import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildHoleOdds,
  buildTripGameModel,
  chooseCpuPlayer,
  defaultDecision,
  holePops,
  makeSeededRandom,
  matchCloseout,
  resolveMatchHole,
} from "../tripGameEngine.js";

const readJson = (name) =>
  JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../../../public/data/${name}`, import.meta.url)), "utf8"));
const nj26 = readJson("golftrip-nj26.json");
const archive = readJson("golftrip-2025.json");
const model = buildTripGameModel(nj26, [archive]);

describe("buildTripGameModel", () => {
  it("offers every course the trip plays, including team-only and par-less rounds", () => {
    const slugs = model.courses.map((course) => course.slug).sort();
    expect(slugs).toEqual(["ballyowen", "black-bear", "crystal-springs", "wild-turkey"]);
    for (const course of model.courses) {
      expect(course.holes).toHaveLength(18);
      expect(course.holes.every((hole) => hole.par >= 3 && hole.par <= 5)).toBe(true);
      expect(Number.isFinite(course.averageToPar)).toBe(true);
    }
  });
  it("keeps every probability vector finite and normalised", () => {
    for (const course of model.courses) {
      for (const hole of course.holes) {
        for (const profile of model.players) {
          const odds = buildHoleOdds({ profile, course, hole, decision: defaultDecision(profile, hole), state: null });
          const total = odds.probs.reduce((sum, value) => sum + value, 0);
          expect(odds.probs.every(Number.isFinite)).toBe(true);
          expect(total).toBeCloseTo(1, 6);
        }
      }
    }
  });
});

describe("matchCloseout", () => {
  it("decides exactly when the lead exceeds the holes left", () => {
    expect(matchCloseout({ humanWins: 5, cpuWins: 2, holesPlayed: 16 })).toMatchObject({ decided: true, label: "3&2" });
    expect(matchCloseout({ humanWins: 3, cpuWins: 5, holesPlayed: 18 })).toMatchObject({ decided: true, leader: "cpu", label: "2 UP" });
    expect(matchCloseout({ humanWins: 4, cpuWins: 2, holesPlayed: 16 })).toMatchObject({ decided: false, dormie: true });
    expect(matchCloseout({ humanWins: 4, cpuWins: 4, holesPlayed: 18 })).toMatchObject({ decided: false });
  });
});

describe("holePops", () => {
  it("gives the strokes to the higher handicap on the lowest stroke indexes", () => {
    const course = model.courses.find((entry) => entry.slug === "crystal-springs");
    const low = { hi: 2 };
    const high = { hi: 14 };
    const easy = course.holes.find((hole) => hole.si === 18);
    const hard = course.holes.find((hole) => hole.si === 1);
    expect(holePops(high, low, course, hard)).toEqual({ human: 1, cpu: 0 });
    expect(holePops(high, low, course, easy)).toEqual({ human: 0, cpu: 0 });
    expect(holePops(low, high, course, hard)).toEqual({ human: 0, cpu: 1 });
  });
});

describe("chooseCpuPlayer", () => {
  it("never exceeds the usage cap across a round", () => {
    const course = model.courses[0];
    const players = model.players.filter((player) => player.team === "North");
    const maxUses = Math.max(2, Math.ceil(18 / players.length));
    for (let seed = 1; seed <= 40; seed += 1) {
      const random = makeSeededRandom(seed);
      const usage = {};
      for (const hole of course.holes) {
        const pick = chooseCpuPlayer({ players, usage, maxUses, course, hole, stateByPlayer: {}, random });
        expect(pick).toBeTruthy();
        usage[pick.profile.key] = (usage[pick.profile.key] || 0) + 1;
      }
      expect(Math.max(...Object.values(usage))).toBeLessThanOrEqual(maxUses);
    }
  });
});

describe("resolveMatchHole", () => {
  const course = model.courses.find((entry) => entry.slug === "crystal-springs");
  const hole = course.holes[0];
  const human = model.players.find((player) => player.team === "South");
  const cpu = model.players.find((player) => player.team === "North");
  const odds = (profile) => buildHoleOdds({ profile, course, hole, decision: defaultDecision(profile, hole), state: null });
  it("keeps the tee landing a live hole already played instead of sampling one", () => {
    let draws = 0;
    const counting = () => {
      draws += 1;
      return 0.5;
    };
    const resolved = resolveMatchHole({
      human,
      cpu,
      humanOdds: odds(human),
      cpuOdds: odds(cpu),
      course,
      hole,
      random: counting,
      humanGrossOverride: hole.par,
      cpuGrossOverride: hole.par + 1,
      humanLandingOverride: "Bunker",
    });
    expect(resolved.humanLanding).toBe("Bunker");
    expect(resolved.humanGross).toBe(hole.par);
    expect(resolved.cpuGross).toBe(hole.par + 1);
    expect(draws).toBe(1); // only the CPU landing is still sampled
  });
  it("is deterministic under a seeded random", () => {
    const run = () =>
      resolveMatchHole({ human, cpu, humanOdds: odds(human), cpuOdds: odds(cpu), course, hole, random: makeSeededRandom(7) });
    expect(run()).toEqual(run());
  });
});
