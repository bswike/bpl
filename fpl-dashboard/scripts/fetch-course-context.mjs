// Adds course-level context to a baked course file: cart paths and wooded
// areas from OpenStreetMap, stored under `context` so the per-hole `features`
// (and the game's terrain rules) are untouched. Usage:
//   node scripts/fetch-course-context.mjs black-bear
import { readFile, writeFile } from "node:fs/promises";

const slug = process.argv[2] || "black-bear";
const file = new URL(`../public/data/${slug}.json`, import.meta.url);
const course = JSON.parse(await readFile(file, "utf8"));
const lats = course.holes.flatMap((h) => h.line.map((p) => p[0]));
const lngs = course.holes.flatMap((h) => h.line.map((p) => p[1]));
const pad = 0.004;
const bbox = `${Math.min(...lats) - pad},${Math.min(...lngs) - pad},${Math.max(...lats) + pad},${Math.max(...lngs) + pad}`;
const query = `[out:json][timeout:60];(way["golf"="cartpath"](${bbox});way["natural"="wood"](${bbox});relation["natural"="wood"](${bbox});way["landuse"="forest"](${bbox}););out geom;`;
const mirrors = ["https://overpass.kumi.systems/api/interpreter", "https://overpass-api.de/api/interpreter"];
let data = null;
for (const url of mirrors) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "User-Agent": "swikle-golf-course-baker/1.0" }, body: `data=${encodeURIComponent(query)}` });
    if (res.ok) {
      data = await res.json();
      break;
    }
  } catch {
    // try the next mirror
  }
}
if (!data) throw new Error("Overpass unavailable");
const paths = [];
const woods = [];
for (const el of data.elements) {
  if (el.type === "way" && el.tags?.golf === "cartpath" && el.geometry) paths.push(el.geometry.map((g) => [g.lat, g.lon]));
  else if (el.type === "way" && (el.tags?.natural === "wood" || el.tags?.landuse === "forest") && el.geometry) {
    const ring = el.geometry.map((g) => [g.lat, g.lon]);
    if (ring.length >= 3) woods.push(ring);
  } else if (el.type === "relation" && el.tags?.natural === "wood") {
    for (const m of el.members || []) if (m.role === "outer" && m.geometry?.length >= 3) woods.push(m.geometry.map((g) => [g.lat, g.lon]));
  }
}
course.context = { source: `OpenStreetMap (ODbL) via Overpass, fetched ${new Date().toISOString().slice(0, 10)}`, paths, woods };
await writeFile(file, JSON.stringify(course));
console.log(`${slug}: ${paths.length} cart paths (${paths.reduce((s, p) => s + p.length, 0)} pts), ${woods.length} wooded areas (${woods.reduce((s, w) => s + w.length, 0)} pts)`);
