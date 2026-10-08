#!/usr/bin/env node
// Rebuilds ../recommended-data.js, the data behind recommended.html.
//
//   1. Reads the list from recommended-list.json (categories -> sub-categories -> items).
//      That file is the source of truth: it was copied from the old Google Sites page,
//      which now just points to this store, so add and edit recommendations there.
//   2. Resolves any new amzn.to affiliate short link to its Amazon ASIN, and labels
//      other links with their vendor. Resolved values are written back to the list.
//   3. Merges the Amazon price / list price / coupon / thumbnail for each ASIN from
//      cache/products.json.
//
// Amazon answers scripted requests (node, curl) with a captcha, so step 3's input is
// collected from a real browser session instead - see amazon-scrape.js - and the live
// prices come from google-apps-script-prices.gs. Items without an entry simply show
// "See price on Amazon".
//
// Usage (from this folder):
//   node build-recommended.js           rebuild ../recommended-data.js
//   node build-recommended.js --asins   also print the ASIN list for amazon-scrape.js

const fs = require("fs");
const path = require("path");

const LIST_FILE = path.join(__dirname, "recommended-list.json");
const OUT_FILE = path.join(__dirname, "..", "recommended-data.js");
const CACHE_DIR = path.join(__dirname, "cache");
const PRODUCT_CACHE = path.join(CACHE_DIR, "products.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readJson = (file, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return fallback;
  }
};

const isAmazon = (href) => /^https:\/\/(amzn\.to\/|www\.amazon\.com\/)/.test(href);

function vendorOf(href) {
  const host = new URL(href).hostname.replace(/^www\./, "");
  if (/tkqlhce|dpbolvw|jdoqocy|anrdoezrs|kqzyfj/.test(host)) return "Tire Rack";
  const known = {
    "rally.build": "Rally.Build",
    "bleedingtarmac.com": "Bleeding Tarmac",
    "get-primitive.com": "Primitive",
    "fercomp.com": "Fercomp",
    "jhmotorsports.com": "JHM Motorsports",
  };
  return known[host] || host;
}

// amzn.to short link -> ASIN (follows the redirect chain by hand; no Amazon page is loaded).
async function resolveAsin(link) {
  let url = link;
  for (let hop = 0; hop < 4; hop++) {
    const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (m) return m[1];
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA } });
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).toString();
  }
  return null;
}

async function main() {
  const list = readJson(LIST_FILE, null);
  // An unreadable or truncated list must never replace the data file.
  if (!list || !Array.isArray(list.sections) || list.sections.length < 10) {
    throw new Error(`${path.basename(LIST_FILE)} is missing or has too few categories. Nothing was written.`);
  }
  const sections = list.sections;

  // Fill in what a newly added item needs (asin for Amazon links, vendor for the rest).
  let resolved = 0;
  for (const s of sections) {
    for (const ss of s.subsections) {
      for (const it of ss.items) {
        if (it.note !== undefined || it.asin || it.vendor) continue;
        if (!it.url) throw new Error(`Item "${it.name}" in "${s.name}" has no url.`);
        if (isAmazon(it.url)) {
          it.asin = (await resolveAsin(it.url)) || undefined;
          if (!it.asin) it.vendor = "Amazon list"; // a storefront / idea list, not one product
          resolved++;
          await sleep(150);
        } else {
          it.vendor = vendorOf(it.url);
        }
      }
    }
  }
  if (resolved) console.log(`Resolved ${resolved} new Amazon link(s).`);
  fs.writeFileSync(LIST_FILE, JSON.stringify(list, null, 1) + "\n"); // keep resolved asin/vendor

  const asins = [...new Set(sections.flatMap((s) => s.subsections.flatMap((ss) => ss.items.map((i) => i.asin).filter(Boolean))))];
  const total = sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.items.filter((i) => i.note === undefined).length, 0), 0);
  console.log(`${sections.length} categories, ${total} items, ${asins.length} unique Amazon products`);
  if (process.argv.includes("--asins")) console.log(asins.join(","));

  // Amazon details collected from a browser session (see amazon-scrape.js).
  const cache = readJson(PRODUCT_CACHE, { checkedAt: null, products: {} });
  const products = cache.products || {};
  let priced = 0;
  let missing = 0;
  const out = sections.map((s) => ({
    ...s,
    subsections: s.subsections.map((ss) => ({
      ...ss,
      items: ss.items.map((it) => {
        const item = { ...it };
        if (!item.asin) return item;
        const p = products[item.asin];
        if (!p || p.e) {
          missing++;
          return item;
        }
        if (p.p != null) {
          item.price = p.p;
          priced++;
        }
        if (p.l) item.was = p.l;
        if (p.d) item.pct = p.d;
        if (p.c) item.coupon = p.c;
        if (p.b) item.deal = p.b;
        if (p.i) item.img = p.i;
        if (p.u) item.unavailable = true;
        return item;
      }),
    })),
  }));
  console.log(`${priced} items priced, ${missing} items with no Amazon data`);

  const body = JSON.stringify(out, (k, v) => (v === null || v === undefined ? undefined : v));
  const checked = cache.checkedAt || new Date().toISOString();
  fs.writeFileSync(
    OUT_FILE,
    "// GENERATED by tools/build-recommended.js from tools/recommended-list.json - do not edit by hand.\n" +
      `const RECOMMENDED_CHECKED = ${JSON.stringify(checked)};\n` +
      `const RECOMMENDED = ${body};\n`
  );
  console.log("Wrote", OUT_FILE, `(${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
