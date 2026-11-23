import { describe, it, expect } from 'vitest';
import { DEFAULT, QUESTIONS, gameValue, parseAnswers, rankTeams, weightsFor } from '../resumeModel.js';

// game: [opp_id, opp, result, margin, site, opp_ap_then, opp_qb_out, own_qb_out]
const team = (id, pct, ap, tal, games) => ({ id, team: `T${id}`, w: 0, l: 0, pct, ap, cfp: null, tal, games });
const teams = [
  team(1, 1.0, 1, 1, [[2, 'T2', 'W', 30, 'H', 20, 0, 0], [3, 'T3', 'W', 7, 'A', null, 0, 0]]),
  team(2, 0.5, 20, 30, [[1, 'T1', 'L', -30, 'A', 1, 0, 0], [3, 'T3', 'W', 3, 'H', null, 1, 0]]),
  team(3, 0.0, null, 120, [[1, 'T1', 'L', -7, 'H', 1, 0, 1], [2, 'T2', 'L', -3, 'A', 20, 0, 0], [999, 'FCS', 'L', -10, 'H', null, 0, 0]]),
];
const oppById = new Map(teams.map((t) => [t.id, t]));
/** Every combination of answers (3^12), one at a time. */
function* everyAnswerSet() {
  const sizes = QUESTIONS.map((q) => q.opts.length);
  const total = sizes.reduce((a, b) => a * b, 1);
  for (let n = 0; n < total; n++) {
    let k = n;
    yield sizes.map((size) => { const i = k % size; k = Math.floor(k / size); return i; });
  }
}

describe('resume model', () => {
  it('values every win above every loss, under every combination of answers', () => {
    for (const a of everyAnswerSet()) {
      const w = weightsFor(a);
      const vals = teams.flatMap((t) => t.games.map((g) => ({ r: g[2], v: gameValue(g, w, oppById) })));
      const minWin = Math.min(...vals.filter((x) => x.r === 'W').map((x) => x.v));
      const maxLoss = Math.max(...vals.filter((x) => x.r === 'L').map((x) => x.v));
      if (!(minWin > maxLoss)) expect(`${a.join('')}: win ${minWin} vs loss ${maxLoss}`).toBe('every win above every loss');
    }
  });

  it('counts a win over a higher-ranked team for more', () => {
    const w = weightsFor(DEFAULT);
    const beat = (rank) => gameValue([9, 'X', 'W', 7, 'H', rank, 0, 0], w, new Map([[9, { pct: 0.8, ap: rank, tal: 60 }]]));
    expect(beat(1)).toBeGreaterThan(beat(25));
  });

  it('ranks every team once and falls back to defaults on a bad answer string', () => {
    const r = rankTeams(teams, DEFAULT);
    expect(r.map((x) => x.rank)).toEqual([1, 2, 3]);
    expect(r[0].id).toBe(1);
    expect(parseAnswers('9')).toEqual(DEFAULT);
  });
});
