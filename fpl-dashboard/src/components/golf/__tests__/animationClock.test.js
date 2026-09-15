import { describe, it, expect } from "vitest";
import { createAnimationClock } from "../tripgame/animationClock.js";
import { makeShot } from "../tripgame/shotTheater.js";
import { groundShotPoint } from "../tripgame/groundView.js";
import { golferPose } from "../tripgame/golferPose.js";

const timing = { frameMs: 145, swingMs: 960 };
const shot = makeShot({
  from: [0, 250],
  to: [15, 0],
  carryTo: [13, 12],
  kind: "drive",
  bend: 25,
});
describe("continuous shot animation", () => {
  it("keeps moving between late game ticks without going backwards", () => {
    const clock = createAnimationClock();
    clock({ shot, phase: "flight", frame: 0 }, 1000, timing);
    const before = clock({ shot, phase: "flight", frame: 0 }, 1230, timing);
    const after = clock({ shot, phase: "flight", frame: 1 }, 1240, timing);
    expect(before.progress).toBeGreaterThan(1);
    expect(after.progress).toBeGreaterThan(before.progress);
    expect(after.progress - before.progress).toBeCloseTo(10 / 145);
  });
  it("joins the stroke at impact and continues follow-through across settle", () => {
    const clock = createAnimationClock();
    clock({ shot, phase: "swing" }, 0, timing);
    expect(clock({ shot, phase: "swing" }, 960, timing).poseTime).toBe(1);
    expect(
      clock({ shot, phase: "flight", frame: 0 }, 960, timing).poseTime,
    ).toBe(1);
    const before = clock({ shot, phase: "flight", frame: 1 }, 1060, timing);
    const after = clock({ shot, phase: "settle" }, 1061, timing);
    expect(after.poseTime - before.poseTime).toBeCloseTo(1 / 960);
  });
  it("honors seeks and fast-forward, and resets for a new stroke", () => {
    const clock = createAnimationClock();
    clock({ shot, phase: "flight", frame: 0 }, 0, timing);
    expect(
      clock({ shot, phase: "flight", frame: 8 }, 40, timing).progress,
    ).toBe(8);
    expect(
      clock({ shot: { ...shot }, phase: "swing", frame: 0 }, 60, timing)
        .progress,
    ).toBe(0);
  });
  it("does not animate between game frames in reduced-motion mode", () => {
    const clock = createAnimationClock(),
      options = { ...timing, reduced: true };
    clock({ shot, phase: "flight", frame: 0 }, 0, options);
    expect(
      clock({ shot, phase: "flight", frame: 0 }, 100, options).progress,
    ).toBe(0);
  });
  it("has continuous flight velocity across the original frame boundaries", () => {
    const epsilon = 0.0001;
    for (const p of [2, 5, 9, 13]) {
      const a = groundShotPoint(shot, p - epsilon),
        b = groundShotPoint(shot, p),
        c = groundShotPoint(shot, p + epsilon);
      for (let axis = 0; axis < 3; axis++) {
        expect(
          Math.abs(
            (b[axis] - a[axis]) / epsilon - (c[axis] - b[axis]) / epsilon,
          ),
        ).toBeLessThan(0.003);
      }
    }
    expect(groundShotPoint(shot, 999)).toEqual([15, 0.12, 0]);
  });
  it("keeps the shaft normalized and continuous throughout a full swing", () => {
    let last = golferPose(0).club;
    for (let t = 0.001; t < 2.25; t += 0.001) {
      const p = golferPose(t);
      expect(Math.hypot(...p.club)).toBeCloseTo(1, 8);
      expect(Math.hypot(...p.club.map((v, i) => v - last[i]))).toBeLessThan(
        0.04,
      );
      last = p.club;
    }
  });
  it("matches the putting stroke's velocity through impact", () => {
    const e = 0.00001,
      a = golferPose(1 - e, "putt"),
      b = golferPose(1, "putt"),
      c = golferPose(1 + e, "putt");
    expect(
      Math.abs((b.club[2] - a.club[2]) / e - (c.club[2] - b.club[2]) / e),
    ).toBeLessThan(0.001);
    expect(Math.abs(golferPose(0.6, "putt").turn)).toBeLessThan(0.05);
  });
});
