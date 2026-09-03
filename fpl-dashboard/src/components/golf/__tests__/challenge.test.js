import { describe, expect, it } from "vitest";
import { decodeCode, encodeCode, randomSeed } from "../tripgame/challenge.js";

describe("challenge codes", () => {
  it("round-trips course, side, style and seed", () => {
    const seed = randomSeed(1700000000123);
    const code = encodeCode({ slug: "wild-turkey", team: "North", swingMode: "full", seed });
    expect(code).toMatch(/^WT-N-F-[0-9A-Z]{5}$/);
    expect(decodeCode(code)).toEqual({ slug: "wild-turkey", team: "North", swingMode: "full", seed });
    expect(decodeCode(code.toLowerCase())).toEqual(decodeCode(code));
  });
  it("rejects junk", () => {
    expect(decodeCode("hello")).toBeNull();
    expect(decodeCode("ZZ-S-F-12345")).toBeNull();
    expect(decodeCode("")).toBeNull();
  });
});
