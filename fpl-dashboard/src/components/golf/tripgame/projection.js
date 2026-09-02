// OSM geometry -> hole projection (SVG space, pin up, trees, hazards).

import {
  clamp,
  pointAlongPolyline,
  polylineLength,
  seededUnit,
} from "./geometry.js";
import {
  classifyTerrain,
  pointInPolygon,
  polygonArea,
  polygonCentroid,
} from "./terrain.js";
export const FEATURE_ORDER = { water: 0, fairway: 1, bunker: 2, green: 3, tee: 4 };

export function buildTreeSprites(projection, holeNumber) {
  const length = polylineLength(projection.line);
  if (!length) return [];
  const rows = clamp(Math.round(projection.height / 44), 6, 13);
  const trees = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = 0.08 + (row / Math.max(1, rows - 1)) * 0.82;
    const axis = pointAlongPolyline(projection.line, length * progress);
    const perpendicular = [-axis.tangent[1], axis.tangent[0]];
    for (const side of [-1, 1]) {
      const seed = holeNumber * 101 + row * 17 + (side > 0 ? 7 : 3);
      if (seededUnit(seed) < 0.13) continue;
      const corridor = clamp(projection.width * 0.22, 18, 43);
      const offset = corridor + seededUnit(seed + 1) * 13;
      const along = (seededUnit(seed + 2) - 0.5) * 12;
      const x = axis.point[0] + perpendicular[0] * offset * side + axis.tangent[0] * along;
      const y = axis.point[1] + perpendicular[1] * offset * side + axis.tangent[1] * along;
      if (x < 5 || x > projection.width - 5 || y < 8 || y > projection.height - 8) continue;
      trees.push({
        x,
        y,
        size: 4.2 + seededUnit(seed + 3) * 3.6,
        variant: Math.floor(seededUnit(seed + 4) * 3),
      });
    }
  }
  return trees;
}

export function routeShapeProfile(line, tee, pin) {
  const length = polylineLength(line);
  if (!length) return { preferredShape: "straight", shapeSeverity: 0 };
  const samples = [
    { progress: 0.3, weight: 0.2 },
    { progress: 0.5, weight: 0.5 },
    { progress: 0.68, weight: 0.3 },
  ];
  const deviation = samples.reduce((total, sample) => {
    const point = pointAlongPolyline(line, length * sample.progress).point;
    const directX = tee[0] + (pin[0] - tee[0]) * sample.progress;
    return total + (point[0] - directX) * sample.weight;
  }, 0);
  const shapeSeverity = clamp((Math.abs(deviation) - 3) / 28, 0, 1);
  return {
    preferredShape: shapeSeverity < 0.12 ? "straight" : deviation < 0 ? "cut" : "draw",
    shapeSeverity,
  };
}

// Trees are part of the projection: built once per hole, never on a pond, a
// fairway or a green, and read by both the map and the collision test.
export function withTrees(projection, holeNumber) {
  const trees = buildTreeSprites(projection, holeNumber).filter(
    (tree) => classifyTerrain(projection.features, [tree.x, tree.y]) === "Rough",
  );
  return { ...projection, trees };
}

export function fallbackProjection(hole) {
  const bend = hole.number % 2 ? -18 : 18;
  const waterSide = hole.number % 3 === 0 ? "right" : hole.number % 4 === 0 ? "left" : null;
  const features = [
    {
      type: "fairway",
      points: [
        [70, 216],
        [103, 172],
        [90 + bend, 116],
        [92, 48],
        [69, 42],
        [58 + bend, 112],
        [48, 176],
      ],
    },
    { type: "green", points: [[63, 43], [73, 29], [93, 32], [101, 47], [92, 58], [73, 57]] },
    { type: "tee", points: [[65, 216], [96, 216], [94, 229], [66, 229]] },
    { type: "bunker", points: [[51, 61], [62, 50], [67, 65], [56, 73]] },
  ];
  if (waterSide) {
    const left = waterSide === "left";
    features.push({
      type: "water",
      points: left
        ? [[0, 118], [39, 110], [47, 150], [24, 180], [0, 173]]
        : [[119, 103], [160, 91], [160, 174], [132, 165], [112, 132]],
    });
  }
  const base = {
    width: 160,
    height: 240,
    features,
    line: [[80, 222], [80 + bend, 125], [82, 43]],
    tee: [80, 222],
    pin: [82, 43],
    dangerSide: waterSide,
    primaryHazard: waterSide ? "water" : "bunker",
    hasWater: Boolean(waterSide),
    hazardLabel: waterSide ? `WATER ${waterSide.toUpperCase()}` : "BUNKERS LEFT",
    preferredShape: bend < 0 ? "cut" : "draw",
    shapeSeverity: 0.58,
    hazardSeverity: waterSide ? 0.68 : 0.32,
    official: null,
    elevation: null,
    source: "prototype",
  };
  return withTrees(base, hole.number);
}

/**
 * OSM tee sets carry no names, only yardages. Pick the set whose course
 * total lands closest to the trip's scorecard yardage; holes with fewer
 * sets fall back to their last (shortest) one.
 */
const teeIndexCache = new WeakMap();
export function tripTeeIndex(geometry, tripYards) {
  if (!geometry?.holes?.length || !Number.isFinite(Number(tripYards))) return 0;
  const cached = teeIndexCache.get(geometry);
  if (cached && cached.tripYards === tripYards) return cached.index;
  const maxSets = Math.max(...geometry.holes.map((entry) => entry.tees?.length || 0), 1);
  let best = 0;
  let bestGap = Infinity;
  for (let index = 0; index < maxSets; index += 1) {
    const total = geometry.holes.reduce((sum, entry) => {
      const tees = entry.tees || [];
      const tee = tees[Math.min(index, tees.length - 1)];
      return sum + (Number(tee?.yards) || Number(entry.yards) || 0);
    }, 0);
    const gap = Math.abs(total - Number(tripYards));
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  }
  teeIndexCache.set(geometry, { tripYards, index: best });
  return best;
}

export function projectHole(geometry, hole, options = {}) {
  const sourceHole = geometry?.holes?.find((entry) => Number(entry.num) === hole.number);
  if (!sourceHole?.line?.length) return fallbackProjection(hole);
  const teeSets = sourceHole.tees || [];
  const teeIndex = Math.min(tripTeeIndex(geometry, options.tripYards), Math.max(0, teeSets.length - 1));
  const tripTee = teeSets[teeIndex] || teeSets[0] || null;
  const teeRaw = tripTee?.pos || sourceHole.line[0];
  const pinRaw = sourceHole.pin || sourceHole.line.at(-1);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((teeRaw[0] * Math.PI) / 180);
  const toMeters = ([lat, lng]) => [(lng - teeRaw[1]) * metersPerDegreeLng, (lat - teeRaw[0]) * metersPerDegreeLat];
  const pinMeters = toMeters(pinRaw);
  const angle = Math.PI / 2 - Math.atan2(pinMeters[1], pinMeters[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
  const transformRaw = (point) => rotate(toMeters(point));
  const rawTee = transformRaw(teeRaw);
  const rawPin = transformRaw(pinRaw);
  const projectFeature = (feature) => ({
    type: feature.type,
    points: feature.coords.map(transformRaw).filter((point) => point.every(Number.isFinite)),
  });
  // Clubhouse practice greens get baked onto holes 1 and 18 (anything within
  // 150 m of the line): keep only greens that hold the pin or sit near it.
  const nearPin = (feature) => {
    if (feature.type !== "green") return true;
    if (pointInPolygon(rawPin, feature.points)) return true;
    const centroid = polygonCentroid(feature.points);
    return Math.hypot(centroid[0] - rawPin[0], centroid[1] - rawPin[1]) <= 60;
  };
  const rawFeatures = (geometry.features || [])
    .filter((feature) => Number(feature.hole) === hole.number && Array.isArray(feature.coords) && feature.coords.length >= 3)
    .map(projectFeature)
    .filter((feature) => feature.points.length >= 3)
    .filter(nearPin);
  const rawLine = sourceHole.line.map(transformRaw).filter((point) => point.every(Number.isFinite));
  const allPoints = [...rawFeatures.flatMap((feature) => feature.points), ...rawLine, rawTee, rawPin];
  if (!allPoints.length) return fallbackProjection(hole);
  const pad = 14;
  const minX = Math.min(...allPoints.map((point) => point[0])) - pad;
  const maxX = Math.max(...allPoints.map((point) => point[0])) + pad;
  const minY = Math.min(...allPoints.map((point) => point[1])) - pad;
  const maxY = Math.max(...allPoints.map((point) => point[1])) + pad;
  const width = Math.max(50, maxX - minX);
  const height = Math.max(80, maxY - minY);
  const toSvg = ([x, y]) => [x - minX, maxY - y];
  // A pond or bunker shared with the next hole is baked onto one hole only.
  // Pull any neighbouring hazard that reaches into this frame so it is drawn
  // and counts as terrain; the frame itself stays defined by this hole.
  const inFrame = (point) => point[0] >= minX && point[0] <= maxX && point[1] >= minY && point[1] <= maxY;
  const neighbourHazards = (geometry.features || [])
    .filter(
      (feature) =>
        Number(feature.hole) !== hole.number &&
        (feature.type === "water" || feature.type === "bunker") &&
        Array.isArray(feature.coords) &&
        feature.coords.length >= 3,
    )
    .map(projectFeature)
    .filter((feature) => feature.points.length >= 3 && feature.points.some(inFrame));

  const hazards = rawFeatures.filter((feature) => feature.type === "water" || feature.type === "bunker");
  let hazardPull = 0;
  for (const feature of hazards) {
    const centerX = feature.points.reduce((total, point) => total + point[0], 0) / feature.points.length;
    hazardPull += centerX * (feature.type === "water" ? 2.5 : 1);
  }
  const dangerSide = Math.abs(hazardPull) < 2 ? null : hazardPull < 0 ? "left" : "right";
  const hasWater = hazards.some((feature) => feature.type === "water");
  const primaryHazard = hasWater ? "water" : hazards.length ? "bunker" : null;
  const hazardArea = hazards.reduce((total, feature) => total + polygonArea(feature.points), 0) / (width * height || 1);
  const hazardSeverity = clamp(hazards.length * 0.055 + hazardArea * 2.8 + (hasWater ? 0.16 : 0), 0.08, 1);
  const routeShape = routeShapeProfile(rawLine, rawTee, rawPin);
  const hazardLabel = primaryHazard
    ? `${primaryHazard === "water" ? "WATER" : "BUNKERS"}${dangerSide ? ` ${dangerSide.toUpperCase()}` : ""}`
    : "NO MAJOR HAZARD";

  const projected = {
    width,
    height,
    features: [...rawFeatures, ...neighbourHazards]
      .map((feature) => ({ ...feature, points: feature.points.map(toSvg) }))
      .sort((a, b) => (FEATURE_ORDER[a.type] ?? 9) - (FEATURE_ORDER[b.type] ?? 9)),
    line: rawLine.map(toSvg),
    tee: toSvg(rawTee),
    pin: toSvg(rawPin),
    dangerSide,
    primaryHazard,
    hasWater,
    hazardLabel,
    hazardSeverity,
    ...routeShape,
    official: sourceHole,
    teeYards: Number(tripTee?.yards) || null,
    elevation: Number(sourceHole.elevM) || null,
    source: "OpenStreetMap / ODbL",
  };
  return withTrees(projected, hole.number);
}
