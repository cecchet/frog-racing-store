#!/usr/bin/env node
// Collects the YouTube videos linked or embedded on the frogracing.us /tech pages, with their titles
// (YouTube's public oEmbed endpoint), and writes cache/videos-raw.json for matching to products.
//
//   node find-videos.js
//
// Output: [{ id, title, author, pages: [{ page, heading }] }]
const fs = require("fs");
const path = require("path");

const SITE = "https://www.frogracing.us";
const PAGES = [
  "/tech/tools", "/tech/car-maintenance/subaru-maintenance", "/tech/car-maintenance/rs4-maintenance",
  "/tech/car-maintenance/jeep-maintenance", "/tech/rally-car-prep/engine-prep", "/tech/scrutineering-rules",
  "/tech/rollcage", "/tech/safety-gear", "/tech/harness-installation", "/tech/seat-installation",
  "/tech/kill-switch", "/tech/fire-suppression", "/tech/rally-car-prep/building-a-rally-car",
  "/tech/rally-car-prep/buying-a-used-rally-car", "/tech/rally-car-prep/rallysafe", "/tech/rally-car-prep/pit-crew",
  "/tech/rally-service-crew", "/tech/rally-time-cards", "/tech/car-maintenance/samsonas-suspension",
  "/tech/car-maintenance/dms-suspension", "/tech/towing-trailer", "/tech/wheels-tires", "/tech/on-board-cameras",
  "/tech/telemetry", "/tech/3d-printing", "/tech/passtech",
];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

// YouTube ids in all the forms a Google Sites page can contain (links, embeds, redirect-wrapped links)
const ID_PATTERNS = [
  /youtu\.be\/([A-Za-z0-9_-]{11})/g,
  /youtube(?:-nocookie)?\.com\/embed\/([A-Za-z0-9_-]{11})/g,
  /youtube\.com\/watch\?(?:[^"'\s<>]*?&(?:amp;)?)?v=([A-Za-z0-9_-]{11})/g,
  /youtube\.com%2Fwatch%3Fv%3D([A-Za-z0-9_-]{11})/g,
  /youtu\.be%2F([A-Za-z0-9_-]{11})/g,
  /youtube\.com%2Fembed%2F([A-Za-z0-9_-]{11})/g,
];

async function main() {
  const videos = new Map();
  for (const p of PAGES) {
    let html;
    try {
      const res = await fetch(SITE + p, { headers: { "User-Agent": UA } });
      if (!res.ok) { console.log(`${p}: HTTP ${res.status}`); continue; }
      html = await res.text();
    } catch (e) { console.log(`${p}: ${e.message}`); continue; }
    const found = [];
    for (const re of ID_PATTERNS) for (const m of html.matchAll(re)) found.push({ id: m[1], at: m.index });
    found.sort((a, b) => a.at - b.at);
    const seen = new Set();
    let count = 0;
    for (const f of found) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      // nearest heading before the video on this page
      const before = html.slice(Math.max(0, f.at - 6000), f.at);
      const heads = [...before.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/g)].map((h) => strip(h[1])).filter(Boolean);
      const heading = heads.length ? heads[heads.length - 1] : "";
      if (!videos.has(f.id)) videos.set(f.id, { id: f.id, pages: [] });
      videos.get(f.id).pages.push({ page: p, heading });
      count++;
    }
    console.log(`${p}: ${count} video(s)`);
    await sleep(500);
  }

  // titles
  let n = 0;
  for (const v of videos.values()) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + v.id)}&format=json`, { headers: { "User-Agent": UA } });
      if (r.ok) { const j = await r.json(); v.title = j.title; v.author = j.author_name; } else { v.title = null; v.status = r.status; }
    } catch (e) { v.title = null; }
    if (++n % 20 === 0) console.log("  titles", n);
    await sleep(150);
  }
  fs.mkdirSync(path.join(__dirname, "cache"), { recursive: true });
  fs.writeFileSync(path.join(__dirname, "cache", "videos-raw.json"), JSON.stringify([...videos.values()], null, 1));
  console.log(`${videos.size} distinct videos; ${[...videos.values()].filter((v) => v.title).length} with titles`);
}
main().catch((e) => { console.error(e); process.exit(1); });
