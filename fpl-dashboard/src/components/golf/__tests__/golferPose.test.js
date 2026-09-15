import { describe, it, expect } from "vitest";
import { golferPose } from "../tripgame/golferPose.js";
describe("cartoon golf swing", () => {
  it("addresses the ball at impact with a full-length club", () => {
    const p = golferPose(1),
      length = Math.hypot(...p.club);
    const head = p.hands.map((v, i) => v + (p.club[i] / length) * 1.05);
    expect(head[0]).toBeCloseTo(0.88, 1);
    expect(head[1]).toBeCloseTo(0.13, 1);
  });
  it("has continuous hand motion through the backswing, impact and finish", () => {
    let previous = golferPose(0);
    for (let t = 0.002; t <= 2.25; t += 0.002) {
      const p = golferPose(t);
      expect(
        [...p.hands, ...p.club, p.turn, p.lean, p.heel].every(Number.isFinite),
      ).toBe(true);
      expect(
        Math.hypot(...p.hands.map((v, i) => v - previous.hands[i])),
      ).toBeLessThan(0.025);
      previous = p;
    }
    expect(golferPose(100)).toEqual(golferPose(2.25));
    expect(golferPose(-1)).toEqual(golferPose(0));
  });
  it("coils back then transfers weight into a balanced finish", () => {
    expect(golferPose(0.7).turn).toBeLessThan(-0.5);
    const finish = golferPose(2.25);
    expect(finish.turn).toBeGreaterThan(0.8);
    expect(finish.shift).toBeLessThan(0);
    expect(finish.heel).toBeGreaterThan(0.1);
  });
});
