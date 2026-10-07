/**
 * Frog Racing Store - live Amazon prices for the Recommended Products page.
 *
 * What it does
 *   - Every hour, asks Amazon's Creators API for the current price, list price,
 *     discount, deal badge and thumbnail of every product on the Recommended page.
 *   - Serves the result as JSON (doGet) so recommended.html can show fresh prices.
 *
 * Setup (once)
 *   1. https://script.google.com -> New project. Paste this whole file in as Code.gs.
 *      (Use a NEW project, separate from the order-logging script.)
 *   2. Project Settings (gear icon) -> Script properties -> Add:
 *        CREDENTIAL_ID       your Creators API Credential ID
 *        CREDENTIAL_SECRET   your Creators API Credential Secret
 *        CREDENTIAL_VERSION  the Version shown with the credential (e.g. 3.1)
 *        PARTNER_TAG         frogracing-20      (optional, this is the default)
 *      The secret lives only here. Never paste it into the code, the repo or a chat.
 *   3. Run `testToken` once (Run button) and approve the permissions prompt.
 *      Check View -> Logs / Executions: it should say the token was obtained.
 *   4. Run `debugOneItem`: logs Amazon's raw answer for one product.
 *   5. Run `refreshPrices` once (takes ~1 minute), then `installHourlyTrigger`.
 *   6. Deploy -> New deployment -> type "Web app" -> Execute as: Me,
 *      Who has access: Anyone -> Deploy. Copy the Web app URL into
 *      RECOMMENDED_LIVE_URL at the top of recommended.js in the store repo.
 *
 * Amazon's rules this is built around: offers (prices) may be cached for at most
 * 1 hour, images and item info for 1 day, so the trigger runs hourly and the page
 * shows when the prices were last refreshed.
 */

var TOKEN_URL_V3 = "https://api.amazon.com/auth/o2/token";
var TOKEN_URL_V2 = "https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token";
var API_URL = "https://creatorsapi.amazon/catalog/v1/getItems";
var MARKETPLACE = "www.amazon.com";
var DATA_URL = "https://store.frogracing.us/recommended-data.js"; // where the product (ASIN) list lives
var BATCH_SIZE = 10; // GetItems limit
var PAUSE_MS = 1200; // stay under the initial 1 request/second limit
var CHUNK = 8000; // Script Properties values are limited to ~9 KB each

// ------------------------------------------------------------------ auth

function prop_(name, fallback) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  return v || fallback;
}

function getToken_(forceNew) {
  var cache = CacheService.getScriptCache();
  if (!forceNew) {
    var cached = cache.get("access_token");
    if (cached) return cached;
  }
  var id = prop_("CREDENTIAL_ID");
  var secret = prop_("CREDENTIAL_SECRET");
  if (!id || !secret) throw new Error("Set CREDENTIAL_ID and CREDENTIAL_SECRET in Project Settings -> Script properties.");

  var version = prop_("CREDENTIAL_VERSION", "3.1");
  var res;
  if (/^2\./.test(version)) {
    // v2.x credentials: Cognito, client id/secret as HTTP Basic auth.
    res = UrlFetchApp.fetch(TOKEN_URL_V2, {
      method: "post",
      headers: { Authorization: "Basic " + Utilities.base64Encode(id + ":" + secret) },
      payload: { grant_type: "client_credentials", scope: "creatorsapi/default" },
      muteHttpExceptions: true,
    });
  } else {
    // v3.x credentials: Login with Amazon.
    res = UrlFetchApp.fetch(TOKEN_URL_V3, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({ grant_type: "client_credentials", client_id: id, client_secret: secret, scope: "creatorsapi::default" }),
      muteHttpExceptions: true,
    });
  }
  if (res.getResponseCode() !== 200) {
    throw new Error("Token request failed (" + res.getResponseCode() + "): " + res.getContentText().slice(0, 300));
  }
  var body = JSON.parse(res.getContentText());
  // Tokens last 1 hour; cache a little less than that.
  cache.put("access_token", body.access_token, Math.min(body.expires_in - 120, 3300));
  return body.access_token;
}

function authHeader_(token) {
  var version = prop_("CREDENTIAL_VERSION", "3.1");
  return /^2\./.test(version) ? "Bearer " + token + ", Version " + version : "Bearer " + token;
}

// ------------------------------------------------------------------ Amazon calls

function getItems_(asins, resources) {
  var payload = JSON.stringify({
    itemIds: asins,
    itemIdType: "ASIN",
    marketplace: MARKETPLACE,
    partnerTag: prop_("PARTNER_TAG", "frogracing-20"),
    resources: resources,
  });
  var token = getToken_(false);
  for (var attempt = 1; attempt <= 4; attempt++) {
    var res = UrlFetchApp.fetch(API_URL, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: authHeader_(token), "x-marketplace": MARKETPLACE },
      payload: payload,
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText());
    if (code === 401 && attempt === 1) {
      token = getToken_(true);
      continue;
    }
    if (code === 429 || code >= 500) {
      Utilities.sleep(2000 * attempt);
      continue;
    }
    throw new Error("GetItems failed (" + code + "): " + res.getContentText().slice(0, 500));
  }
  throw new Error("GetItems kept failing after retries.");
}

var RESOURCES = [
  "images.primary.medium",
  "offersV2.listings.price",
  "offersV2.listings.availability",
  "offersV2.listings.dealDetails",
  "offersV2.listings.isBuyBoxWinner",
];

// ------------------------------------------------------------------ parsing

function amount_(money) {
  return money && typeof money.amount === "number" ? money.amount : null;
}

// Reduce one Amazon item to the compact shape the page uses:
//   p price, l list price, d percent off, b deal ("pbd" | "ltd"), i image id, u unavailable
function parseItem_(item) {
  var out = { p: null, l: null, d: 0, b: "", i: null, u: 0 };

  var url = item.images && item.images.primary && item.images.primary.medium && item.images.primary.medium.url;
  var m = url && url.match(/\/images\/I\/([^._\/][^\/]*?)\./);
  if (m) out.i = m[1];

  var listings = (item.offersV2 && item.offersV2.listings) || [];
  var listing = null;
  for (var k = 0; k < listings.length; k++) {
    if (listings[k].isBuyBoxWinner) listing = listings[k];
  }
  if (!listing && listings.length) listing = listings[0];
  if (!listing) {
    out.u = 1;
    return out;
  }

  var price = listing.price || {};
  out.p = amount_(price.money);
  var basis = price.savingBasis && amount_(price.savingBasis.money);
  if (basis && out.p != null && basis > out.p) out.l = basis;
  var pct = price.savings && price.savings.percentage;
  out.d = out.l ? Math.round(pct || (1 - out.p / out.l) * 100) : 0;

  var deal = listing.dealDetails;
  var badge = deal && (deal.badge || deal.accessType || "");
  if (badge) out.b = /prime big deal/i.test(badge) ? "pbd" : "ltd";
  if (out.p == null) out.u = 1;
  return out;
}

// ------------------------------------------------------------------ the product list

function loadAsins_() {
  var res = UrlFetchApp.fetch(DATA_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error("Could not read " + DATA_URL + " (" + res.getResponseCode() + ")");
  var seen = {};
  var list = [];
  var re = /"asin":"([A-Z0-9]{10})"/g;
  var m;
  var text = res.getContentText();
  while ((m = re.exec(text))) {
    if (!seen[m[1]]) {
      seen[m[1]] = true;
      list.push(m[1]);
    }
  }
  return list;
}

// ------------------------------------------------------------------ storage

function save_(items) {
  var props = PropertiesService.getScriptProperties();
  var json = JSON.stringify(items);
  var parts = Math.ceil(json.length / CHUNK);
  for (var n = 0; n < parts; n++) props.setProperty("data_" + n, json.substr(n * CHUNK, CHUNK));
  props.setProperty("data_parts", String(parts));
  props.setProperty("updated_at", new Date().toISOString());
  CacheService.getScriptCache().remove("response");
}

function load_() {
  var props = PropertiesService.getScriptProperties();
  var parts = parseInt(props.getProperty("data_parts") || "0", 10);
  var json = "";
  for (var n = 0; n < parts; n++) json += props.getProperty("data_" + n) || "";
  return { updatedAt: props.getProperty("updated_at"), items: json ? JSON.parse(json) : {} };
}

// ------------------------------------------------------------------ entry points

/** Hourly job (see installHourlyTrigger). Keeps the previous data if Amazon fails part way. */
function refreshPrices() {
  var asins = loadAsins_();
  if (!asins.length) throw new Error("No ASINs found at " + DATA_URL + " - has recommended-data.js been pushed?");
  var previous = load_().items;
  var items = {};
  var failed = 0;

  for (var start = 0; start < asins.length; start += BATCH_SIZE) {
    var batch = asins.slice(start, start + BATCH_SIZE);
    var data;
    try {
      data = getItems_(batch, RESOURCES);
    } catch (err) {
      console.error("Batch starting at " + start + " failed: " + err);
      failed += batch.length;
      batch.forEach(function (a) {
        if (previous[a]) items[a] = previous[a];
      });
      Utilities.sleep(PAUSE_MS);
      continue;
    }
    var found = {};
    var results = (data.itemsResult && data.itemsResult.items) || [];
    results.forEach(function (it) {
      found[it.asin] = true;
      items[it.asin] = parseItem_(it);
    });
    batch.forEach(function (a) {
      if (!found[a]) items[a] = previous[a] || { p: null, l: null, d: 0, b: "", i: null, u: 1 };
    });
    Utilities.sleep(PAUSE_MS);
  }

  if (failed >= asins.length) throw new Error("Every batch failed; keeping the previous data.");
  save_(items);
  console.log("Refreshed " + Object.keys(items).length + " products (" + failed + " carried over from the previous run).");
}

/** Web app: returns { updatedAt, items: { ASIN: {...} } } as JSON. */
function doGet() {
  var cache = CacheService.getScriptCache();
  var body = cache.get("response");
  if (!body) {
    body = JSON.stringify(load_());
    if (body.length < 95000) cache.put("response", body, 300);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------------ setup helpers

function testToken() {
  var token = getToken_(true);
  console.log("OK - obtained an access token (" + token.length + " characters).");
}

/** Logs Amazon's raw answer for one product so the field names can be checked. */
function debugOneItem() {
  var data = getItems_(["B000CO7XEU"], RESOURCES);
  console.log(JSON.stringify(data, null, 2));
  var item = data.itemsResult && data.itemsResult.items && data.itemsResult.items[0];
  if (item) console.log("Parsed: " + JSON.stringify(parseItem_(item)));
}

function installHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "refreshPrices") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("refreshPrices").timeBased().everyHours(1).create();
  console.log("Hourly trigger installed.");
}
