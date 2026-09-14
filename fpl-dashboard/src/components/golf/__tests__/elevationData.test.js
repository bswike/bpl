import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
const read = (name) =>
  JSON.parse(
    readFileSync(
      new URL(`../../../../public/data/${name}`, import.meta.url),
      "utf8",
    ),
  );
const data = read("black-bear-elevation.json"),
  geometry = read("black-bear.json");
describe("Black Bear lidar elevation profiles", () => {
  it("covers every mapped hole and tee using explicit vertical units", () => {
    expect(data.holes).toHaveLength(18);
    expect(data.source.verticalUnits).toBe("US survey feet");
    expect(data.source.verticalDatum).toContain("NAVD88");
    for (const hole of data.holes) {
      const mapped = geometry.holes.find((h) => h.num === hole.number);
      expect(hole.tees).toHaveLength(mapped.tees.length);
      for (const tee of hole.tees) {
        expect(tee.points.length).toBeGreaterThan(2);
        expect(tee.points[0].lat).toBeCloseTo(mapped.tees[tee.index].pos[0], 6);
        expect(tee.points[0].lng).toBeCloseTo(mapped.tees[tee.index].pos[1], 6);
        expect(tee.points.at(-1).lat).toBeCloseTo(mapped.pin[0], 6);
        expect(tee.points.at(-1).lng).toBeCloseTo(mapped.pin[1], 6);
        tee.points.forEach((p, i) => {
          expect(p.elevationFt).toBeGreaterThan(0);
          expect(p.elevationFt).toBeLessThan(1804);
          expect(p.elevationM).toBeCloseTo((p.elevationFt * 1200) / 3937, 2);
          if (i) {
            expect(p.distanceM).toBeGreaterThan(tee.points[i - 1].distanceM);
            expect(
              p.distanceM - tee.points[i - 1].distanceM,
            ).toBeLessThanOrEqual(5.01);
          }
        });
      }
    }
  });
  it("agrees at shared greens and preserves the sampled first-hole climb", () => {
    for (const hole of data.holes) {
      const heights = hole.tees.map((t) => t.summary.greenElevationFt);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(0.1);
    }
    expect(data.holes[0].tees[0].summary.netChangeFt).toBeCloseTo(36.85, 1);
  });
});
