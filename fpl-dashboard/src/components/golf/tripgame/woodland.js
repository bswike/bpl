import data from "./data/blackBearWoodland.json";
import { seededUnit } from "./geometry.js";
import { pointInPolygon, classifyTerrain } from "./terrain.js";
export function geographicToMap(projection, [lat, lng]) {
  const g = projection.georeference;
  const x = (lng - g.tee[1]) * g.metersPerDegreeLng,
    y = (lat - g.tee[0]) * 111320;
  return [x * g.cos - y * g.sin - g.minX, g.maxY - (x * g.sin + y * g.cos)];
}
/** The traced wooded areas for a hole in map units, for drawing the canopy. */
export function woodlandAreas(projection, holeNumber) {
  const source = data.holes.find((h) => h.number === holeNumber);
  if (!source || !projection.georeference) return [];
  return source.areas.map((p) => p.map((v) => geographicToMap(projection, v)));
}

const cache = new WeakMap();
export function mappedWoodland(projection, holeNumber) {
  if (cache.has(projection)) return cache.get(projection);
  const source = data.holes.find((h) => h.number === holeNumber);
  if (!source || !projection.georeference) return [];
  const trees = [],
    areas = source.areas.map((p) =>
      p.map((v) => geographicToMap(projection, v)),
    );
  const extent = Math.max(projection.width, projection.height) + 240;
  const minX = (projection.width - extent) / 2,
    minY = (projection.height - extent) / 2;
  function add(x, y, seed, individual = false) {
    if (x < minX || x > minX + extent || y < minY || y > minY + extent) return;
    if (classifyTerrain(projection.features, [x, y]) !== "Rough") return;
    if (
      Math.hypot(x - projection.tee[0], y - projection.tee[1]) < 12 ||
      Math.hypot(x - projection.pin[0], y - projection.pin[1]) < 10
    )
      return;
    const species = [
      "oak",
      "maple",
      "oak",
      "hickory",
      "maple",
      "poplar",
      "basswood",
      "locust",
    ][Math.floor(seededUnit(seed + 3) * 8)];
    const height =
      (individual ? 10 : 15) + seededUnit(seed + 5) * (individual ? 7 : 9);
    const radius =
      species === "poplar"
        ? height * 0.19
        : height * ((individual ? 0.3 : 0.24) + seededUnit(seed + 7) * 0.08);
    // Keep the crown off sand, water and greens; the stem alone was hiding
    // the left fairway bunker on the 1st.
    const hazards = projection.features.filter((f) =>
      ["bunker", "water", "green"].includes(f.type),
    );
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2,
        px = x + Math.cos(a) * radius,
        py = y + Math.sin(a) * radius;
      if (hazards.some((f) => pointInPolygon([px, py], f.points))) return;
    }
    trees.push({
      x,
      y,
      size: radius / 1.15,
      height,
      radius,
      species,
      seed,
      variant: Math.floor(seededUnit(seed + 11) * 3),
      individual,
    });
  }
  source.individuals.forEach((p, i) =>
    add(...geographicToMap(projection, p), holeNumber * 991 + i * 113, true),
  );
  // Use a geographic lattice so changing tees does not move the forest.
  const scale = 111320 * Math.cos((41.12 * Math.PI) / 180),
    step = source.spacingM;
  const all = source.areas.flat();
  const west = Math.min(...all.map((p) => p[1])),
    east = Math.max(...all.map((p) => p[1]));
  const south = Math.min(...all.map((p) => p[0])),
    north = Math.max(...all.map((p) => p[0]));
  for (
    let row = Math.floor((south * 111320) / step);
    row <= Math.ceil((north * 111320) / step);
    row++
  ) {
    for (
      let col = Math.floor((west * scale) / step);
      col <= Math.ceil((east * scale) / step);
      col++
    ) {
      const seed = row * 127 + col * 619;
      if (seededUnit(seed) < 0.16) continue;
      const lat = ((row + 0.15 + seededUnit(seed + 1) * 0.7) * step) / 111320,
        lng = ((col + 0.15 + seededUnit(seed + 2) * 0.7) * step) / scale;
      const [x, y] = geographicToMap(projection, [lat, lng]);
      if (!areas.some((p) => pointInPolygon([x, y], p))) continue;
      if (trees.some((t) => t.individual && Math.hypot(t.x - x, t.y - y) < 7))
        continue;
      add(x, y, seed);
    }
  }
  cache.set(projection, trees);
  return trees;
}
