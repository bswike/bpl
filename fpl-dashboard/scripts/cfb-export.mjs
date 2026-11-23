// Copy the CFB site tables from ../cfb/data/json into public/data/cfb for the /cfb pages.
//
//   node scripts/cfb-export.mjs
//
// Run after `python ../cfb/pipeline/build.py`. games.json is split into one file per team
// so a team page only downloads its own game log.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'cfb', 'data', 'json');
const OUT = join(here, '..', 'public', 'data', 'cfb');

const read = (name) => JSON.parse(readFileSync(join(SRC, `${name}.json`), 'utf8'));
const write = (path, data) => writeFileSync(join(OUT, path), JSON.stringify(data));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'games'), { recursive: true });

// Logos are school trademarks hosted by ESPN; the site does not show them, so leave them out.
const teams = read('team_summary').map(({ logo, logo_dark, ...rest }) => rest);
write('teams.json', teams);

for (const name of ['meta', 'top50', 'home_away_splits', 'ap_polls', 'ap_receiving_votes', 'cfp_rankings']) {
  write(`${name}.json`, read(name));
}

const byTeam = new Map();
for (const g of read('games')) {
  if (!byTeam.has(g.team_id)) byTeam.set(g.team_id, []);
  byTeam.get(g.team_id).push(g);
}
for (const [id, games] of byTeam) {
  games.sort((a, b) => a.date.localeCompare(b.date));
  write(join('games', `${id}.json`), games);
}

console.log(`cfb-export: ${teams.length} teams, ${byTeam.size} game logs -> ${OUT}`);
