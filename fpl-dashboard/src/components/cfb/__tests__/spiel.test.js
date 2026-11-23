import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DEFAULT, QUESTIONS, rankTeams } from '../resumeModel.js';
import { CONF_GROUPS } from '../resumeFast.js';
import { barSpiel } from '../spiel.js';

const teams = JSON.parse(readFileSync(new URL('../../../../public/data/cfb/resume.json', import.meta.url), 'utf8')).teams;
const none = { love: '', hate: '', loveConf: '', hateConf: '' };
const spiel = (goals, answers = DEFAULT) => barSpiel({ goals: { ...none, ...goals }, answers, ranked: rankTeams(teams, answers), teams, groups: CONF_GROUPS });

describe('bar spiel', () => {
  it('argues for and against the chosen teams in at most two sentences', () => {
    const iu = teams.find((t) => t.team === 'Indiana');
    const uga = teams.find((t) => t.team === 'Georgia');
    const text = spiel({ love: String(iu.id), hate: String(uga.id), hateConf: 'SEC' });
    expect(text).toContain('Indiana at #');
    expect(text).toContain('Georgia at #');
    expect(text.split(/[.?!]\s/).length).toBeLessThanOrEqual(2);
  });

  it('never knocks a conference with a strong record outside it', () => {
    for (const c of Object.keys(CONF_GROUPS)) {
      const text = spiel({ hateConf: c });
      const m = text.match(/went (\d+)-(\d+) outside the conference/);
      if (m) expect(Number(m[1]) / (Number(m[1]) + Number(m[2]))).toBeLessThan(0.6);
    }
  });

  it('leads with what the answers emphasize', () => {
    const utah = teams.find((t) => t.team === 'Utah');
    const marginHigh = QUESTIONS.map((q, i) => (q.key === 'margin' ? 4 : DEFAULT[i]));
    expect(spiel({ love: String(utah.id) }, marginHigh)).toMatch(/Utah at #\d+ is easy: a \d+-point average margin/);
  });
});
