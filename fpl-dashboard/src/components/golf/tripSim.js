/**
 * Golf trip Monte Carlo — gross match play, hole-by-hole.
 * Port of scripts/golf-trip-monte-carlo.py for in-browser use.
 */

const ANCH_H = [-5, 0, 10, 20, 30];
const ANCH_P = [
  [0.008, 0.19, 0.63, 0.155, 0.015, 0.002, 0],
  [0.004, 0.14, 0.6, 0.22, 0.031, 0.004, 0.001],
  [0.001, 0.05, 0.36, 0.42, 0.13, 0.032, 0.007],
  [0.0005, 0.018, 0.21, 0.4, 0.245, 0.093, 0.0335],
  [0.0002, 0.006, 0.105, 0.325, 0.315, 0.16, 0.0888],
].map((row) => {
  const sum = row.reduce((a, b) => a + b, 0);
  return row.map((p) => p / sum);
});

const CATS = [-2, -1, 0, 1, 2, 3, 4];

export const DEFAULT_BLUE = [
  ["Kunkel", 4.0, 3.2],
  ["Zeider", 8.2, 8.2],
  ["Gonsoroski", 8.8, 8.8],
  ["Appold", 11.3, 8.0],
  ["Wilson", 11.5, 11.5],
  ["Ervin", 13.6, 12.1],
  ["Reynolds", 13.6, 13.6],
  ["Mahony", 18.4, 18.4],
  ["Kintz", 19.9, 18.0],
  ["Bullock", 20.3, 18.6],
  ["Solomon", 20.7, 20.7],
  ["Laureys", 25.6, 25.6],
];

export const DEFAULT_RED = [
  ["Kennedy", 4.5, 4.5],
  ["Carnrike", 7.2, 7.0],
  ["Munoz", 7.4, 7.4],
  ["Lacy", 9.8, 9.8],
  ["Tomek", 11.9, 11.9],
  ["Uber", 13.3, 13.3],
  ["Swikle", 13.7, 11.9],
  ["Magee", 13.7, 13.3],
  ["VanNice", 14.2, 12.4],
  ["Velasquez", 14.6, 11.7],
  ["Ramos", 18.2, 16.2],
  ["Haubert", 18.7, 18.4],
];

function clip(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

function interp(x, xp, fp) {
  const v = clip(x, xp[0], xp[xp.length - 1]);
  let i = 0;
  while (i < xp.length - 2 && v > xp[i + 1]) i++;
  const t = (xp[i + 1] - xp[i]) ? (v - xp[i]) / (xp[i + 1] - xp[i]) : 0;
  return fp[i] + t * (fp[i + 1] - fp[i]);
}

function holeProbs(h) {
  const probs = ANCH_P.map((row) => interp(h, ANCH_H, row));
  const sum = probs.reduce((a, b) => a + b, 0);
  return probs.map((p) => p / sum);
}

function makeRng(seed = 17) {
  let s = seed >>> 0;
  let spare = null;
  return {
    random() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    normal() {
      if (spare != null) {
        const v = spare;
        spare = null;
        return v;
      }
      let u = 0;
      let v = 0;
      while (u === 0) u = this.random();
      while (v === 0) v = this.random();
      const mag = Math.sqrt(-2 * Math.log(u));
      spare = mag * Math.cos(2 * Math.PI * v);
      return mag * Math.sin(2 * Math.PI * v);
    },
  };
}

function sampleCat(probs, rng) {
  const u = rng.random();
  let c = 0;
  for (let k = 0; k < probs.length; k++) {
    c += probs[k];
    if (u < c) return CATS[k];
  }
  return CATS[CATS.length - 1];
}

function simRounds(index, n, rng) {
  const sd = 1.2 + 0.05 * Math.max(index, 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const eff = index + rng.normal() * sd;
    const probs = holeProbs(eff);
    const holes = [];
    for (let h = 0; h < 18; h++) holes.push(sampleCat(probs, rng));
    out.push(holes);
  }
  return out;
}

function match(hA, hB, n, rng) {
  const a = simRounds(hA, n, rng);
  const b = simRounds(hB, n, rng);
  let w = 0;
  let h = 0;
  let l = 0;
  for (let i = 0; i < n; i++) {
    let wa = 0;
    let wb = 0;
    for (let hole = 0; hole < 18; hole++) {
      if (a[i][hole] < b[i][hole]) wa++;
      else if (b[i][hole] < a[i][hole]) wb++;
    }
    if (wa > wb) w++;
    else if (wa === wb) h++;
    else l++;
  }
  return [w / n, h / n, l / n];
}

function fourball(pA, pB, n, rng) {
  const a0 = simRounds(pA[0], n, rng);
  const a1 = simRounds(pA[1], n, rng);
  const b0 = simRounds(pB[0], n, rng);
  const b1 = simRounds(pB[1], n, rng);
  let w = 0;
  let h = 0;
  let l = 0;
  for (let i = 0; i < n; i++) {
    const a = [];
    const b = [];
    for (let hole = 0; hole < 18; hole++) {
      a.push(Math.min(a0[i][hole], a1[i][hole]));
      b.push(Math.min(b0[i][hole], b1[i][hole]));
    }
    let wa = 0;
    let wb = 0;
    for (let hole = 0; hole < 18; hole++) {
      if (a[hole] < b[hole]) wa++;
      else if (b[hole] < a[hole]) wb++;
    }
    if (wa > wb) w++;
    else if (wa === wb) h++;
    else l++;
  }
  return [w / n, h / n, l / n];
}

function altshotH(p) {
  return 0.5 * (p[0] + p[1]) + 1.5 + 0.12 * Math.abs(p[0] - p[1]);
}

function sessionDist(matchProbs, n, rng) {
  const pts = new Float64Array(n);
  for (const [pw, ph] of matchProbs) {
    for (let i = 0; i < n; i++) {
      const u = rng.random();
      pts[i] += u < pw ? 1 : u < pw + ph ? 0.5 : 0;
    }
  }
  return pts;
}

function pct(n) {
  return `${Math.round(n * 100)}%`;
}

/** @typedef {{ name: string, current: number, low: number }} TripPlayer */

/**
 * @param {TripPlayer[]} blue
 * @param {TripPlayer[]} red
 * @param {{ mode?: 'current'|'blend', matchN?: number, sessionN?: number, seed?: number }} opts
 */
export function runTripSim(blue, red, opts = {}) {
  const { mode = "current", matchN = 8000, sessionN = 80000, seed = 17 } = opts;
  const rng = makeRng(seed);
  const size = Math.min(blue.length, red.length);
  if (size < 4) {
    return { error: "Need at least 4 players per team with handicap indexes." };
  }

  const idx = (p) =>
    mode === "blend"
      ? Math.round((0.7 * p.current + 0.3 * p.low) * 10) / 10
      : p.current;

  const B = blue.slice(0, size).map((p) => ({ name: p.name, h: idx(p) }));
  const R = red.slice(0, size).map((p) => ({ name: p.name, h: idx(p) }));

  const singles = [];
  for (let i = 0; i < size; i++) {
    const [w, h, l] = match(B[i].h, R[i].h, matchN, rng);
    singles.push({
      blue: B[i],
      red: R[i],
      w,
      h,
      l,
      coin: w / (w + l || 1) >= 0.4 && w / (w + l || 1) <= 0.6,
    });
  }

  const half = Math.floor(size / 2);
  const swB = Array.from({ length: half }, (_, i) => [B[i], B[size - 1 - i]]);
  const swR = Array.from({ length: half }, (_, i) => [R[i], R[size - 1 - i]]);
  const fbA = [];
  for (let i = 0; i < half; i++) {
    const [w, h, l] = fourball(
      [swB[i][0].h, swB[i][1].h],
      [swR[i][0].h, swR[i][1].h],
      matchN,
      rng
    );
    fbA.push({ blue: swB[i], red: swR[i], w, h, l });
  }

  const asN = Math.min(6, size - (size % 2));
  const asRes = [];
  for (let i = 0; i < asN; i += 2) {
    const hb = altshotH([B[i].h, B[i + 1].h]);
    const hr = altshotH([R[i].h, R[i + 1].h]);
    const [w, h, l] = match(hb, hr, matchN, rng);
    asRes.push({
      blue: [B[i], B[i + 1]],
      red: [R[i], R[i + 1]],
      hb,
      hr,
      w,
      h,
      l,
    });
  }

  const botPairs = Math.min(3, Math.floor((size - asN) / 2));
  const b4Res = [];
  for (let i = 0; i < botPairs; i++) {
    const bi = asN + i;
    const bj = size - 1 - i;
    const ri = asN + i;
    const rj = size - 1 - i;
    const [w, h, l] = fourball(
      [B[bi].h, B[bj].h],
      [R[ri].h, R[rj].h],
      matchN,
      rng
    );
    b4Res.push({ blue: [B[bi], B[bj]], red: [R[ri], R[rj]], w, h, l });
  }

  const tripProbs = [
    ...fbA.map((m) => [m.w, m.h, m.l]),
    ...asRes.map((m) => [m.w, m.h, m.l]),
    ...b4Res.map((m) => [m.w, m.h, m.l]),
    ...singles.map((m) => [m.w, m.h, m.l]),
  ];
  const tripPts = sessionDist(tripProbs, sessionN, rng);
  const tripTotal = tripProbs.length;
  const tripMid = tripTotal / 2;
  const expTrip = tripProbs.reduce((s, [w, h]) => s + w + 0.5 * h, 0);
  const expSingles = singles.reduce((s, m) => s + m.w + 0.5 * m.h, 0);

  const singlesPts = sessionDist(
    singles.map((m) => [m.w, m.h, m.l]),
    sessionN,
    rng
  );
  const singlesMid = size / 2;

  const fairSpots = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4].map((spot) => {
    let win = 0;
    let tie = 0;
    for (let i = 0; i < sessionN; i++) {
      const v = tripPts[i] + spot;
      if (v > tripMid) win++;
      else if (v === tripMid) tie++;
    }
    return {
      spot,
      blue: win / sessionN,
      tie: tie / sessionN,
      red: 1 - win / sessionN - tie / sessionN,
    };
  });

  const singlesSpots = [0, 1, 1.5, 2].map((spot) => {
    let win = 0;
    let tie = 0;
    for (let i = 0; i < sessionN; i++) {
      const v = singlesPts[i] + spot;
      if (v > singlesMid) win++;
      else if (v === singlesMid) tie++;
    }
    return {
      spot,
      blue: win / sessionN,
      tie: tie / sessionN,
      red: 1 - win / sessionN - tie / sessionN,
    };
  });

  let tripWin = 0;
  let tripTie = 0;
  for (let i = 0; i < sessionN; i++) {
    if (tripPts[i] > tripMid) tripWin++;
    else if (tripPts[i] === tripMid) tripTie++;
  }

  return {
    mode,
    size,
    singles,
    expSingles,
    singlesCoin: singles.filter((m) => m.coin).length,
    fourball: fbA,
    altshot: asRes,
    botFourball: b4Res,
    trip: {
      points: tripTotal,
      expected: expTrip,
      blueWin: tripWin / sessionN,
      tie: tripTie / sessionN,
      redWin: 1 - tripWin / sessionN - tripTie / sessionN,
    },
    fairSpots,
    singlesSpots,
    pct,
  };
}
