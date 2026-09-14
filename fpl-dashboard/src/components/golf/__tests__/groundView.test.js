import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { projectHole } from "../tripgame/projection.js";
import { createBall, simulateStroke } from "../tripgame/liveStroke.js";
import { makeShot } from "../tripgame/shotTheater.js";
import {
  groundShotPoint,
  groundShotShape,
  groundCameraFrame,
  playbackSafetyBudget,
  shotPlaybackDuration,
} from "../tripgame/groundView.js";

const geometry = JSON.parse(
  readFileSync(
    new URL("../../../../public/data/black-bear.json", import.meta.url),
    "utf8",
  ),
);
describe("Black Bear ground theater", () => {
  for (const source of geometry.holes)
    it(`preserves hole ${source.num} geometry and shot landing`, () => {
      const hole = { number: source.num, par: source.par, yards: source.yards };
      const projection = projectHole(geometry, hole);
      expect(projection.features.length).toBeGreaterThan(0);
      const shot = makeShot({
        from: projection.tee,
        to: projection.pin,
        kind: "drive",
        bend: 20,
      });
      const first = groundShotPoint(shot, 0),
        last = groundShotPoint(shot, shot.frames.length - 1);
      expect([first[0], first[2]]).toEqual(projection.tee);
      expect([last[0], last[2]]).toEqual(projection.pin);
      expect(last[1]).toBeCloseTo(0.12);
      expect(
        groundShotPoint(shot, shot.frames.length * 0.4).every(Number.isFinite),
      ).toBe(true);
      const camera = groundCameraFrame(projection.tee, projection.pin);
      expect(camera.eye[1]).toBe(3.1);
      expect(camera.eye.every(Number.isFinite)).toBe(true);
    });
  it("distinguishes actual draw, cut and straight trajectories regardless of hole direction", () => {
    for (const to of [
      [0, -100],
      [100, 0],
      [-70, 70],
    ]) {
      expect(
        groundShotShape(
          makeShot({ from: [0, 0], to, kind: "drive", bend: 20 }),
        ),
      ).toBe("draw");
      expect(
        groundShotShape(
          makeShot({ from: [0, 0], to, kind: "drive", bend: -20 }),
        ),
      ).toBe("cut");
      expect(
        groundShotShape(makeShot({ from: [0, 0], to, kind: "drive" })),
      ).toBe("straight");
    }
  });
  it("carries the chosen shape through live shot physics without changing the scored landing", () => {
    const hole = { number: 1, par: 4, yards: 359 };
    const projection = projectHole(geometry, hole);
    const play = (shape) =>
      simulateStroke({
        projection,
        hole,
        ball: createBall(projection),
        meter: { power: 0.87, accuracy: 0 },
        judgment: { tier: "pure" },
        clubId: "driver",
        yardsScale: 1,
        shape,
      });
    const draw = play("draw"),
      cut = play("cut");
    expect(groundShotShape(draw.shot)).toBe("draw");
    expect(groundShotShape(cut.shot)).toBe("cut");
    expect(draw.ball.pos).toEqual(cut.ball.pos);
    expect(
      draw.shot.frames[Math.floor(draw.shot.frames.length / 2)].gx,
    ).not.toEqual(cut.shot.frames[Math.floor(cut.shot.frames.length / 2)].gx);
  });
  it("gives slower ground replays enough time to reach the putts", () => {
    const shots = [
      { kind: "drive", frames: Array(19) },
      { kind: "approach", frames: Array(19) },
      { kind: "putt", frames: Array(10), final: true },
    ];
    const actual = 2 * (700 + 19 * 145 + 850) + 320 + 10 * 78 + 640;
    expect(playbackSafetyBudget(shots, true)).toBeGreaterThan(actual + 4000);
    expect(playbackSafetyBudget(shots, true)).toBeGreaterThan(
      playbackSafetyBudget(shots, false),
    );
    expect(shotPlaybackDuration(shots[2], "flight", true)).toBe(78);
  });
  it("keeps rollout on the ground and clamps playback beyond its endpoints", () => {
    const shot = makeShot({
      from: [0, 100],
      to: [5, 0],
      carryTo: [4, 10],
      kind: "drive",
      bend: -10,
    });
    expect(groundShotPoint(shot, 999)).toEqual([5, 0.12, 0]);
    expect(groundShotPoint(shot, -3)).toEqual([0, 0.12, 100]);
    expect(groundShotPoint(shot, shot.frames.length - 1.5)[1]).toBe(0.12);
  });
});
