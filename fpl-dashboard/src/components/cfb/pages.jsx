import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SortTable from './SortTable';
import { CONFS, CURRENT_SEASON, FIRST_SEASON, filterTeams, num, signed, useCfb } from './data';
import {
  colAvgLead, colConf, colLead, colNg, colRecord, colT50, colTeam, colTied, colTrail, pastSeasonCols, teamStatCols,
} from './columns';
import { ConfFilter, ProjectedNote, SeasonStrip, Status } from './ui';

const basisOf = (r) => r.top50_basis;
const projRow = (r) => (r.top50_basis === 'Projected' ? 'projrow' : undefined);

// Every team has a rank; model order breaks any gap.
const defaultOrder = (r) => r.top50_rank ?? 100 + r.model_rank;

// ---- Ratings (landing page) --------------------------------------------------

const SEASONS = Array.from({ length: CURRENT_SEASON - FIRST_SEASON + 1 }, (_, i) => CURRENT_SEASON - i);

/** "Season: 2026 | 2025 | ... | 2004"; switching season keeps the power-conference filter but drops a conference. */
function SeasonLinks({ season }) {
  const [params] = useSearchParams();
  const href = (y) => {
    const p = new URLSearchParams();
    if (params.get('set')) p.set('set', params.get('set'));
    if (y !== CURRENT_SEASON) p.set('season', y);
    const q = p.toString();
    return q ? `/cfb?${q}` : '/cfb';
  };
  return <SeasonStrip seasons={SEASONS} season={season} hrefFor={href} />;
}

export function Ratings() {
  const [params] = useSearchParams();
  const want = Number(params.get('season'));
  const season = SEASONS.includes(want) ? want : CURRENT_SEASON;
  return season === CURRENT_SEASON ? <CurrentRatings /> : <PastRatings key={season} season={season} />;
}

function CurrentRatings() {
  const { data, error } = useCfb('teams', 'meta');
  const [params] = useSearchParams();

  const columns = useMemo(
    () => [{ ...colT50(basisOf), value: defaultOrder }, colTeam, ...teamStatCols(data?.meta)],
    [data],
  );

  if (!data) return <Status error={error} />;
  const rows = filterTeams(data.teams, params);
  return (
    <>
      <SeasonLinks season={CURRENT_SEASON} />
      <ConfFilter />
      <ProjectedNote />
      <SortTable key={params.toString()} columns={columns} rows={rows} rankRows={data.teams} defaultSort={{ key: 't50', dir: 'asc' }} rowClass={projRow} />
    </>
  );
}

function PastRatings({ season }) {
  const key = `history/season_${season}`;
  const { data, error } = useCfb(key);
  const [params] = useSearchParams();
  const columns = useMemo(() => pastSeasonCols(season), [season]);
  if (!data) return <Status error={error} />;
  const all = data[key];
  const present = new Set(all.map((r) => r.conference));
  const confs = [...CONFS.filter((c) => present.has(c)), ...[...present].filter((c) => !CONFS.includes(c)).sort()];
  const rows = filterTeams(all, params);
  return (
    <>
      <SeasonLinks season={season} />
      <ConfFilter confs={confs} />
      <p className="note">Full season, bowls and playoff included. AP = final poll.</p>
      <SortTable key={params.toString()} columns={columns} rows={rows} rankRows={all} defaultSort={{ key: 'apf', dir: 'asc' }} />
    </>
  );
}

// ---- Game control ------------------------------------------------------------

export function Control() {
  const { data, error } = useCfb('teams');
  const [params] = useSearchParams();
  if (!data) return <Status error={error} />;
  const columns = [
    colT50(basisOf),
    colTeam,
    colConf(),
    colRecord('wl', 'W-L', 'wins', 'losses'),
    colLead,
    colTied,
    colTrail,
    colAvgLead,
    { key: 'mpg', label: 'Margin', group: 'Game control', desc: true, rank: true, title: 'Average final margin per game', value: (r) => r.margin_pg, render: (r) => signed(r.margin_pg) },
    colNg,
    { key: 'nt', label: 'NeverTr', group: 'Wins / losses', desc: true, title: 'Wins in which the team was never behind', value: (r) => r.games_never_trailed },
    { key: 'cb', label: 'Cmbk10', group: 'Wins / losses', desc: true, title: 'Wins after trailing by 10 or more', value: (r) => r.comeback_wins_10 },
    { key: 'bl', label: 'Blown10', group: 'Wins / losses', desc: true, title: 'Losses after leading by 10 or more', value: (r) => r.blown_leads_10 },
    { key: 'bdo', label: 'BigCmbk', group: 'Wins / losses', desc: true, title: 'Largest deficit overcome in a win', value: (r) => r.biggest_deficit_overcome ?? null, render: (r) => num(r.biggest_deficit_overcome) },
    { key: 'bll', label: 'BigLost', group: 'Wins / losses', desc: true, title: 'Largest lead lost in a loss', value: (r) => r.biggest_lead_lost ?? null, render: (r) => num(r.biggest_lead_lost) },
  ];
  return (
    <>
      <h2>Game Control</h2>
      <ConfFilter />
      <SortTable key={params.toString()} columns={columns} rows={filterTeams(data.teams, params)} rankRows={data.teams} defaultSort={{ key: 'lead', dir: 'desc' }} rowClass={projRow} />
    </>
  );
}
