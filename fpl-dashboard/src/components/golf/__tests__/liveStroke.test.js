import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildTripGameModel, defaultDecision, makeSeededRandom } from "../tripGameEngine.js";
import { polylineLength } from "../tripgame/geometry.js";
import { ballDone, ballGross, cpuMeterSample, cpuPuttAim, createBall, simulateCpuStroke, simulateStroke } from "../tripgame/liveStroke.js";
import { makePuttRead } from "../tripgame/putting.js";
import { projectHole } from "../tripgame/projection.js";
import { computeShotTarget } from "../tripgame/shotPhysics.js";

const readJson = (name) =>
  JSON.parse(fs.readFileSync(fileURLToPath(new URL(`../../../../public/data/${name}`, import.meta.url)), "utf8"));
const model = buildTripGameModel(readJson("golftrip-nj26.json"), [readJson("golftrip-2025.json")]);
const course = model.courses.find((entry) => entry.slug === "crystal-springs");
const geometry = readJson("crystal-springs.json");
const holes = course.holes.map((base) => {
  const projection = projectHole(geometry, base);
  const hole = { ...base, par: Number(projection.official?.par) || base.par, yards: Number(projection.official?.yards) || null, stimpSalt: 0 };
  return { hole, projection, yardsScale: hole.yards ? polylineLength(projection.line) / hole.yards : 1 };
});

function playRound(hi, seed) {
  const rng = makeSeededRandom(seed);
  let strokes = 0;
  for (const { hole, projection, yardsScale } of holes) {
    const decision = defaultDecision({ hi, stockShape: "cut" }, hole);
    const cpu = { ball: createBall(projection), hi, buzz: 0, decision, teeTarget: computeShotTarget(projection, hole, decision).target, conceded: false };
    let guard = 0;
    while (!ballDone(cpu.ball, hole) && guard < 14) {
      guard += 1;
      cpu.ball = simulateCpuStroke({ projection, hole, cpu, yardsScale, rng, seedSalt: guard }).ball;
    }
    expect(ballDone(cpu.ball, hole)).toBe(true);
    strokes += ballGross(cpu.ball, hole);
  }
  return strokes;
}

const average = (values) => values.reduce((total, value) => total + value, 0) / values.length;

describe("CPU through the shared physics", () => {
  it("scores like its handicap on Crystal Springs (calibrated bands)", () => {
    const rounds = (hi) => average(Array.from({ length: 40 }, (_, seed) => playRound(hi, 100 + seed)));
    const scratch = rounds(0);
    const ten = rounds(10);
    const twenty = rounds(20);
    expect(scratch).toBeGreaterThan(73);
    expect(scratch).toBeLessThan(80);
    expect(ten).toBeGreaterThan(80);
    expect(ten).toBeLessThan(90);
    expect(twenty).toBeGreaterThan(92);
    expect(twenty).toBeLessThan(104);
    expect(scratch).toBeLessThan(ten);
    expect(ten).toBeLessThan(twenty);
  }, 60000);
  it("is deterministic for a given seed", () => {
    expect(playRound(12, 7)).toBe(playRound(12, 7));
  });
});

describe("cpuMeterSample", () => {
  const spread = (hi) => {
    const rng = makeSeededRandom(3);
    const samples = Array.from({ length: 2000 }, () => cpuMeterSample({ hi, rng, zoneScale: 1.3 }));
    return average(samples.map((sample) => Math.abs(sample.accuracy)));
  };
  it("taps tighter with skill", () => {
    expect(spread(0)).toBeLessThan(spread(12));
    expect(spread(12)).toBeLessThan(spread(24));
  });
  it("paces putts around the band centre", () => {
    const rng = makeSeededRandom(5);
    const paceBand = { min: 0.5, max: 0.65 };
    const power = average(Array.from({ length: 2000 }, () => cpuMeterSample({ hi: 8, rng, putt: true, paceBand, feet: 12 }).power));
    expect(power).toBeCloseTo(0.575, 1);
  });
});

describe("cpuPuttAim", () => {
  it("misreads long putts more than short ones", () => {
    const hole = { number: 3, par: 4, stimpSalt: 0 };
    const error = (feet) => {
      const read = makePuttRead({ hole, puttCount: 0, feet, sceneCarry: null });
      const rng = makeSeededRandom(11);
      return average(Array.from({ length: 1500 }, () => Math.abs(cpuPuttAim(read, 10, rng) - read.requiredTicks)));
    };
    expect(error(4)).toBeLessThan(error(12));
    expect(error(12)).toBeLessThan(error(30));
  });
});

describe("simulateStroke", () => {
  const { hole, projection, yardsScale } = holes[0];
  it("never mutates the ball it is given", () => {
    const ball = createBall(projection);
    const before = JSON.stringify(ball);
    simulateStroke({ projection, hole, ball, meter: { power: 0.87, accuracy: 0 }, judgment: { tier: "pure" }, clubId: "driver", yardsScale, hi: 5 });
    expect(JSON.stringify(ball)).toBe(before);
  });
  it("records the tee landing and counts a penalty as a stroke", () => {
    const ball = createBall(projection);
    const played = simulateStroke({ projection, hole, ball, meter: { power: 0.87, accuracy: 1 }, judgment: { tier: "wild" }, clubId: "driver", yardsScale, hi: 5, rng: () => 0.95 });
    expect(played.ball.teeLanding).toBeTruthy();
    expect(played.ball.strokes).toBe(1 + (played.result.penalty || 0));
    expect(played.shot.side).toBe("human");
  });
});
