import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectHole } from "../tripgame/projection.js";
import {
  createTerrainSampler,
  gridElevation,
  mapToGeographic,
} from "../tripgame/elevationTerrain.js";
import { groundCameraFrame, groundShotPoint } from "../tripgame/groundView.js";
const course = JSON.parse(readFileSync("public/data/black-bear.json", "utf8"));
const profiles = JSON.parse(
  readFileSync("public/data/black-bear-elevation.json", "utf8"),
);
const terrain = JSON.parse(
  readFileSync(
    "src/components/golf/tripgame/data/blackBearTerrain.json",
    "utf8",
  ),
);

describe("Black Bear terrain", () => {
  it("contains complete, finite six-meter grids for the surveyed opening holes", () => {
    expect(terrain.holes.map((h) => h.number)).toEqual([1, 2, 3, 4, 5]);
    for (const grid of terrain.holes) {
      expect(grid.heights).toHaveLength(grid.rows * grid.cols);
      expect(
        grid.heights.every((h) => Number.isFinite(h) && h > 100 && h < 350),
      ).toBe(true);
      expect(
        ((grid.north - grid.south) * 111320) / (grid.rows - 1),
      ).toBeLessThanOrEqual(6);
    }
  });
  for (const grid of terrain.holes) {
    it(`aligns hole ${grid.number} terrain with all tee sets and independently sampled profiles`, () => {
      const source = course.holes[grid.number - 1];
      for (let index = 0; index < source.tees.length; index++) {
        const selectedCourse = {
          ...course,
          holes: course.holes.map((h) => ({
            ...h,
            tees: [h.tees[Math.min(index, h.tees.length - 1)]],
          })),
        };
        const p = projectHole(selectedCourse, {
          number: grid.number,
          par: source.par,
          yards: source.tees[index].yards,
        });
        const tee = mapToGeographic(p, ...p.tee),
          pin = mapToGeographic(p, ...p.pin);
        tee.forEach((value, i) =>
          expect(value).toBeCloseTo(source.tees[index].pos[i], 8),
        );
        pin.forEach((value, i) => expect(value).toBeCloseTo(source.pin[i], 8));
        const heightAt = createTerrainSampler(p, grid);
        expect(heightAt(...p.tee)).toBe(0);
        const profile = profiles.holes[grid.number - 1].tees[index];
        expect(
          Math.abs(
            heightAt(...p.pin) - (profile.summary.netChangeFt * 1200) / 3937,
          ),
        ).toBeLessThan(1.5);
        const camera = groundCameraFrame(p.tee, p.pin, heightAt);
        expect(
          camera.eye[1] - heightAt(camera.eye[0], camera.eye[2]),
        ).toBeGreaterThanOrEqual(3.099);
      }
    });
  }
  it("interpolates a planar cross slope and clamps outside the sampled extent", () => {
    const grid = {
      cols: 2,
      rows: 2,
      west: 0,
      east: 1,
      south: 0,
      north: 1,
      heights: [10, 20, 30, 40],
    };
    expect(gridElevation(grid, 0.5, 0.5)).toBe(25);
    expect(gridElevation(grid, 2, 2)).toBe(40);
  });
  it("keeps launch, landing and rollout on a sloping surface while preserving horizontal shot shape", () => {
    const heightAt = (x, z) => x * 0.1 + z * 0.2;
    const shot = {
      air: true,
      from: [0, 0],
      carryTo: [100, 0],
      to: [110, 0],
      frames: [
        { gx: 0, gy: 0, lift: 0 },
        { gx: 50, gy: 8, lift: 30 },
        { gx: 100, gy: 0, lift: 0 },
        { gx: 110, gy: 0, lift: 0, rolling: true },
      ],
    };
    expect(groundShotPoint(shot, 0, heightAt)).toEqual([0, 0.12, 0]);
    expect(groundShotPoint(shot, 1, heightAt)).toEqual([50, 21.62, 8]);
    expect(groundShotPoint(shot, 2, heightAt)).toEqual([100, 10.12, 0]);
    expect(groundShotPoint(shot, 3, heightAt)).toEqual([110, 11.12, 0]);
    expect(createTerrainSampler({}, undefined)(10, 20)).toBe(0);
  });
});
