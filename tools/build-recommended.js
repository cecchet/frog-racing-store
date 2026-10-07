#!/usr/bin/env node
// Rebuilds ../recommended-data.js, the data behind the "Recommended Products"
// section of the store.
//
//   1. Fetches the live list from the old Google Sites page and parses it into
//      categories -> sub-categories -> items.
//   2. Resolves each amzn.to affiliate short link to its Amazon ASIN.
//   3. Merges the Amazon price / list price / coupon / thumbnail for each ASIN
//      from cache/products.json.
//
// Amazon answers scripted requests (node, curl) with a captcha, so step 3's input
// is collected from a real browser session instead - see amazon-scrape.js for the
// snippet that produces cache/products.json. Items without an entry there simply
// show "See price on Amazon".
//
// Usage (from this folder, after `npm install`):
//   node build-recommended.js           rebuild ../recommended-data.js
//   node build-recommended.js --asins   also print the ASIN list for amazon-scrape.js

const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const PAGE_URL = "https://www.frogracing.us/store/recommended-products";
const OUT_FILE = path.join(__dirname, "..", "recommended-data.js");
const CACHE_DIR = path.join(__dirname, "cache");
const ASIN_CACHE = path.join(CACHE_DIR, "asin.json");
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

// ---------------------------------------------------------------- stage 1: parse

const clean = (s) => s.replace(/\s+/g, " ").trim();

// Google Sites wraps outbound links in google.com/url?q=...
function unwrap(href) {
  try {
    const u = new URL(href);
    if (u.hostname.endsWith("google.com") && u.pathname === "/url") return u.searchParams.get("q") || href;
  } catch (e) {}
  return href;
}

const isFrogSite = (href) => /(^|\.)frogracing\.us/.test(new URL(href, "https://x.invalid").hostname);
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

// The page text reads "Some product: https://amzn.to/xyz (comment)"; drop the URL
// and the punctuation it leaves behind.
function labelFrom(text) {
  return clean(text.replace(/https?:\/\/\S+/g, ""))
    .replace(/:\s+(?=[(\[])/g, " ")
    .replace(/[\s:\-–.]+$/, "");
}

// Turn the page's flat run of headings/paragraphs into an ordered entry list.
function readEntries(html) {
  const $ = cheerio.load(html);
  const entries = [];
  $("h2, h3, p").each((_, el) => {
    const $el = $(el);
    if ($el.closest("header, nav, footer").length) return;
    const text = clean($el.text());
    if (!text) return;
    const hrefs = [];
    $el.find("a[href]").each((__, a) => {
      const h = unwrap($(a).attr("href"));
      if (/^https?:/.test(h) && !hrefs.includes(h)) hrefs.push(h);
    });
    // A few lines hold a bare amzn.to URL that was never turned into a hyperlink.
    for (const m of text.matchAll(/https:\/\/amzn\.to\/\w+/g)) if (!hrefs.includes(m[0])) hrefs.push(m[0]);
    entries.push({ tag: el.tagName.toLowerCase(), label: labelFrom(text), hrefs });
  });
  return entries;
}

// Group the entries into sections / sub-sections / groups.
function parseSections(entries) {
  const sections = [];
  let sec = null;
  let sub = null;
  let grp = null;

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const external = e.hrefs.filter((h) => !isFrogSite(h));
    const internal = e.hrefs.filter(isFrogSite);

    if (e.tag === "h2") {
      sec = { name: e.label, link: external.find(isAmazon) || null, subsections: [] };
      sections.push(sec);
      sub = null;
      grp = null;
      continue;
    }
    if (!sec) continue; // intro text before the first category
    const ensureSub = () => {
      if (!sub) {
        sub = { name: "", link: null, items: [] };
        sec.subsections.push(sub);
      }
      return sub;
    };

    if (e.tag === "h3") {
      sub = { name: e.label, link: external.find(isAmazon) || null, items: [] };
      sec.subsections.push(sub);
      grp = null;
      continue;
    }

    if (external.length) {
      ensureSub().items.push({ name: e.label, group: grp, links: external });
      continue;
    }

    // Plain text: either a heading for the items that follow, or a free-standing note.
    const next = entries[i + 1];
    const nextIsItem = next && next.tag === "p" && next.hrefs.some((h) => !isFrogSite(h));
    const looksLikeHeading = nextIsItem && !internal.length && e.label.length <= 60 && !/[.!]$/.test(e.label);
    if (looksLikeHeading) {
      grp = e.label;
    } else {
      ensureSub().items.push({ note: e.label, href: internal[0] || null, group: grp });
    }
  }

  // Merge runs of consecutive short notes ("Part numbers:", "Bolt: ...", "Nut: ...") into one.
  for (const s of sections) {
    for (const ss of s.subsections) {
      const merged = [];
      for (const it of ss.items) {
        const prev = merged[merged.length - 1];
        if (it.note && prev && prev.note && !it.href && !prev.href && it.group === prev.group) {
          prev.note += (/:$/.test(prev.note) ? " " : " · ") + it.note;
        } else merged.push(it);
      }
      ss.items = merged;
    }
    s.subsections = s.subsections.filter((ss) => ss.items.length || ss.link);
  }
  return sections.filter((s) => s.subsections.length);
}

// ------------------------------------------------------- stage 2: short link -> ASIN

async function resolveAsin(link, cache) {
  if (cache[link]) return cache[link];
  let url = link;
  for (let hop = 0; hop < 4; hop++) {
    const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
    if (m) {
      cache[link] = m[1];
      return m[1];
    }
    const res = await fetch(url, { redirect: "manual", headers: { "User-Agent": UA } });
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).toString();
  }
  return null;
}

// ------------------------------------------------------------------------- main

async function main() {
  console.log("Fetching", PAGE_URL);
  const html = await (await fetch(PAGE_URL, { headers: { "User-Agent": UA } })).text();
  const sections = parseSections(readEntries(html));

  const asinCache = readJson(ASIN_CACHE, {});
  let resolved = 0;
  for (const s of sections) {
    for (const ss of s.subsections) {
      for (const it of ss.items) {
        if (!it.links) continue;
        const amazon = it.links.find(isAmazon);
        if (amazon) {
          it.url = amazon;
          const known = !!asinCache[amazon];
          it.asin = (await resolveAsin(amazon, asinCache)) || undefined;
          // A storefront / idea-list link rather than a single product.
          if (!it.asin) it.vendor = "Amazon list";
          if (!known) {
            await sleep(150);
            if (++resolved % 50 === 0) console.log(`  resolved ${resolved} new links`);
          }
        } else {
          it.url = it.links[0];
          it.vendor = vendorOf(it.links[0]);
        }
        delete it.links;
      }
    }
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(ASIN_CACHE, JSON.stringify(asinCache));

  const asins = [...new Set(sections.flatMap((s) => s.subsections.flatMap((ss) => ss.items.map((i) => i.asin).filter(Boolean))))];
  const total = sections.reduce((a, s) => a + s.subsections.reduce((b, ss) => b + ss.items.filter((i) => !i.note).length, 0), 0);
  console.log(`${sections.length} categories, ${total} items, ${asins.length} unique Amazon products`);
  if (process.argv.includes("--asins")) console.log(asins.join(","));

  // Amazon details collected from a browser session (see amazon-scrape.js).
  const cache = readJson(PRODUCT_CACHE, { checkedAt: null, products: {} });
  const products = cache.products || {};
  let priced = 0;
  let missing = 0;
  for (const s of sections) {
    for (const ss of s.subsections) {
      for (const it of ss.items) {
        if (!it.asin) continue;
        const p = products[it.asin];
        if (!p || p.e) {
          missing++;
          continue;
        }
        if (p.p != null) {
          it.price = p.p;
          priced++;
        }
        if (p.l) it.was = p.l;
        if (p.d) it.pct = p.d;
        if (p.c) it.coupon = p.c;
        if (p.b) it.deal = p.b;
        if (p.i) it.img = p.i;
        if (p.u) it.unavailable = true;
        if (!it.name && p.t) it.name = p.t;
      }
    }
  }
  console.log(`${priced} items priced, ${missing} items with no Amazon data`);

  const body = JSON.stringify(sections, (k, v) => (v === null || v === undefined ? undefined : v));
  const checked = cache.checkedAt || new Date().toISOString();
  fs.writeFileSync(
    OUT_FILE,
    "// GENERATED by tools/build-recommended.js - do not edit by hand.\n" +
      `// Source list: ${PAGE_URL}\n` +
      `const RECOMMENDED_CHECKED = ${JSON.stringify(checked)};\n` +
      `const RECOMMENDED = ${body};\n`
  );
  console.log("Wrote", OUT_FILE, `(${(fs.statSync(OUT_FILE).size / 1024).toFixed(0)} KB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
