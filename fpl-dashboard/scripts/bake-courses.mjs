// Bakes golf course geometry from OpenStreetMap (Overpass API) into static
// JSONs under public/data/, plus a courses.json manifest for the menu screen.
//
// Usage: node scripts/bake-courses.mjs [slug ...]   (no args = all)

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(join(__dirname, "..", "public", "data"));

// --- course registry -------------------------------------------------------
// Each fetch group shares one Overpass query (bbox + boundary relation).
// holeRef: regex on the OSM hole way's ref tag; capture group 1 = hole number.
const FETCH_GROUPS = [
  {
    bbox: "28.2023,-80.6968,28.2299,-80.6795",
    boundaryRelation: 1230389,
    courses: [
      {
        slug: "suntree-challenge",
        name: "Suntree CC \u2014 Challenge",
        location: "Melbourne, FL",
        holeRef: /^Challenge (\d+)$/,
      },
      {
        slug: "suntree-classic",
        name: "Suntree CC \u2014 Classic",
        location: "Melbourne, FL",
        holeRef: /^Classic (\d+)$/,
      },
    ],
  },
  {
    bbox: "44.8242,-93.6425,44.8348,-93.6181",
    boundaryRelation: 3227780,
    courses: [
      {
        slug: "chaska-town",
        name: "Chaska Town Course",
        location: "Chaska, MN",
        holeRef: /^(\d+)$/,
        // OSM has no pars/handicaps for Chaska; from the official scorecard
        parOverride: { 1: 4, 2: 4, 3: 4, 4: 3, 5: 4, 6: 3, 7: 5, 8: 4, 9: 5, 10: 4, 11: 4, 12: 3, 13: 4, 14: 3, 15: 5, 16: 4, 17: 4, 18: 5 },
        hcpOverride: { 1: 7, 2: 3, 3: 17, 4: 15, 5: 5, 6: 13, 7: 1, 8: 9, 9: 11, 10: 8, 11: 4, 12: 16, 13: 2, 14: 14, 15: 12, 16: 18, 17: 6, 18: 10 },
      },
    ],
  },
];

// menu entries that have no bakeable OSM data yet
const UNAVAILABLE = [
  {
    slug: "sparrows-point",
    name: "Sparrows Point CC",
    location: "Dundalk, MD",
    available: false,
    note: "Not yet mapped in OpenStreetMap",
  },
];

// --- geo helpers ------------------------------------------------------------
const M_PER_DEG_LAT = 111320;
const M_TO_YD = 1.09361;
const mPerDegLng = (lat) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

function distMeters(a, b) {
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  const dx = (a.lon - b.lon) * mPerDegLng((a.lat + b.lat) / 2);
  return Math.hypot(dx, dy);
}

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

const distToPolyline = (p, coords) => {
  let best = Infinity;
  for (let i = 0; i < coords.length - 1; i++) best = Math.min(best, pointToSegment(p, coords[i], coords[i + 1]));
  return best;
};

function centroid(coords) {
  let lat = 0, lon = 0;
  for (const c of coords) { lat += c.lat; lon += c.lon; }
  return { lat: lat / coords.length, lon: lon / coords.length };
}

const lineLengthMeters = (coords) => {
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) total += distMeters(coords[i], coords[i + 1]);
  return total;
};

function stitchOuterRings(relation) {
  const segs = (relation.members ?? [])
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

// playing path from a tee: tee centroid -> centerline beyond projection -> pin
function playingPath(teePos, line, pin) {
  let bestSeg = 0, bestDist = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const d = pointToSegment(teePos, line[i], line[i + 1]);
    if (d < bestDist) { bestDist = d; bestSeg = i; }
  }
  const path = [teePos];
  for (let i = bestSeg + 1; i < line.length; i++) path.push(line[i]);
  if (pin) path.push(pin);
  return path.filter((p, i) => i === 0 || distMeters(p, path[i - 1]) > 5);
}

const FEATURE_TYPES = new Set(["fairway", "green", "tee", "bunker", "water_hazard", "lateral_water_hazard"]);
const MAX_ASSIGN_DIST = 150;
const round6 = (v) => Number(v.toFixed(6));

// ground elevation (m above sea level) for camera targets — the 3D Maps
// camera uses absolute altitudes, so aiming at 0 is underground inland
async function elevations(points) {
  const lat = points.map((p) => p[0].toFixed(5)).join(",");
  const lon = points.map((p) => p[1].toFixed(5)).join(",");
  const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
  if (!res.ok) throw new Error(`elevation HTTP ${res.status}`);
  return (await res.json()).elevation;
}

async function overpass(query) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "swikle-golf-course-baker/1.0 (one-time data bake)",
      },
      body: "data=" + encodeURIComponent(query),
    });
    if (res.ok) return res.json();
    console.warn(`Overpass HTTP ${res.status}, attempt ${attempt}/3`);
    await new Promise((r) => setTimeout(r, 10000 * attempt));
  }
  throw new Error("Overpass failed after 3 attempts");
}

async function bakeGroup(group) {
  const query = `
[out:json][timeout:90];
(
  way["golf"](${group.bbox});
  node["golf"](${group.bbox});
  relation["golf"](${group.bbox});
  relation(${group.boundaryRelation});
);
out geom;`;
  console.log(`Fetching bbox ${group.bbox} ...`);
  const data = await overpass(query);
  console.log(`  ${data.elements.length} elements`);

  const ways = data.elements.filter((e) => e.type === "way" && e.geometry);
  const nodes = data.elements.filter((e) => e.type === "node");

  // holes across ALL courses in the group (so features assign to the right one)
  const allHoles = [];
  for (const w of ways) {
    if (w.tags.golf !== "hole" || !w.tags.ref) continue;
    for (const course of group.courses) {
      const m = w.tags.ref.match(course.holeRef);
      if (!m) continue;
      allHoles.push({
        slug: course.slug,
        num: Number(m[1]),
        par: course.parOverride?.[Number(m[1])] ?? (Number(w.tags.par) || null),
        hcp: course.hcpOverride?.[Number(m[1])] ?? (Number(w.tags.handicap) || null),
        line: w.geometry.map((g) => ({ lat: g.lat, lon: g.lon })),
      });
      break;
    }
  }

  const nearestHole = (p) => {
    let best = null, bestDist = Infinity;
    for (const h of allHoles) {
      const d = distToPolyline(p, h.line);
      if (d < bestDist) { bestDist = d; best = h; }
    }
    return { hole: best, dist: bestDist };
  };

  // features from ways and multipolygon relations
  const features = [];
  const addFeature = (golf, coords) => {
    const { hole, dist } = nearestHole(centroid(coords));
    if (!hole || dist > MAX_ASSIGN_DIST) return;
    features.push({
      slug: hole.slug,
      type: golf.includes("water_hazard") ? "water" : golf,
      hole: hole.num,
      coords: coords.map((c) => [round6(c.lat), round6(c.lon)]),
    });
  };
  for (const w of ways) {
    if (!FEATURE_TYPES.has(w.tags.golf)) continue;
    addFeature(w.tags.golf, w.geometry.map((g) => ({ lat: g.lat, lon: g.lon })));
  }
  for (const rel of data.elements) {
    if (rel.type !== "relation" || !rel.tags?.golf || !FEATURE_TYPES.has(rel.tags.golf)) continue;
    for (const ring of stitchOuterRings(rel)) {
      if (ring.length < 4) continue;
      addFeature(rel.tags.golf, ring.map(([lat, lon]) => ({ lat, lon })));
    }
  }

  // pins
  const pins = [];
  for (const n of nodes) {
    if (n.tags?.golf !== "pin") continue;
    const { hole, dist } = nearestHole({ lat: n.lat, lon: n.lon });
    if (!hole || dist > MAX_ASSIGN_DIST) continue;
    pins.push({ slug: hole.slug, hole: hole.num, lat: round6(n.lat), lon: round6(n.lon) });
  }

  // boundary
  const boundaryRel = data.elements.find((e) => e.type === "relation" && e.id === group.boundaryRelation);
  const boundary = boundaryRel
    ? stitchOuterRings(boundaryRel)
        .sort((a, b) => b.length - a.length)
        .map((ring) => ring.map(([lat, lon]) => [round6(lat), round6(lon)]))
    : [];

  // emit one JSON per course
  const manifest = [];
  for (const course of group.courses) {
    const courseFeatures = features.filter((f) => f.slug === course.slug).map(({ slug, ...f }) => f); // eslint-disable-line no-unused-vars
    const holes = allHoles
      .filter((h) => h.slug === course.slug)
      .sort((a, b) => a.num - b.num)
      .map((h) => {
        const pinNode = pins.find((p) => p.slug === course.slug && p.hole === h.num);
        const pin = pinNode ? { lat: pinNode.lat, lon: pinNode.lon } : null;
        const tees = courseFeatures
          .filter((f) => f.type === "tee" && f.hole === h.num)
          .map((f) => {
            const c = centroid(f.coords.map(([lat, lon]) => ({ lat, lon })));
            const path = playingPath(c, h.line, pin);
            return {
              pos: [round6(c.lat), round6(c.lon)],
              yards: Math.round(lineLengthMeters(path) * M_TO_YD),
              path: path.map((p) => [round6(p.lat), round6(p.lon)]),
            };
          })
          .sort((a, b) => b.yards - a.yards);
        return {
          num: h.num,
          par: h.par,
          hcp: h.hcp,
          yards: Math.round(lineLengthMeters(h.line) * M_TO_YD),
          line: h.line.map((c) => [round6(c.lat), round6(c.lon)]),
          pin: pin ? [pin.lat, pin.lon] : null,
          tees,
        };
      });

    if (!holes.length) {
      console.warn(`  WARNING: no holes for ${course.slug}`);
      continue;
    }
    const allPts = holes.flatMap((h) => h.line);
    const center = {
      lat: allPts.reduce((s, p) => s + p[0], 0) / allPts.length,
      lng: allPts.reduce((s, p) => s + p[1], 0) / allPts.length,
    };

    // ground elevations: course center + each hole's midpoint (camera targets)
    const holeMids = holes.map((h) => {
      const t = h.tees[0]?.pos ?? h.line[0];
      const end = h.pin ?? h.line[h.line.length - 1];
      return [(t[0] + end[0]) / 2, (t[1] + end[1]) / 2];
    });
    const elevs = await elevations([[center.lat, center.lng], ...holeMids]);
    const elevM = Math.round(elevs[0]);
    holes.forEach((h, i) => { h.elevM = Math.round(elevs[i + 1]); });

    const out = {
      course: course.name,
      location: course.location,
      source: "OpenStreetMap (ODbL) via Overpass API, fetched " + new Date().toISOString().slice(0, 10),
      center,
      elevM,
      holes,
      features: courseFeatures,
      boundary,
    };
    writeFileSync(join(OUT_DIR, `${course.slug}.json`), JSON.stringify(out));
    const par = holes.reduce((s, h) => s + (h.par ?? 0), 0);
    const yards = holes.reduce((s, h) => s + (h.tees[0]?.yards ?? h.yards), 0);
    console.log(`  ${course.slug}: ${holes.length} holes, par ${par}, ~${yards} yds (tips), ${courseFeatures.length} features`);
    manifest.push({
      slug: course.slug,
      name: course.name,
      location: course.location,
      available: true,
      holes: holes.length,
      par,
      yards,
    });
  }
  return manifest;
}

mkdirSync(OUT_DIR, { recursive: true });
const only = process.argv.slice(2);
let manifest = [];
for (const group of FETCH_GROUPS) {
  const groupCourses = only.length ? group.courses.filter((c) => only.includes(c.slug)) : group.courses;
  if (!groupCourses.length) continue;
  manifest = manifest.concat(await bakeGroup({ ...group, courses: groupCourses }));
  await new Promise((r) => setTimeout(r, 3000)); // be polite to Overpass
}
manifest = manifest.concat(UNAVAILABLE);
writeFileSync(join(OUT_DIR, "courses.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote manifest with ${manifest.length} entries`);
