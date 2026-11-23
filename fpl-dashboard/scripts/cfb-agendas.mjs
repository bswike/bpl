// Precompute Resume Builder agendas: for each single goal, the answers that serve it best.
//
//   node scripts/cfb-agendas.mjs      (also run by cfb-export.mjs)
//
// Reads public/data/cfb/resume.json and writes public/data/cfb/resume_agendas.json:
//   { team: {id: {s, rank}}, hate: {id: {s, rank}}, conf: {name: {s, top12, teams}}, hateConf: {name: {s, top12, teams}} }
// (s = ?s= answer string). The page applies these directly for one goal and uses them as starting points when goals
// are combined. Search code is shared with the page (src/components/cfb/resumeFast.js); this runs it harder (more
// starts and kicks). Results are near-optimal, not guaranteed best. It first checks the fast scorer against the real model.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = join(here, '..', 'public', 'data', 'cfb');
const src = (f) => pathToFileURL(join(here, '..', 'src', 'components', 'cfb', f)).href;
const { DEFAULT, QUESTIONS, rankTeams, answersToParam } = await import(src('resumeModel.js'));
const { makeFast, searchAgenda, CONF_GROUPS } = await import(src('resumeFast.js'));

const HATE_TOP = 40; // "hate" lists the teams ranked this high by default
const EFFORT = { starts: 60, kicks: 80 };
const SEEDS = [7];

function best(F, goals) {
  let top = null;
  for (const seed of SEEDS) {
    const r = searchAgenda(F, goals, { ...EFFORT, seed, seeds: top ? [top.answers] : [] });
    top = pick(top, r, goals);
  }
  return top;
}
// prefer the result that serves the goal better (same scoring order as the page's line)
function pick(a, b, goals) {
  if (!a) return b;
  const key = (x) => (goals.love != null ? -x.result.love : goals.hate != null ? x.result.hate
    : goals.loveConf ? x.result.loveConf.top12 : -x.result.hateConf.top12);
  return key(b) > key(a) ? b : a;
}

export function buildAgendas(resume) {
  const T = resume.teams;
  const F = makeFast(T);
  let s = 17;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let k = 0; k < 300; k++) {
    const a = QUESTIONS.map(() => Math.floor(rnd() * 5));
    if (F.rank(a).map((i) => T[i].id).join() !== rankTeams(T, a).map((r) => r.id).join()) {
      throw new Error('resumeFast.js disagrees with resumeModel.js; change them together');
    }
  }
  const out = { generated_from: { games_through: resume.games_through }, team: {}, hate: {}, conf: {}, hateConf: {} };
  for (const t of T) {
    const r = best(F, { love: t.id });
    out.team[t.id] = { s: answersToParam(r.answers), rank: r.result.love };
  }
  for (const i of F.rank(DEFAULT).slice(0, HATE_TOP)) {
    const r = best(F, { hate: T[i].id });
    out.hate[T[i].id] = { s: answersToParam(r.answers), rank: r.result.hate };
  }
  for (const [label, confs] of Object.entries(CONF_GROUPS)) {
    if (!T.some((t) => confs.includes(t.conf))) continue;
    const up = best(F, { loveConf: confs });
    out.conf[label] = { s: answersToParam(up.answers), ...up.result.loveConf };
    const down = best(F, { hateConf: confs });
    out.hateConf[label] = { s: answersToParam(down.answers), ...down.result.hateConf };
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const t0 = Date.now();
  const out = buildAgendas(JSON.parse(readFileSync(join(DATA, 'resume.json'), 'utf8')));
  writeFileSync(join(DATA, 'resume_agendas.json'), JSON.stringify(out));
  console.log(`cfb-agendas: ${Object.keys(out.team).length} team, ${Object.keys(out.hate).length} hate, ${Object.keys(out.conf).length}+${Object.keys(out.hateConf).length} conference agendas in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
