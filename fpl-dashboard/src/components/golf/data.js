/**
 * Data layer for the /golf dashboard.
 * Parses a GHIN score export into a clean round model with normalized
 * course names, strict 9/18-hole tagging, and per-hole result counts.
 */

export const RESULT_ORDER = ["eagle", "birdie", "par", "bogey", "double", "triple"];

export const RESULT_COLORS = {
  eagle: "#d4af37",
  birdie: "#e74c3c",
  par: "#22c55e",
  bogey: "#3b82f6",
  double: "#8b5cf6",
  triple: "#6b7280",
};

export const RESULT_LABELS = {
  eagle: "Eagle+",
  birdie: "Birdie",
  par: "Par",
  bogey: "Bogey",
  double: "Double",
  triple: "Triple+",
};

export function resultKey(score, par) {
  const d = score - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  if (d === 2) return "double";
  return "triple";
}

export function parseToPar(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (/^e(ven)?$/i.test(s)) return 0;
  const m = s.match(/^([+-]?)(\d+)$/);
  if (!m) return null;
  return (m[1] === "-" ? -1 : 1) * Number(m[2]);
}

export function fmtToPar(n, { decimals = 0 } = {}) {
  if (n == null) return "—";
  const v = decimals ? Number(n.toFixed(decimals)) : Math.round(n);
  if (v === 0) return "E";
  const str = decimals ? Math.abs(v).toFixed(decimals) : String(Math.abs(v));
  return (v > 0 ? "+" : "−") + str;
}

/* ---------- course name normalization ---------- */

// Par sequences used to identify rounds posted without a course name.
const KNOWN_PARS = {
  "suntree-classic": [4, 5, 3, 4, 5, 4, 3, 4, 4, 5, 4, 4, 4, 3, 4, 3, 4, 5],
  "suntree-challenge": [4, 3, 4, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5],
};
const KNOWN_NAMES = {
  "suntree-classic": "Suntree CC – Classic",
  "suntree-challenge": "Suntree CC – Challenge",
};

const SMALL_WORDS = new Set(["at", "of", "the", "and", "de", "la"]);
const KEEP_CAPS = new Set(["GC", "CC", "II", "III", "IV", "IMG", "USA"]);

function titleCaseWord(w) {
  if (w.length < 3 || KEEP_CAPS.has(w)) return w;
  if (w !== w.toUpperCase()) return w; // already mixed case, leave alone
  const lower = w.toLowerCase();
  if (SMALL_WORDS.has(lower)) return lower;
  return lower.replace(/(^|[^a-z0-9])([a-z])/g, (m, pre, c) => pre + c.toUpperCase());
}

// Fix ALL-CAPS names ("FOX HOLLOW GOLF COURSE" -> "Fox Hollow Golf Course").
export function prettyName(name) {
  return name
    .split(/(\s+|\/)/)
    .map((part) => (/^\s+$|^\/$/.test(part) ? part : titleCaseWord(part)))
    .join("")
    .replace(/\s*\/\s*/g, " / ");
}

const SUFFIXES = [
  "golf club",
  "golf course",
  "golf links",
  "country club",
  "golf resort",
  "club",
  "course",
  "gc",
  "cc",
];

function courseSlug(name) {
  let s = name
    .toLowerCase()
    .replace(/[^a-z0-9/ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of SUFFIXES) {
      if (s.endsWith(" " + suf)) {
        s = s.slice(0, -suf.length - 1).trim();
        changed = true;
      }
    }
  }
  return s || name.toLowerCase();
}

function matchKnownPars(score) {
  const hds = score.hole_details;
  if (!hds?.length || hds.length < 9) return null;
  const pars = [...hds]
    .sort((a, b) => a.hole_number - b.hole_number)
    .map((h) => h.par);
  for (const [key, known] of Object.entries(KNOWN_PARS)) {
    if (pars.length >= 18 && known.every((p, i) => p === pars[i])) return key;
    if (pars.length === 9) {
      const front = known.slice(0, 9);
      const back = known.slice(9, 18);
      if (front.every((p, i) => p === pars[i])) return key;
      if (back.every((p, i) => p === pars[i])) return key;
    }
  }
  return null;
}

function normalizeCourse(score) {
  const facility = (score.facility_name || "").trim();
  const course = (score.course_name || "").trim();
  const raw = course || facility || (score.course_display_value || "").trim();
  const combined = `${facility} ${raw}`.toLowerCase();

  // Suntree has four naming variants in the wild (incl. a truncated one);
  // Crane Creek combos mention Suntree too, so rule those out first.
  if (!combined.includes("crane creek") && combined.includes("suntree")) {
    if (combined.includes("classic"))
      return { key: "suntree-classic", display: KNOWN_NAMES["suntree-classic"] };
    if (combined.includes("challeng"))
      return { key: "suntree-challenge", display: KNOWN_NAMES["suntree-challenge"] };
  }

  if (!raw) {
    const known = matchKnownPars(score);
    if (known) return { key: known, display: KNOWN_NAMES[known] };
    const cr = score.course_rating ?? "?";
    const slope = score.slope_rating ?? "?";
    return {
      key: `cr-${cr}-${slope}`,
      display: `Unknown course (CR ${cr} / Slope ${slope})`,
    };
  }

  // Compare facility (minus any parenthetical) with course: if they name the
  // same thing, use one; otherwise show "Facility – Course" so multi-course
  // facilities (e.g. Grand Cypress Links vs Cypress) stay distinct.
  const facilityBase = facility.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const fslug = facilityBase ? courseSlug(facilityBase) : "";
  const cslug = courseSlug(raw);
  if (facility && course && fslug !== cslug) {
    return {
      key: `${fslug} ${cslug}`.trim(),
      display: prettyName(`${facility} – ${course}`),
    };
  }
  const display = facility.length >= raw.length ? facility : raw;
  return { key: cslug, display: prettyName(display) };
}

/* ---------- round model ---------- */

function countResults(hd) {
  const counts = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0, ace: 0 };
  for (const h of hd) {
    const raw = h.raw_score || h.adjusted_gross_score;
    if (!raw || !h.par) continue;
    counts[resultKey(raw, h.par)]++;
    if (raw === 1) counts.ace++;
  }
  return counts;
}

export function buildModel(json) {
  const displayVotes = {}; // key -> {display -> count}
  const rounds = (json.scores || [])
    .filter((s) => s.adjusted_gross_score != null)
    .map((s) => {
      const { key, display } = normalizeCourse(s);
      displayVotes[key] = displayVotes[key] || {};
      displayVotes[key][display] = (displayVotes[key][display] || 0) + 1;

      const hd =
        Array.isArray(s.hole_details) && s.hole_details.length
          ? [...s.hole_details].sort((a, b) => a.hole_number - b.hole_number)
          : null;
      const holes = s.number_of_holes === 9 || s.number_of_played_holes === 9 ? 9 : 18;
      const par = hd ? hd.reduce((sum, h) => sum + (h.par || 0), 0) : null;
      const toPar =
        parseToPar(s.to_par_display_value) ??
        (par ? s.adjusted_gross_score - par : null);
      // USGA/WHS: any round under 18 played holes gets an 18-hole Score
      // Differential by scaling up with the player's expected score for the
      // unplayed holes — GHIN computes that as (adjusted_)scaled_up_differential.
      // The raw `differential` on those rounds is partial-scale, so never
      // fall back to it.
      const played = s.number_of_played_holes || s.number_of_holes || 18;
      const diff =
        played < 18
          ? (s.adjusted_scaled_up_differential ?? s.scaled_up_differential)
          : s.differential;
      return {
        id: s.id,
        date: s.played_at,
        year: (s.played_at || "").slice(0, 4),
        courseKey: key,
        tee: s.tee_name || null,
        cr: s.course_rating != null ? Number(s.course_rating) : null,
        slope: s.slope_rating != null ? Number(s.slope_rating) : null,
        yards: s.tee_yardage != null ? Number(s.tee_yardage) : null,
        holes,
        played,
        ags: s.adjusted_gross_score,
        toPar,
        par: par ?? (toPar != null ? s.adjusted_gross_score - toPar : null),
        diff: diff != null ? Number(diff) : null,
        used: !!s.used,
        hd,
        counts: hd ? countResults(hd) : null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const courseNames = {};
  for (const [key, votes] of Object.entries(displayVotes)) {
    courseNames[key] = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  }
  for (const r of rounds) r.courseName = courseNames[r.courseKey];

  const years = [...new Set(rounds.map((r) => r.year))].sort().reverse();
  return { golfer: json.golfer || {}, rounds, years, courseNames };
}

/* ---------- aggregation ---------- */

const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

export function aggregate(rounds) {
  const r18 = rounds.filter((r) => r.holes === 18);
  const r9 = rounds.filter((r) => r.holes === 9);
  const tracked = rounds.filter((r) => r.counts);
  const counts = { eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0 };
  let trackedHoles = 0;
  const parScoring = { 3: { n: 0, sum: 0 }, 4: { n: 0, sum: 0 }, 5: { n: 0, sum: 0 } };
  for (const r of tracked) {
    for (const k of RESULT_ORDER) counts[k] += r.counts[k];
    for (const h of r.hd) {
      const raw = h.raw_score || h.adjusted_gross_score;
      if (!raw || !h.par) continue;
      trackedHoles++;
      if (parScoring[h.par]) {
        parScoring[h.par].n++;
        parScoring[h.par].sum += raw;
      }
    }
  }
  // Only rounds with all 18 holes actually played can be a "best" — scaled-up
  // partial rounds (10-17 holes) have projected scores, not real ones.
  const full18 = r18.filter((r) => r.played === 18);
  const best18 = full18.length
    ? full18.reduce((a, b) => (b.ags < a.ags ? b : a))
    : null;
  const best9 = r9.length ? r9.reduce((a, b) => (b.ags < a.ags ? b : a)) : null;
  const diffs = rounds.map((r) => r.diff).filter((d) => d != null);
  return {
    n: rounds.length,
    n18: r18.length,
    n9: r9.length,
    avg18: avg(r18.map((r) => r.ags)),
    avg9: avg(r9.map((r) => r.ags)),
    best18,
    best9,
    avgToPar18: avg(r18.map((r) => r.toPar).filter((v) => v != null)),
    avgToPar9: avg(r9.map((r) => r.toPar).filter((v) => v != null)),
    avgDiff: avg(diffs),
    bestDiff: diffs.length ? Math.min(...diffs) : null,
    counts,
    trackedHoles,
    trackedRounds: tracked.length,
    parScoring,
  };
}

/** Per-hole aggregates (1..18) across rounds that have hole details. */
export function aggregateHoles(rounds) {
  const holes = {};
  for (const r of rounds) {
    if (!r.hd) continue;
    for (const h of r.hd) {
      const n = h.hole_number;
      if (!n || n < 1 || n > 18) continue;
      const raw = h.raw_score || h.adjusted_gross_score;
      if (!raw) continue;
      if (!holes[n]) holes[n] = { hole: n, scores: [], par: null, sa: null };
      holes[n].scores.push(raw);
      if (h.par) holes[n].par = h.par;
      if (h.stroke_allocation) holes[n].sa = h.stroke_allocation;
    }
  }
  return Object.values(holes)
    .sort((a, b) => a.hole - b.hole)
    .map((x) => {
      const dist = {};
      for (const s of x.scores) {
        const k = resultKey(s, x.par || 4);
        dist[k] = (dist[k] || 0) + 1;
      }
      return {
        hole: x.hole,
        par: x.par || 4,
        sa: x.sa,
        avg: avg(x.scores),
        best: Math.min(...x.scores),
        worst: Math.max(...x.scores),
        count: x.scores.length,
        distribution: dist,
      };
    });
}

export function groupBy(rounds, keyFn) {
  const m = {};
  for (const r of rounds) {
    const k = keyFn(r);
    (m[k] = m[k] || []).push(r);
  }
  return m;
}
