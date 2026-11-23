// Resume Builder scoring, shared by the page (Resume.jsx) and offline checks. No React here.

// Each answer is one option index; the URL keeps them as ?r=111111111 so rankings can be shared.
export const QUESTIONS = [
  { sec: 'Wins', key: 'winGood', q: 'Wins over teams with winning records', opts: [['No extra credit', 0], ['Some extra', 0.5], ['Big boost', 1]] },
  { sec: 'Wins', key: 'ranked', q: 'Wins over AP-ranked teams', opts: [['No extra credit', 0], ['Some extra', 0.75], ['Big boost', 1.5]] },
  { sec: 'Wins', key: 'faded', q: 'A win over a team that was ranked then but isn’t now', opts: [['Still a ranked win', 'then'], ['Counts half', 'half'], ['Not a ranked win', 'now']] },
  { sec: 'Wins', key: 'talent', q: 'Wins over teams with top-50 rosters (247 talent)', opts: [['No extra credit', 0], ['Some extra', 0.5], ['Big boost', 1]] },
  { sec: 'Wins', key: 'road', q: 'Road wins', opts: [['Same as home', 0], ['A bit more', 0.25], ['A lot more', 0.5]] },
  { sec: 'Wins', key: 'fcs', q: 'Wins over FCS teams', opts: [['Count fully', 1], ['Count half', 0.5], ['Don’t count', 0]] },
  { sec: 'Losses', key: 'lossBad', q: 'Losses to teams with losing records (or FCS)', opts: [['Like any loss', 0], ['Hurt more', 0.75], ['Hurt a lot', 1.5]] },
  { sec: 'Losses', key: 'goodLoss', q: 'Losses to ranked teams', opts: [['Hurt like any loss', 1], ['Hurt less', 0.7], ['Hurt much less', 0.4]] },
  { sec: 'Schedule', key: 'sos', q: 'Credit for a tough schedule, win or lose', opts: [['None', 0], ['Some', 0.4], ['A lot', 0.75]] },
  { sec: 'Full strength', key: 'qb', q: 'A win when the opponent’s starting QB didn’t play', opts: [['Counts the same', 1], ['Counts a bit less', 0.8], ['Counts much less', 0.5]] },
  { sec: 'Full strength', key: 'ownQb', q: 'A loss when your own starting QB didn’t play', opts: [['Hurts the same', 1], ['Hurts less', 0.6], ['Barely hurts', 0.25]] },
  { sec: 'Margin', key: 'margin', q: 'Margin of victory (or defeat)', opts: [['Only W/L matters', 0], ['Matters some', 0.5], ['Matters a lot', 1]] },
];
export const DEFAULT = QUESTIONS.map(() => 1);
export const PLAYOFF = 12;

export function parseAnswers(s) {
  if (!s || s.length !== QUESTIONS.length) return [...DEFAULT];
  const a = [...s].map(Number);
  return a.every((x, i) => Number.isInteger(x) && x >= 0 && x < QUESTIONS[i].opts.length) ? a : DEFAULT;
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
  const byRank = (r) => 0.5 + (26 - r) / 25;
  const now = rankedNow ? byRank(opp.ap) : 0;
  const then = rankedThen ? byRank(apThen) : 0;
  const rankedFactor = w.faded === 'then' ? Math.max(now, then) : w.faded === 'half' ? (rankedNow ? now : then * 0.5) : now;
  const m = Math.min(Math.abs(margin), 21) / 21;
  // schedule credit for every game: from -1 (winless or FCS opponent) to +1 (unbeaten opponent)
  const sched = w.sos * (fcs ? -1 : (opp.pct - 0.5) * 2);
  if (result === 'W') {
    if (fcs) return Math.max(w.fcs + sched, WIN_FLOOR * w.fcs);
    // roster talent of the opponent: full credit for a top-25 roster, half for 26-50
    const talentFactor = opp.tal == null ? 0 : opp.tal <= 25 ? 1 : opp.tal <= 50 ? 0.5 : 0;
    let v = 1 + (opp.pct > 0.5 ? w.winGood : 0) + w.ranked * rankedFactor + w.talent * talentFactor + (site === 'A' ? w.road : 0) + w.margin * m;
    if (oppQbOut) v *= w.qb;
    return Math.max(v + sched, WIN_FLOOR);
  }
  let p = 1 + (fcs || opp.pct < 0.5 ? w.lossBad : 0) + w.margin * m;
  if (rankedFactor > 0) p *= w.goodLoss;
  if (ownQbOut) p *= w.ownQb;
  return Math.min(-p + sched, LOSS_FLOOR);
}

/** Option values for a list of answer indexes, keyed by question. */
export function weightsFor(answers) {
  return Object.fromEntries(QUESTIONS.map((q, i) => [q.key, (q.opts[answers[i]] ?? q.opts[DEFAULT[i]])[1]]));
}

/** Every team with its score, best win, worst loss and rank under the answers. */
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
    return { ...t, score: vals.length ? (total * typical) / vals.length : 0, best: wins[0]?.g[1], worst: losses[0]?.g[1] };
  });
  rows.sort((a, b) => b.score - a.score || (a.ap ?? 99) - (b.ap ?? 99) || b.pct - a.pct);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}
