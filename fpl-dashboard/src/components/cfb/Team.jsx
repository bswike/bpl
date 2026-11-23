import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, pct, rec, signed, useCfb } from './data';
import { Status, TeamLink } from './ui';

const SPLIT_HEAD = ['', 'G', 'W-L', 'Yes', 'No', '1-25', '26-50', '51+', 'Lead%', 'Tied%', 'Trail%', 'AvgLead', 'NG Marg'];

function SplitRow({ label, r, games }) {
  return (
    <tr>
      <td className="l">{label}</td>
      <td>{games}</td>
      <td>{rec(r.wins, r.losses)}</td>
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

const siteMark = { Home: 'vs', Away: '@', Neutral: 'n' };

export default function Team() {
  const { id } = useParams();
  const teamId = Number(id);
  const base = useCfb('teams', 'meta', 'ap_polls', 'cfp_rankings', 'home_away_splits');
  const log = useCfb(`games/${teamId}`);
  const t = base.data?.teams.find((x) => x.team_id === teamId);

  useEffect(() => {
    if (t) document.title = `${t.team} · CFB 2026`;
  }, [t]);

  if (!base.data) return <Status error={base.error} />;
  if (!t) return <p>No FBS team with id {id}. <Link to="/cfb">Back to ratings</Link></p>;

  const { meta, ap_polls, cfp_rankings, home_away_splits } = base.data;
  const ap = ap_polls.filter((p) => p.team_id === teamId).sort((a, b) => a.poll_week - b.poll_week);
  const cfp = cfp_rankings.filter((p) => p.team_id === teamId).sort((a, b) => a.cfp_week - b.cfp_week);
  const sites = home_away_splits.filter((r) => r.team_id === teamId);
  const basisLabel = t.top50_basis === 'Projected' ? 'projected by this site’s model, not a published ranking' : t.top50_basis;

  return (
    <>
      <h2>
        {t.display_name} <span className="muted">({t.conference})</span>
      </h2>
      <table className="kv">
        <tbody>
          <tr><th>Record</th><td>{rec(t.wins, t.losses)} <span className="muted">games through {fmtDate(meta.games_through)}</span></td></tr>
          <tr><th>AP</th><td>{t.ap_rank ? `#${t.ap_rank}` : t.ap_status || 'Unranked'}{t.ap_points ? ` (${t.ap_points} pts)` : ''} <span className="muted">poll of {fmtDate(meta.ap_poll.released)}</span></td></tr>
          <tr><th>CFP</th><td>{t.cfp_rank ? `#${t.cfp_rank}` : 'Unranked'} <span className="muted">committee ranking of {fmtDate(meta.cfp.released)}, before later games</span></td></tr>
          <tr><th>Top 50</th><td>{t.top50_rank ? <>#{t.top50_rank} <span className={t.top50_basis === 'Projected' ? 'proj' : 'muted'}>{basisLabel}</span></> : 'Not on the list'}</td></tr>
          <tr><th>247 talent</th><td>#{t.talent_rank} of 138 <span className="muted">preseason roster composite, {fmtDate(meta.talent.last_updated)}</span></td></tr>
          <tr><th>Model*</th><td>#{t.model_rank} of 138 <span className="muted">this site’s estimate, not an official ranking (Colley {t.colley.toFixed(3)}, SRS {signed(t.srs)})</span></td></tr>
          <tr><th>AP history</th><td>{ap.length ? ap.map((p) => `${p.poll_week === 1 ? 'Pre' : `W${p.poll_week}`} ${p.rank}`).join(' · ') : 'Not ranked in any 2026 AP poll'}</td></tr>
          <tr><th>CFP history</th><td>{cfp.length ? cfp.map((p) => `W${p.cfp_week} ${p.rank}`).join(' · ') : 'Not ranked by the committee'}</td></tr>
        </tbody>
      </table>

      <h3>Splits</h3>
      <div className="cfb-scroll">
        <table className="cfb-t">
          <thead>
            <tr className="grp">
              <th className="blank" colSpan={3} />
              <th className="g" colSpan={2}><div>{'Opp. AP-ranked at least\nonce this season'}</div></th>
              <th className="g" colSpan={3}><div>vs. opp. 247 talent rank</div></th>
              <th className="g" colSpan={5}><div>Game control</div></th>
            </tr>
            <tr>{SPLIT_HEAD.map((h, i) => <th key={i} className={i === 0 ? 'l' : undefined}>{h}</th>)}</tr>
          </thead>
          <tbody>
            <SplitRow label="All" r={t} games={t.wins + t.losses} />
            {sites.map((r) => <SplitRow key={r.site} label={r.site} r={r} games={r.games} />)}
          </tbody>
        </table>
      </div>
      <p className="note">
        Wins never trailing: {t.games_never_trailed} · Wins after trailing by 10+: {t.comeback_wins_10} · Losses after
        leading by 10+: {t.blown_leads_10}
        {t.biggest_deficit_overcome != null && ` · Biggest deficit overcome: ${t.biggest_deficit_overcome}`}
        {t.biggest_lead_lost != null && ` · Biggest lead lost: ${t.biggest_lead_lost}`}
      </p>

      <h3>Games</h3>
      {!log.data ? (
        <Status error={log.error} />
      ) : (
        <>
          <div className="cfb-scroll">
            <table className="cfb-t">
              <thead>
                <tr>
                  {['Date', 'Wk', '', 'Opponent', 'Opp Tal', 'Result', 'Led%', 'Tied%', 'Trail%', 'AvgLead', 'BigLead', 'BigDef', 'NG Marg'].map((h, i) => (
                    <th key={i} className={i === 3 ? 'l' : undefined}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {log.data[`games/${teamId}`].map((g) => (
                  <tr key={g.game_id}>
                    <td>{fmtDate(g.date)}</td>
                    <td>{g.week}</td>
                    <td title={g.venue}>{siteMark[g.site]}</td>
                    <td className="l">
                      {g.opp_is_fbs ? <TeamLink id={g.opp_id}>{g.opp}</TeamLink> : <>{g.opp} <span className="muted">(FCS)</span></>}
                      {g.opp_ever_ap_ranked && <span className="dag" title="AP-ranked at least once this season">†</span>}
                    </td>
                    <td>{g.opp_talent_rank ?? ''}</td>
                    <td className={g.result === 'W' ? 'win' : 'loss'}>
                      {g.result} {g.points_for}-{g.points_against}{g.overtime ? ' OT' : ''}
                    </td>
                    <td>{pct(g.led_pct)}</td>
                    <td>{pct(g.tied_pct)}</td>
                    <td>{pct(g.trailed_pct)}</td>
                    <td>{signed(g.avg_lead)}</td>
                    <td>{g.biggest_lead}</td>
                    <td>{g.biggest_deficit}</td>
                    <td>{signed(g.ng_margin, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">
            † opponent was AP-ranked at least once this season (not necessarily on game day). vs home · @ away · n neutral.
            Opp Tal = opponent’s 247Sports talent rank. Time shares are regulation only.
          </p>
        </>
      )}
    </>
  );
}
