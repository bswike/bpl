// ---------------------------------------------------------------------------
// Engine for the 3D course viewer: geometry helpers, strokes-gained model
// (Broadie PGA baseline), lie classification against OSM polygons, dispersion
// sampling, and the camera raycast used for dragging aim points.
// All points are [lat, lng] pairs unless noted.
// ---------------------------------------------------------------------------

export const M_PER_DEG_LAT = 111320;
export const YD_TO_M = 0.9144;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function bearing(a, b) {
  const [lat1, lng1] = [toRad(a[0]), toRad(a[1])];
  const [lat2, lng2] = [toRad(b[0]), toRad(b[1])];
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function distMeters(a, b) {
  const dy = (b[0] - a[0]) * M_PER_DEG_LAT;
  const dx = (b[1] - a[1]) * M_PER_DEG_LAT * Math.cos(toRad((a[0] + b[0]) / 2));
  return Math.hypot(dx, dy);
}

export function offsetPoint(p, headingDeg, distM) {
  const th = toRad(headingDeg);
  const dLat = (distM * Math.cos(th)) / M_PER_DEG_LAT;
  const dLng = (distM * Math.sin(th)) / (M_PER_DEG_LAT * Math.cos(toRad(p[0])));
  return [p[0] + dLat, p[1] + dLng];
}

export function pointAlong(path, distM) {
  let remaining = distM;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = distMeters(path[i], path[i + 1]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return [
        path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        path[i][1] + (path[i + 1][1] - path[i][1]) * t,
      ];
    }
    remaining -= seg;
  }
  return path[path.length - 1];
}

export function pathLengthM(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distMeters(path[i], path[i + 1]);
  return total;
}

// dispersion ellipse ring (for drawing): lateral half-width aM, depth half bM
export function ellipsePath(center, headingDeg, aM, bM, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * 2 * Math.PI;
    const p1 = offsetPoint(center, headingDeg, bM * Math.cos(phi));
    pts.push(offsetPoint(p1, headingDeg + 90, aM * Math.sin(phi)));
  }
  return pts;
}

// ---------------------------------------------------------------------------
// Strokes gained: Broadie PGA Tour baseline (expected strokes to hole out).
// Distances in yards; putting table in feet.
// ---------------------------------------------------------------------------

const T_TEE = [[100, 2.92], [120, 2.99], [140, 2.97], [160, 2.99], [180, 3.05], [200, 3.12], [220, 3.17], [240, 3.25], [260, 3.45], [280, 3.65], [300, 3.71], [320, 3.79], [340, 3.86], [360, 3.92], [380, 3.96], [400, 3.99], [420, 4.02], [440, 4.08], [460, 4.17], [480, 4.28], [500, 4.41], [520, 4.54], [540, 4.65], [560, 4.74], [580, 4.79], [600, 4.82]];
const T_FAIRWAY = [[10, 2.18], [20, 2.40], [40, 2.60], [60, 2.70], [80, 2.75], [100, 2.80], [120, 2.85], [140, 2.91], [160, 2.98], [180, 3.08], [200, 3.19], [220, 3.32], [240, 3.45], [260, 3.58], [280, 3.69], [300, 3.78], [320, 3.84], [340, 3.88], [360, 3.95], [380, 4.03], [400, 4.11], [420, 4.15], [440, 4.20], [460, 4.29], [480, 4.40], [500, 4.53], [520, 4.66], [540, 4.78], [560, 4.86], [580, 4.91], [600, 4.94]];
const T_ROUGH = [[10, 2.34], [20, 2.59], [40, 2.78], [60, 2.91], [80, 2.96], [100, 3.02], [120, 3.08], [140, 3.15], [160, 3.23], [180, 3.31], [200, 3.42], [220, 3.53], [240, 3.64], [260, 3.74], [280, 3.83], [300, 3.90], [320, 3.95], [340, 4.02], [360, 4.11], [380, 4.21], [400, 4.30], [420, 4.34], [440, 4.39], [460, 4.48], [480, 4.59], [500, 4.72], [520, 4.85], [540, 4.97], [560, 5.05], [580, 5.10], [600, 5.13]];
const T_SAND = [[10, 2.43], [20, 2.53], [40, 2.82], [60, 3.15], [80, 3.24], [100, 3.23], [120, 3.21], [140, 3.22], [160, 3.28], [180, 3.40], [200, 3.55], [220, 3.70], [240, 3.84], [260, 3.93], [280, 4.00], [300, 4.04], [320, 4.12], [340, 4.26], [360, 4.41], [380, 4.55], [400, 4.69], [420, 4.73], [440, 4.78], [460, 4.87], [480, 4.98], [500, 5.11], [520, 5.24], [540, 5.36], [560, 5.44], [580, 5.49], [600, 5.52]];
const T_GREEN_FT = [[1, 1.0], [2, 1.01], [3, 1.04], [4, 1.13], [5, 1.23], [6, 1.34], [7, 1.42], [8, 1.5], [10, 1.61], [15, 1.78], [20, 1.87], [30, 1.98], [40, 2.06], [50, 2.14], [60, 2.21], [90, 2.4], [120, 2.56]];

function interp(table, x) {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

// expected strokes to hole out from `distYds` with a given lie
export function expectedStrokes(lie, distYds) {
  switch (lie) {
    case "green": return interp(T_GREEN_FT, distYds * 3);
    case "tee": return interp(T_TEE, distYds);
    case "fairway": return interp(T_FAIRWAY, distYds);
    case "sand": return interp(T_SAND, distYds);
    default: return interp(T_ROUGH, distYds); // rough / water-drop / recovery
  }
}

// ---------------------------------------------------------------------------
// Lie classification against baked course polygons
// ---------------------------------------------------------------------------

function pointInRing(pt, ring) {
  // ray casting on [lat, lng]
  let inside = false;
  const [y, x] = pt;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function ringBBox(ring) {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const [lat, lng] of ring) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return [minLat, minLng, maxLat, maxLng];
}

const inBBox = (pt, b) => pt[0] >= b[0] && pt[1] >= b[1] && pt[0] <= b[2] && pt[1] <= b[3];

// Build a classifier from the baked course JSON. Priority: green > sand >
// water > fairway/tee > rough (inside boundary) > ob.
export function buildClassifier(data) {
  const groups = { green: [], sand: [], water: [], fairway: [] };
  for (const f of data.features) {
    const ring = f.coords;
    const entry = { ring, bbox: ringBBox(ring) };
    if (f.type === "green") groups.green.push(entry);
    else if (f.type === "bunker") groups.sand.push(entry);
    else if (f.type === "water") groups.water.push(entry);
    else if (f.type === "fairway" || f.type === "tee") groups.fairway.push(entry);
  }
  const boundary = (data.boundary ?? []).map((ring) => ({ ring, bbox: ringBBox(ring) }));
  const order = ["green", "sand", "water", "fairway"];
  return (pt) => {
    for (const lie of order) {
      for (const e of groups[lie]) {
        if (inBBox(pt, e.bbox) && pointInRing(pt, e.ring)) return lie;
      }
    }
    for (const e of boundary) {
      if (inBBox(pt, e.bbox) && pointInRing(pt, e.ring)) return "rough";
    }
    return "ob";
  };
}

// ---------------------------------------------------------------------------
// Dispersion sampling + shot evaluation
// ---------------------------------------------------------------------------

export const DISPERSION = { lateral: 0.09, depth: 0.055 }; // 1-sigma, fraction of shot length

// deterministic gaussian-ish sample pattern: center + 3 rings of 8
const SAMPLE_PATTERN = (() => {
  const samples = [{ u: 0, v: 0, w: 0.15 }];
  const rings = [
    { r: 0.7, w: 0.45 },
    { r: 1.4, w: 0.3 },
    { r: 2.2, w: 0.1 },
  ];
  for (const { r, w } of rings) {
    for (let i = 0; i < 8; i++) {
      const phi = (i / 8) * 2 * Math.PI + 0.3;
      samples.push({ u: r * Math.cos(phi), v: r * Math.sin(phi), w: w / 8 });
    }
  }
  return samples;
})();

// Evaluate one planned shot with dispersion.
//   origin/aim/pin: [lat,lng]; originLie: 'tee'|'fairway'|... ; par for tee table
export function evaluateShot({ origin, originLie, aim, pin, par, classify }) {
  const shotM = distMeters(origin, aim);
  const shotYds = shotM / YD_TO_M;
  const heading = bearing(origin, aim);
  const sigLatM = shotM * DISPERSION.lateral;
  const sigDepM = shotM * DISPERSION.depth;

  const originDistYds = distMeters(origin, pin) / YD_TO_M;
  const originTable = originLie === "tee" && par < 4 ? "fairway" : originLie;
  const eOrigin = expectedStrokes(originTable, originDistYds);

  let eZone = 0;
  const pcts = { green: 0, fairway: 0, rough: 0, sand: 0, water: 0, ob: 0 };
  for (const s of SAMPLE_PATTERN) {
    const p1 = offsetPoint(aim, heading, s.v * sigDepM);
    const pt = offsetPoint(p1, heading + 90, s.u * sigLatM);
    const lie = classify(pt);
    pcts[lie] += s.w;
    const dYds = distMeters(pt, pin) / YD_TO_M;
    let e;
    if (lie === "water") e = 1 + expectedStrokes("rough", dYds); // penalty drop
    else if (lie === "ob") e = 1 + eOrigin; // stroke and distance
    else e = expectedStrokes(lie, dYds);
    eZone += s.w * e;
  }

  return { shotYds: Math.round(shotYds), heading, eOrigin, eZone, sg: eOrigin - 1 - eZone, pcts };
}

// Evaluate the whole planned chain: aims = [[lat,lng]...], last aim targets pin area.
export function evaluateChain({ teePos, teePathYds, aims, pin, par, classify }) {
  const shots = [];
  let origin = teePos;
  let originLie = "tee";
  for (let k = 0; k < aims.length; k++) {
    const res = evaluateShot({ origin, originLie, aim: aims[k], pin, par, classify });
    shots.push(res);
    origin = aims[k];
    const lie = classify(aims[k]);
    originLie = lie === "water" || lie === "ob" ? "rough" : lie;
  }
  const baselineTable = par >= 4 ? "tee" : "fairway";
  const baseline = expectedStrokes(baselineTable, teePathYds);
  const totalSg = shots.reduce((s, x) => s + x.sg, 0);
  return { shots, baseline, expected: baseline - totalSg };
}

// default aim points for a tee: drive (par 4/5), layup (par 5), then pin
export function defaultAims(tee, par, pin, driveYds = 250) {
  const path = tee.path;
  const totalM = pathLengthM(path);
  const aims = [];
  if (par >= 4) {
    const driveM = Math.min(driveYds * YD_TO_M, totalM - 20 * YD_TO_M);
    aims.push(pointAlong(path, driveM));
    if (par >= 5) {
      const remainingM = totalM - driveM;
      if (remainingM > 220 * YD_TO_M) aims.push(pointAlong(path, totalM - 100 * YD_TO_M));
    }
  }
  aims.push(pin ? [...pin] : path[path.length - 1]);
  return aims;
}

// ---------------------------------------------------------------------------
// Camera model for Map3DElement: screen <-> ground conversions for dragging.
// ENU frame in meters centered on the camera look-at point.
// ---------------------------------------------------------------------------

export function cameraState(map, width, height) {
  const c = map.center;
  const center = { lat: c?.lat ?? 0, lng: c?.lng ?? 0, alt: c?.altitude ?? 0 };
  const range = map.range ?? 1000;
  const tilt = toRad(map.tilt ?? 0);
  const heading = toRad(map.heading ?? 0);
  const fov = toRad(map.fov ?? 35); // vertical FOV, API default 35deg
  const mLat = M_PER_DEG_LAT;
  const mLng = M_PER_DEG_LAT * Math.cos(toRad(center.lat));

  // camera position in ENU (x=east, y=north, z=up), origin at look-at point
  const px = -range * Math.sin(tilt) * Math.sin(heading);
  const py = -range * Math.sin(tilt) * Math.cos(heading);
  const pz = center.alt + range * Math.cos(tilt);
  const P = [px, py, pz];
  const C = [0, 0, center.alt];

  // basis
  const f = norm(sub(C, P));
  const r = norm(cross(f, [0, 0, 1]));
  const u = cross(r, f);
  const tanV = Math.tan(fov / 2);
  const tanH = (tanV * width) / height;

  const toENU = (pt) => [(pt[1] - center.lng) * mLng, (pt[0] - center.lat) * mLat];
  const toLatLngPt = (x, y) => [center.lat + y / mLat, center.lng + x / mLng];

  return { P, f, r, u, tanV, tanH, width, height, toENU, toLatLngPt, centerAlt: center.alt };
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };

function pixelRay(cam, sx, sy) {
  const ndcX = (2 * sx) / cam.width - 1;
  const ndcY = 1 - (2 * sy) / cam.height;
  return norm([
    cam.f[0] + cam.r[0] * ndcX * cam.tanH + cam.u[0] * ndcY * cam.tanV,
    cam.f[1] + cam.r[1] * ndcX * cam.tanH + cam.u[1] * ndcY * cam.tanV,
    cam.f[2] + cam.r[2] * ndcX * cam.tanH + cam.u[2] * ndcY * cam.tanV,
  ]);
}

// screen pixel -> ground [lat,lng], intersecting plane z = groundZ (meters)
export function screenToGround(cam, sx, sy, groundZ) {
  const d = pixelRay(cam, sx, sy);
  if (Math.abs(d[2]) < 1e-9) return null;
  const s = (groundZ - cam.P[2]) / d[2];
  if (s <= 0) return null;
  return cam.toLatLngPt(cam.P[0] + s * d[0], cam.P[1] + s * d[1]);
}

// ground [lat,lng] at altitude z -> screen pixel
export function groundToScreen(cam, pt, z) {
  const [x, y] = cam.toENU(pt);
  const v = sub([x, y, z], cam.P);
  const zf = dot(v, cam.f);
  if (zf <= 0) return null;
  const xr = dot(v, cam.r) / (zf * cam.tanH);
  const yu = dot(v, cam.u) / (zf * cam.tanV);
  return [((xr + 1) / 2) * cam.width, ((1 - yu) / 2) * cam.height];
}

// Estimate ground altitude so the ray through pixel (sx,sy) passes over the
// known ground point `pt` — self-calibrates terrain height at drag start.
export function calibrateGroundZ(cam, sx, sy, pt) {
  const d = pixelRay(cam, sx, sy);
  const [tx, ty] = cam.toENU(pt);
  // pick the dominant horizontal component for stability
  const s = Math.abs(d[0]) > Math.abs(d[1])
    ? (tx - cam.P[0]) / d[0]
    : (ty - cam.P[1]) / d[1];
  if (!isFinite(s) || s <= 0) return 0;
  return cam.P[2] + s * d[2];
}
