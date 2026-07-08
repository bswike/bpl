import fs from "node:fs";

// Usage: node scripts/preprocess-suntree.mjs <input.geojson> [outputPath] [coursePrefix]
// Extracts one Suntree course from OSM golf geojson into compact SVG-ready
// per-hole JSON (projected to local meters, rotated tee->green, water clipped).
const SRC = process.argv[2] || "suntree.geojson";
const OUT = process.argv[3] || "src/components/golf/data/suntreeClassic.json";
const PREFIX = process.argv[4] || "Classic";

const d = JSON.parse(fs.readFileSync(SRC, "utf8"));
const feats = d.features;

// ---- projection: equirectangular around Classic bbox center, in meters ----
const holes = feats.filter((f) => f.properties?.golf === "hole");
const classicHoles = holes.filter((h) => String(h.properties.ref).startsWith(PREFIX));
function allCoords(g) {
  const out = [];
  const walk = (a) => (typeof a[0] === "number" ? out.push(a) : a.forEach(walk));
  walk(g.coordinates);
  return out;
}
let lat0 = 0, lon0 = 0, n = 0;
for (const h of classicHoles) for (const c of allCoords(h.geometry)) { lon0 += c[0]; lat0 += c[1]; n++; }
lon0 /= n; lat0 /= n;
const mPerLon = 111320 * Math.cos((lat0 * Math.PI) / 180);
const mPerLat = 110540;
const proj = ([lon, lat]) => [(lon - lon0) * mPerLon, (lat - lat0) * mPerLat];
const projRing = (ring) => ring.map(proj);

// ---- centerlines for ALL holes (for nearest-hole assignment) ----
const centerlines = holes.map((h) => ({
  ref: String(h.properties.ref),
  pts: allCoords(h.geometry).map(proj),
}));
function distPtSeg(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p[0] - a[0], wy = p[1] - a[1];
  const L2 = vx * vx + vy * vy || 1e-9;
  let t = (wx * vx + wy * vy) / L2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * vx, cy = a[1] + t * vy;
  return Math.hypot(p[0] - cx, p[1] - cy);
}
function distToLine(p, line) {
  let m = Infinity;
  for (let i = 0; i < line.length - 1; i++) m = Math.min(m, distPtSeg(p, line[i], line[i + 1]));
  if (line.length === 1) m = Math.hypot(p[0] - line[0][0], p[1] - line[0][1]);
  return m;
}
function centroidM(ring) {
  let x = 0, y = 0;
  for (const c of ring) { x += c[0]; y += c[1]; }
  return [x / ring.length, y / ring.length];
}
// nearest classic hole ref for a projected centroid, or null if a non-classic hole is closer
function assignHole(centM) {
  const THRESH = 75; // meters perpendicular to the hole line
  let best = null, bestD = Infinity;
  for (const cl of centerlines) {
    const dd = distToLine(centM, cl.pts);
    if (dd < bestD) { bestD = dd; best = cl.ref; }
  }
  if (!best || !best.startsWith(PREFIX) || bestD > THRESH) return null;
  return best;
}

// ---- collect features per classic hole ----
const TYPES = ["fairway", "green", "bunker", "water_hazard", "lateral_water_hazard", "tee"];
const perHole = {}; // "Classic N" -> { fairway:[], green:[], bunker:[], water:[], tee:[] }
for (const h of classicHoles) perHole[String(h.properties.ref)] = { fairway: [], green: [], bunker: [], water: [], tee: [] };

for (const f of feats) {
  const g = f.properties?.golf;
  if (!TYPES.includes(g)) continue;
  if (f.geometry.type !== "Polygon") continue;
  const ring = projRing(f.geometry.coordinates[0]);
  const ref = assignHole(centroidM(ring));
  if (!ref) continue;
  const bucket =
    g === "water_hazard" || g === "lateral_water_hazard" ? "water" : g;
  perHole[ref][bucket].push(ring);
}

// ---- build per-hole rotated + normalized output ----
function rotate(p, o, cosA, sinA) {
  const x = p[0] - o[0], y = p[1] - o[1];
  return [x * cosA - y * sinA, x * sinA + y * cosA];
}
const out = [];
for (let i = 1; i <= 18; i++) {
  const ref = `${PREFIX} ${i}`;
  const hf = classicHoles.find((h) => String(h.properties.ref) === ref);
  if (!hf) continue;
  const line = allCoords(hf.geometry).map(proj);
  const bucket = perHole[ref];

  // orient tee->green: the tee end is whichever centerline endpoint is
  // nearest the tee boxes (unambiguous); fall back to green centroid.
  const teeBoxesC = bucket.tee.length
    ? centroidM(bucket.tee.flat())
    : bucket.green.length
      ? centroidM(bucket.green[0]).map((v) => -v) // opposite of green as last resort
      : line[0];
  const s0 = Math.hypot(line[0][0] - teeBoxesC[0], line[0][1] - teeBoxesC[1]);
  const sN = Math.hypot(line[line.length - 1][0] - teeBoxesC[0], line[line.length - 1][1] - teeBoxesC[1]);
  const tee = s0 < sN ? line[0] : line[line.length - 1];
  const green = s0 < sN ? line[line.length - 1] : line[0];
  const yards = (() => {
    let m = 0;
    for (let k = 0; k < line.length - 1; k++) m += Math.hypot(line[k + 1][0] - line[k][0], line[k + 1][1] - line[k][1]);
    return Math.round(m * 1.09361);
  })();

  // rotate so tee->green points up (+Y)
  const v = [green[0] - tee[0], green[1] - tee[1]];
  const phi = Math.atan2(v[1], v[0]);
  const alpha = Math.PI / 2 - phi; // map v to +Y
  const cosA = Math.cos(alpha), sinA = Math.sin(alpha);
  const R = (ring) => ring.map((p) => rotate(p, tee, cosA, sinA));

  const shapes = [];
  const addAll = (rings, t) => rings.forEach((r) => shapes.push({ t, pts: R(r) }));
  addAll(bucket.water, "water");
  addAll(bucket.fairway, "fairway");
  addAll(bucket.bunker, "bunker");
  addAll(bucket.green, "green");
  addAll(bucket.tee, "tee");
  const lineR = R(line);
  const teeR = R([tee])[0];
  const greenR = R([green])[0];

  // bbox over everything, normalize to 0.. with padding
  let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
  const consider = (p) => { mnx = Math.min(mnx, p[0]); mny = Math.min(mny, p[1]); mxx = Math.max(mxx, p[0]); mxy = Math.max(mxy, p[1]); };
  shapes.forEach((s) => { if (s.t !== "water") s.pts.forEach(consider); });
  lineR.forEach(consider);
  if (!shapes.length) { consider(teeR); consider(greenR); }
  const pad = 12;
  mnx -= pad; mny -= pad; mxx += pad; mxy += pad;
  const W = mxx - mnx, H = mxy - mnx * 0 - mny; // height
  const norm = (p) => [Math.round((p[0] - mnx) * 10) / 10, Math.round((p[1] - mny) * 10) / 10];

  out.push({
    n: i,
    par: Number(hf.properties.par),
    hcp: Number(hf.properties.handicap),
    yards,
    w: Math.round(W * 10) / 10,
    h: Math.round(H * 10) / 10,
    shapes: shapes.map((s) => ({ t: s.t, pts: s.pts.map(norm).map(([x, y]) => [x, y]) })),
    line: lineR.map(norm),
    tee: norm(teeR),
    green: norm(greenR),
  });
}

fs.writeFileSync(OUT, JSON.stringify(out));
const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
console.log(`wrote ${out.length} holes, ${kb} KB`);
for (const h of out) {
  const counts = {};
  h.shapes.forEach((s) => (counts[s.t] = (counts[s.t] || 0) + 1));
  console.log(`  Classic ${h.n}: par ${h.par}, hcp ${h.hcp}, ${h.yards}y, ${h.w.toFixed(0)}x${h.h.toFixed(0)}m,`, JSON.stringify(counts));
}
