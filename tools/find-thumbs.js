#!/usr/bin/env node
// Finds a thumbnail for the recommended-list rows that link to a vendor page (not Amazon, not an
// affiliate click-tracking redirect): reads each page's preview image (og:image, the one the
// site itself offers for sharing) and downloads it next to the other store images.
//
//   node find-thumbs.js            report what it would use for every row without a `thumb`
//   node find-thumbs.js --download save the images to ../images/recommended/ (raw, as served)
//
// A page that refuses the request (403, captcha, ...) is skipped - nothing tries to get past it.
// Resize/convert the downloaded files afterwards (see the repo notes) and set `thumb` in
// recommended-list.json.

const fs = require("fs");
const path = require("path");

const LIST_FILE = path.join(__dirname, "recommended-list.json");
const OUT_DIR = path.join(__dirname, "cache", "thumbs-raw");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const CLICK_TRACKERS = /tkqlhce|dpbolvw|jdoqocy|anrdoezrs|kqzyfj|amzn\.to|amazon\./; // never opened: they register clicks / are Amazon

const download = process.argv.includes("--download");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#0?38;/g, "&").replace(/&quot;/g, '"');

function metaImage(html, base) {
  const pick = (re) => (html.match(re) || [])[1];
  let url =
    pick(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i) ||
    pick(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  if (!url) {
    // other places a page declares its main picture: <link rel="image_src">, itemprop="image",
    // and schema.org JSON-LD (string, array or {url})
    url =
      pick(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<img[^>]+itemprop=["']image["'][^>]+src=["']([^"']+)["']/i);
  }
  if (!url) {
    for (const block of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const walk = (o) => {
          if (!o || typeof o !== "object") return null;
          if (o.image) {
            const im = Array.isArray(o.image) ? o.image[0] : o.image;
            const u = typeof im === "string" ? im : im && im.url;
            if (u && /\.(jpe?g|png|webp)/i.test(u)) return u;
          }
          for (const v of Object.values(o)) {
            const r = walk(v);
            if (r) return r;
          }
          return null;
        };
        url = walk(JSON.parse(block[1]));
        if (url) break;
      } catch (e) {}
    }
  }
  return url ? new URL(decode(url), base).toString() : null;
}

async function main() {
  const list = JSON.parse(fs.readFileSync(LIST_FILE, "utf8"));
  const byUrl = new Map();
  for (const s of list.sections)
    for (const ss of s.subsections)
      for (const it of ss.items) {
        if (it.note !== undefined || it.store || it.asin || it.thumb || !it.url) continue;
        // `thumbPage` names the page whose photo to use when the row's own link can't be opened
        // (affiliate click-tracking links); otherwise the row's own page is used.
        const page = it.thumbPage || it.url;
        if (!it.thumbPage && CLICK_TRACKERS.test(it.url)) continue;
        if (!byUrl.has(page)) byUrl.set(page, []);
        byUrl.get(page).push(it.name);
      }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const found = {};
  const sourcesFile = path.join(__dirname, "thumb-sources.json");
  const sources = fs.existsSync(sourcesFile) ? JSON.parse(fs.readFileSync(sourcesFile, "utf8")) : {};
  for (const [url, names] of byUrl) {
    let note = "";
    if ((sources.skip || []).includes(url)) {
      console.log(`${url.replace("https://", "").slice(0, 70).padEnd(70)} | ${names[0].slice(0, 28).padEnd(28)} | skipped (thumb-sources.json)`);
      continue;
    }
    if (sources.pages && sources.pages[url]) {
      found[url] = sources.pages[url];
      console.log(`${url.replace("https://", "").slice(0, 70).padEnd(70)} | ${names[0].slice(0, 28).padEnd(28)} | ${sources.pages[url].slice(0, 90)} (thumb-sources.json)`);
      continue;
    }
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
      const html = await res.text();
      if (!res.ok) note = `HTTP ${res.status}`;
      else if (/captcha|are you a robot|access denied|attention required/i.test(html.slice(0, 4000))) note = "bot check - skipped";
      else {
        const img = metaImage(html, res.url);
        if (!img) note = "no preview image";
        else {
          found[url] = img;
          note = img;
        }
      }
    } catch (e) {
      note = "error: " + e.message;
    }
    console.log(`${url.replace("https://", "").slice(0, 70).padEnd(70)} | ${names[0].slice(0, 28).padEnd(28)} | ${note}`);
    await sleep(1200);
  }

  if (download) {
    for (const [url, img] of Object.entries(found)) {
      const key = require("crypto").createHash("sha1").update(url).digest("hex").slice(0, 12);
      const res = await fetch(img, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.log("  could not download", img, res.status);
        continue;
      }
      const type = res.headers.get("content-type") || "";
      const ext = /png/.test(type) ? "png" : /webp/.test(type) ? "webp" : /gif/.test(type) ? "gif" : "jpg";
      fs.writeFileSync(path.join(OUT_DIR, `${key}.${ext}`), Buffer.from(await res.arrayBuffer()));
      found[url] = { img, file: `${key}.${ext}`, type };
      await sleep(400);
    }
    fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(found, null, 1));
    console.log("saved", Object.keys(found).length, "images to", OUT_DIR);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
