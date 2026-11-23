import { Link, useSearchParams } from 'react-router-dom';
import { pct, rec, signed } from './data';

const MAX = 4;

// One row of the comparison. better: 'low' or 'high' marks the best value in bold (null = no highlight).
const num = (x) => (x == null ? null : x);
const winPct = (w, l) => (w + l ? w / (w + l) : null);
const ROWS = [
  { sec: 'Resume' },
  { label: 'Your rank', v: (r) => r.rank, better: 'low' },
  { label: 'Score', v: (r) => r.score, show: (r) => r.score.toFixed(1), better: 'high' },
  { label: 'Record', v: (r) => winPct(r.w, r.l), show: (r) => rec(r.w, r.l), better: 'high' },
  { label: 'Conference', show: (r, t) => t?.conference ?? r.conf },
  { label: 'AP', v: (r) => num(r.ap), better: 'low' },
  { label: 'CFP', v: (r) => num(r.cfp), better: 'low' },
  { label: 'FPI', v: (r) => num(r.fpi), show: (r) => (r.fpi == null ? '' : `${r.fpi.toFixed(1)} (#${r.fpi_rank})`), better: 'high' },
  { label: 'SOR (ESPN)', v: (r) => num(r.sor), better: 'low' },
  { label: 'SOS (ESPN)', v: (r) => num(r.sos), better: 'low' },
  { label: '247 talent', v: (r) => num(r.tal), better: 'low' },
  { label: 'Best win', show: (r) => r.best ?? '' },
  { label: 'Worst loss', show: (r) => r.worst ?? '' },
  { sec: 'Records' },
  { label: 'Vs. currently ranked', rec: 'vs_cur_ranked' },
  { label: 'Vs. AP-ranked at least once', rec: 'vs_ap_ranked' },
  { label: 'Vs. never AP-ranked', rec: 'vs_ap_unranked' },
  { label: 'Vs. talent 1-25', rec: 'vs_talent_t1' },
  { label: 'Vs. talent 26-50', rec: 'vs_talent_t2' },
  { label: 'Vs. talent 51-75', rec: 'vs_talent_t3' },
  { label: 'Vs. talent 76+', rec: 'vs_talent_t4' },
  { label: 'Home', rec: 'home' },
  { label: 'Away', rec: 'away' },
  { label: 'Neutral', rec: 'neutral' },
  { sec: 'Game control' },
  { label: 'Lead%', v: (r, t) => t?.lead_pct, show: (r, t) => pct(t?.lead_pct), better: 'high' },
  { label: 'Trail%', v: (r, t) => t?.trail_pct, show: (r, t) => pct(t?.trail_pct), better: 'low' },
  { label: 'Avg lead', v: (r, t) => t?.avg_lead, show: (r, t) => signed(t?.avg_lead), better: 'high' },
  { label: 'Margin w/o garbage time', v: (r, t) => t?.ng_margin_pg, show: (r, t) => signed(t?.ng_margin_pg), better: 'high' },
  { label: 'Margin per game', v: (r, t) => t?.margin_pg, show: (r, t) => signed(t?.margin_pg), better: 'high' },
];

function cell(row, r, t) {
  if (row.rec) return rec(t?.[`${row.rec}_w`] ?? 0, t?.[`${row.rec}_l`] ?? 0);
  if (row.show) return row.show(r, t);
  const v = row.v(r, t);
  return v == null ? '' : v;
}

/** Side-by-side resumes for 2-4 teams, chosen with ?c=id,id. ranked = rows from rankTeams; teamsById = teams.json. */
export default function Compare({ ranked, teamsById, fpiAsOf }) {
  const [params, setParams] = useSearchParams();
  const byId = new Map(ranked.map((r) => [r.id, r]));
  const ids = (params.get('c') || '').split(',').map(Number).filter((id) => byId.has(id)).slice(0, MAX);
  const setIds = (next) => setParams((prev) => {
    const p = new URLSearchParams(prev);
    if (next.length) p.set('c', next.join(',')); else p.delete('c');
    return p;
  }, { replace: true });
  const add = (id) => id && !ids.includes(id) && ids.length < MAX && setIds([...ids, id]);
  const remove = (id) => setIds(ids.filter((x) => x !== id));
  const bubble = ranked.slice(11, 13).map((r) => r.id);
  const picked = ids.map((id) => byId.get(id));

  const bestOf = (row) => {
    if (!row.better || picked.length < 2) return new Set();
    const vals = picked.map((r) => ({ id: r.id, v: row.v(r, teamsById.get(r.id)) })).filter((x) => x.v != null);
    if (!vals.length) return new Set();
    const target = row.better === 'low' ? Math.min(...vals.map((x) => x.v)) : Math.max(...vals.map((x) => x.v));
    return new Set(vals.filter((x) => x.v === target).map((x) => x.id));
  };

  return (
    <div className="compare">
      <h3>Compare resumes</h3>
      <p className="links compare-pick">
        {picked.map((r) => (
          <span key={r.id} className="chip">
            {r.rank}. {r.team} <button type="button" className="linkbtn" onClick={() => remove(r.id)} aria-label={`Remove ${r.team}`}>×</button>
          </span>
        ))}
        {ids.length < MAX && (
          <select value="" onChange={(e) => add(Number(e.target.value))} aria-label="Add a team to compare">
            <option value="">+ add team</option>
            {ranked.filter((r) => !ids.includes(r.id)).map((r) => <option key={r.id} value={r.id}>{r.rank}. {r.team}</option>)}
          </select>
        )}
        {' '}
        <button type="button" className="linkbtn" onClick={() => setIds(bubble)}>Compare your #12 and #13</button>
        {ids.length > 0 && <>{' | '}<button type="button" className="linkbtn" onClick={() => setIds([])}>Clear</button></>}
      </p>

      {picked.length > 0 && (
        <>
          <div className="cfb-scroll">
            <table className="cfb-t compare-t">
              <thead>
                <tr>
                  <th className="l st" style={{ left: 0 }} />
                  {picked.map((r) => <th key={r.id}><Link to={`/cfb/team/${r.id}`}>{r.team}</Link></th>)}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, i) => (row.sec ? (
                  <tr key={`s${i}`} className="secrow"><td className="l st" style={{ left: 0 }} colSpan={picked.length + 1}>{row.sec}</td></tr>
                ) : (
                  <tr key={row.label}>
                    <td className="l st" style={{ left: 0 }}>{row.label}</td>
                    {(() => {
                      const best = bestOf(row);
                      return picked.map((r) => (
                        <td key={r.id} className={best.has(r.id) ? 'bestcell' : undefined}>{cell(row, r, teamsById.get(r.id))}</td>
                      ));
                    })()}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>

          <h3>Games, valued by your answers</h3>
          <div className="compare-games">
            {picked.map((r) => (
              <div key={r.id} className="cfb-scroll">
                <table className="cfb-t">
                  <thead>
                    <tr><th className="l">{r.team}</th><th>Result</th><th title="What the game adds to (or takes from) the score">Value</th></tr>
                  </thead>
                  <tbody>
                    {r.vals.map(({ g, v }, k) => {
                      const [oppId, opp, result, margin, site] = g;
                      const o = byId.get(oppId);
                      return (
                        <tr key={k}>
                          <td className="l">
                            {site === 'A' ? '@ ' : site === 'N' ? 'n ' : ''}
                            {o?.ap != null && <span className="orank">{o.ap}</span>}
                            {o ? <Link to={`/cfb/team/${oppId}`}>{opp}</Link> : <>{opp} <span className="muted">(FCS)</span></>}
                          </td>
                          <td className={result === 'W' ? 'win' : 'loss'}>{result} {result === 'W' ? '+' : ''}{margin}</td>
                          <td>{v > 0 ? '+' : ''}{v.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                    <tr className="totrow"><td className="l" colSpan={2}>Score (11-game scale)</td><td>{r.score.toFixed(1)}</td></tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="note">Bold = best among the teams shown. FPI, SOR and SOS: ESPN{fpiAsOf ? `, as of ${fpiAsOf}` : ''}.</p>
        </>
      )}
    </div>
  );
}

