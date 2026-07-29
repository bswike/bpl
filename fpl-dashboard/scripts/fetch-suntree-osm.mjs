// One-shot script: pulls Suntree Country Club golf features from OpenStreetMap
// (Overpass API), assigns each feature to its nearest hole, filters to the
// Challenge course, and writes public/data/suntree-challenge.json.
//
// Usage: node scripts/fetch-suntree-osm.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(join(__dirname, "..", "public", "data", "suntree-challenge.json"));

// Suntree Country Club bounding box (from Nominatim relation 1230389)
const BBOX = "28.2023,-80.6968,28.2299,-80.6795";

const QUERY = `
[out:json][timeout:60];
(
  way["golf"](${BBOX});
  node["golf"](${BBOX});
  relation["golf"](${BBOX});
  relation(1230389);
);
out geom;
`;

// --- tiny geo helpers (equirectangular approx, fine at course scale) ---
const M_PER_DEG_LAT = 111320;
const mPerDegLng = (lat) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function distMeters(a, b) {
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  const dx = (a.lon - b.lon) * mPerDegLng((a.lat + b.lat) / 2);
  return Math.hypot(dx, dy);
}

// distance from point p to segment [a, b]
function pointToSegment(p, a, b) {
  const scale = mPerDegLng((a.lat + b.lat) / 2);
  const ax = a.lon * scale, ay = a.lat * M_PER_DEG_LAT;
  const bx = b.lon * scale, by = b.lat * M_PER_DEG_LAT;
  const px = p.lon * scale, py = p.lat * M_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distToPolyline(p, coords) {
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) {
    best = Math.min(best, pointToSegment(p, coords[i], coords[i + 1]));
  }
  return best;
}

function centroid(coords) {
  let lat = 0, lon = 0;
  for (const c of coords) { lat += c.lat; lon += c.lon; }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

function lineLengthMeters(coords) {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) total += distMeters(coords[i], coords[i + 1]);
  return total;
}

// --- fetch ---
console.log("Querying Overpass...");
const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "User-Agent": "swikle-golf-course-viewer/1.0 (one-time data bake)",
  },
  body: "data=" + encodeURIComponent(QUERY),
});
if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
const data = await res.json();
console.log(`Got ${data.elements.length} elements`);

const ways = data.elements.filter((e) => e.type === "way" && e.geometry);
const nodes = data.elements.filter((e) => e.type === "node");

// --- holes ---
const allHoles = ways
  .filter((w) => w.tags.golf === "hole" && w.tags.ref)
  .map((w) => {
    const m = w.tags.ref.match(/^(Challenge|Classic)\s+(\d+)$/);
    return m && {
      course: m[1],
      num: Number(m[2]),
      par: Number(w.tags.par),
      hcp: Number(w.tags.handicap) || null,
      line: w.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
    };
  })
  .filter(Boolean);

// assign a point to its nearest hole (across both courses, so shared/adjacent
// Classic features don't get misattributed to Challenge)
function nearestHole(p) {
  let best = null, bestDist = Infinity;
  for (const h of allHoles) {
    const d = distToPolyline(p, h.line);
    if (d < bestDist) { bestDist = d; best = h; }
  }
  return { hole: best, dist: bestDist };
}

const FEATURE_TYPES = new Set(["fairway", "green", "tee", "bunker", "water_hazard", "lateral_water_hazard"]);
const MAX_ASSIGN_DIST = 150; // meters from hole line

const features = [];
for (const w of ways) {
  const golf = w.tags.golf;
  if (!FEATURE_TYPES.has(golf)) continue;
  const coords = w.geometry.map((g) => ({ lat: g.lat, lon: g.lon }));
  const { hole, dist } = nearestHole(centroid(coords));
  if (!hole || hole.course !== "Challenge" || dist > MAX_ASSIGN_DIST) continue;
  features.push({
    type: golf.includes("water_hazard") ? "water" : golf,
    hole: hole.num,
    coords: coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))]),
  });
}

// golf features mapped as multipolygon relations (most Suntree fairways!)
for (const rel of data.elements) {
  if (rel.type !== "relation" || !rel.tags?.golf || !rel.members) continue;
  const golf = rel.tags.golf;
  if (!FEATURE_TYPES.has(golf)) continue;
  for (const ring of stitchOuterRings(rel)) {
    if (ring.length < 4) continue;
    const coords = ring.map(([lat, lon]) => ({ lat, lon }));
    const { hole, dist } = nearestHole(centroid(coords));
    if (!hole || hole.course !== "Challenge" || dist > MAX_ASSIGN_DIST) continue;
    features.push({
      type: golf.includes("water_hazard") ? "water" : golf,
      hole: hole.num,
      coords: coords.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))]),
    });
  }
}

// pins (green node markers)
const pins = [];
for (const n of nodes) {
  if (n.tags?.golf !== "pin") continue;
  const { hole, dist } = nearestHole({ lat: n.lat, lon: n.lon });
  if (!hole || hole.course !== "Challenge" || dist > MAX_ASSIGN_DIST) continue;
  pins.push({ hole: hole.num, lat: Number(n.lat.toFixed(6)), lon: Number(n.lon.toFixed(6)) });
}

// Build the "playing path" from a tee: tee centroid -> hole centerline beyond
// the tee's projection -> pin/green. Used for yardages and landing points.
function playingPath(teePos, line, pin) {
  // find the projection of the tee onto the centerline (as cumulative distance)
  let bestSeg = 0, bestDist = Infinity, bestT = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i], b = line[i + 1];
    const scale = mPerDegLng((a.lat + b.lat) / 2);
    const ax = a.lon * scale, ay = a.lat * M_PER_DEG_LAT;
    const bx = b.lon * scale, by = b.lat * M_PER_DEG_LAT;
    const px = teePos.lon * scale, py = teePos.lat * M_PER_DEG_LAT;
    const dx = bx - ax, dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < bestDist) { bestDist = d; bestSeg = i; bestT = t; }
  }
  const path = [teePos];
  for (let i = bestSeg + 1; i < line.length; i++) path.push(line[i]);
  // skip the partially-passed vertex if the tee projects almost onto it
  if (bestT < 0.95 && bestSeg + 1 < line.length) {
    // keep as is: first centerline point after projection already included
  }
  if (pin) path.push(pin);
  // drop near-duplicate consecutive points
  return path.filter((p, i) => i === 0 || distMeters(p, path[i - 1]) > 5);
}

const M_TO_YD = 1.09361;
const holes = allHoles
  .filter((h) => h.course === "Challenge")
  .sort((a, b) => a.num - b.num)
  .map((h) => {
    const pinNode = pins.find((p) => p.hole === h.num);
    const pin = pinNode ? { lat: pinNode.lat, lon: pinNode.lon } : null;

    // tee sets for this hole: centroid of each tee polygon + playing path/yards
    const tees = features
      .filter((f) => f.type === "tee" && f.hole === h.num)
      .map((f) => {
        const c = centroid(f.coords.map(([lat, lon]) => ({ lat, lon })));
        const path = playingPath(c, h.line, pin);
        return {
          pos: [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))],
          yards: Math.round(lineLengthMeters(path) * M_TO_YD),
          path: path.map((p) => [Number(p.lat.toFixed(6)), Number(p.lon.toFixed(6))]),
        };
      })
      .sort((a, b) => b.yards - a.yards);

    return {
      num: h.num,
      par: h.par,
      hcp: h.hcp,
      yards: Math.round(lineLengthMeters(h.line) * M_TO_YD),
      line: h.line.map((c) => [Number(c.lat.toFixed(6)), Number(c.lon.toFixed(6))]),
      pin: pin ? [pin.lat, pin.lon] : null,
      tees,
    };
  });

// --- course boundary (relation outer ways stitched into rings) for OB detection ---
function stitchOuterRings(relation) {
  const segs = relation.members
    .filter((m) => m.type === "way" && m.role !== "inner" && m.geometry)
    .map((m) => m.geometry.map((g) => [g.lat, g.lon]));
  const rings = [];
  while (segs.length) {
    let ring = segs.shift();
    let extended = true;
    while (extended) {
      extended = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const near = (a, b) => Math.abs(a[0] - b[0]) < 1e-7 && Math.abs(a[1] - b[1]) < 1e-7;
        if (near(s[0], end)) { ring = ring.concat(s.slice(1)); segs.splice(i, 1); extended = true; break; }
        if (near(s[s.length - 1], end)) { ring = ring.concat(s.slice(0, -1).reverse()); segs.splice(i, 1); extended = true; break; }
      }
    }
    rings.push(ring);
  }
  return rings;
}

const courseRel = data.elements.find((e) => e.type === "relation" && e.id === 1230389);
let boundary = [];
if (courseRel) {
  const rings = stitchOuterRings(courseRel).sort((a, b) => b.length - a.length);
  boundary = rings.map((ring) => ring.map(([lat, lon]) => [Number(lat.toFixed(6)), Number(lon.toFixed(6))]));
  console.log(`Boundary: ${boundary.length} ring(s), sizes ${boundary.map((r) => r.length).join(",")}`);
} else {
  console.warn("WARNING: course boundary relation not found");
}

const allPts = holes.flatMap((h) => h.line);
const center = {
  lat: allPts.reduce((s, p) => s + p[0], 0) / allPts.length,
  lng: allPts.reduce((s, p) => s + p[1], 0) / allPts.length,
};

const out = {
  course: "Suntree CC - Challenge",
  source: "OpenStreetMap (ODbL) via Overpass API, fetched " + new Date().toISOString().slice(0, 10),
  center,
  holes,
  features,
  boundary,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(out));
const counts = {};
for (const f of features) counts[f.type] = (counts[f.type] || 0) + 1;
console.log(`Wrote ${OUT_PATH}`);
console.log(`${holes.length} holes | features:`, counts, `| ${pins.length} pins`);
console.log("Pars:", holes.map((h) => h.par).join(","));
