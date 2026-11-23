import { describe, it, expect } from 'vitest';
import { DEFAULT, QUESTIONS, SCALE, answersToParam, gameValue, marginBand, migrateOldAnswers, parseAnswers, rankTeams, weightsFor } from '../resumeModel.js';

// game: [opp_id, opp, result, margin, site, opp_ap_then, opp_qb_out, own_qb_out]
const team = (id, pct, ap, tal, games) => ({ id, team: `T${id}`, w: 0, l: 0, pct, ap, cfp: null, tal, games });
const teams = [
  team(1, 1.0, 1, 1, [[2, 'T2', 'W', 30, 'H', 20, 0, 0], [3, 'T3', 'W', 7, 'A', null, 0, 0]]),
  team(2, 0.5, 20, 30, [[1, 'T1', 'L', -30, 'A', 1, 0, 0], [3, 'T3', 'W', 3, 'H', null, 1, 0]]),
  team(3, 0.0, null, 120, [[1, 'T1', 'L', -7, 'H', 1, 0, 1], [2, 'T2', 'L', -3, 'A', 20, 0, 0], [999, 'FCS', 'L', -10, 'H', null, 0, 0]]),
];
const oppById = new Map(teams.map((t) => [t.id, t]));
/** Every combination of each question's two extremes (2^12), then random answer sets in between. */
function* answerSets(random = 20000) {
  const n = QUESTIONS.length;
  for (let mask = 0; mask < 2 ** n; mask++) yield QUESTIONS.map((_, i) => ((mask >> i) & 1 ? SCALE - 1 : 0));
  let seed = 11;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < random; k++) yield QUESTIONS.map(() => Math.floor(rnd() * SCALE));
}

describe('resume model', () => {
  it('values every win above every loss, at every extreme and across random answers', () => {
    for (const a of answerSets()) {
      const w = weightsFor(a);
      const vals = teams.flatMap((t) => t.games.map((g) => ({ r: g[2], v: gameValue(g, w, oppById) })));
      const minWin = Math.min(...vals.filter((x) => x.r === 'W').map((x) => x.v));
      const maxLoss = Math.max(...vals.filter((x) => x.r === 'L').map((x) => x.v));
      if (!(minWin > maxLoss)) expect(`${a.join('')}: win ${minWin} vs loss ${maxLoss}`).toBe('every win above every loss');
    }
  });

  it('gives schedule credit by opponent strength (SRS), not record', () => {
    const w = weightsFor(QUESTIONS.map((_, i) => (QUESTIONS[i].key === 'sos' ? SCALE - 1 : DEFAULT[i])));
    const vs = (srs) => gameValue([9, 'X', 'W', 7, 'H', null, 0, 0], w, new Map([[9, { pct: 0.7, ap: null, tal: 90, srs }]]));
    expect(vs(10)).toBeGreaterThan(vs(-10)); // same .700 record, stronger opponent counts more
  });

  it('discounts wins over bad teams and charges extra for home losses', () => {
    const w = weightsFor(DEFAULT);
    const opp = (pct) => new Map([[9, { pct, ap: null, tal: 90, srs: 0 }]]);
    expect(gameValue([9, 'X', 'W', 7, 'H', null, 0, 0], w, opp(0))).toBeLessThan(gameValue([9, 'X', 'W', 7, 'H', null, 0, 0], w, opp(0.5)));
    expect(gameValue([9, 'X', 'L', -7, 'H', null, 0, 0], w, opp(0.6))).toBeLessThan(gameValue([9, 'X', 'L', -7, 'A', null, 0, 0], w, opp(0.6)));
  });

  it('scores margin in football bands and charges more for late losses', () => {
    expect([1, 3, 4, 8, 9, 16, 17, 40].map(marginBand)).toEqual([-0.5, -0.5, 0, 0, 0.5, 0.5, 1, 1]);
    const w = weightsFor(QUESTIONS.map((q, i) => (q.key === 'margin' ? SCALE - 1 : DEFAULT[i])));
    const opp = new Map([[9, { pct: 0.6, ap: null, tal: 90, srs: 0 }]]);
    const loss = (margin, when = 0) => gameValue([9, 'X', 'L', margin, 'A', null, 0, 0], w, opp, when);
    expect(loss(-3)).toBeGreaterThan(loss(-8)); // a 3-point loss hurts less than an 8-point one
    expect(loss(-8)).toBeGreaterThan(loss(-24));
    expect(loss(-8, 1)).toBeLessThan(loss(-8, 0)); // the same loss late in the season hurts more
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
    expect(parseAnswers(answersToParam(DEFAULT))).toEqual(DEFAULT);
  });

  it('has the expected default weights and converts old three-option links', () => {
    const w = weightsFor(DEFAULT);
    expect(w).toMatchObject({ winGood: 0.5, ranked: 0.75, faded: 0.5, talent: 0.3, weakWin: 0.4, road: 0.25, fcs: 0.5, lossBad: 0.75, homeLoss: 0.5, lateLoss: 0.2, goodLoss: 0.7, sos: 0.25, qb: 0.8, ownQb: 0.6, margin: 0.4 });
    expect(migrateOldAnswers('111111111111')).toEqual(DEFAULT);
    // every old third option maps to 5, except the three questions whose old options ran biggest-effect-first
    // (faded: "not a ranked win", fcs: "don't count", goodLoss: "hurt much less"), which map to 1
    expect(answersToParam(migrateOldAnswers('222222222222'))).toBe('551535153315555');
    // and their old first options ("still a ranked win", "count fully", "hurt like any loss") map to 5
    expect(answersToParam(migrateOldAnswers('110110101111'))).toBe('335333533353333');
    // 12- and 14-question ?s= links keep their answers and get the default (3) for questions added since
    expect(answersToParam(parseAnswers('512345123451'))).toBe('512334513323451');
    expect(answersToParam(parseAnswers('11111111111111'))).toBe('111111111311111');
    expect(migrateOldAnswers('11')).toBeNull();
  });
});
