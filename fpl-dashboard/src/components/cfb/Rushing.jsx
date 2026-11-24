import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import SortTable from './SortTable';
import { filterTeams, fixed, pct, signed, useCfb } from './data';
import { colConf, colPlayer, colT50, colTeam } from './columns';
import { ConfFilter, Status, ViewLinks } from './ui';

// Rushing (cfb/pipeline/rushing.py). The play-by-play does not say what kind of run it was, and its left/middle/right
// mark follows the stat crew more than the offense, so the splits are how far runs get, short yardage, and who ran.

const VIEWS = [
  ['off', 'Offense', 'rushing_offense'],
  ['def', 'Defense', 'rushing_defense'],
  ['rb', 'Rushers', 'rushing_players'],
];
const THIN = 10; // a split with fewer runs than this is greyed (the count is in the cell's tooltip)

const basisOf = (r) => r.top50_basis;
const SHORT = '3rd or 4th down with 2 or fewer yards to go, or goal to go from the 2 or closer';

function statCols(view) {
  const def = view === 'def';
  // hi(true): the offense wants this number high. On the defense table the good direction flips, and with it the
  // first-click sort and the small ranks.
  const hi = (offenseWantsHigh) => (def ? !offenseWantsHigh : offenseWantsHigh);
  const thin = (n, text, what = 'runs') => <span className={n < THIN ? 'muted' : undefined} title={n < THIN ? `${n} ${what}: small sample` : `${n} ${what}`}>{text}</span>;
  const all = 'All runs';
  const cols = [
    { key: 'att', label: 'Att', group: all, desc: true, title: `Runs${def ? ' faced' : ''}. Sacks, kneel-downs and snaps charged to the team are not counted, so this is lower than the box score.`, value: (r) => r.att },
    { key: 'ypc', label: 'Y/C', group: all, desc: hi(true), title: 'Yards per carry', value: (r) => r.ypc, render: (r) => fixed(r.ypc) },
    { key: 'epa', label: 'EPA/C', group: all, desc: hi(true), rank: true, title: 'Expected points added per run', value: (r) => r.epa, render: (r) => signed(r.epa, 2) },
    { key: 'succ', label: 'Succ%', group: all, desc: hi(true), rank: true, title: 'Success rate: the run gained 50% of the yards to go on 1st down, 70% on 2nd, all of them on 3rd or 4th, or scored', value: (r) => r.succ_pct, render: (r) => pct(r.succ_pct) },
    { key: 'stuff', label: 'Stuff%', group: all, desc: hi(false), title: 'Share of runs stopped for no gain or a loss', value: (r) => r.stuff_pct, render: (r) => pct(r.stuff_pct) },
    { key: 'opp', label: '4+%', group: all, desc: hi(true), title: 'Share of runs that gained 4 or more yards', value: (r) => r.opp_pct, render: (r) => pct(r.opp_pct) },
    { key: 'expl', label: '10+%', group: all, desc: hi(true), title: 'Share of runs that gained 10 or more yards', value: (r) => r.expl_pct, render: (r) => pct(r.expl_pct) },
    { key: 'line', label: 'Line Y', group: all, desc: hi(true), title: 'Line yards per carry: the part of each run credited to the blocking. Losses count 120%, yards 0-4 in full, yards 5-10 at half, nothing past 10.', value: (r) => r.line_ypc, render: (r) => fixed(r.line_ypc, 2) },
    { key: 'hilite', label: 'Hilite Y', group: all, desc: hi(true), title: 'Highlight yards per run of 4 or more: what the runner added past the blocking (half of yards 5-10, everything past 10)', value: (r) => r.hilite_ypo, render: (r) => fixed(r.hilite_ypo, 2) },
    { key: 'shn', label: 'Att', group: 'Short yardage', desc: true, title: `Runs on ${SHORT}`, value: (r) => r.short_att },
    { key: 'shc', label: 'Conv%', group: 'Short yardage', desc: hi(true), rank: true, title: `Share converted on ${SHORT}`, value: (r) => r.short_conv_pct, render: (r) => thin(r.short_att, pct(r.short_conv_pct)) },
  ];
  if (view === 'rb') return cols;
  const nonQb = 'Non-QB runs';
  const qb = 'QB runs';
  return [
    ...cols,
    { key: 'bypc', label: 'Y/C', group: nonQb, desc: hi(true), title: 'Yards per carry by everyone except quarterbacks', value: (r) => r.back_ypc, render: (r) => thin(r.back_att, fixed(r.back_ypc)) },
    { key: 'bepa', label: 'EPA/C', group: nonQb, desc: hi(true), rank: true, title: 'Expected points added per run by everyone except quarterbacks', value: (r) => r.back_epa, render: (r) => thin(r.back_att, signed(r.back_epa, 2)) },
    { key: 'qsh', label: 'Share', group: qb, desc: true, title: 'Share of runs carried by quarterbacks. Scrambles and designed runs together; sacks are not runs.', value: (r) => r.qb_share, render: (r) => thin(r.qb_att, pct(r.qb_share)) },
    { key: 'qypc', label: 'Y/C', group: qb, desc: hi(true), title: 'Yards per carry on quarterback runs', value: (r) => r.qb_ypc, render: (r) => thin(r.qb_att, fixed(r.qb_ypc)) },
    { key: 'qepa', label: 'EPA/C', group: qb, desc: hi(true), rank: true, title: 'Expected points added per quarterback run', value: (r) => r.qb_epa, render: (r) => thin(r.qb_att, signed(r.qb_epa, 2)) },
  ];
}

export default function Rushing() {
  const [params] = useSearchParams();
  const view = VIEWS.some(([k]) => k === params.get('view')) ? params.get('view') : 'off';
  const table = VIEWS.find(([k]) => k === view)[2];
  const { data, error } = useCfb('teams', 'meta', table);

  const columns = useMemo(
    () => (view === 'rb'
      ? [colT50(basisOf), colPlayer, { ...colTeam, sticky: undefined }, ...statCols(view)]
      : [colT50(basisOf), colTeam, colConf(), ...statCols(view)]),
    [view],
  );
  // each rushing row carries its team's identity (rank, conference) so the shared columns and filters work
  const all = useMemo(() => {
    if (!data) return [];
    const teams = new Map(data.teams.map((t) => [t.team_id, t]));
    return data[table].map((r) => ({ ...teams.get(r.team_id), ...r }));
  }, [data, table]);

  if (!data) return <Status error={error} />;
  const minCarries = data.meta.rushing?.min_carries_per_team_game;
  return (
    <>
      <h2>Rushing</h2>
      <ViewLinks views={VIEWS} view={view} />
      <ConfFilter />
      <p className="note">
        Sacks and kneel-downs aren’t runs here. Line Y = the blocking’s yards per carry; Hilite Y = what the runner added per
        run of 4+. QB runs = scrambles and designed runs together.
        {view === 'def' && ' Rows show what opposing runners did.'}
        {view === 'rb' && minCarries && ` Min. ${minCarries} carries per team game.`}
      </p>
      <SortTable
        key={params.toString()}
        columns={columns}
        rows={filterTeams(all, params)}
        rankRows={all}
        rowKey={view === 'rb' ? (r) => r.athlete_id : undefined}
        defaultSort={{ key: 'epa', dir: view === 'def' ? 'asc' : 'desc' }}
      />
    </>
  );
}
