import { Fragment, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { fmtDate, pct, rec, signed, useCfb } from './data';
import SortTable from './SortTable';
import { colT50, colTeam, teamStatCols } from './columns';
import { Status } from './ui';

const SPLIT_HEAD = ['', 'G', 'W-L', 'Vs. Currently\nRanked', 'Yes', 'No', '1-25', '26-50', '51+', 'Lead%', 'Tied%', 'Trail%', 'AvgLead', 'NG Marg'];
const AP_GROUP = 'Opp. AP-ranked at least\nonce this season';
const siteMark = { Home: 'vs', Away: '@', Neutral: 'n' };
const CURRENT = 2026;

const teamHref = (id, season) => (season && season !== CURRENT ? `/cfb/team/${id}?season=${season}` : `/cfb/team/${id}`);
const rk = (n) => (n == null ? '' : `#${n}`);
/** Spread from the team's side: negative = favored, PK = pick'em. */
const fmtSpread = (x) => (x == null ? '' : x === 0 ? 'PK' : `${x > 0 ? '+' : ''}${x}`);

// ---- shared tables -------------------------------------------------------------

function SplitRow({ label, r, games }) {
  return (
    <tr>
      <td className="l">{label}</td>
      <td>{games}</td>
      <td>{rec(r.wins, r.losses)}</td>
      <td>{rec(r.vs_cur_ranked_w, r.vs_cur_ranked_l)}</td>
      <td>{rec(r.vs_ap_ranked_w, r.vs_ap_ranked_l)}</td>
      <td>{rec(r.vs_ap_unranked_w, r.vs_ap_unranked_l)}</td>
      <td>{rec(r.vs_talent_t1_w, r.vs_talent_t1_l)}</td>
      <td>{rec(r.vs_talent_t2_w, r.vs_talent_t2_l)}</td>
      <td>{rec(r.vs_talent_t3_w, r.vs_talent_t3_l)}</td>
      <td>{pct(r.lead_pct)}</td>
      <td>{pct(r.tied_pct)}</td>
      <td>{pct(r.trail_pct)}</td>
      <td>{signed(r.avg_lead)}</td>
      <td>{signed(r.ng_margin_pg)}</td>
    </tr>
  );
}

function SplitsTable({ all, sites }) {
  return (
    <div className="cfb-scroll">
      <table className="cfb-t">
        <thead>
          <tr className="grp">
            <th className="blank" colSpan={4} />
            <th className="g" colSpan={2}><div>{AP_GROUP}</div></th>
            <th className="g" colSpan={3}><div>vs. opp. 247 talent rank</div></th>
            <th className="g" colSpan={5}><div>Game control</div></th>
          </tr>
          <tr>{SPLIT_HEAD.map((h, i) => <th key={i} className={i === 0 ? 'l' : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          <SplitRow label="All" r={all} games={all.wins + all.losses} />
          {sites.map((r) => <SplitRow key={r.site} label={r.site} r={r} games={r.games} />)}
        </tbody>
      </table>
    </div>
  );
}

function GameLog({ games, season, upcoming = [] }) {
  const past = season !== CURRENT;
  return (
    <>
      <div className="cfb-scroll">
        <table className="cfb-t">
          <thead>
            <tr>
              {['Date', 'Wk', '', 'Opponent', 'Opp Tal', 'Result', 'Led%', 'Tied%', 'Trail%', 'AvgLead', 'BigLead', 'BigDef', 'NG Marg', 'Game'].map((h, i) => (
                <th key={i} className={i === 3 || i === 13 ? 'l' : undefined}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {games.map((g) => (
              <tr key={g.game_id} className={g.season_type === 'Postseason' ? 'postrow' : undefined}>
                <td>{fmtDate(g.date)}</td>
                <td>{g.season_type === 'Postseason' ? 'P' : g.week}</td>
                <td title={g.venue}>{siteMark[g.site]}</td>
                <td className="l">
                  {g.opp_cur_rank != null && <span className="orank" title="Rank in the latest poll">{g.opp_cur_rank}</span>}
                  {g.opp_is_fbs ? <Link to={teamHref(g.opp_id, season)}>{g.opp}</Link> : <>{g.opp} <span className="muted">(FCS)</span></>}
                  {g.opp_ever_ap_ranked && <span className="dag" title="AP-ranked at least once this season">†</span>}
                </td>
                <td>{g.opp_talent_rank ?? ''}</td>
                <td className={g.result === 'W' ? 'win' : 'loss'}>
                  <Link to={`/cfb/game/${g.game_id}`} className="score" title="Box score">
                    {g.result} {g.points_for}-{g.points_against}{g.overtime ? ' OT' : ''}
                  </Link>
                </td>
                <td>{pct(g.led_pct)}</td>
                <td>{pct(g.tied_pct)}</td>
                <td>{pct(g.trailed_pct)}</td>
                <td>{signed(g.avg_lead)}</td>
                <td>{g.biggest_lead ?? ''}</td>
                <td>{g.biggest_deficit ?? ''}</td>
                <td>{g.ng_margin == null ? '' : signed(g.ng_margin, 0)}</td>
                <td className="l">{g.note || ''}</td>
              </tr>
            ))}
            {upcoming.map((g) => (
              <tr key={g.game_id} className="nextrow">
                <td>{fmtDate(g.date)}</td>
                <td>{g.season_type === 'Postseason' ? 'P' : g.week}</td>
                <td title={g.venue}>{siteMark[g.site]}</td>
                <td className="l">
                  {g.opp_cur_rank != null && <span className="orank" title="Rank in the latest poll">{g.opp_cur_rank}</span>}
                  {g.opp_id == null ? 'TBD' : g.opp_is_fbs ? <Link to={teamHref(g.opp_id)}>{g.opp}</Link> : <>{g.opp} <span className="muted">(FCS)</span></>}
                  {g.opp_ever_ap_ranked && <span className="dag" title="AP-ranked at least once this season">†</span>}
                </td>
                <td>{g.opp_talent_rank ?? ''}</td>
                <td className="proj" title={g.proj_margin == null ? 'Opponent not yet known' : `Projected margin ${signed(g.proj_margin)} (this site's model)`}>
                  {g.proj_spread == null ? '' : `Proj ${fmtSpread(g.proj_spread)}`}
                </td>
                <td colSpan={7} />
                <td className="l">{g.note || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        † AP-ranked at least once · small number = {past ? 'final AP' : 'current'} rank
        {upcoming.length > 0 && ' · Proj = model spread (− = favored)'}
      </p>
    </>
  );
}

// ---- remaining schedule: each upcoming game with the opponent's full stat line ----

function RemainingSchedule({ upcoming, teamsById, meta }) {
  const known = upcoming.filter((g) => g.opp_is_fbs && teamsById.has(g.opp_id));
  const other = upcoming.filter((g) => !(g.opp_is_fbs && teamsById.has(g.opp_id)));
  const rows = known.map((g) => ({ ...teamsById.get(g.opp_id), _g: g }));
  const columns = [
    colT50((r) => r.top50_basis),
    { ...colTeam, label: 'Opponent' },
    { key: 'date', label: 'Date', value: (r) => r._g.kickoff_utc, render: (r) => fmtDate(r._g.date) },
    { key: 'site', label: '', value: (r) => r._g.site, render: (r) => <span title={r._g.venue}>{siteMark[r._g.site]}</span> },
    {
      key: 'proj',
      label: 'Proj',
      title: "Projected spread from this site's model for the team whose page this is (negative = favored). Not a betting line.",
      value: (r) => r._g.proj_spread,
      render: (r) => <span className="proj">{fmtSpread(r._g.proj_spread)}</span>,
    },
    ...teamStatCols(meta),
  ];
  return (
    <>
      {rows.length > 0 && (
        <SortTable
          columns={columns}
          rows={rows}
          rankRows={[...teamsById.values()]}
          rowKey={(r) => r._g.game_id}
          rankKey={(r) => r.team_id}
          defaultSort={{ key: 'date', dir: 'asc' }}
        />
      )}
      {other.map((g) => (
        <p key={g.game_id} className="note">
          {fmtDate(g.date)} · {g.note || 'Game'} · {g.opp_id == null ? 'opponent TBD' : `${g.opp} (FCS), Proj ${fmtSpread(g.proj_spread)}`}
          {g.site === 'Neutral' ? ' · neutral site' : ''}
        </p>
      ))}
      <p className="note">Proj = this site’s model spread (− = favored), not a betting line.</p>
    </>
  );
}

// ---- season-by-season table ----------------------------------------------------

function HistoryTable({ rows, id, season }) {
  const head = ['Season', 'Conf', 'W-L', 'Post', 'AP Pre', 'AP Final', 'CFP', 'Talent', 'Vs. Currently\nRanked', 'Yes', 'No', '1-25', '26-50', '51+', 'Home', 'Away', 'Neut', 'Lead%', 'AvgLead', 'NG Marg'];
  return (
    <div className="cfb-scroll">
      <table className="cfb-t">
        <thead>
          <tr className="grp">
            <th className="blank" colSpan={4} />
            <th className="g" colSpan={4}><div>Rankings</div></th>
            <th className="blank" />
            <th className="g" colSpan={2}><div>{AP_GROUP}</div></th>
            <th className="g" colSpan={3}><div>vs. opp. 247 talent rank</div></th>
            <th className="g" colSpan={3}><div>Site</div></th>
            <th className="g" colSpan={3}><div>Game control</div></th>
          </tr>
          <tr>{head.map((h, i) => <th key={h} className={i < 2 ? 'l' : undefined}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.season} className={r.season === season ? 'onrow' : undefined}>
              <td className="l">
                {r.season === season ? <b>{r.season}{r.current ? '*' : ''}</b> : <Link to={teamHref(id, r.season)}>{r.season}{r.current ? '*' : ''}</Link>}
              </td>
              <td className="l">{r.conference}</td>
              <td>{rec(r.wins, r.losses)}</td>
              <td>{r.current ? '' : rec(r.post_w, r.post_l)}</td>
              <td>{r.ap_pre_rank ?? ''}</td>
              <td>{r.ap_final_rank ?? ''}</td>
              <td>{r.cfp_final_rank ?? ''}</td>
              <td>{r.talent_rank ?? '–'}</td>
              <td>{rec(r.vs_cur_ranked_w, r.vs_cur_ranked_l)}</td>
              <td>{rec(r.vs_ap_ranked_w, r.vs_ap_ranked_l)}</td>
              <td>{rec(r.vs_ap_unranked_w, r.vs_ap_unranked_l)}</td>
              <td>{rec(r.vs_talent_t1_w, r.vs_talent_t1_l)}</td>
              <td>{rec(r.vs_talent_t2_w, r.vs_talent_t2_l)}</td>
              <td>{rec(r.vs_talent_t3_w, r.vs_talent_t3_l)}</td>
              <td>{rec(r.home_w, r.home_l)}</td>
              <td>{rec(r.away_w, r.away_l)}</td>
              <td>{rec(r.neutral_w, r.neutral_l)}</td>
              <td>{pct(r.lead_pct)}{r.lead_pct_rank != null && <span className="rk">{r.lead_pct_rank}</span>}</td>
              <td>{signed(r.avg_lead)}</td>
              <td>{signed(r.ng_margin_pg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- page ----------------------------------------------------------------------

export default function Team() {
  const { id } = useParams();
  const teamId = Number(id);
  const [params] = useSearchParams();
  const base = useCfb('teams', 'meta', 'ap_polls', 'cfp_rankings', 'home_away_splits', 'upcoming');
  const log = useCfb(`games/${teamId}`);
  const hist = useCfb(`history/${teamId}`, 'history/meta');
  const t = base.data?.teams.find((x) => x.team_id === teamId);

  const h = hist.data?.[`history/${teamId}`];
  const hmeta = hist.data?.['history/meta'];
  const pastSeasons = h ? h.seasons.map((s) => s.season) : [];
  const want = Number(params.get('season'));
  const season = pastSeasons.includes(want) ? want : CURRENT;

  useEffect(() => {
    if (t) document.title = `${t.team}${season !== CURRENT ? ` ${season}` : ''} · CFB`;
  }, [t, season]);

  if (!base.data) return <Status error={base.error} />;
  if (!t) return <p>No FBS team with id {id}. <Link to="/cfb">Back to ratings</Link></p>;

  const { meta, ap_polls, cfp_rankings, home_away_splits } = base.data;
  const ap = ap_polls.filter((p) => p.team_id === teamId).sort((a, b) => a.poll_week - b.poll_week);
  const cfp = cfp_rankings.filter((p) => p.team_id === teamId).sort((a, b) => a.cfp_week - b.cfp_week);
  const histLoading = !hist.data && !hist.error;

  // The current season as a history row, so it sits on top of the past ones.
  const currentRow = {
    ...t,
    season: CURRENT,
    current: true,
    ap_pre_rank: ap.find((p) => p.poll_week === 1)?.rank ?? null,
    ap_final_rank: t.ap_rank,
    cfp_final_rank: t.cfp_rank,
  };
  const historyRows = [currentRow, ...(h ? [...h.seasons].reverse() : [])];

  const seasonLinks = (
    <p className="links">
      Season:{' '}
      {[CURRENT, ...[...pastSeasons].reverse()].map((y, i) => (
        <Fragment key={y}>
          {i > 0 && ' | '}
          {y === season ? <b>{y}</b> : <Link to={teamHref(teamId, y)}>{y}</Link>}
        </Fragment>
      ))}
      {histLoading && <span className="muted"> (loading past seasons…)</span>}
    </p>
  );

  const historySection = (
    <>
      <h3>Season by season</h3>
      {h ? (
        <>
          <HistoryTable rows={historyRows} id={teamId} season={season} />
          <p className="note">*through {fmtDate(meta.games_through)}</p>
        </>
      ) : hist.error ? (
        <p className="muted">No FBS seasons before {CURRENT} in this data (2020 onward).</p>
      ) : (
        <Status />
      )}
    </>
  );

  // ---------------------------------------------------------------- past season view
  if (season !== CURRENT) {
    const s = h.seasons.find((x) => x.season === season);
    const sm = hmeta.seasons[String(season)];
    const games = h.games.filter((g) => g.season === season);
    const sites = ['Home', 'Away', 'Neutral'].filter((k) => s.sites[k]).map((k) => ({ site: k, ...s.sites[k] }));
    return (
      <>
        <h2>
          {t.display_name} · {season} <span className="muted">({s.conference})</span>
        </h2>
        {seasonLinks}
        <table className="kv">
          <tbody>
            <tr><th>Record</th><td>{rec(s.wins, s.losses)} {s.post_w + s.post_l ? <span className="muted">post {rec(s.post_w, s.post_l)}</span> : null}</td></tr>
            <tr><th>AP</th><td>
              Preseason {s.ap_pre_rank ? `#${s.ap_pre_rank}` : 'unranked'} · Final {s.ap_final_rank ? `#${s.ap_final_rank}` : 'unranked'}
              {s.ap_best_rank ? ` · Best #${s.ap_best_rank}` : ''}
            </td></tr>
            <tr><th>CFP</th><td>{s.cfp_final_rank ? `#${s.cfp_final_rank}` : 'Unranked'}</td></tr>
            <tr><th>247 talent</th><td>{s.talent_rank ? `#${s.talent_rank} of ${sm.fbs_teams}` : 'Not listed'}</td></tr>
          </tbody>
        </table>

        <h3>Splits</h3>
        <SplitsTable all={s} sites={sites} />
        <p className="note">
          Wins never trailing: {s.games_never_trailed} · Wins after trailing by 10+: {s.comeback_wins_10} · Losses after
          leading by 10+: {s.blown_leads_10}
        </p>

        {historySection}

        <h3>Games</h3>
        <GameLog games={games} season={season} />
      </>
    );
  }

  // ---------------------------------------------------------------- current season view
  const sites = home_away_splits.filter((r) => r.team_id === teamId);
  const teamsById = new Map(base.data.teams.map((x) => [x.team_id, x]));
  const curRankOf = (o) => (o ? (meta.latest_poll.poll === 'CFP' ? o.cfp_rank : o.ap_rank) : null);
  const upcoming = base.data.upcoming
    .filter((g) => g.team_id === teamId)
    .map((g) => {
      const o = teamsById.get(g.opp_id);
      return { ...g, opp_cur_rank: curRankOf(o), opp_talent_rank: o?.talent_rank ?? null, opp_ever_ap_ranked: !!o?.ever_ap_ranked };
    });
  const basisLabel = t.top50_basis === 'Projected' ? 'projected (site model)' : t.top50_basis;

  return (
    <>
      <h2>
        {t.display_name} <span className="muted">({t.conference})</span>
      </h2>
      {seasonLinks}
      <table className="kv">
        <tbody>
          <tr><th>Record</th><td>{rec(t.wins, t.losses)}</td></tr>
          <tr><th>AP</th><td>{t.ap_rank ? `#${t.ap_rank}` : t.ap_status || 'Unranked'}{t.ap_points ? ` (${t.ap_points} pts)` : ''} <span className="muted">{fmtDate(meta.ap_poll.released)}</span></td></tr>
          <tr><th>CFP</th><td>{t.cfp_rank ? `#${t.cfp_rank}` : 'Unranked'} <span className="muted">{fmtDate(meta.cfp.released)}</span></td></tr>
          <tr><th>Rank</th><td>{t.top50_rank ? <>#{t.top50_rank} <span className={t.top50_basis === 'Projected' ? 'proj' : 'muted'}>{basisLabel}</span></> : 'Not on the list'}</td></tr>
          <tr><th>247 talent</th><td>{rk(t.talent_rank)} of 138 <span className="muted">preseason</span></td></tr>
          <tr><th>Model*</th><td>{rk(t.model_rank)} of 138 <span className="muted">site estimate</span></td></tr>
          <tr><th>AP history</th><td>{ap.length ? ap.map((p) => `${p.poll_week === 1 ? 'Pre' : `W${p.poll_week}`} ${p.rank}`).join(' · ') : 'Not ranked in any 2026 AP poll'}</td></tr>
          <tr><th>CFP history</th><td>{cfp.length ? cfp.map((p) => `W${p.cfp_week} ${p.rank}`).join(' · ') : 'Not ranked by the committee'}</td></tr>
        </tbody>
      </table>

      <h3>Splits</h3>
      <SplitsTable all={t} sites={sites} />
      <p className="note">
        Wins never trailing: {t.games_never_trailed} · Wins after trailing by 10+: {t.comeback_wins_10} · Losses after
        leading by 10+: {t.blown_leads_10}
        {t.biggest_deficit_overcome != null && ` · Biggest deficit overcome: ${t.biggest_deficit_overcome}`}
        {t.biggest_lead_lost != null && ` · Biggest lead lost: ${t.biggest_lead_lost}`}
      </p>

      <h3>Remaining schedule</h3>
      {upcoming.length ? <RemainingSchedule upcoming={upcoming} teamsById={teamsById} meta={meta} /> : <p className="muted">No games left on the schedule.</p>}

      {historySection}

      <h3>Games</h3>
      {!log.data ? <Status error={log.error} /> : <GameLog games={log.data[`games/${teamId}`]} season={CURRENT} upcoming={upcoming} />}
    </>
  );
}
