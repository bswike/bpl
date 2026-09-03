import { describe, expect, it } from "vitest";
import { polylineLength } from "../tripgame/geometry.js";
import { projectHole } from "../tripgame/projection.js";
import { EMPTY_RECORDS, noteRecord } from "../tripgame/records.js";
import { resolveLiveStroke } from "../tripgame/shotPhysics.js";
import { makeShot } from "../tripgame/shotTheater.js";
import { windEffect, windFor, windLabel } from "../tripgame/wind.js";

const LAT0 = 41;
const LNG0 = -74;
const mPerLat = 111320;
const mPerLng = mPerLat * Math.cos((LAT0 * Math.PI) / 180);
const at = (north, east) => [LAT0 + north / mPerLat, LNG0 + east / mPerLng];
const box = (n0, n1, e0, e1) => [at(n0, e0), at(n0, e1), at(n1, e1), at(n1, e0)];
const geometry = {
  holes: [{ num: 1, par: 4, yards: 383, hcp: 7, line: [at(0, 0), at(175, 0), at(350, 0)], tees: [{ pos: at(0, 0) }], pin: at(350, 0) }],
  features: [
    { type: "fairway", hole: 1, coords: box(30, 320, -20, 20) },
    { type: "green", hole: 1, coords: box(335, 365, -14, 14) },
    { type: "water", hole: 1, coords: box(268, 290, -25, 25) },
  ],
};
const hole = { number: 1, par: 4, yards: 383, si: 7 };
const projection = projectHole(geometry, hole);
const yardsScale = polylineLength(projection.line) / hole.yards;
const pure = { tier: "pure" };
const shot = (extra) =>
  resolveLiveStroke({ projection, hole, from: projection.tee, lie: "Tee", meter: { power: 0.87, accuracy: 0 }, judgment: pure, clubId: "driver", carryBoost: 1, yardsScale, hi: 8, ...extra });

describe("wind", () => {
  it("is seeded per hole and round, capped at 18 mph", () => {
    const a = windFor({ number: 4 }, 12);
    expect(windFor({ number: 4 }, 12)).toEqual(a);
    expect(windFor({ number: 4 }, 13)).not.toEqual(a);
    for (let n = 1; n <= 18; n += 1) expect(windFor({ number: n }, 5).mph).toBeLessThanOrEqual(18);
  });
  it("helps downwind, hurts into it, drifts across", () => {
    const up = [0, -1];
    const helping = { mph: 12, vx: 0, vy: -12 };
    const into = { mph: 12, vx: 0, vy: 12 };
    const cross = { mph: 12, vx: 12, vy: 0 };
    expect(windEffect(helping, up, 250).carryMult).toBeGreaterThan(1.04);
    expect(windEffect(into, up, 250).carryMult).toBeLessThan(0.96);
    expect(Math.abs(windEffect(cross, up, 250).driftYards)).toBeGreaterThan(5);
    expect(Math.abs(windEffect(cross, up, 100).driftYards)).toBeLessThan(Math.abs(windEffect(cross, up, 250).driftYards));
    expect(windLabel(into, up)).toBe("12MPH INTO");
    expect(windLabel(null, up)).toBe("CALM");
  });
});

describe("rollout and spin", () => {
  it("rolls a drive out on the fairway and further with topspin", () => {
    const plain = shot({});
    expect(plain.rollYards).toBeGreaterThan(10);
    expect(plain.totalYards).toBe(Math.round(Math.hypot(plain.to[0] - projection.tee[0], plain.to[1] - projection.tee[1]) / yardsScale));
    // A topspin drive here runs straight through into the pond; compare spin on an iron that stops short of it.
    const iron = shot({ clubId: "iron7" });
    const ironTop = shot({ clubId: "iron7", spin: "top" });
    expect(ironTop.rollYards).toBeGreaterThan(iron.rollYards);
    expect(shot({ spin: "top" }).kind).toBe("splash");
  });
  it("can roll into the water it carried", () => {
    // Carry to just short of the pond at 268 m, then let the roll find it.
    const pondFrontUnits = 268 - 6;
    const from = [projection.tee[0], projection.tee[1] - (pondFrontUnits - 40)];
    const res = resolveLiveStroke({ projection, hole, from, lie: "Fairway", meter: { power: 0.87, accuracy: 0 }, judgment: pure, clubId: "chip", carryBoost: 1, yardsScale, hi: 8, spin: "top" });
    expect(res.kind).toBe("splash");
    expect(res.caption).toBe("ROLLS INTO THE WATER!");
  });
  it("bites with backspin on a flushed approach into the green", () => {
    const from = [projection.pin[0], projection.pin[1] + 130 * yardsScale];
    const res = resolveLiveStroke({ projection, hole, from, lie: "Fairway", meter: { power: 0.87, accuracy: 0 }, judgment: pure, clubId: "iron9", carryBoost: 1, yardsScale, hi: 8, spin: "back" });
    expect(res.nextLie).toBe("Green");
    expect(res.rollYards).toBeLessThanOrEqual(0);
    expect(res.caption).toBe("BITES!");
  });
  it("calls out a close approach", () => {
    const from = [projection.pin[0], projection.pin[1] + 105 * 1.048 * yardsScale];
    const res = resolveLiveStroke({ projection, hole, from, lie: "Fairway", meter: { power: 0.87, accuracy: 0 }, judgment: { tier: "great" }, clubId: "wedge", carryBoost: 1, yardsScale, hi: 8, spin: "back" });
    expect(["KICK-IN!", "STIFF!", "GREAT LOOK!", "BITES!"]).toContain(res.caption);
    expect(res.proximityFeet).toBeLessThanOrEqual(15);
  });
  it("animates the flight and then the roll", () => {
    const res = shot({});
    const theater = makeShot({ from: projection.tee, to: res.to, carryTo: res.carryTo, kind: "drive", yardsScale });
    expect(theater.frames.some((frame) => frame.rolling)).toBe(true);
    expect(theater.frames.at(-1).gx).toBeCloseTo(res.to[0], 5);
    expect(theater.yards).toBe(res.totalYards);
  });
});

describe("records", () => {
  it("keeps the bar-room numbers and says when one falls", () => {
    let state = { ...EMPTY_RECORDS };
    let out = noteRecord(state, { type: "drive", yards: 288, player: "A", course: "CS", hole: 1 });
    expect(out.record.kind).toBe("longestDrive");
    state = out.records;
    out = noteRecord(state, { type: "drive", yards: 270, player: "A", course: "CS", hole: 2 });
    expect(out.record).toBeNull();
    out = noteRecord(out.records, { type: "approach", feet: 4, fromYards: 150, player: "A", course: "CS", hole: 3 });
    expect(out.record.label).toBe("CLOSEST APPROACH · 4 FT");
    out = noteRecord(out.records, { type: "holeOut", ace: true });
    expect(out.records.aces).toBe(1);
    expect(out.record.label).toBe("HOLE IN ONE #1");
    out = noteRecord(out.records, { type: "streak", count: 2, player: "A" });
    expect(out.record).toBeNull();
  });
});

describe("batch B: bite, drift frame, drop", () => {
  it("does not spin back off the green into a fronting pond", () => {
    const fronted = {
      ...geometry,
      features: [
        { type: "fairway", hole: 1, coords: box(30, 315, -20, 20) },
        { type: "green", hole: 1, coords: box(335, 365, -14, 14) },
        { type: "water", hole: 1, coords: box(318, 334, -25, 25) },
      ],
    };
    const proj = projectHole(fronted, hole);
    const scale = polylineLength(proj.line) / hole.yards;
    // Land 1.5 m onto the front of the green; a 3-yard bite would cross the pond edge.
    const carry = 105 * 1.048 * 0.97;
    const from = [proj.pin[0], proj.pin[1] + (13.5 + carry * scale)];
    const res = resolveLiveStroke({ projection: proj, hole, from, lie: "Fairway", meter: { power: 0.87, accuracy: 0 }, judgment: pure, clubId: "wedge", carryBoost: 1, yardsScale: scale, hi: 8, spin: "back" });
    expect(res.kind).not.toBe("splash");
    expect(res.nextLie).toBe("Green");
    expect(res.rollYards).toBeGreaterThanOrEqual(0);
  });
  it("drifts the same way on screen whichever way the shot is headed", () => {
    const cross = { mph: 15, angle: Math.PI / 2, vx: 15, vy: 0 };
    const up = shot({ wind: cross, clubId: "iron7", judgment: { tier: "great" } });
    const fromPast = [projection.pin[0], projection.pin[1] - 20];
    const target = [projection.pin[0], projection.pin[1] + 120 * yardsScale];
    const down = resolveLiveStroke({ projection, hole, from: fromPast, lie: "Rough", meter: { power: 0.87, accuracy: 0 }, judgment: { tier: "great" }, clubId: "iron9", carryBoost: 1, yardsScale, hi: 8, wind: cross, lineTarget: target });
    expect(up.carryTo[0] - projection.tee[0]).toBeGreaterThan(0.5);
    expect(down.carryTo[0] - fromPast[0]).toBeGreaterThan(0.5);
  });
  it("drops a trickle-in beside the hazard, not down the fairway", () => {
    const res = shot({ spin: "top" });
    expect(res.kind).toBe("splash");
    const dropBack = Math.hypot(res.nextPos[0] - res.to[0], res.nextPos[1] - res.to[1]) / yardsScale;
    expect(dropBack).toBeLessThan(12);
  });
});

describe("records at the bar", () => {
  it("only counts drives from 200, putts from 6 ft and approaches from 40 yards", () => {
    const base = { player: "A", course: "CS", hole: 1 };
    expect(noteRecord(EMPTY_RECORDS, { type: "drive", yards: 199, ...base }).record).toBeNull();
    expect(noteRecord(EMPTY_RECORDS, { type: "drive", yards: 200, ...base }).record).not.toBeNull();
    expect(noteRecord(EMPTY_RECORDS, { type: "putt", feet: 5, ...base }).record).toBeNull();
    expect(noteRecord(EMPTY_RECORDS, { type: "putt", feet: 6, ...base }).record).not.toBeNull();
    expect(noteRecord(EMPTY_RECORDS, { type: "approach", feet: 3, fromYards: 39, ...base }).record).toBeNull();
    expect(noteRecord(EMPTY_RECORDS, { type: "approach", feet: 3, fromYards: 40, ...base }).record).not.toBeNull();
  });
  it("survives a storage that throws", async () => {
    const { loadRecords, saveRecords } = await import("../tripgame/records.js");
    const angry = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
    expect(loadRecords(angry)).toEqual({ ...EMPTY_RECORDS });
    expect(() => saveRecords(angry, EMPTY_RECORDS)).not.toThrow();
    expect(loadRecords(null)).toEqual({ ...EMPTY_RECORDS });
  });
});
