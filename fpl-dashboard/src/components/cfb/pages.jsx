import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SortTable from './SortTable';
import { filterTeams, num, signed, useCfb } from './data';
import {
  colAvgLead, colConf, colLead, colNg, colRankNum, colRecord, colT50, colTeam, colTied, colTrail, splitCols,
} from './columns';
import { ConfFilter, ProjectedNote, Status } from './ui';

const basisOf = (r) => r.top50_basis;
const projRow = (r) => (r.top50_basis === 'Projected' ? 'projrow' : undefined);

// Teams off the top 50 follow in model order, but show no rank.
const defaultOrder = (r) => r.top50_rank ?? 100 + r.model_rank;

// ---- Ratings (landing page) --------------------------------------------------

export function Ratings() {
  const { data, error } = useCfb('teams', 'meta');
  const [params] = useSearchParams();

  const columns = useMemo(() => {
    const meta = data?.meta;
    return [
      { ...colT50(basisOf), value: defaultOrder },
      colTeam,
      colConf(),
      colRecord('wl', 'W-L', 'wins', 'losses'),
      colRankNum('ap', 'AP', 'ap_rank', `AP rank, poll of ${meta?.ap_poll.released}`, { group: 'Rankings' }),
      colRankNum('cfp', 'CFP', 'cfp_rank', `CFP committee rank of ${meta?.cfp.released} (before later games)`, { group: 'Rankings' }),
      colRankNum('tal', 'Talent', 'talent_rank', '247Sports 2026 Team Talent Composite rank (preseason roster talent)', { group: 'Rankings' }),
      colRankNum('model', 'Model*', 'model_rank', "This site's model rank among 138 FBS teams. An estimate, not an official ranking.", { group: 'Rankings' }),
      ...splitCols,
      colRecord('home', 'Home', 'home_w', 'home_l', { group: 'Site' }),
      colRecord('away', 'Away', 'away_w', 'away_l', { group: 'Site' }),
      colRecord('neut', 'Neut', 'neutral_w', 'neutral_l', { group: 'Site' }),
      colLead,
      colAvgLead,
      colNg,
    ];
  }, [data]);

  if (!data) return <Status error={error} />;
  const rows = filterTeams(data.teams, params);
  return (
    <>
      <h2>2026 Team Ratings</h2>
      <ConfFilter />
      <ProjectedNote />
      <SortTable key={params.toString()} columns={columns} rows={rows} rankRows={data.teams} defaultSort={{ key: 't50', dir: 'asc' }} rowClass={projRow} />
      <p className="note">
        Click a column to sort. Small numbers are ranks among all 138 FBS teams. <b>Model*</b> is this site's own estimate
        (see <Link to="/cfb/about">About</Link>), not an official ranking. <b>Talent</b> is a preseason roster ranking.
      </p>
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
      <p className="note">
        Share of the 60 minutes of regulation spent leading, tied and trailing; scoring margin averaged over every second
        of regulation; and margin with garbage time removed (lead of 38+ in Q2, 28+ in Q3, 22+ in Q4). Overtime counts
        toward margins but not toward time shares.
      </p>
      <SortTable key={params.toString()} columns={columns} rows={filterTeams(data.teams, params)} rankRows={data.teams} defaultSort={{ key: 'lead', dir: 'desc' }} rowClass={projRow} />
    </>
  );
}

// ---- Home / away / neutral ---------------------------------------------------

const SITES = ['Home', 'Away', 'Neutral'];

export function Splits() {
  const { data, error } = useCfb('teams', 'home_away_splits');
  const [params] = useSearchParams();
  const site = SITES.includes(params.get('site')) ? params.get('site') : 'Home';
  const teamsById = useMemo(() => new Map((data?.teams || []).map((t) => [t.team_id, t])), [data]);
  if (!data) return <Status error={error} />;

  const siteRows = data.home_away_splits.filter((r) => r.site === site);
  const columns = [
    colT50((r) => teamsById.get(r.team_id)?.top50_basis),
    colTeam,
    colConf(),
    { key: 'g', label: 'G', desc: true, value: (r) => r.games },
    colRecord('wl', 'W-L', 'wins', 'losses'),
    ...splitCols,
    colLead,
    colTrail,
    colAvgLead,
    { ...colNg, title: 'Margin per game with garbage time removed' },
  ];
  const siteHref = (s) => {
    const p = new URLSearchParams(params);
    p.set('site', s);
    return `/cfb/splits?${p}`;
  };
  return (
    <>
      <h2>Home / Away / Neutral</h2>
      <p className="links">
        {SITES.map((s, i) => (
          <span key={s}>
            {i > 0 && ' | '}
            {s === site ? <b>{s}</b> : <Link to={siteHref(s)}>{s}</Link>}
          </span>
        ))}
      </p>
      <ConfFilter />
      <p className="note">
        {site} games only. Neutral-site games are their own split, so a team's three rows add up to its season. Small
        numbers rank among all FBS teams with a {site.toLowerCase()} game.
      </p>
      <SortTable
        key={`${site}|${params}`}
        columns={columns}
        rows={filterTeams(siteRows, params, teamsById)}
        rankRows={siteRows}
        defaultSort={{ key: 'wl', dir: 'desc' }}
        rowClass={(r) => projRow(teamsById.get(r.team_id) || {})}
      />
    </>
  );
}

