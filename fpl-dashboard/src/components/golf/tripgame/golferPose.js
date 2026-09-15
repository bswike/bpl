const keys = [
  {
    t: 0,
    hands: [0.34, 1.03, 0],
    club: [0.56, -0.94, 0],
    turn: 0,
    lean: 0.08,
    shift: 0,
    heel: 0,
  },
  {
    t: 0.24,
    hands: [0.34, 1.08, 0.14],
    club: [0.7, -0.7, 0.48],
    turn: -0.12,
    lean: 0.08,
    shift: 0.025,
    heel: 0,
  },
  {
    t: 0.64,
    hands: [0.13, 1.8, 0.28],
    club: [-0.28, 0.54, -0.84],
    turn: -0.6,
    lean: 0.035,
    shift: 0.07,
    heel: 0.025,
  },
  {
    t: 0.76,
    hands: [0.12, 1.82, 0.27],
    club: [-0.35, 0.48, -0.83],
    turn: -0.62,
    lean: 0.04,
    shift: 0.07,
    heel: 0.025,
  },
  {
    t: 1,
    hands: [0.34, 1.03, 0],
    club: [0.56, -0.94, 0],
    turn: 0.05,
    lean: 0.08,
    shift: -0.015,
    heel: 0.04,
  },
  {
    t: 1.2,
    hands: [0.18, 1.34, -0.45],
    club: [0.36, 0.2, -0.91],
    turn: 0.48,
    lean: 0.04,
    shift: -0.07,
    heel: 0.1,
  },
  {
    t: 1.72,
    hands: [-0.24, 1.83, -0.22],
    club: [-0.64, 0.54, 0.54],
    turn: 0.98,
    lean: -0.055,
    shift: -0.1,
    heel: 0.17,
  },
  {
    t: 2.25,
    hands: [-0.23, 1.8, -0.19],
    club: [-0.65, 0.52, 0.55],
    turn: 0.94,
    lean: -0.035,
    shift: -0.09,
    heel: 0.15,
  },
];
// Cubic interpolation carries momentum through impact instead of stopping at
// every keyframe. The backswing pause and finish are authored into the timing.
export function golferPose(time) {
  const t = Math.max(0, Math.min(keys.at(-1).t, time));
  let i = 0;
  while (i < keys.length - 2 && t > keys[i + 1].t) i++;
  const a = keys[i],
    b = keys[i + 1],
    before = keys[Math.max(0, i - 1)],
    after = keys[Math.min(keys.length - 1, i + 2)];
  const span = b.t - a.t,
    u = (t - a.t) / span;
  const interpolate = (field, component) => {
    const get = (k) =>
      component === undefined ? k[field] : k[field][component];
    const av = get(a),
      bv = get(b);
    const ma = i === 0 ? 0 : ((bv - get(before)) / (b.t - before.t)) * span;
    const mb =
      i + 1 === keys.length - 1
        ? 0
        : ((get(after) - av) / (after.t - a.t)) * span;
    return (
      (2 * u ** 3 - 3 * u * u + 1) * av +
      (u ** 3 - 2 * u * u + u) * ma +
      (-2 * u ** 3 + 3 * u * u) * bv +
      (u ** 3 - u * u) * mb
    );
  };
  return {
    hands: [0, 1, 2].map((j) => interpolate("hands", j)),
    club: [0, 1, 2].map((j) => interpolate("club", j)),
    turn: interpolate("turn"),
    lean: interpolate("lean"),
    shift: interpolate("shift"),
    heel: interpolate("heel"),
  };
}
