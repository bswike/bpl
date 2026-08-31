const SCORE_VALUES = [-1, 0, 1, 2, 3];

export const SCORE_BUCKETS = [
  { id: "birdie", label: "Birdie+", short: "BRD", tone: "best" },
  { id: "par", label: "Par", short: "PAR", tone: "good" },
  { id: "bogey", label: "Bogey", short: "BOG", tone: "warn" },
  { id: "double", label: "Double", short: "DBL", tone: "bad" },
  { id: "triple", label: "Triple+", short: "3+", tone: "awful" },
];

export const CLUBS = [
  { id: "driver", label: "Driver", short: "DRV", carry: 255, fairway: -0.08, upside: 0.16, risk: 0.08, minPar: 4 },
  { id: "wood", label: "Fairway", short: "3W", carry: 222, fairway: 0.01, upside: 0.07, risk: 0.025, minPar: 3 },
  { id: "iron", label: "Iron", short: "IRN", carry: 178, fairway: 0.1, upside: -0.025, risk: -0.025, minPar: 3 },
];

export const AIMS = [
  { id: "left", label: "Left", offset: -0.62 },
  { id: "center", label: "Center", offset: 0 },
  { id: "right", label: "Right", offset: 0.62 },
];

export const SHAPES = [
  { id: "draw", label: "Draw", bias: -0.28 },
  { id: "straight", label: "Straight", bias: 0 },
  { id: "cut", label: "Cut", bias: 0.28 },
];

const PRIOR_HI = [-5, 0, 10, 20, 30];
const PRIOR_PROBS = [
  [0.198, 0.63, 0.155, 0.015, 0.002],
  [0.144, 0.6, 0.22, 0.031, 0.005],
  [0.051, 0.36, 0.42, 0.13, 0.039],
  [0.0185, 0.21, 0.4, 0.245, 0.1265],
  [0.0062, 0.105, 0.325, 0.315, 0.2488],
];

const COURSE_META = {
  "crystal-springs": { slope: 144, rating: 71.3, par: 72, geometry: "/data/crystal-springs.json" },
  "wild-turkey": { slope: 132, rating: 71.7, par: 71, geometry: "/data/wild-turkey.json" },
  "black-bear": { slope: 132, rating: 71.3, par: 72, geometry: "/data/black-bear.json" },
  ballyowen: { slope: 138, rating: 72.2, par: 72, geometry: "/data/ballyowen.json" },
};

const PLAYER_SCOUTING = {
  "brett swikle": { stockShape: "cut" },
};

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const sum = (values) => values.reduce((total, value) => total + value, 0);
const mean = (values) => (values.length ? sum(values) / values.length : 0);

function normalize(probs) {
  const total = sum(probs);
  return total > 0 ? probs.map((value) => value / total) : [0.05, 0.35, 0.4, 0.15, 0.05];
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function canonicalPlayer(name) {
  const normalized = String(name || "")
    .toLowerCase()
    .replace(/[.’']/g, "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized === "matthew magee") return "matt magee";
  if (normalized === "david ramos morlans") return "david ramos";
  return normalized;
}

export function courseSlug(value) {
  const label = String(value || "").toLowerCase();
  if (label.includes("crystal")) return "crystal-springs";
  if (label.includes("wild turkey") || label.includes("turkey")) return "wild-turkey";
  if (label.includes("black bear") || /\bbear\b/.test(label)) return "black-bear";
  if (label.includes("ballyowen")) return "ballyowen";
  return label
    .replace(/golf club|golf course|\bgc\b/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function priorForIndex(index) {
  const value = clamp(Number(index) || 0, PRIOR_HI[0], PRIOR_HI[PRIOR_HI.length - 1]);
  let left = 0;
  while (left < PRIOR_HI.length - 2 && value > PRIOR_HI[left + 1]) left += 1;
  const span = PRIOR_HI[left + 1] - PRIOR_HI[left] || 1;
  const mix = (value - PRIOR_HI[left]) / span;
  return normalize(PRIOR_PROBS[left].map((prob, i) => prob + mix * (PRIOR_PROBS[left + 1][i] - prob)));
}

function scoreDistToBuckets(dist) {
  if (!Array.isArray(dist) || dist.length < 6) return [0, 0, 0, 0, 0];
  return [
    (Number(dist[0]) || 0) + (Number(dist[1]) || 0),
    Number(dist[2]) || 0,
    Number(dist[3]) || 0,
    Number(dist[4]) || 0,
    Number(dist[5]) || 0,
  ];
}

function profileProbabilities(index, observations) {
  const prior = priorForIndex(index);
  const counts = prior.map((prob) => prob * 36);
  for (const observation of observations) {
    const buckets = scoreDistToBuckets(observation.dist);
    for (let i = 0; i < counts.length; i++) counts[i] += buckets[i] * observation.weight;
  }
  return normalize(counts);
}

function ratingFromProbabilities(index, probs) {
  const expected = sum(probs.map((prob, i) => prob * SCORE_VALUES[i]));
  const variance = sum(probs.map((prob, i) => prob * (SCORE_VALUES[i] - expected) ** 2));
  return {
    overall: Math.round(clamp(96 - (Number(index) || 0) * 2.05, 35, 99)),
    attack: Math.round(clamp(35 + probs[0] * 285, 35, 99)),
    control: Math.round(clamp(98 - (probs[3] + probs[4]) * 175, 30, 99)),
    consistency: Math.round(clamp(98 - variance * 24, 30, 99)),
    expected,
  };
}

function collectRoundRows(round) {
  const allRows = [];
  const individual = new Map();
  for (const tournament of round?.tournaments || []) {
    if (tournament.type !== "match") continue;
    for (const match of tournament.matches || []) {
      for (const row of match.card?.rows || []) {
        if (!Array.isArray(row.gross)) continue;
        allRows.push(row);
        if (row.name.includes(" + ")) continue;
        const key = canonicalPlayer(row.name);
        const holes = row.gross.filter((score) => typeof score === "number").length;
        const previous = individual.get(key);
        const previousHoles = previous?.gross?.filter((score) => typeof score === "number").length || 0;
        if (holes > previousHoles) individual.set(key, row);
      }
    }
  }
  return { allRows, individual };
}

function inferStrokeOrder(rows) {
  if (!rows.length) return Array.from({ length: 18 }, (_, i) => i);
  return Array.from({ length: 18 }, (_, hole) => {
    let two = 0;
    let one = 0;
    let max = 0;
    for (const row of rows) {
      const dots = Number(row.dots?.[hole]) || 0;
      if (dots >= 2) two += 1;
      if (dots >= 1) one += 1;
      max = Math.max(max, dots);
    }
    return { hole, two, one, max };
  })
    .sort((a, b) => b.two - a.two || b.max - a.max || b.one - a.one || a.hole - b.hole)
    .map((entry) => entry.hole);
}

function buildCourseCandidate(dataset, round) {
  if (!Array.isArray(round.pars) || round.pars.length < 18) return null;
  const { allRows, individual } = collectRoundRows(round);
  if (individual.size < 4) return null;
  const slug = courseSlug(round.course || round.label);
  const meta = COURSE_META[slug] || {
    slope: 113,
    rating: sum(round.pars),
    par: sum(round.pars),
    geometry: null,
  };
  const strokeOrder = inferStrokeOrder(allRows);
  const siByHole = Array(18).fill(18);
  strokeOrder.forEach((hole, rank) => {
    siByHole[hole] = rank + 1;
  });
  const holes = round.pars.slice(0, 18).map((par, holeIndex) => {
    const playerScores = {};
    const relatives = [];
    for (const [playerKey, row] of individual) {
      const gross = row.gross?.[holeIndex];
      if (typeof gross !== "number") continue;
      playerScores[playerKey] = gross;
      relatives.push({ playerKey, value: gross - par });
    }
    return {
      number: holeIndex + 1,
      par,
      si: siByHole[holeIndex],
      playerScores,
      relatives,
      averageToPar: mean(relatives.map((entry) => entry.value)),
    };
  });
  const observed = holes.flatMap((hole) => hole.relatives.map((entry) => entry.value));
  return {
    id: `${dataset.trip?.id || "trip"}-${slug}`,
    slug,
    label: round.course || round.label,
    roundLabel: round.label,
    tripLabel: dataset.trip?.name || "Golf Trip",
    holes,
    averageToPar: mean(observed),
    coverage: observed.length,
    ...meta,
  };
}

function decorateCourse(course) {
  const ordered = [...course.holes].sort((a, b) => a.averageToPar - b.averageToPar);
  const rank = Object.fromEntries(ordered.map((hole, index) => [hole.number, index + 1]));
  return {
    ...course,
    holes: course.holes.map((hole) => ({ ...hole, tripRank: rank[hole.number] })),
  };
}

export function buildTripGameModel(primary, history = []) {
  if (!primary) return { players: [], courses: [], teams: [] };
  const datasets = [primary, ...history].filter(
    (dataset, index, all) =>
      dataset?.players?.length &&
      all.findIndex((candidate) => candidate.trip?.id === dataset.trip?.id) === index,
  );
  const observationByPlayer = new Map();
  datasets.forEach((dataset, datasetIndex) => {
    const weight = datasetIndex === 0 ? 1 : 0.45;
    for (const player of dataset.players || []) {
      const key = canonicalPlayer(player.name);
      if (!observationByPlayer.has(key)) observationByPlayer.set(key, []);
      observationByPlayer.get(key).push({ dist: player.dist, weight });
    }
  });

  const players = (primary.players || [])
    .filter((player) => (player.team === "South" || player.team === "North") && Number.isFinite(Number(player.hi)))
    .map((player) => {
      const key = canonicalPlayer(player.name);
      const hi = Number(player.hi);
      const probs = profileProbabilities(hi, observationByPlayer.get(key) || []);
      const ratings = ratingFromProbabilities(hi, probs);
      const scouting = PLAYER_SCOUTING[key];
      const stockShape = scouting?.stockShape || SHAPES[hashString(key) % SHAPES.length].id;
      return {
        key,
        name: player.name,
        team: player.team,
        hi,
        probs,
        stockShape,
        profileSource: scouting ? "scouted" : "modeled",
        trait: key === "sean wilson" ? "Fireball Supplier" : null,
        ...ratings,
      };
    })
    .sort((a, b) => a.team.localeCompare(b.team) || a.hi - b.hi || a.name.localeCompare(b.name));

  const courseBySlug = new Map();
  for (const dataset of datasets) {
    for (const round of dataset.rounds || []) {
      const candidate = buildCourseCandidate(dataset, round);
      if (!candidate) continue;
      const previous = courseBySlug.get(candidate.slug);
      if (!previous || candidate.coverage > previous.coverage) courseBySlug.set(candidate.slug, candidate);
    }
  }
  const courses = [...courseBySlug.values()]
    .map(decorateCourse)
    .sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));
  return {
    players,
    courses,
    teams: ["South", "North"].filter((team) => players.some((player) => player.team === team)),
    dataSummary: {
      trips: datasets.length,
      observations: courses.reduce((total, course) => total + course.coverage, 0),
      historicalPlayers: observationByPlayer.size,
    },
  };
}

function shiftDistribution(source, amount) {
  let probs = [...source];
  let remaining = clamp(amount, -1.5, 1.5);
  while (Math.abs(remaining) > 0.0001) {
    const direction = remaining > 0 ? 1 : -1;
    const fraction = Math.min(1, Math.abs(remaining));
    const next = Array(probs.length).fill(0);
    for (let i = 0; i < probs.length; i++) {
      const destination = clamp(i + direction, 0, probs.length - 1);
      next[i] += probs[i] * (1 - fraction);
      next[destination] += probs[i] * fraction;
    }
    probs = next;
    remaining -= direction * fraction;
  }
  return normalize(probs);
}

function addActualMemory(probs, actualRelative) {
  if (actualRelative == null) return probs;
  const bucket = actualRelative <= -1 ? 0 : actualRelative === 0 ? 1 : actualRelative === 1 ? 2 : actualRelative === 2 ? 3 : 4;
  const strength = 3;
  const baseStrength = 36;
  return normalize(probs.map((prob, index) => prob * baseStrength + (index === bucket ? strength : 0)));
}

function averageHoleWithoutPlayer(hole, playerKey) {
  const values = hole.relatives.filter((entry) => entry.playerKey !== playerKey).map((entry) => entry.value);
  return values.length ? mean(values) : hole.averageToPar;
}

function shapeFitAdjustment(profile, hole, shapeId) {
  const preferred = hole.preferredShape || "straight";
  const severity = clamp(Number(hole.shapeSeverity) || 0, 0, 1);
  const execution = shapeId === profile.stockShape ? -0.025 : 0.03;
  if (preferred === "straight") return execution + (shapeId === "straight" ? -0.02 : 0);
  if (shapeId === preferred) return execution - 0.18 * severity;
  if (shapeId === "straight") return execution + 0.055 * severity;
  return execution + 0.18 * severity;
}

/** Aim is a continuous lateral offset (-0.93 left .. 0.93 right); legacy string ids still resolve. */
export function aimOffsetOf(aim) {
  if (typeof aim === "number") return clamp(aim, -0.93, 0.93);
  const preset = AIMS.find((item) => item.id === aim);
  return preset ? preset.offset : 0;
}

function landingProbabilities(profile, hole, decision, state) {
  const club = CLUBS.find((item) => item.id === decision.club) || CLUBS[0];
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const danger = hole.dangerSide === "left" ? -1 : hole.dangerSide === "right" ? 1 : 0;
  const pathBias = aimOffsetOf(decision.aim) + shape.bias;
  const intoDanger = Math.max(0, pathBias * danger);
  const awayFromDanger = Math.max(0, -pathBias * danger);
  const offline = Math.max(0, Math.abs(pathBias) - 0.45);
  const shapeFit = shapeFitAdjustment(profile, hole, decision.shape);
  const hazardSeverity = clamp(Number(hole.hazardSeverity) || (hole.hasWater ? 0.55 : 0.25), 0, 1);
  const clubAggression = club.id === "driver" ? 1 : club.id === "wood" ? 0.58 : 0.2;
  const buzz = Number(state?.buzz) || 0;
  const buzzPenalty = buzz > 35 ? (buzz - 35) / 270 : 0;
  const control = (profile.control - 30) / 69;

  let fairway =
    0.44 +
    control * 0.2 +
    club.fairway -
    buzzPenalty -
    intoDanger * 0.08 -
    offline * 0.14 -
    shapeFit * 0.24 -
    hazardSeverity * clubAggression * 0.055;
  let bunker =
    0.06 +
    club.risk * 0.35 +
    intoDanger * (hole.primaryHazard === "bunker" ? 0.08 : 0.025) +
    Math.max(0, shapeFit) * 0.08 +
    hazardSeverity * clubAggression * 0.025;
  let penalty =
    0.015 +
    Math.max(0, club.risk) * 0.25 +
    intoDanger * (hole.primaryHazard === "water" ? 0.12 : 0.075) +
    Math.max(0, shapeFit) * 0.06 +
    hazardSeverity * clubAggression * 0.035;
  if (hole.hasWater) penalty += 0.018;
  penalty -= awayFromDanger * 0.035;
  fairway = clamp(fairway, 0.2, 0.76);
  bunker = clamp(bunker, 0.015, 0.2);
  penalty = clamp(penalty, 0.005, 0.24);
  const rough = Math.max(0.08, 1 - fairway - bunker - penalty);
  return normalize([fairway, rough, bunker, penalty]);
}

function stateShift(state) {
  const buzz = Number(state?.buzz) || 0;
  const morale = Number(state?.morale ?? 50);
  const buzzEffect = buzz <= 35 ? -buzz * 0.0025 : -0.0875 + (buzz - 35) * 0.015;
  const moraleEffect = -(morale - 50) * 0.004;
  return buzzEffect + moraleEffect;
}

function applyFireballVariance(probs) {
  const next = [...probs];
  const moved = Math.min(next[2] * 0.52, 0.22);
  next[2] -= moved;
  next[0] += moved * 0.34;
  next[1] += moved * 0.24;
  next[3] += moved * 0.24;
  next[4] += moved * 0.18;
  return normalize(next);
}

/* Same weights used for the mean "trouble" shift in buildHoleOdds, so conditioning stays consistent. */
const LANDING_SHIFTS = [0, 0.08, 0.22, 1.25];
const LANDING_LABELS = ["Fairway", "Rough", "Bunker", "Penalty area"];

/** Score distribution conditioned on where the tee shot actually finished. */
function conditionOnLanding(probs, landing, landingIndex) {
  const weights = [landing.fairway, landing.rough, landing.bunker, landing.penalty];
  const meanShift = weights.reduce((total, weight, index) => total + weight * LANDING_SHIFTS[index], 0);
  let conditional = shiftDistribution(probs, LANDING_SHIFTS[landingIndex] - meanShift);
  if (landingIndex === 3) conditional = normalize(conditional.map((prob, index) => (index === 0 ? prob * 0.05 : prob)));
  else if (landingIndex === 2) conditional = normalize(conditional.map((prob, index) => (index === 0 ? prob * 0.45 : prob)));
  return conditional;
}

/** Penalty for leaving an awkward approach — or flying the green — with the chosen club. */
function distanceShiftFor(hole, club) {
  const yards = Number(hole.yards);
  if (!Number.isFinite(yards) || yards <= 0) return 0;
  const comfortZone = hole.par === 3 ? 10 : hole.par === 4 ? 150 : 265;
  const leftover = Math.max(0, yards - club.carry);
  let shift = clamp((leftover - comfortZone) / 320, 0, 0.4);
  if (club.carry > yards + 20) shift += clamp((club.carry - yards - 20) / 260, 0, 0.3);
  return shift;
}

export function defaultDecision(profile, hole) {
  const yards = Number(hole.yards) || 0;
  return {
    club: hole.par <= 3 ? (yards > 195 ? "wood" : "iron") : "driver",
    aim: hole.dangerSide === "right" ? -0.42 : hole.dangerSide === "left" ? 0.42 : 0,
    shape: profile.stockShape,
    fireball: false,
  };
}

export function buildHoleOdds({ profile, course, hole, decision, state }) {
  if (!profile || !course || !hole) return null;
  const actualGross = hole.playerScores?.[profile.key];
  const actualRelative = typeof actualGross === "number" ? actualGross - hole.par : null;
  let probs = addActualMemory(profile.probs, actualRelative);
  const tripDifficulty = averageHoleWithoutPlayer(hole, profile.key) - course.averageToPar;
  const officialDifficulty = ((9.5 - (hole.si || 9.5)) / 8.5) * 0.12;
  const landing = landingProbabilities(profile, hole, decision, state);
  const club = CLUBS.find((item) => item.id === decision.club) || CLUBS[0];
  const trouble = landing[1] * 0.08 + landing[2] * 0.22 + landing[3] * 1.25;
  const shapeFit = shapeFitAdjustment(profile, hole, decision.shape);
  const hazardSeverity = clamp(Number(hole.hazardSeverity) || (hole.hasWater ? 0.55 : 0.25), 0, 1);
  const clubRisk = Math.max(0, club.risk) * (0.2 + hazardSeverity * 1.75);
  const distanceShift = distanceShiftFor(hole, club);
  const shift =
    tripDifficulty * 0.55 +
    officialDifficulty +
    trouble +
    shapeFit +
    clubRisk +
    distanceShift +
    stateShift(state) -
    club.upside;
  probs = shiftDistribution(probs, shift);
  if (decision.fireball) probs = applyFireballVariance(probs);
  const expectedRelative = sum(probs.map((prob, index) => prob * SCORE_VALUES[index]));
  const actualBucket =
    actualRelative == null ? null : actualRelative <= -1 ? 0 : actualRelative === 0 ? 1 : actualRelative === 1 ? 2 : actualRelative === 2 ? 3 : 4;
  return {
    probs,
    landing: {
      fairway: landing[0],
      rough: landing[1],
      bunker: landing[2],
      penalty: landing[3],
    },
    expectedRelative,
    expectedGross: hole.par + expectedRelative,
    actualGross,
    actualRelative,
    actualChance: actualBucket == null ? null : probs[actualBucket],
    tripDifficulty,
    officialDifficulty,
    courseHandicap: courseHandicap(profile.hi, course),
  };
}

export function courseHandicap(index, course) {
  const hi = Number(index);
  if (!Number.isFinite(hi)) return 0;
  return Math.round(hi * ((course?.slope || 113) / 113) + ((course?.rating || course?.par || 72) - (course?.par || 72)));
}

function strokeOnHole(strokes, strokeIndex) {
  const count = Math.max(0, Math.round(strokes));
  const full = Math.floor(count / 18);
  const remaining = count % 18;
  return full + ((strokeIndex || 18) <= remaining ? 1 : 0);
}

function sampleIndex(probs, random) {
  const value = random();
  let cumulative = 0;
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i];
    if (value <= cumulative) return i;
  }
  return probs.length - 1;
}

export function resolveMatchHole({ human, cpu, humanOdds, cpuOdds, course, hole, random = Math.random }) {
  const humanLandingIndex = sampleIndex(
    [humanOdds.landing.fairway, humanOdds.landing.rough, humanOdds.landing.bunker, humanOdds.landing.penalty],
    random,
  );
  const cpuLandingIndex = sampleIndex(
    [cpuOdds.landing.fairway, cpuOdds.landing.rough, cpuOdds.landing.bunker, cpuOdds.landing.penalty],
    random,
  );
  const humanBucket = sampleIndex(conditionOnLanding(humanOdds.probs, humanOdds.landing, humanLandingIndex), random);
  const cpuBucket = sampleIndex(conditionOnLanding(cpuOdds.probs, cpuOdds.landing, cpuLandingIndex), random);
  const humanGross = Math.max(1, hole.par + SCORE_VALUES[humanBucket]);
  const cpuGross = Math.max(1, hole.par + SCORE_VALUES[cpuBucket]);
  const humanHcp = courseHandicap(human.hi, course);
  const cpuHcp = courseHandicap(cpu.hi, course);
  const humanStroke = strokeOnHole(Math.max(0, humanHcp - cpuHcp), hole.si);
  const cpuStroke = strokeOnHole(Math.max(0, cpuHcp - humanHcp), hole.si);
  const humanNet = humanGross - humanStroke;
  const cpuNet = cpuGross - cpuStroke;
  const winner = humanNet < cpuNet ? "human" : humanNet > cpuNet ? "cpu" : "tie";
  return {
    winner,
    humanGross,
    cpuGross,
    humanNet,
    cpuNet,
    humanStroke,
    cpuStroke,
    humanLanding: LANDING_LABELS[humanLandingIndex],
    cpuLanding: LANDING_LABELS[cpuLandingIndex],
    humanBucket: SCORE_BUCKETS[humanBucket],
    cpuBucket: SCORE_BUCKETS[cpuBucket],
  };
}

/** Match-play closeout: the match is decided once the lead exceeds the holes remaining. */
export function matchCloseout({ humanWins, cpuWins, holesPlayed, totalHoles = 18 }) {
  const remaining = totalHoles - holesPlayed;
  const diff = Math.abs(humanWins - cpuWins);
  if (diff > remaining) {
    return {
      decided: true,
      leader: humanWins > cpuWins ? "human" : "cpu",
      label: remaining > 0 ? `${diff}&${remaining}` : `${diff} UP`,
      holesPlayed,
    };
  }
  return { decided: false, dormie: diff > 0 && diff === remaining };
}

const AIM_SEARCH = [-0.62, -0.31, 0, 0.31, 0.62];

export function findBestDecision({ profile, course, hole, state }) {
  const base = defaultDecision(profile, hole);
  let best = null;
  let worst = null;
  for (const club of CLUBS.filter((item) => item.minPar <= hole.par)) {
    for (const shape of SHAPES) {
      for (const aim of AIM_SEARCH) {
        const decision = { ...base, club: club.id, shape: shape.id, aim, fireball: false };
        const odds = buildHoleOdds({ profile, course, hole, decision, state });
        const plan = { decision, odds };
        if (!best || odds.expectedGross < best.odds.expectedGross) best = plan;
        if (!worst || odds.expectedGross > worst.odds.expectedGross) worst = plan;
      }
    }
  }
  return { best, worst };
}

export function chooseCpuPlayer({ players, usage, maxUses, course, hole, stateByPlayer, random = Math.random }) {
  const available = players.filter((player) => (usage[player.key] || 0) < maxUses);
  const pool = available.length ? available : players;
  let best = null;
  for (const profile of pool) {
    const { best: bestPlan } = findBestDecision({
      profile,
      course,
      hole,
      state: stateByPlayer[profile.key],
    });
    const { decision, odds } = bestPlan;
    const conservation = (usage[profile.key] || 0) * 0.075;
    const noise = (random() - 0.5) * 0.12;
    const score = odds.expectedGross + conservation + noise;
    if (!best || score < best.score) best = { profile, decision, odds, score };
  }
  return best;
}

export function makeSeededRandom(seed) {
  let value = (Number(seed) || 1) >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatOdds(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

export function scoreLabel(relative) {
  if (relative <= -2) return "Eagle+";
  if (relative === -1) return "Birdie";
  if (relative === 0) return "Par";
  if (relative === 1) return "Bogey";
  if (relative === 2) return "Double";
  return "Triple+";
}
