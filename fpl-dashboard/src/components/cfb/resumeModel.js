// Resume Builder scoring, shared by the page (Resume.jsx) and offline checks. No React here.

// Every question is a 1-5 scale where 5 is the biggest effect. Answers are stored as indexes 0-4 (shown as 1-5) and the
// URL keeps them as ?s=333333333333 so rankings can be shared. 3 is the default for every question and 2 and 4 sit
// halfway to the ends. Value ranges were tuned by running every 1/3/5 combination and a million random answer sets
// (talent and schedule were scaled down so neither outweighs ranked wins).
export const QUESTIONS = [
  { sec: 'Wins', key: 'winGood', q: 'How much extra credit for FBS wins over .500 teams?', lo: 'none', hi: 'big boost', vals: [0, 0.25, 0.5, 0.75, 1] },
  { sec: 'Wins', key: 'ranked', q: 'How much extra credit for wins over AP-ranked teams?', lo: 'none', hi: 'big boost', vals: [0, 0.375, 0.75, 1.125, 1.5] },
  { sec: 'Wins', key: 'faded', q: 'How much should a win over a team that’s no longer ranked still count as a ranked win?', lo: 'not at all', hi: 'fully', vals: [0, 0.25, 0.5, 0.75, 1] },
  { sec: 'Wins', key: 'talent', q: 'How much extra credit for wins over teams with top-50 rosters (247 talent)?', lo: 'none', hi: 'big boost', vals: [0, 0.15, 0.3, 0.45, 0.6] },
  { sec: 'Wins', key: 'weakWin', q: 'How much less should a win over a bad team count? (more so the worse its record)', lo: 'the same', hi: 'barely counts', vals: [0, 0.2, 0.4, 0.6, 0.8] },
  { sec: 'Wins', key: 'road', q: 'How much extra credit for road wins?', lo: 'none', hi: 'a lot', vals: [0, 0.125, 0.25, 0.375, 0.5] },
  { sec: 'Wins', key: 'fcs', q: 'How much should a win over an FCS team count?', lo: 'not at all', hi: 'fully', vals: [0, 0.25, 0.5, 0.75, 1] },
  { sec: 'Losses', key: 'lossBad', q: 'How much more should a loss to a team with a losing record (or FCS) hurt?', lo: 'no more', hi: 'a lot more', vals: [0, 0.375, 0.75, 1.125, 1.5] },
  { sec: 'Losses', key: 'homeLoss', q: 'How much more should a home loss hurt?', lo: 'no more', hi: 'a lot more', vals: [0, 0.25, 0.5, 0.75, 1] },
  { sec: 'Losses', key: 'goodLoss', q: 'How much should a loss to a ranked team hurt?', lo: 'much less', hi: 'like any loss', vals: [0.4, 0.55, 0.7, 0.85, 1] },
  { sec: 'Schedule', key: 'sos', q: 'How much credit for a tough schedule, win or lose?', lo: 'none', hi: 'a lot', vals: [0, 0.125, 0.25, 0.375, 0.5] },
  { sec: 'Full strength', key: 'qb', q: 'How much less should a win count if the opponent’s starting QB was out?', lo: 'the same', hi: 'much less', vals: [1, 0.9, 0.8, 0.65, 0.5] },
  { sec: 'Full strength', key: 'ownQb', q: 'How much less should a loss hurt if your own starting QB was out?', lo: 'the same', hi: 'much less', vals: [1, 0.8, 0.6, 0.425, 0.25] },
  { sec: 'Margin', key: 'margin', q: 'How much should margin of victory (or defeat) matter?', lo: 'only W/L', hi: 'a lot', vals: [0, 0.25, 0.5, 0.75, 1] },
];
export const SCALE = 5;
export const DEFAULT = QUESTIONS.map(() => 2);
export const PLAYOFF = 12;

// Question order of earlier links (before weakWin and homeLoss were added); their new questions get the default.
const LEGACY_KEYS = ['winGood', 'ranked', 'faded', 'talent', 'road', 'fcs', 'lossBad', 'goodLoss', 'sos', 'qb', 'ownQb', 'margin'];
const fromLegacy = (vals) => {
  const byKey = Object.fromEntries(LEGACY_KEYS.map((k, i) => [k, vals[i]]));
  return QUESTIONS.map((q, i) => byKey[q.key] ?? DEFAULT[i]);
};

/** Answers from the ?s= digits (1-5 per question); older 12-question links carry over; anything else gives defaults. */
export function parseAnswers(s) {
  if (!s || !/^[1-5]+$/.test(s)) return [...DEFAULT];
  const a = [...s].map((c) => Number(c) - 1);
  if (a.length === QUESTIONS.length) return a;
  if (a.length === LEGACY_KEYS.length) return fromLegacy(a);
  return [...DEFAULT];
}

export const answersToParam = (a) => a.map((x) => x + 1).join('');

// The earlier three-option links (?r=, digits 0-2) map to 1, 3 and 5. Three of those questions listed their options with
// the biggest effect first, so they are flipped.
const OLD_FLIPPED = new Set(['faded', 'fcs', 'goodLoss']);
export function migrateOldAnswers(r) {
  if (!r || r.length !== LEGACY_KEYS.length || !/^[0-2]+$/.test(r)) return null;
  return fromLegacy([...r].map((c, i) => {
    const k = Number(c) * 2; // 0, 2, 4
    return OLD_FLIPPED.has(LEGACY_KEYS[i]) ? 4 - k : k;
  }));
}

// A win is always worth at least WIN_FLOOR and a loss always costs at least LOSS_FLOOR (half a win), so no combination of answers
// can make a loss count for more than a win (schedule credit alone could otherwise turn a loss positive).
const WIN_FLOOR = 0.25;
const LOSS_FLOOR = -0.5;

/** Value of one game for the team's resume under the chosen answers. */
export function gameValue(g, w, oppById) {
  const [oppId, , result, margin, site, apThen, oppQbOut, ownQbOut] = g;
  const opp = oppById.get(oppId); // undefined for FCS
  const fcs = !opp;
  const rankedNow = opp?.ap != null;
  const rankedThen = apThen != null;
  // a ranked opponent counts more the higher it is ranked: about 1.5 for #1 down to about 0.5 for #25
  // a team that was ranked when played but isn't now counts as ranked by the share the user chose (w.faded, 0-1)
  const byRank = (r) => 0.5 + (26 - r) / 25;
  const rankedFactor = rankedNow ? byRank(opp.ap) : rankedThen ? byRank(apThen) * w.faded : 0;
  const m = Math.min(Math.abs(margin), 21) / 21;
  // schedule credit for every game, from -1 to +1 by opponent strength. Strength is the opponent's SRS rating (margin,
  // adjusted for who it played), so a good record in a weak conference does not pass for a strong opponent; +-12 points
  // (about the top and bottom tenth of FBS) reaches the ends. FCS opponents are -1. Without SRS, win% stands in.
  const strength = fcs ? -1 : opp.srs != null ? Math.max(-1, Math.min(1, opp.srs / 12)) : (opp.pct - 0.5) * 2;
  const sched = w.sos * strength;
  if (result === 'W') {
    if (fcs) return Math.max(w.fcs + sched, WIN_FLOOR * w.fcs);
    // roster talent of the opponent: full credit for a top-25 roster, half for 26-50
    const talentFactor = opp.tal == null ? 0 : opp.tal <= 25 ? 1 : opp.tal <= 50 ? 0.5 : 0;
    // the .500 bonus grows with the opponent's record: about half for a team just over .500, 1.5x for an unbeaten one
    const goodFactor = opp.pct > 0.5 ? 0.5 + (opp.pct - 0.5) * 2 : 0;
    let v = 1 + w.winGood * goodFactor + w.ranked * rankedFactor + w.talent * talentFactor + (site === 'A' ? w.road : 0) + w.margin * m;
    // a win over a bad team is discounted, more the worse its record (none at .500, full at winless)
    const badness = Math.max(0, 0.5 - opp.pct) * 2;
    v *= 1 - w.weakWin * badness;
    if (oppQbOut) v *= w.qb;
    return Math.max(v + sched, WIN_FLOOR);
  }
  let p = 1 + (fcs || opp.pct < 0.5 ? w.lossBad : 0) + w.margin * m;
  if (rankedFactor > 0) p *= w.goodLoss;
  if (ownQbOut) p *= w.ownQb;
  // a home loss costs extra on top, untouched by the softening above
  if (site === 'H') p += w.homeLoss;
  return Math.min(-p + sched, LOSS_FLOOR);
}

/** Option values for a list of answer indexes, keyed by question. */
export function weightsFor(answers) {
  return Object.fromEntries(QUESTIONS.map((q, i) => [q.key, q.vals[answers[i]] ?? q.vals[DEFAULT[i]]]));
}

/** Every team with its score, best win, worst loss, per-game values ({g, v}) and rank under the answers. */
export function rankTeams(teams, answers) {
  const oppById = new Map(teams.map((t) => [t.id, t]));
  const w = weightsFor(answers);
  // scores are put on a common number of games, so a team with an extra game (or one fewer) is not helped or hurt
  const counts = teams.map((t) => t.games.length).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)] || 1;
  const rows = teams.map((t) => {
    const vals = t.games.map((g) => ({ g, v: gameValue(g, w, oppById) }));
    const wins = vals.filter((x) => x.g[2] === 'W').sort((a, b) => b.v - a.v);
    const losses = vals.filter((x) => x.g[2] === 'L').sort((a, b) => a.v - b.v);
    const total = vals.reduce((s, x) => s + x.v, 0);
    return { ...t, score: vals.length ? (total * typical) / vals.length : 0, best: wins[0]?.g[1], worst: losses[0]?.g[1], vals };
  });
  rows.sort((a, b) => b.score - a.score || (a.ap ?? 99) - (b.ap ?? 99) || b.pct - a.pct);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
