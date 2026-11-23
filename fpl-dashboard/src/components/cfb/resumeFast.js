// Fast Resume Builder scoring and agenda search. Same math as resumeModel.js (gameValue/rankTeams), with each game's
// features worked out once so thousands of answer sets can be ranked quickly. The tests check that it ranks exactly
// like rankTeams; change both together.
import { DEFAULT, PLAYOFF, QUESTIONS, SCALE, marginBand } from './resumeModel.js';

export function makeFast(teams) {
  const K = Object.fromEntries(QUESTIONS.map((q, i) => [q.key, i]));
  const byId = new Map(teams.map((t, i) => [t.id, i]));
  const counts = teams.map((t) => t.games.length).sort((a, b) => a - b);
  const typical = counts[Math.floor(counts.length / 2)] || 1;
  const byRank = (r) => 0.5 + (26 - r) / 25;
  const G = [];
  teams.forEach((t, ti) => t.games.forEach((g, k) => {
    const [oppId, , result, margin, site, apThen, oppQbOut, ownQbOut] = g;
    const oi = byId.get(oppId);
    const opp = oi == null ? null : teams[oi];
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
  const n = teams.length;
  const glen = teams.map((t) => t.games.length || 1);
  const apKey = teams.map((t) => t.ap ?? 99);
  const pct = teams.map((t) => t.pct);
  const score = new Float64Array(n);
  const order = Array.from({ length: n }, (_, i) => i);
  const rankOf = new Int32Array(n);
  const vals = QUESTIONS.map((q) => q.vals);
  return {
    teams, score, rankOf,
    /** Rank under answers (indexes 0-4); fills score and rankOf (1-based) and returns team indexes in rank order. */
    rank(a) {
      const w = (key) => vals[K[key]][a[K[key]]];
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
      for (let r = 0; r < n; r++) rankOf[order[r]] = r + 1;
      return order;
    },
  };
}

/**
 * Answers that best serve every chosen goal at once.
 * goals: { love: team id, hate: team id, loveConf: [conference names], hateConf: [conference names] } (any subset).
 * Each goal scores 0-1 and they are added, so two goals count equally. Hill-climbs from the defaults and random starts.
 * seeds: extra starting answer sets. Returns { answers, result } where result has love/hate ranks and the conferences' top-12 counts.
 */
export function searchAgenda(F, goals, { starts = 50, kicks = 60, seed = 7, seeds = [] } = {}) {
  const { teams } = F;
  const n = teams.length;
  const idx = (id) => teams.findIndex((t) => t.id === id);
  const love = goals.love != null ? idx(goals.love) : -1;
  const hate = goals.hate != null ? idx(goals.hate) : -1;
  const members = (confs) => (confs?.length ? teams.map((t, i) => (confs.includes(t.conf) ? i : -1)).filter((i) => i >= 0) : []);
  const up = members(goals.loveConf), down = members(goals.hateConf);
  const cap = (m) => Math.min(PLAYOFF, m.length) || 1;
  // how close a team is to passing the one above it (0-1); guides the climb between rank changes
  const near = (gap) => 1 / (1 + Math.exp(-gap));
  const at = (rank) => { for (let i = 0; i < n; i++) if (F.rankOf[i] === rank) return i; return -1; };
  const objective = () => {
    let v = 0;
    if (love >= 0) {
      const r = F.rankOf[love];
      v += (n - r) / (n - 1) + (r > 1 ? (0.9 / (n - 1)) * near(F.score[love] - F.score[at(r - 1)]) : 0);
    }
    if (hate >= 0) {
      const r = F.rankOf[hate];
      v += (r - 1) / (n - 1) + (r < n ? (0.9 / (n - 1)) * near(F.score[at(r + 1)] - F.score[hate]) : 0);
    }
    if (up.length) {
      let top = 0, depth = 0;
      for (const i of up) { if (F.rankOf[i] <= PLAYOFF) top++; depth += Math.max(0, 26 - F.rankOf[i]); }
      // depth guides the climb toward the next team in, but is worth less than one more team in the top 12
      v += top / cap(up) + (0.9 / cap(up)) * (depth / (26 * up.length));
    }
    if (down.length) {
      let top = 0, depth = 0;
      for (const i of down) { if (F.rankOf[i] <= PLAYOFF) top++; depth += Math.min(F.rankOf[i], 60); }
      // depth guides the climb toward the next team out, but is worth less than one fewer team in the top 12
      v += 1 - top / cap(down) + (0.9 / cap(down)) * (depth / (60 * down.length));
    }
    return v;
  };
  const evalA = (a) => { F.rank(a); return objective(); };
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const climb = (start) => {
    let a = [...start];
    let v = evalA(a);
    let improved = true;
    while (improved) {
      improved = false;
      for (let i = 0; i < a.length; i++) {
        for (let o = 0; o < SCALE; o++) {
          if (o === a[i]) continue;
          const b = [...a];
          b[i] = o;
          const vb = evalA(b);
          if (vb > v + 1e-12) { a = b; v = vb; improved = true; }
        }
      }
    }
    return { a, v };
  };
  let best = climb(DEFAULT);
  // caller-supplied starting points (e.g. each goal's precomputed best answers when goals are combined)
  for (const start of seeds) {
    const r = climb(start);
    if (r.v > best.v + 1e-12) best = r;
  }
  // the extremes, random starting points, then "kicks": change 3-6 answers of the best so far at random and climb again
  for (const edge of [0, SCALE - 1]) {
    const r = climb(QUESTIONS.map(() => edge));
    if (r.v > best.v + 1e-12) best = r;
  }
  for (let k = 0; k < starts; k++) {
    const r = climb(QUESTIONS.map(() => Math.floor(rnd() * SCALE)));
    if (r.v > best.v + 1e-12) best = r;
  }
  for (let k = 0; k < kicks; k++) {
    const a = [...best.a];
    const changes = 3 + Math.floor(rnd() * 4);
    for (let j = 0; j < changes; j++) a[Math.floor(rnd() * a.length)] = Math.floor(rnd() * SCALE);
    const r = climb(a);
    if (r.v > best.v + 1e-12) best = r;
  }
  F.rank(best.a);
  const count = (m) => m.filter((i) => F.rankOf[i] <= PLAYOFF).length;
  return {
    answers: best.a,
    result: {
      love: love >= 0 ? F.rankOf[love] : null,
      hate: hate >= 0 ? F.rankOf[hate] : null,
      loveConf: up.length ? { top12: count(up), teams: up.length } : null,
      hateConf: down.length ? { top12: count(down), teams: down.length } : null,
    },
  };
}

export const CONF_GROUPS = {
  SEC: ['SEC'], 'Big Ten': ['Big Ten'], 'Big 12': ['Big 12'], ACC: ['ACC'], 'Pac-12': ['Pac-12'],
  American: ['American'], 'C-USA': ['C-USA'], MAC: ['MAC'], 'Mountain West': ['Mountain West'], 'Sun Belt': ['Sun Belt'],
  'Group of 5': ['American', 'C-USA', 'MAC', 'Mountain West', 'Sun Belt'],
};
