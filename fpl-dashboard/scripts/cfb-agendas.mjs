// Precompute Resume Builder "agendas": the answers that best serve one goal.
//
//   node scripts/cfb-agendas.mjs      (also run by cfb-export.mjs)
//
// Reads public/data/cfb/resume.json, writes public/data/cfb/resume_agendas.json:
//   { team: {id: {s, rank}}, conf: {name: {s, top12, teams}}, hate: {id: {s, rank}} }
// where s is the ?s= answer string (1-5 per question).
//
// Scoring uses a fast copy of src/components/cfb/resumeModel.js (per-game features precomputed). The script first
// checks that the copy ranks exactly like the real model and stops if it does not.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, '..', 'public', 'data', 'cfb');
const M = await import(pathToFileURL(join(here, '..', 'src', 'components', 'cfb', 'resumeModel.js')).href);
const { QUESTIONS, DEFAULT, PLAYOFF, rankTeams, answersToParam, marginBand } = M;

export const CONF_AGENDAS = {
  SEC: ['SEC'], 'Big Ten': ['Big Ten'], 'Big 12': ['Big 12'], ACC: ['ACC'], 'Pac-12': ['Pac-12'],
  'Group of 5': ['American', 'C-USA', 'MAC', 'Mountain West', 'Sun Belt'],
};
const HATE_TOP = 25;
const STARTS = 60;

function makeFast(teams) {
  const K = Object.fromEntries(QUESTIONS.map((q, i) => [q.key, i]));
  const byId = new Map(teams.map((t, i) => [t.id, i]));
  const counts = teams.map((t) => t.games.length).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)];
  const byRank = (r) => 0.5 + (26 - r) / 25;
  const G = [];
  teams.forEach((t, ti) => t.games.forEach((g, k) => {
    const [oppId, , result, margin, site, apThen, oppQbOut, ownQbOut] = g;
    const oi = byId.get(oppId); const opp = oi == null ? null : teams[oi];
    G.push({
      ti, win: result === 'W', fcs: !opp,
      nowF: opp?.ap != null ? byRank(opp.ap) : 0, thenF: opp?.ap == null && apThen != null ? byRank(apThen) : 0,
      goodF: opp && opp.pct > 0.5 ? 0.5 + (opp.pct - 0.5) * 2 : 0, badness: opp ? Math.max(0, 0.5 - opp.pct) * 2 : 0,
      bad: !opp || opp.pct < 0.5, home: site === 'H',
      tal: opp?.tal == null ? 0 : opp.tal <= 25 ? 1 : opp.tal <= 50 ? 0.5 : 0,
      road: site === 'A', m: marginBand(margin), when: k / Math.max(t.games.length - 1, 1),
      schedBase: !opp ? -1 : opp.srs != null ? Math.max(-1, Math.min(1, opp.srs / 12)) : (opp.pct - 0.5) * 2,
      qbOut: !!oppQbOut, ownOut: !!ownQbOut,
    });
  }));
  const n = teams.length, glen = teams.map((t) => t.games.length);
  const apKey = teams.map((t) => t.ap ?? 99), pct = teams.map((t) => t.pct);
  const score = new Float64Array(n), order = Array.from({ length: n }, (_, i) => i), rankOf = new Int32Array(n);
  const vals = QUESTIONS.map((q) => q.vals);
  return {
    score, rankOf,
    rank(a) {
      const w = (k) => vals[K[k]][a[K[k]]];
      const winGood = w('winGood'), ranked = w('ranked'), faded = w('faded'), talent = w('talent'), road = w('road'), fcsW = w('fcs');
      const weakWin = w('weakWin'), homeLoss = w('homeLoss'), lateLoss = w('lateLoss');
      const lossBad = w('lossBad'), goodLoss = w('goodLoss'), sos = w('sos'), qb = w('qb'), ownQb = w('ownQb'), margin = w('margin');
      score.fill(0);
      for (const g of G) {
        const rf = g.nowF || g.thenF * faded;
        const sched = sos * g.schedBase;
        let v;
        if (g.win) {
          if (g.fcs) v = Math.max(fcsW + sched, 0.25 * fcsW);
          else {
            let x = 1 + winGood * g.goodF + ranked * rf + talent * g.tal + (g.road ? road : 0) + margin * g.m;
            x *= 1 - weakWin * g.badness;
            if (g.qbOut) x *= qb;
            v = Math.max(x + sched, 0.25);
          }
        } else {
          let p = 1 + (g.bad ? lossBad : 0) + margin * g.m;
          p *= 1 + lateLoss * g.when;
          if (rf > 0) p *= goodLoss;
          if (g.ownOut) p *= ownQb;
          if (g.home) p += homeLoss;
          v = Math.min(-p + sched, -0.5);
        }
        score[g.ti] += v;
      }
      for (let i = 0; i < n; i++) { score[i] = (score[i] * typical) / glen[i]; order[i] = i; }
      order.sort((x, y) => score[y] - score[x] || apKey[x] - apKey[y] || pct[y] - pct[x]);
      order.forEach((i, r) => { rankOf[i] = r + 1; });
      return order;
    },
  };
}

/** Hill-climb answers to maximize objective(F) (a number, higher is better) from DEFAULT and random starts. */
function search(F, objective, seed0) {
  let seed = seed0;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const evalA = (a) => { F.rank(a); return objective(F); };
  let best = { a: [...DEFAULT], v: evalA(DEFAULT) };
  for (let s = 0; s <= STARTS; s++) {
    let a = s === 0 ? [...DEFAULT] : QUESTIONS.map(() => Math.floor(rnd() * 5));
    let v = evalA(a), improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < a.length; i++) for (let o = 0; o < 5; o++) {
        if (o === a[i]) continue;
        const b = [...a]; b[i] = o; const vb = evalA(b);
        if (vb > v + 1e-9) { a = b; v = vb; improved = true; }
      }
    }
    if (v > best.v + 1e-9) best = { a, v };
  }
  return best.a;
}

export function buildAgendas(resume) {
  const T = resume.teams, F = makeFast(T);
  // the fast copy must rank exactly like the real model
  let seed = 17;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 300; k++) {
    const a = QUESTIONS.map(() => Math.floor(rnd() * 5));
    const real = rankTeams(T, a).map((r) => r.id).join(',');
    if (F.rank(a).map((i) => T[i].id).join(',') !== real) throw new Error('agenda scorer disagrees with resumeModel.js; update scripts/cfb-agendas.mjs');
  }
  const idx = (id) => T.findIndex((t) => t.id === id);
  // gap terms break ties toward answers that are closer to the next improvement
  const lift = (ti) => (F2) => {
    const r = F2.rankOf[ti];
    let above = Infinity;
    for (let i = 0; i < T.length; i++) if (F2.rankOf[i] === r - 1) above = F2.score[i];
    return -r * 1000 + (r === 1 ? 0 : Math.max(-999, F2.score[ti] - above));
  };
  const sink = (ti) => (F2) => {
    const r = F2.rankOf[ti];
    let below = -Infinity;
    for (let i = 0; i < T.length; i++) if (F2.rankOf[i] === r + 1) below = F2.score[i];
    return r * 1000 + (below === -Infinity ? 0 : Math.max(-999, below - F2.score[ti]));
  };
  const confScore = (members) => (F2) => {
    let top = 0, depth = 0;
    for (const i of members) { const r = F2.rankOf[i]; if (r <= PLAYOFF) top++; depth += Math.max(0, 26 - r); }
    return top * 1000 + depth;
  };

  const out = { generated_from: { games_through: resume.games_through }, team: {}, conf: {}, hate: {} };
  T.forEach((t, ti) => {
    const a = search(F, lift(ti), 1000 + ti);
    F.rank(a);
    out.team[t.id] = { s: answersToParam(a), rank: F.rankOf[ti] };
  });
  for (const [label, confs] of Object.entries(CONF_AGENDAS)) {
    const members = T.map((t, i) => (confs.includes(t.conf) ? i : -1)).filter((i) => i >= 0);
    if (!members.length) continue;
    const a = search(F, confScore(members), 7);
    F.rank(a);
    out.conf[label] = { s: answersToParam(a), top12: members.filter((i) => F.rankOf[i] <= PLAYOFF).length, teams: members.length };
  }
  const defaultOrder = F.rank(DEFAULT).slice(0, HATE_TOP);
  defaultOrder.forEach((ti) => {
    const a = search(F, sink(ti), 5000 + ti);
    F.rank(a);
    out.hate[T[ti].id] = { s: answersToParam(a), rank: F.rankOf[ti] };
  });
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = Date.now();
  const resume = JSON.parse(readFileSync(join(DATA, 'resume.json'), 'utf8'));
  const out = buildAgendas(resume);
  writeFileSync(join(DATA, 'resume_agendas.json'), JSON.stringify(out));
  console.log(`cfb-agendas: ${Object.keys(out.team).length} team, ${Object.keys(out.conf).length} conference and ${Object.keys(out.hate).length} hate agendas in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
