const keys = [
  {
    t: 0,
    hands: [0.34, 1.03, 0],
    pitch: -0.12,
    lie: Math.atan2(0.56, 0.94),
    turn: 0,
    lean: 0.08,
    shift: 0,
    heel: 0,
  },
  {
    t: 0.24,
    hands: [0.34, 1.08, 0.14],
    pitch: -0.7,
    lie: 0.6,
    turn: -0.12,
    lean: 0.08,
    shift: 0.025,
    heel: 0,
  },
  {
    t: 0.64,
    hands: [0.25, 1.88, 0.42],
    pitch: -4.1,
    lie: -0.28,
    turn: -0.6,
    lean: 0.1,
    shift: 0.07,
    heel: 0.025,
  },
  {
    t: 0.76,
    hands: [0.24, 1.9, 0.4],
    pitch: -4.2,
    lie: -0.35,
    turn: -0.62,
    lean: 0.1,
    shift: 0.07,
    heel: 0.025,
  },
  {
    t: 1,
    hands: [0.34, 1.03, 0],
    pitch: 0,
    lie: Math.atan2(0.56, 0.94),
    turn: 0.05,
    lean: 0.08,
    shift: -0.015,
    heel: 0.04,
  },
  {
    t: 1.2,
    hands: [0.18, 1.34, -0.45],
    pitch: 1.85,
    lie: 0.37,
    turn: 0.48,
    lean: 0.04,
    shift: -0.07,
    heel: 0.1,
  },
  {
    t: 1.72,
    hands: [-0.3, 1.91, -0.38],
    pitch: 3.9,
    lie: -0.66,
    turn: 0.98,
    lean: -0.055,
    shift: -0.1,
    heel: 0.17,
  },
  {
    t: 2.25,
    hands: [-0.28, 1.86, -0.36],
    pitch: 3.88,
    lie: -0.66,
    turn: 0.94,
    lean: -0.035,
    shift: -0.09,
    heel: 0.15,
  },
];
// Cubic interpolation carries momentum through impact instead of stopping at
// every keyframe. The backswing pause and finish are authored into the timing.
export function golferPose(time, kind = "drive") {
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
  // Interpolating a direction vector can nearly cancel opposite directions,
  // making the shaft suddenly flip. Unwrapped angles preserve the swing arc.
  const pitch = interpolate("pitch"),
    lie = interpolate("lie");
  const pose = {
    hands: [0, 1, 2].map((j) => interpolate("hands", j)),
    club: [
      Math.sin(lie),
      -Math.cos(lie) * Math.cos(pitch),
      -Math.cos(lie) * Math.sin(pitch),
    ],
    turn: interpolate("turn"),
    lean: interpolate("lean"),
    shift: interpolate("shift"),
    heel: interpolate("heel"),
  };
  if (kind === "putt") {
    // One pendulum: a quiet takeaway, accelerating through contact, then a
    // small release. Position and speed both match at the impact boundary.
    const start = Math.min(1, t / 0.35);
    const angle =
      t <= 1
        ? -0.24 * Math.sin(Math.PI * t) * start * start * (3 - 2 * start)
        : 0.18 * (1 - Math.exp(-((0.24 * Math.PI) / 0.18) * (t - 1)));
    return {
      hands: [0.34, 1.03, -angle * 0.3],
      club: [
        Math.sin(keys[0].lie),
        -Math.cos(keys[0].lie) * Math.cos(angle),
        -Math.cos(keys[0].lie) * Math.sin(angle),
      ],
      turn: angle * 0.16,
      lean: 0.1,
      shift: 0,
      heel: 0,
    };
  }
  if (kind === "chip" || kind === "punch" || kind === "sand") {
    const amount = kind === "sand" ? 0.7 : 0.48;
    const shortPitch = pitch * amount,
      shortLie = keys[0].lie + (lie - keys[0].lie) * amount;
    pose.hands = pose.hands.map(
      (v, i) => keys[0].hands[i] + (v - keys[0].hands[i]) * amount,
    );
    pose.club = [
      Math.sin(shortLie),
      -Math.cos(shortLie) * Math.cos(shortPitch),
      -Math.cos(shortLie) * Math.sin(shortPitch),
    ];
    pose.turn *= amount;
    pose.shift *= amount;
    pose.heel *= amount;
  }
  return pose;
}
