// Pure terrain geometry for the trip game: polygon tests, landing
// classification and "nearest hazard" placement. No React, no DOM.

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point[0];
    y += point[1];
  }
  return [x / points.length, y / points.length];
}

export function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, prior = polygon.length - 1; index < polygon.length; prior = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[prior];
    const crosses =
      current[1] > point[1] !== previous[1] > point[1] &&
      point[0] < ((previous[0] - current[0]) * (point[1] - current[1])) / ((previous[1] - current[1]) || 1e-6) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

// Priority order matters: water beats sand, sand beats short grass.
export function classifyTerrain(features, point) {
  const hit = (type) =>
    (features || []).some((feature) => feature.type === type && feature.points?.length >= 3 && pointInPolygon(point, feature.points));
  if (hit("water")) return "Penalty area";
  if (hit("bunker")) return "Bunker";
  if (hit("green") || hit("fairway") || hit("tee")) return "Fairway";
  return "Rough";
}

export function pointInsideFeature(feature, target) {
  if (pointInPolygon(target, feature.points)) return target;
  const centroid = polygonCentroid(feature.points);
  if (pointInPolygon(centroid, feature.points)) return centroid;
  for (const vertex of feature.points) {
    const inward = [vertex[0] * 0.72 + centroid[0] * 0.28, vertex[1] * 0.72 + centroid[1] * 0.28];
    if (pointInPolygon(inward, feature.points)) return inward;
  }
  return centroid;
}

/** Nearest point on a ring's boundary to the target, nudged a little inside. */
export function nearestEdgePoint(points, target) {
  let best = null;
  for (let index = 0; index < points.length; index += 1) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const lengthSq = abx * abx + aby * aby || 1e-9;
    const t = clamp(((target[0] - a[0]) * abx + (target[1] - a[1]) * aby) / lengthSq, 0, 1);
    const point = [a[0] + abx * t, a[1] + aby * t];
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1]);
    if (!best || distance < best.distance) best = { point, distance };
  }
  if (!best) return null;
  const centroid = polygonCentroid(points);
  const toCentre = [centroid[0] - best.point[0], centroid[1] - best.point[1]];
  const span = Math.hypot(toCentre[0], toCentre[1]) || 1;
  const inside = [best.point[0] + (toCentre[0] / span) * 3, best.point[1] + (toCentre[1] / span) * 3];
  return { point: pointInPolygon(inside, points) ? inside : pointInsideFeature({ points }, inside), distance: best.distance };
}

// Distance is measured to the feature's edge, not its centroid: a big lake
// beside the aim is still "right there", and a ball never teleports mid-pond.
export function nearestFeaturePoint(features, types, target, maxDist) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  let best = null;
  for (const feature of features || []) {
    if (!wanted.has(feature.type) || !feature.points || feature.points.length < 3) continue;
    if (pointInPolygon(target, feature.points)) return { point: target, distance: 0 };
    const candidate = nearestEdgePoint(feature.points, target);
    if (!candidate || candidate.distance > maxDist) continue;
    if (!best || candidate.distance < best.distance) best = candidate;
  }
  return best;
}
