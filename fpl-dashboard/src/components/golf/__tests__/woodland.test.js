import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectHole } from "../tripgame/projection.js";
import { mappedWoodland, geographicToMap } from "../tripgame/woodland.js";
import { mapToGeographic } from "../tripgame/elevationTerrain.js";
import { classifyTerrain, pointInPolygon } from "../tripgame/terrain.js";
const course = JSON.parse(readFileSync("public/data/black-bear.json", "utf8"));
const data = JSON.parse(
  readFileSync(
    "src/components/golf/tripgame/data/blackBearWoodland.json",
    "utf8",
  ),
);
describe("Black Bear aerial woodland", () => {
  for (const h of data.holes)
    it(`keeps hole ${h.number} trees in traced woods or individual locations, with matching collision trees`, () => {
      const p = projectHole(course, {
        number: h.number,
        par: course.holes[h.number - 1].par,
      });
      const trees = mappedWoodland(p, h.number);
      // A short par 3 sits in a tight frame and carries fewer stems.
      expect(trees.length).toBeGreaterThan(course.holes[h.number - 1].par === 3 ? 50 : 100);
      expect(trees.length).toBeLessThan(1800);
      expect(new Set(trees.map((t) => t.species)).size).toBeGreaterThan(3);
      const areas = h.areas.map((a) => a.map((ll) => geographicToMap(p, ll)));
      for (const t of trees) {
        expect(classifyTerrain(p.features, [t.x, t.y])).toBe("Rough");
        expect(t.height).toBeGreaterThanOrEqual(10);
        expect(t.height).toBeLessThanOrEqual(24);
        if (!t.individual)
          expect(areas.some((a) => pointInPolygon([t.x, t.y], a))).toBe(true);
        expect(t.radius).toBeGreaterThan(1);
      }
      for (const t of p.trees)
        expect(
          trees.some((v) => v.seed === t.seed && v.x === t.x && v.y === t.y),
        ).toBe(true);
      expect(mappedWoodland(p, h.number)).toBe(trees);
    });
  it("does not move tree coordinates when a different tee is selected", () => {
    const a = projectHole(course, { number: 1, par: 4 });
    const short = {
      ...course,
      holes: course.holes.map((h) => ({ ...h, tees: [h.tees.at(-1)] })),
    };
    const b = projectHole(short, { number: 1, par: 4 });
    const first = mappedWoodland(a, 1),
      second = mappedWoodland(b, 1);
    let shared = 0;
    for (const tree of first) {
      const other = second.find((t) => t.seed === tree.seed);
      if (!other) continue;
      const ll = mapToGeographic(a, tree.x, tree.y),
        rr = mapToGeographic(b, other.x, other.y);
      expect(ll[0]).toBeCloseTo(rr[0], 8);
      expect(ll[1]).toBeCloseTo(rr[1], 8);
      shared++;
    }
    expect(shared).toBeGreaterThan(100);
  });
});
