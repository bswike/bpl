import { FLIGHT_FRAME_MS } from "./shotTheater.js";

export const GROUND_FLIGHT_FRAME_MS = 145;

// Keep the 3D theater in the same horizontal coordinates as the game.
// Airborne shots bridge launch/landing elevation; rollout follows the surface.
const flatGround = () => 0;
const flightEnds = new WeakMap();
function flightEnd(shot) {
  if (!flightEnds.has(shot)) {
    const firstRoll = shot.frames.findIndex((f) => f.rolling);
    flightEnds.set(
      shot,
      firstRoll < 0 ? shot.frames.length - 1 : firstRoll - 1,
    );
  }
  return flightEnds.get(shot);
}
export function groundShotPoint(shot, progress, heightAt = flatGround) {
  const frames = shot?.frames || [];
  if (!frames.length) {
    const [x, z] = shot?.from || [0, 0];
    return [x, heightAt(x, z) + 0.12, z];
  }
  const index = Math.max(0, Math.min(frames.length - 1, progress));
  const a = frames[Math.floor(index)];
  const b = frames[Math.min(frames.length - 1, Math.floor(index) + 1)];
  const t = index % 1;
  let x = a.gx + (b.gx - a.gx) * t;
  let z = a.gy + (b.gy - a.gy) * t;
  const from = shot.from || [frames[0].gx, frames[0].gy];
  const end = shot.carryTo || shot.to || [frames.at(-1).gx, frames.at(-1).gy];
  const dx = end[0] - from[0],
    dz = end[1] - from[1];
  let fraction = Math.max(
    0,
    Math.min(
      1,
      ((x - from[0]) * dx + (z - from[1]) * dz) / (dx * dx + dz * dz || 1),
    ),
  );
  let lift = (a.lift + (b.lift - a.lift) * t) * 0.55;
  const landingFrame = flightEnd(shot);
  if (
    shot.air &&
    shot.control &&
    Number.isFinite(shot.apex) &&
    landingFrame > 0 &&
    index <= landingFrame
  ) {
    // Evaluate the actual Bezier and parabola, not straight segments between
    // sparse game frames. This preserves both the scored path and its tangent.
    fraction = index / landingFrame;
    const u = 1 - fraction;
    x =
      u * u * from[0] +
      2 * u * fraction * shot.control[0] +
      fraction * fraction * end[0];
    z =
      u * u * from[1] +
      2 * u * fraction * shot.control[1] +
      fraction * fraction * end[1];
    lift = 4 * fraction * u * shot.apex * 0.55;
  } else if (index > landingFrame && shot.air && shot.control) {
    const roll = (index - landingFrame) / (frames.length - 1 - landingFrame);
    const eased = 1 - (1 - roll) ** 1.7;
    x = end[0] + (shot.to[0] - end[0]) * eased;
    z = end[1] + (shot.to[1] - end[1]) * eased;
  }
  const ground = heightAt(x, z);
  const baseline =
    index > landingFrame || !shot.air
      ? ground
      : heightAt(...from) + (heightAt(...end) - heightAt(...from)) * fraction;
  return [x, 0.12 + Math.max(ground, baseline + lift), z];
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

export function groundCameraFrame(from, to, heightAt = flatGround) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  const dx = (to[0] - from[0]) / distance,
    dz = (to[1] - from[1]) / distance;
  const eyeX = from[0] - dx * 9 - dz * 2.8,
    eyeZ = from[1] - dz * 9 + dx * 2.8;
  return {
    eye: [eyeX, Math.max(heightAt(eyeX, eyeZ), heightAt(...from)) + 3.1, eyeZ],
    target: [from[0] + dx * 65, heightAt(...from) + 5, from[1] + dz * 65],
    direction: [dx, dz],
  };
}

// Follow a delayed point on the arc with a little lateral separation. Keeping
// the launch heading (rather than steering into every bend) reveals shot shape.
export function flightCameraFrame(shot, progress, base, heightAt = flatGround) {
  const last = Math.max(1, (shot.frames?.length || 1) - 1);
  const p = Math.max(0, Math.min(last, progress));
  const ball = groundShotPoint(shot, p, heightAt);
  const lag = groundShotPoint(
    shot,
    Math.max(0, p - Math.min(6, last * 0.18, p * 0.6)),
    heightAt,
  );
  const [dx, dz] = base.direction;
  const length = Math.hypot(
    (shot.to?.[0] || 0) - shot.from[0],
    (shot.to?.[1] || 0) - shot.from[1],
  );
  const distance =
    9 + (Math.max(10, Math.min(25, length * 0.1)) - 9) * Math.min(1, p / 12);
  const along = (lag[0] - shot.from[0]) * dx + (lag[2] - shot.from[1]) * dz;
  const axisX = shot.from[0] + dx * along;
  const axisZ = shot.from[1] + dz * along;
  const side = groundShotShape(shot) === "draw" ? -1 : 1;
  const eye = [
    axisX + (lag[0] - axisX) * 0.25 - dx * distance - dz * 5 * side,
    lag[1] + 7,
    axisZ + (lag[2] - axisZ) * 0.25 - dz * distance + dx * 5 * side,
  ];
  const launch = Math.max(0, Math.min(1, p / Math.min(7, last * 0.3)));
  const blend = launch * launch * (3 - 2 * launch);
  const position = eye.map((v, i) => base.eye[i] + (v - base.eye[i]) * blend);
  position[1] = Math.max(position[1], heightAt(position[0], position[2]) + 3.1);
  const look = [ball[0] + dx * 2, ball[1] - 0.6, ball[2] + dz * 2];
  return {
    eye: position,
    target: look.map((v, i) => base.target[i] + (v - base.target[i]) * blend),
    blend,
  };
}

// Shared by the animation clock and watchdog: longer 3D flights must not
// cause the watchdog to skip the rest of a hole before its putts.
export function shotPlaybackDuration(shot, phase, ground = false) {
  const groundShot = ground && shot.kind !== "putt";
  if (phase === "swing")
    return shot.kind === "putt"
      ? 480
      : groundShot
        ? shot.kind === "chip" || shot.kind === "punch"
          ? 720
          : 960
        : 420;
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
