#!/usr/bin/env node
// Suggests which recommended-list rows each video could belong to, by comparing the words in the
// video's title with the words in each product's name. It only SUGGESTS: the matches that are used
// live in recommended-videos.json, which is curated by hand.
//
//   node match-videos.js [minScore]      (default 5)
const fs = require("fs");
const path = require("path");

const videos = JSON.parse(fs.readFileSync(path.join(__dirname, "cache", "videos-raw.json"), "utf8")).filter((v) => /frog racing/i.test(v.author || ""));
const list = JSON.parse(fs.readFileSync(path.join(__dirname, "recommended-list.json"), "utf8"));
const PRODUCTS = require("vm").runInNewContext(fs.readFileSync(path.join(__dirname, "..", "products.js"), "utf8") + ";PRODUCTS");

const STOP = new Set("the and for with from your this that how what which are was into over under about video part new old all any can not our their its you vs of on in to a an by at as or is it be installation install replacement replace review frog racing rally car cars subaru audi jeep set kit pack piece pcs inch".split(" "));
const tok = (s) => (s.toLowerCase().replace(/[^a-z0-9+.\-\s]/g, " ").split(/\s+/).map((t) => t.replace(/^[.\-]+|[.\-]+$/g, "")).filter((t) => t.length >= 3 && !STOP.has(t)));

// one entry per distinct product key (asin, url or store id), keeping every row's text
const rows = new Map();
for (const s of list.sections) for (const ss of s.subsections) for (const it of ss.items) {
  if (it.note !== undefined) continue;
  const key = it.store ? "store:" + it.store : it.asin || it.url;
  const text = it.store ? (PRODUCTS.find((p) => p.id === it.store) || {}).name || it.store : it.name;
  if (!rows.has(key)) rows.set(key, { key, names: new Set(), where: new Set() });
  rows.get(key).names.add(text);
  rows.get(key).where.add(`${s.name} > ${ss.name || "-"}`);
}
const entries = [...rows.values()].map((r) => ({ ...r, tokens: new Set(tok([...r.names].join(" "))) }));

// idf over products + video titles so common words ("tool", "sensor") count less than rare ones
const df = new Map();
const docs = [...entries.map((e) => e.tokens), ...videos.map((v) => new Set(tok(v.title)))];
for (const d of docs) for (const t of d) df.set(t, (df.get(t) || 0) + 1);
const idf = (t) => Math.log(1 + docs.length / (df.get(t) || 1));

const min = parseFloat(process.argv[2] || "5");
const out = [];
for (const v of videos) {
  const vt = new Set(tok(v.title + " " + v.pages.map((p) => p.heading).join(" ")));
  const cand = entries
    .map((e) => {
      const shared = [...e.tokens].filter((t) => vt.has(t));
      return { key: e.key, name: [...e.names][0], where: [...e.where][0], score: shared.reduce((a, t) => a + idf(t), 0), shared };
    })
    .filter((c) => c.score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  out.push({ id: v.id, title: v.title, candidates: cand });
}
fs.writeFileSync(path.join(__dirname, "cache", "video-candidates.json"), JSON.stringify(out, null, 1));
const withC = out.filter((o) => o.candidates.length);
console.log(`${videos.length} Frog Racing videos; ${withC.length} have at least one candidate (score >= ${min}); ${entries.length} distinct products`);
for (const o of withC) {
  console.log(`\n${o.id} | ${o.title.slice(0, 80)}`);
  for (const c of o.candidates) console.log(`   ${c.score.toFixed(1).padStart(5)}  ${c.name.slice(0, 62)}  [${c.where}]  <${c.shared.join(",")}>  ${c.key}`);
}
