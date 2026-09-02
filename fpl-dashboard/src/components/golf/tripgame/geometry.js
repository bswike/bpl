// Small vector and polyline helpers. No React, no DOM.
export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function pathFromPoints(points, close = true) {
  if (!points?.length) return "";
  const commands = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")}${close ? " Z" : ""}`;
}

export function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < (points?.length || 0); index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return total;
}

export function pointAlongPolyline(points, distance) {
  if (!points?.length) return { point: [0, 0], tangent: [0, -1] };
  if (points.length === 1) return { point: points[0], tangent: [0, -1] };
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    if (remaining <= length) {
      const ratio = remaining / length;
      return {
        point: [start[0] + dx * ratio, start[1] + dy * ratio],
        tangent: [dx / length, dy / length],
      };
    }
    remaining -= length;
  }
  const end = points.at(-1);
  const previous = points.at(-2);
  const dx = end[0] - previous[0];
  const dy = end[1] - previous[1];
  const length = Math.hypot(dx, dy) || 1;
  return { point: end, tangent: [dx / length, dy / length] };
}

export function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

export function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function curvedPath(from, to, bend) {
  const mid = interpolate(from, to, 0.5);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const perpendicular = [-dy / length, dx / length];
  const control = [mid[0] + perpendicular[0] * bend, mid[1] + perpendicular[1] * bend];
  return `M${from[0].toFixed(1)},${from[1].toFixed(1)} Q${control[0].toFixed(1)},${control[1].toFixed(1)} ${to[0].toFixed(
    1,
  )},${to[1].toFixed(1)}`;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function featureBounds(features, type) {
  const points = features.filter((feature) => feature.type === type).flatMap((feature) => feature.points);
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((point) => point[0])),
    maxX: Math.max(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxY: Math.max(...points.map((point) => point[1])),
    cx: points.reduce((total, point) => total + point[0], 0) / points.length,
    cy: points.reduce((total, point) => total + point[1], 0) / points.length,
  };
}

export function quadPoint(from, control, to, t) {
  const inverse = 1 - t;
  return [
    inverse * inverse * from[0] + 2 * inverse * t * control[0] + t * t * to[0],
    inverse * inverse * from[1] + 2 * inverse * t * control[1] + t * t * to[1],
  ];
}

export function sidePoint(from, toward, offset) {
  const dx = toward[0] - from[0];
  const dy = toward[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (-dy / len) * offset, from[1] + (dx / len) * offset];
}

function distanceToSegment(a, b, target) {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const lengthSq = abx * abx + aby * aby || 1e-9;
  const t = clamp(((target[0] - a[0]) * abx + (target[1] - a[1]) * aby) / lengthSq, 0, 1);
  return Math.hypot(a[0] + abx * t - target[0], a[1] + aby * t - target[1]);
}

/**
 * Shortest distance from a point to a polyline (metres in projection space).
 * With `cutCorners`, the chord between every second vertex counts too, so a
 * ball played straight across a dogleg is measured against the cut line.
 */
export function distanceToPolyline(points, target, cutCorners = false) {
  if (!points || points.length === 0) return Infinity;
  if (points.length === 1) return Math.hypot(points[0][0] - target[0], points[0][1] - target[1]);
  let best = Infinity;
  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distanceToSegment(points[index], points[index + 1], target));
    if (cutCorners && index + 2 < points.length) best = Math.min(best, distanceToSegment(points[index], points[index + 2], target));
  }
  return best;
}

