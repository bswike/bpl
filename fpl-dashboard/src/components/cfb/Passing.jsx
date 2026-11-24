import { Fragment, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import SortTable from './SortTable';
import { filterTeams, pct, signed, useCfb } from './data';
import { colConf, colT50, colTeam } from './columns';
import { ConfFilter, Status } from './ui';

// Passing by throw depth (cfb/pipeline/passing.py). The play-by-play says where each pass was caught or aimed, not what
// kind of play it was, so the buckets are depths: "behind line" holds screens, swing passes and checkdowns together.

const VIEWS = [
  ['off', 'Offense', 'passing_offense'],
  ['def', 'Defense', 'passing_defense'],
  ['qb', 'Quarterbacks', 'passing_players'],
];
const BUCKETS = [
  ['behind', 'Behind line', 'at or behind the line of scrimmage (screens, swing passes and checkdowns together)'],
  ['short', '1-9 yds', '1-9 yards past the line'],
  ['mid', '10-19 yds', '10-19 yards past the line'],
  ['deep', '20+ yds', '20 or more yards past the line'],
];
const THIN = 10; // a depth bucket with fewer throws than this is greyed (the count is in the cell's tooltip)

const fixed = (x, digits = 1) => (x == null ? '' : x.toFixed(digits));
const basisOf = (r) => r.top50_basis;

function statCols(view) {
  const def = view === 'def';
  const good = !def; // on the defense table lower is better, so those columns sort and rank low-to-high
  const all = 'All throws';
  const cols = [
    { key: 'att', label: 'Att', group: all, desc: true, title: `Pass attempts${def ? ' faced' : ''}, counted from play-by-play (can differ from the box score by a throw or two)`, value: (r) => r.att },
    { key: 'cmp', label: 'Cmp%', group: all, desc: good, title: 'Completion rate', value: (r) => r.cmp_pct, render: (r) => pct(r.cmp_pct) },
    { key: 'ypa', label: 'Y/A', group: all, desc: good, title: 'Passing yards per attempt', value: (r) => r.ypa, render: (r) => fixed(r.ypa) },
    { key: 'epa', label: 'EPA/A', group: all, desc: good, rank: true, title: 'Expected points added per pass attempt. Sacks and scrambles are not pass attempts and are not included.', value: (r) => r.epa, render: (r) => signed(r.epa, 2) },
    {
      key: 'coe', label: 'Cmp+/-', group: all, desc: good, rank: true,
      title: 'Completion % above or below what an average FBS passer completes on throws of the same depth',
      value: (r) => r.cmp_oe, render: (r) => (r.cmp_oe == null ? '' : signed(r.cmp_oe * 100)),
    },
    { key: 'adot', label: 'aDOT', group: all, desc: true, title: 'Average depth of target: air yards per attempt', value: (r) => r.adot, render: (r) => fixed(r.adot) },
    { key: 'air', label: 'Air%', group: all, desc: true, title: 'Share of passing yards gained in the air, before the catch. Low means the yards came after the catch.', value: (r) => r.air_share, render: (r) => pct(r.air_share) },
    { key: 'yac', label: 'YAC', group: all, desc: true, title: 'Yards after the catch per completion', value: (r) => r.yac, render: (r) => fixed(r.yac) },
  ];
  for (const [k, label, what] of BUCKETS) {
    const cell = (r, text) => {
      const n = r[`${k}_att`];
      return <span className={n < THIN ? 'muted' : undefined} title={n < THIN ? `${n} throws: small sample` : `${n} throws`}>{text}</span>;
    };
    cols.push(
      { key: `${k}s`, label: 'Share', group: label, desc: true, title: `Share of throws ${what}`, value: (r) => r[`${k}_share`], render: (r) => cell(r, pct(r[`${k}_share`])) },
      { key: `${k}c`, label: 'Cmp%', group: label, desc: good, title: `Completion rate on throws ${what}`, value: (r) => r[`${k}_cmp_pct`], render: (r) => cell(r, pct(r[`${k}_cmp_pct`])) },
      { key: `${k}e`, label: 'EPA/A', group: label, desc: good, rank: true, title: `Expected points added per attempt on throws ${what}`, value: (r) => r[`${k}_epa`], render: (r) => cell(r, signed(r[`${k}_epa`], 2)) },
    );
  }
  return cols;
}

const colPlayer = {
  key: 'player',
  label: 'Player',
  left: true,
  sticky: '2.6em',
  value: (r) => r.player,
  render: (r) => <Link className="pname" to={`/cfb/player/${r.athlete_id}`}>{r.player}</Link>,
};

/** "Offense | Defense | Quarterbacks", keeping the conference filter. */
function ViewLinks({ view }) {
  const [params] = useSearchParams();
  const href = (v) => {
    const p = new URLSearchParams(params);
    if (v === 'off') p.delete('view');
    else p.set('view', v);
    const q = p.toString();
    return q ? `/cfb/passing?${q}` : '/cfb/passing';
  };
  return (
    <p className="links">
      {VIEWS.map(([k, label], i) => (
        <Fragment key={k}>
          {i > 0 && ' | '}
          {k === view ? <b>{label}</b> : <Link to={href(k)}>{label}</Link>}
        </Fragment>
      ))}
    </p>
  );
}

export default function Passing() {
  const [params] = useSearchParams();
  const view = VIEWS.some(([k]) => k === params.get('view')) ? params.get('view') : 'off';
  const table = VIEWS.find(([k]) => k === view)[2];
  const { data, error } = useCfb('teams', 'meta', table);

  const columns = useMemo(
    () => (view === 'qb'
      ? [colT50(basisOf), colPlayer, { ...colTeam, sticky: undefined }, ...statCols(view)]
      : [colT50(basisOf), colTeam, colConf(), ...statCols(view)]),
    [view],
  );
  // each passing row carries its team's identity (rank, conference) so the shared columns and filters work
  const all = useMemo(() => {
    if (!data) return [];
    const teams = new Map(data.teams.map((t) => [t.team_id, t]));
    return data[table].map((r) => ({ ...teams.get(r.team_id), ...r }));
  }, [data, table]);

  if (!data) return <Status error={error} />;
  const minAtt = data.meta.passing?.min_attempts_per_team_game;
  return (
    <>
      <h2>Passing by Throw Depth</h2>
      <ViewLinks view={view} />
      <ConfFilter />
      <p className="note">
        Depth = air yards past the line of scrimmage. “Behind line” = screens, swing passes and checkdowns together.
        {view === 'def' && ' Rows show what opposing passers did.'}
        {view === 'qb' && minAtt && ` Min. ${minAtt} attempts per team game.`}
      </p>
      <SortTable
        key={params.toString()}
        columns={columns}
        rows={filterTeams(all, params)}
        rankRows={all}
        rowKey={view === 'qb' ? (r) => r.athlete_id : undefined}
        defaultSort={{ key: 'epa', dir: view === 'def' ? 'asc' : 'desc' }}
      />
    </>
  );
}
