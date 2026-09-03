import { describe, expect, it } from "vitest";
import { computeMapCamera } from "../tripgame/camera.js";
import { LIVE_CARRY_SWEET, LIVE_CLUBS, defaultLiveClub } from "../tripgame/clubs.js";
import { polylineLength } from "../tripgame/geometry.js";
import { judgeSwing } from "../tripgame/meter.js";
import { fallbackProjection, projectHole } from "../tripgame/projection.js";
import { makePuttRead, resolveLivePutt, stimpOf } from "../tripgame/putting.js";
import { resolveLiveStroke } from "../tripgame/shotPhysics.js";
import { buildShotSequence } from "../tripgame/shotTheater.js";
import { classifyTerrain } from "../tripgame/terrain.js";

// A straight 350 m hole heading due north from (41°, -74°), with a 40 m wide
// fairway, a green at the pin, a practice green off to the side, and a pond
// baked onto the neighbouring hole that reaches into this frame.
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
    { type: "green", hole: 1, coords: box(20, 50, 150, 180) },
    { type: "water", hole: 2, coords: box(150, 200, -45, -25) },
  ],
};
const hole = { number: 1, par: 4, yards: 383, si: 7 };
const projection = projectHole(geometry, hole);
const yardsScale = polylineLength(projection.line) / hole.yards;
const pure = { tier: "pure" };
const stroke = (extra) =>
  resolveLiveStroke({
    projection,
    hole,
    from: projection.tee,
    lie: "Tee",
    meter: { power: 0.87, accuracy: 0 },
    judgment: pure,
    clubId: "driver",
    carryBoost: 1,
    yardsScale,
    hi: 12,
    ...extra,
  });

describe("projectHole", () => {
  it("puts the pin at the top, keeps one real green, drops the practice green and pulls in the neighbour's pond", () => {
    expect(projection.pin[1]).toBeLessThan(projection.tee[1]);
    expect(projection.features.filter((feature) => feature.type === "green")).toHaveLength(1);
    expect(projection.features.some((feature) => feature.type === "water")).toBe(true);
    expect(projection.hasWater).toBe(false); // the neighbour's pond is drawn, but this hole's own read stays honest
  });
  it("never plants a tree on the fairway, the green or in the water", () => {
    expect(projection.trees.length).toBeGreaterThan(0);
    for (const tree of projection.trees) expect(classifyTerrain(projection.features, [tree.x, tree.y])).toBe("Rough");
    const fallback = fallbackProjection(hole);
    for (const tree of fallback.trees) expect(classifyTerrain(fallback.features, [tree.x, tree.y])).toBe("Rough");
  });
});

describe("resolveLiveStroke", () => {
  it("lands a flushed centre tap at the sweet-spot carry on the fairway", () => {
    const res = stroke({});
    const carried = Math.hypot(res.carryTo[0] - projection.tee[0], res.carryTo[1] - projection.tee[1]) / yardsScale;
    expect(carried).toBeCloseTo(255 * LIVE_CARRY_SWEET, 0);
    expect(res.rollYards).toBeGreaterThan(10); // a drive runs out on the fairway
    expect(res.totalYards).toBeGreaterThan(carried);
    expect(res.nextLie).toBe("Fairway");
    expect(res.penalty).toBeUndefined();
  });
  it("keeps a greenside bunker as sand even inside the green's box", () => {
    const pin = projection.pin;
    const carryUnits = 42 * LIVE_CARRY_SWEET * yardsScale;
    // Straight at the pin from 12 m beyond the chip's carry: the ball stops 12 m short, in the sand.
    const from = [pin[0], pin[1] + carryUnits + 12];
    const bunker = { type: "bunker", points: [[pin[0] - 5, pin[1] + 7], [pin[0] + 5, pin[1] + 7], [pin[0] + 5, pin[1] + 17], [pin[0] - 5, pin[1] + 17]] };
    const sandy = { ...projection, features: [...projection.features, bunker] };
    const res = resolveLiveStroke({ projection: sandy, hole, from, lie: "Fairway", meter: { power: 0.87, accuracy: 0 }, judgment: pure, clubId: "chip", carryBoost: 1, yardsScale, hi: 12 });
    expect(res.nextLie).toBe("Bunker");
    expect(res.feet).toBeUndefined();
  });
  it("marks a banana slice off the map as stroke and distance", () => {
    const res = stroke({ judgment: { tier: "wild" }, meter: { power: 0.87, accuracy: 0.9 }, rng: () => 0.9 });
    expect(res.kind).toBe("ob");
    expect(res.penalty).toBe(1);
    expect(res.nextPos).toEqual(projection.tee);
  });
  it("sprays wider with a fireball", () => {
    const plain = stroke({ judgment: { tier: "good" }, meter: { power: 0.87, accuracy: 0.3 } });
    const fire = stroke({ judgment: { tier: "good" }, meter: { power: 0.87, accuracy: 0.3 }, fireball: true });
    expect(Math.abs(fire.to[0] - projection.tee[0])).toBeGreaterThan(Math.abs(plain.to[0] - projection.tee[0]));
  });
  it("aims a tee ball at the planned line target instead of the pin", () => {
    const target = [projection.tee[0] + 30, projection.tee[1] - 200];
    const res = stroke({ lineTarget: target });
    expect(res.to[0]).toBeGreaterThan(projection.tee[0] + 20);
  });
});

describe("judgeSwing", () => {
  it("grades taps from pure to wild", () => {
    expect(judgeSwing(0.87, 0).tier).toBe("pure");
    expect(judgeSwing(0.87, 0.25).tier).toBe("good");
    expect(judgeSwing(0.87, 0.9).tier).toBe("wild");
  });
});

describe("putting", () => {
  const read = makePuttRead({ hole, puttCount: 0, feet: 10, sceneCarry: null });
  const pace = (read.paceBand.min + read.paceBand.max) / 2;
  const aim = Math.round(read.requiredTicks);
  it("holes a putt aimed on the read at good pace", () => {
    expect(resolveLivePutt({ read, aimTicks: aim, meter: { power: pace, accuracy: 0 }, puttCount: 0 }).made).toBe(true);
  });
  it("misses a hot putt and leaves something", () => {
    const hot = resolveLivePutt({ read, aimTicks: aim, meter: { power: pace + 0.3, accuracy: 0 }, puttCount: 0 });
    expect(hot.made).toBe(false);
    expect(hot.leaveFeet).toBeGreaterThan(0);
  });
  it("only shows mercy on the fourth putt", () => {
    const miss = { read, aimTicks: aim + 5, meter: { power: pace, accuracy: 0 } };
    expect(resolveLivePutt({ ...miss, puttCount: 2 }).made).toBe(false);
    expect(resolveLivePutt({ ...miss, puttCount: 3 }).made).toBe(true);
  });
  it("varies green speed by round, deterministically", () => {
    const tiers = new Set(Array.from({ length: 30 }, (_, salt) => stimpOf({ number: 4, stimpSalt: salt })));
    expect(tiers.size).toBeGreaterThan(1);
    expect(stimpOf({ number: 4, stimpSalt: 9 })).toBe(stimpOf({ number: 4, stimpSalt: 9 }));
  });
});

describe("defaultLiveClub", () => {
  it("clubs up rather than coming up short", () => {
    expect(defaultLiveClub(150, "Fairway")).toBe("iron7");
    expect(defaultLiveClub(100, "Fairway")).toBe("wedge");
    expect(defaultLiveClub(100, "Bunker")).toBe("wedge");
    expect(LIVE_CLUBS.every((club) => club.id !== "wood" && club.id !== "iron")).toBe(true);
  });
});

describe("buildShotSequence", () => {
  it("animates exactly the sampled gross and finishes in the hole", () => {
    const decision = { club: "driver", aim: 0, shape: "straight", fireball: false, carryBoost: 1 };
    const shots = buildShotSequence({ projection, hole, decision, gross: 4, landingLabel: "Fairway", side: "cpu", seedSalt: 5 });
    expect(shots).toHaveLength(4);
    expect(shots.at(-1)).toMatchObject({ kind: "putt", final: true, side: "cpu" });
  });
});

describe("computeMapCamera", () => {
  it("frames both the tee and the pin when planning, at the requested aspect", () => {
    const camera = computeMapCamera({ projection, playback: null, landing: null, activeShot: null, flightFrame: null, liveFocus: null, aspect: 0.8 });
    const contains = ([x, y]) => x >= camera.x && x <= camera.x + camera.w && y >= camera.y && y <= camera.y + camera.h;
    expect(contains(projection.tee)).toBe(true);
    expect(contains(projection.pin)).toBe(true);
    expect(camera.w / camera.h).toBeCloseTo(0.8, 1);
  });
});
