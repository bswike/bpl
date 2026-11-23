import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT, QUESTIONS, SCALE, rankTeams } from '../resumeModel.js';
import { makeFast, searchAgenda, CONF_GROUPS } from '../resumeFast.js';

// the real exported data, so every kind of game (FCS, ranked then/now, QB out, neutral) is covered
const teams = JSON.parse(readFileSync(new URL('../../../../public/data/cfb/resume.json', import.meta.url), 'utf8')).teams;

describe('fast resume scorer', () => {
  it('ranks exactly like rankTeams', () => {
    const F = makeFast(teams);
    let seed = 41;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let k = 0; k < 300; k++) {
      const a = QUESTIONS.map(() => Math.floor(rnd() * SCALE));
      expect(F.rank(a).map((i) => teams[i].id)).toEqual(rankTeams(teams, a).map((r) => r.id));
    }
  });

  it('agenda search never does worse than the default answers', () => {
    const F = makeFast(teams);
    const pos = (id, a) => rankTeams(teams, a).findIndex((r) => r.id === id) + 1;
    const team = teams.find((t) => t.team === 'Indiana');
    const rival = teams.find((t) => t.team === 'Georgia');
    const love = searchAgenda(F, { love: team.id }, { starts: 5, kicks: 5 });
    expect(love.result.love).toBeLessThanOrEqual(pos(team.id, DEFAULT));
    const hate = searchAgenda(F, { hate: rival.id }, { starts: 5, kicks: 5 });
    expect(hate.result.hate).toBeGreaterThanOrEqual(pos(rival.id, DEFAULT));
    const both = searchAgenda(F, { love: team.id, hateConf: CONF_GROUPS.SEC }, { starts: 5, kicks: 5 });
    expect(both.result.love).toBeGreaterThan(0);
    expect(both.result.hateConf.teams).toBe(teams.filter((t) => t.conf === 'SEC').length);
  });
});
