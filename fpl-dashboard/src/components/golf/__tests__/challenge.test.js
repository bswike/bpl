import { describe, expect, it } from "vitest";
import { decodeCode, encodeCode, randomSeed, streamSeeds } from "../tripgame/challenge.js";

describe("challenge codes", () => {
  it("round-trips course, side, style and seed", () => {
    const seed = randomSeed(1700000000123);
    const code = encodeCode({ slug: "wild-turkey", team: "North", swingMode: "full", seed });
    expect(code).toMatch(/^WT-N-F-[0-9A-Z]{5}$/);
    expect(decodeCode(code)).toEqual({ slug: "wild-turkey", team: "North", swingMode: "full", seed });
    expect(decodeCode(encodeCode({ slug: "suntree-classic", team: "South", swingMode: "single", seed: 1 }))).toEqual({
      slug: "suntree-classic",
      team: "South",
      swingMode: "single",
      seed: 1,
    });
    expect(decodeCode(code.toLowerCase())).toEqual(decodeCode(code));
  });
  it("rejects junk", () => {
    expect(decodeCode("hello")).toBeNull();
    expect(decodeCode("ZZ-S-F-12345")).toBeNull();
    expect(decodeCode("")).toBeNull();
  });
});

describe("streamSeeds", () => {
  it("gives each hole its own deterministic streams", () => {
    const a = streamSeeds(12345, 0);
    expect(streamSeeds(12345, 0)).toEqual(a);
    expect(streamSeeds(12345, 5)).not.toEqual(a);
    expect(streamSeeds(12345, 5).cpu).not.toBe(streamSeeds(12346, 5).cpu);
    expect(a.human).not.toBe(a.cpu);
  });
});

describe("seed space", () => {
  it("wraps seeds past 36^5 and decodes back", async () => {
    const { SEED_SPACE } = await import("../tripgame/challenge.js");
    const code = encodeCode({ slug: "ballyowen", team: "South", swingMode: "single", seed: SEED_SPACE + 5 });
    expect(code).toBe("BO-S-O-00005");
    expect(decodeCode(code).seed).toBe(5);
  });
});
