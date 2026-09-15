import { describe, it, expect } from "vitest";
import { makeShot } from "../tripgame/shotTheater.js";
import {
  groundCameraFrame,
  groundShotPoint,
  flightCameraFrame,
} from "../tripgame/groundView.js";
describe("flight chase camera", () => {
  for (const bend of [-25, 0, 25])
    it(`smoothly follows a ${bend} meter bend from launch to landing`, () => {
      const shot = makeShot({
        from: [0, 300],
        to: [0, 0],
        kind: "drive",
        bend,
      });
      const ground = (x, z) => x * 0.1 + (300 - z) * 0.05;
      const base = groundCameraFrame(shot.from, shot.to, ground);
      const start = flightCameraFrame(shot, 0, base, ground);
      expect(start.eye).toEqual(base.eye);
      expect(start.target).toEqual(base.target);
      let previous = start;
      for (let p = 0.1; p < shot.frames.length - 1; p += 0.1) {
        const frame = flightCameraFrame(shot, p, base, ground),
          ball = groundShotPoint(shot, p, ground);
        expect([...frame.eye, ...frame.target].every(Number.isFinite)).toBe(
          true,
        );
        expect(frame.eye[1]).toBeGreaterThanOrEqual(
          ground(frame.eye[0], frame.eye[2]) + 3.099,
        );
        expect(
          Math.hypot(...frame.eye.map((v, i) => v - previous.eye[i])),
        ).toBeLessThan(10);
        if (frame.blend === 1) expect(frame.eye[2]).toBeGreaterThan(ball[2]);
        previous = frame;
      }
      const last = shot.frames.length - 1;
      expect(flightCameraFrame(shot, last + 100, base, ground)).toEqual(
        flightCameraFrame(shot, last, base, ground),
      );
      expect(
        flightCameraFrame(shot, last / 2, base, ground).eye[1],
      ).toBeGreaterThan(base.eye[1] + 10);
    });
  it("handles a very short shot without non-finite camera values", () => {
    const shot = makeShot({ from: [20, 20], to: [20, 19], kind: "chip" });
    const base = groundCameraFrame(shot.from, shot.to);
    expect(flightCameraFrame(shot, 2, base).eye.every(Number.isFinite)).toBe(
      true,
    );
  });
});
