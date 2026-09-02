import { describe, expect, it } from "vitest";
import { classifyTerrain, nearestFeaturePoint, pointInPolygon } from "../tripgame/terrain.js";

const square = (x, y, size) => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];

describe("pointInPolygon", () => {
  it("handles open and closed rings", () => {
    const ring = square(0, 0, 10);
    expect(pointInPolygon([5, 5], ring)).toBe(true);
    expect(pointInPolygon([15, 5], ring)).toBe(false);
    expect(pointInPolygon([5, 5], [...ring, ring[0]])).toBe(true);
  });
});

describe("classifyTerrain", () => {
  const features = [
    { type: "fairway", points: square(0, 0, 100) },
    { type: "green", points: square(60, 60, 30) },
    { type: "bunker", points: square(70, 50, 15) },
    { type: "water", points: square(75, 55, 5) },
  ];
  it("ranks water over sand over short grass over rough", () => {
    expect(classifyTerrain(features, [77, 57])).toBe("Penalty area");
    expect(classifyTerrain(features, [72, 52])).toBe("Bunker");
    expect(classifyTerrain(features, [65, 65])).toBe("Fairway");
    expect(classifyTerrain(features, [20, 20])).toBe("Fairway");
    expect(classifyTerrain(features, [150, 150])).toBe("Rough");
  });
  it("keeps a bunker that overlaps the green as sand", () => {
    expect(classifyTerrain(features, [72, 62])).toBe("Bunker");
  });
});

describe("nearestFeaturePoint", () => {
  const lake = { type: "water", points: square(100, 0, 400) };
  it("measures to the shore, not the centroid, and lands just inside", () => {
    const hit = nearestFeaturePoint([lake], "water", [90, 200], 30);
    expect(hit).not.toBeNull();
    expect(hit.distance).toBeCloseTo(10, 5);
    expect(pointInPolygon(hit.point, lake.points)).toBe(true);
    expect(hit.point[0]).toBeLessThan(110);
  });
  it("skips features farther than maxDist", () => {
    expect(nearestFeaturePoint([lake], "water", [0, 200], 30)).toBeNull();
  });
  it("returns the target itself when already inside", () => {
    expect(nearestFeaturePoint([lake], "water", [300, 200], 30)).toEqual({ point: [300, 200], distance: 0 });
  });
});
