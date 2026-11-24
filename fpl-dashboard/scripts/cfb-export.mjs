// Copy the CFB site tables from ../cfb/data/json into public/data/cfb for the /cfb pages.
//
//   node scripts/cfb-export.mjs
//
// Run after `python ../cfb/pipeline/build.py` (and `history.py` for past seasons). games.json and
// the history tables are split into one file per team so a team page only downloads its own data.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'cfb', 'data', 'json');
const HIST = join(here, '..', '..', 'cfb', 'data', 'history');
const BOX = join(here, '..', '..', 'cfb', 'data', 'box');
const PLAYERS = join(here, '..', '..', 'cfb', 'data', 'players');
const OUT = join(here, '..', 'public', 'data', 'cfb');

const read = (name) => JSON.parse(readFileSync(join(SRC, `${name}.json`), 'utf8'));
const write = (path, data) => writeFileSync(join(OUT, path), JSON.stringify(data));

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'games'), { recursive: true });
mkdirSync(join(OUT, 'history'), { recursive: true });

// Logos are school trademarks hosted by ESPN; the site does not show them, so leave them out.
const teams = read('team_summary').map(({ logo, logo_dark, ...rest }) => rest);
write('teams.json', teams);

for (const name of ['meta', 'top50', 'home_away_splits', 'ap_polls', 'ap_receiving_votes', 'cfp_rankings', 'upcoming', 'resume',
  'passing_offense', 'passing_defense', 'passing_players']) {
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

// ---- past seasons: history/<team_id>.json = { seasons: [...], games: [...] }, oldest season first
const readHist = (name) => JSON.parse(readFileSync(join(HIST, name), 'utf8'));
const hist = new Map();
const slot = (id) => {
  if (!hist.has(id)) hist.set(id, { seasons: [], games: [] });
  return hist.get(id);
};
for (const r of readHist('team_seasons.json')) slot(r.team_id).seasons.push(r);
for (const { team, team_id, ...g } of readHist('games.json')) slot(team_id).games.push(g);
for (const [id, h] of hist) {
  h.seasons.sort((a, b) => a.season - b.season);
  h.games.sort((a, b) => a.season - b.season || a.date.localeCompare(b.date));
  write(join('history', `${id}.json`), h);
}
write(join('history', 'meta.json'), readHist('meta.json'));
// one file per past season with every FBS team's row (no per-site detail), for the Ratings page season picker
const bySeason = new Map();
for (const { sites, ...r } of readHist('team_seasons.json')) {
  if (!bySeason.has(r.season)) bySeason.set(r.season, []);
  bySeason.get(r.season).push(r);
}
for (const [season, rows] of bySeason) write(join('history', `season_${season}.json`), rows);

// ---- box scores: one file per game, built by cfb/pipeline/boxscores.py
let boxes = 0;
if (existsSync(BOX)) {
  cpSync(BOX, join(OUT, 'box'), { recursive: true });
  boxes = readdirSync(BOX).filter((f) => f.endsWith('.json')).length;
}
// ---- player season totals and game logs, sharded by athlete id (also from boxscores.py)
if (existsSync(PLAYERS)) cpSync(PLAYERS, join(OUT, 'players'), { recursive: true });

// ---- Resume Builder agendas (answers that best serve one goal); ~1 minute of searching
const { buildAgendas } = await import('./cfb-agendas.mjs');
const agendas = buildAgendas(read('resume'));
write('resume_agendas.json', agendas);

console.log(`cfb-export: ${teams.length} teams, ${byTeam.size} game logs, ${hist.size} team histories, ${boxes} box score files -> ${OUT}`);
