// "Your narrative" (shown on the page): a one- or two-sentence argument for an agenda, built from the teams' actual results and the answers
// the user leaned on hardest. Every claim is a fact from the data; the answers only decide which facts lead.
import { PLAYOFF, QUESTIONS } from './resumeModel.js';

const KEY = Object.fromEntries(QUESTIONS.map((q, i) => [q.key, i]));

// game: [opp_id, opp, result, margin, site, opp_ap_then, opp_qb_out, own_qb_out]
function facts(team, oppById) {
  const games = team.games.map((g) => ({ g, opp: oppById.get(g[0]) }));
  const wins = games.filter((x) => x.g[2] === 'W');
  const losses = games.filter((x) => x.g[2] === 'L');
  const ranked = (x) => x.opp?.ap != null || x.g[5] != null;
  const losing = (x) => !x.opp || x.opp.pct < 0.5;
  const rec = (x) => (x.opp ? `${x.opp.w}-${x.opp.l}` : 'FCS');
  const rankedWins = wins.filter(ranked).sort((a, b) => (a.opp?.ap ?? a.g[5] ?? 99) - (b.opp?.ap ?? b.g[5] ?? 99));
  const lastLoss = losses.length ? games.indexOf(losses[losses.length - 1]) : -1;
  return {
    team, games, wins, losses, rec,
    winsOver500: wins.filter((x) => x.opp && x.opp.pct > 0.5).length,
    rankedWins,
    talentWins: wins.filter((x) => x.opp?.tal != null && x.opp.tal <= 50).length,
    roadWins: wins.filter((x) => x.g[4] === 'A').length,
    avgWinMargin: wins.length ? wins.reduce((s, x) => s + x.g[3], 0) / wins.length : 0,
    winsVsLosing: wins.filter(losing),
    badLosses: losses.filter(losing),
    homeLosses: losses.filter((x) => x.g[4] === 'H'),
    rankedLosses: losses.filter(ranked),
    qbOutLosses: losses.filter((x) => x.g[7]),
    backupQbWins: wins.filter((x) => x.g[6]),
    fcsGames: games.filter((x) => !x.opp).length,
    gamesSinceLoss: lastLoss < 0 ? null : games.length - 1 - lastLoss,
    lastLoss: lastLoss < 0 ? null : games[lastLoss],
  };
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const num = (n) => WORDS[n] ?? String(n);
const plural = (n, word) => `${num(n)} ${word}${n === 1 ? '' : 's'}`;
const ordinal = (n) => `${n}${[11, 12, 13].includes(n % 100) ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const list = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

// Each clause: [question key, how much the answers emphasize it (0-4), text or null when the facts don't support it]
function forClauses(f, a) {
  const t = f.team;
  const best = f.rankedWins[0];
  const n = f.rankedWins.length;
  return [
    ['ranked', a.ranked, n === 1 ? `a win over ranked ${best.g[1]}` : n > 1 ? `${plural(n, 'win')} over ranked teams, ${best.g[1]} included` : null],
    ['winGood', a.winGood, f.winsOver500 >= 3 ? `${plural(f.winsOver500, 'win')} over teams with winning records` : null],
    ['talent', a.talent, f.talentWins >= 2 ? `${plural(f.talentWins, 'win')} over top-50 rosters` : null],
    ['sos', a.sos, t.sos != null && t.sos <= 30 ? `the nation’s ${ordinal(t.sos)}-toughest schedule` : null],
    ['margin', a.margin, f.avgWinMargin >= 14 ? `a ${Math.round(f.avgWinMargin)}-point average margin of victory` : null],
    ['road', a.road, f.roadWins >= 3 ? `${plural(f.roadWins, 'road win')}` : null],
    ['lossBad', a.lossBad, f.losses.length && !f.badLosses.length ? 'not one bad loss' : null],
    ['homeLoss', a.homeLoss, !f.homeLosses.length ? 'an unbeaten home record' : null],
    ['lateLoss', a.lateLoss, f.gamesSinceLoss != null && f.gamesSinceLoss >= 3 ? `no losses since ${f.lastLoss.g[1]}` : null],
    ['goodLoss', 4 - a.goodLoss, f.losses.length && f.rankedLosses.length === f.losses.length
      ? (f.losses.length === 1 ? 'their only loss came against a ranked team' : 'every loss against a ranked team') : null],
    ['ownQb', a.ownQb, f.qbOutLosses.length
      ? (f.losses.length === 1 ? 'their only loss came without their starting QB' : `${num(f.qbOutLosses.length)} of their ${num(f.losses.length)} losses without their starting QB`) : null],
    ['weakWin', a.weakWin, f.winsVsLosing.length <= 2 ? 'no padding against bad teams' : null],
    ['fcs', 4 - a.fcs, f.fcsGames === 0 ? 'not even an FCS game on the schedule' : null],
  ];
}

function againstClauses(f, a) {
  const t = f.team;
  const bad = f.badLosses[0];
  const home = f.homeLosses[0];
  const last = f.games[f.games.length - 1];
  const qb = f.backupQbWins.length;
  return [
    ['lossBad', a.lossBad, bad ? `a loss to ${bad.g[1]} (${f.rec(bad)})` : null],
    ['homeLoss', a.homeLoss, home ? `a home loss to ${home.g[1]}` : null],
    ['lateLoss', a.lateLoss, last?.g[2] === 'L' ? `a loss to ${last.g[1]} last time out` : null],
    ['ranked', a.ranked, f.rankedWins.length <= 1 ? `${f.rankedWins.length ? 'just one win' : 'not one win'} over a ranked team` : null],
    ['sos', a.sos, t.sos != null && t.sos >= 50 ? `the ${ordinal(t.sos)}-ranked schedule` : null],
    ['weakWin', a.weakWin, f.winsVsLosing.length >= 4 ? `${num(f.winsVsLosing.length)} of their ${num(f.wins.length)} wins against losing teams` : null],
    ['qb', a.qb, qb ? (qb === 1 ? 'a win over a backup quarterback' : `${num(qb)} wins over backup quarterbacks`) : null],
    ['talent', a.talent, f.talentWins <= 1 ? `${f.talentWins ? 'just one win' : 'not one win'} over a top-50 roster` : null],
    ['winGood', a.winGood, f.winsOver500 <= 3 ? `only ${plural(f.winsOver500, 'win')} over teams with winning records` : null],
    ['margin', a.margin, f.wins.length && f.avgWinMargin < 10 ? `an average margin of victory of just ${Math.round(f.avgWinMargin)}` : null],
  ];
}

// strongest supported clauses first; ties keep the listed order
const pick = (clauses, n) => clauses.filter((c) => c[2]).map((c, i) => ({ c, i }))
  .sort((x, y) => y.c[1] - x.c[1] || x.i - y.i).slice(0, n).map((x) => x.c[2]);

function confFacts(confs, teams, oppById, rankById) {
  const members = teams.filter((t) => confs.includes(t.conf));
  let w = 0, l = 0, rankedWins = 0, rankedInConf = 0;
  for (const t of members) {
    for (const g of t.games) {
      const opp = oppById.get(g[0]);
      if (opp && !confs.includes(opp.conf)) { if (g[2] === 'W') w++; else l++; }
      if (g[2] === 'W' && (opp?.ap != null || g[5] != null)) {
        rankedWins++;
        if (opp && confs.includes(opp.conf)) rankedInConf++;
      }
    }
  }
  const top12 = members.filter((t) => rankById.get(t.id) <= PLAYOFF).map((t) => t.team);
  return { members, w, l, rankedWins, rankedInConf, top12 };
}

/**
 * The spiel for the current goals and answers.
 * goals: { love, hate } team ids (or ''), { loveConf, hateConf } conference group names (or '').
 * ranked: rows from rankTeams; teams: resume.json teams; groups: conference group name -> conference list.
 */
export function barSpiel({ goals, answers, ranked, teams, groups }) {
  const a = Object.fromEntries(Object.entries(KEY).map(([k, i]) => [k, answers[i]]));
  const oppById = new Map(teams.map((t) => [t.id, t]));
  const rankById = new Map(ranked.map((r) => [r.id, r.rank]));
  const byId = (id) => teams.find((t) => t.id === Number(id));
  const sentences = [];

  const pro = [];
  if (goals.love) {
    const t = byId(goals.love);
    const why = pick(forClauses(facts(t, oppById), a), goals.loveConf ? 2 : 3);
    pro.push(`${t.team} at #${rankById.get(t.id)} is easy${why.length ? `: ${list(why)}` : ''}`);
  }
  if (goals.loveConf) {
    const c = confFacts(groups[goals.loveConf], teams, oppById, rankById);
    const why = [`a ${c.w}-${c.l} record outside the conference`, c.rankedWins ? `${c.rankedWins} ranked wins between them` : null].filter(Boolean);
    pro.push(`the ${goals.loveConf} earns ${c.top12.length ? `its ${num(c.top12.length)} in the top ${PLAYOFF}` : 'more respect'} with ${list(why)}`);
  }
  if (pro.length) sentences.push(cap(pro.join(', and ')) + '.');

  const con = [];
  if (goals.hate) {
    const t = byId(goals.hate);
    const why = pick(againstClauses(facts(t, oppById), a), goals.hateConf ? 2 : 3);
    con.push(`${t.team} at #${rankById.get(t.id)} is generous${why.length ? `: ${list(why)}` : ''}`);
  }
  if (goals.hateConf) {
    const c = confFacts(groups[goals.hateConf], teams, oppById, rankById);
    // only damaging facts: a weak record outside the league, or ranked wins that are mostly over each other
    const nonConf = c.w + c.l ? c.w / (c.w + c.l) : 1;
    const knock = nonConf < 0.6 ? `went ${c.w}-${c.l} outside the conference`
      : c.rankedWins && c.rankedInConf / c.rankedWins >= 0.5 ? `got ${c.rankedInConf} of its ${c.rankedWins} ranked wins by beating itself`
        : `has ${num(c.members.length)} teams and still can’t build a deep resume`;
    const who = c.top12.length === 0 ? `has nobody in the top ${PLAYOFF}` : c.top12.length === 1 ? `${c.top12[0]} is all it’s got` : `${num(c.top12.length)} teams are all it’s got`;
    con.push(`the ${goals.hateConf} ${knock}, and ${who}`);
  }
  if (con.length) sentences.push(cap(con.join(', and ')) + '.');
  return sentences.join(' ');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
