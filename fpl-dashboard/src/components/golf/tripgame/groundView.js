import { FLIGHT_FRAME_MS } from "./shotTheater.js";

export const GROUND_FLIGHT_FRAME_MS = 145;

// Keep the 3D theater in the same horizontal coordinates as the game.
// Height is illustrative: the source course polygons contain no elevation.
export function groundShotPoint(shot, progress) {
  const frames = shot?.frames || [];
  if (!frames.length) return [shot?.from?.[0] || 0, 0.12, shot?.from?.[1] || 0];
  const index = Math.max(0, Math.min(frames.length - 1, progress));
  const a = frames[Math.floor(index)];
  const b = frames[Math.min(frames.length - 1, Math.floor(index) + 1)];
  const t = index % 1;
  return [
    a.gx + (b.gx - a.gx) * t,
    0.12 + (a.lift + (b.lift - a.lift) * t) * 0.55,
    a.gy + (b.gy - a.gy) * t,
  ];
}

export function groundShotShape(shot) {
  if (!shot?.air || !shot.control) return "straight";
  const end = shot.carryTo || shot.to;
  const dx = end[0] - shot.from[0],
    dz = end[1] - shot.from[1];
  const bend =
    (dx * (shot.control[1] - shot.from[1]) -
      dz * (shot.control[0] - shot.from[0])) /
    (Math.hypot(dx, dz) || 1);
  return Math.abs(bend) < 0.6 ? "straight" : bend > 0 ? "draw" : "cut";
}

export function groundCameraFrame(from, to) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const dx = (to[0] - from[0]) / distance,
    dz = (to[1] - from[1]) / distance;
  return {
    eye: [from[0] - dx * 9 - dz * 2.8, 3.1, from[1] - dz * 9 + dx * 2.8],
    target: [from[0] + dx * 65, 5, from[1] + dz * 65],
    direction: [dx, dz],
  };
}

// Shared by the animation clock and watchdog: longer 3D flights must not
// cause the watchdog to skip the rest of a hole before its putts.
export function shotPlaybackDuration(shot, phase, ground = false) {
  const groundShot = ground && shot.kind !== "putt";
  if (phase === "swing")
    return shot.kind === "putt" ? 320 : groundShot ? 700 : 420;
  if (phase === "flight")
    return groundShot ? GROUND_FLIGHT_FRAME_MS : FLIGHT_FRAME_MS;
  return shot.kind === "splash"
    ? 700
    : shot.final
      ? 640
      : groundShot
        ? 850
        : 300;
}

export function playbackSafetyBudget(shots, ground = false) {
  const duration = shots.reduce(
    (total, shot) =>
      total +
      shotPlaybackDuration(shot, "swing", ground) +
      (shot.frames?.length || 1) *
        shotPlaybackDuration(shot, "flight", ground) +
      shotPlaybackDuration(shot, "settle", ground),
    0,
  );
  return Math.ceil(duration * 1.25 + 4000);
}
