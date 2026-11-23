import { Fragment, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { PLAYER_CATS, PLAYER_SHARDS, fmtDate, teamHref, useCfb } from './data';
import { Status } from './ui';

export default function Player() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const aid = Number(id);
  const key = `players/${aid % PLAYER_SHARDS}`;
  const { data, error } = useCfb(key, 'players/meta');
  const p = data?.[key]?.[String(aid)];
  const cols = data?.['players/meta']?.cols;

  const seasons = p ? p.seasons.map((s) => s.season) : [];
  const want = Number(params.get('season'));
  const season = seasons.includes(want) ? want : seasons.at(-1);
  const s = p?.seasons.find((x) => x.season === season);

  useEffect(() => {
    if (p) document.title = `${p.name} ${season} · CFB`;
  }, [p, season]);

  if (error) return <Status error={error} />;
  if (!data) return <Status />;
  if (!p) return <p>No player with id {id}. <Link to="/cfb">Back to ratings</Link></p>;

  const games = Object.fromEntries(s.games.map((g) => [g[0], g]));

  return (
    <>
      <h2>
        {p.name} <span className="muted">· <Link to={teamHref(s.team_id, season)}>{s.team}</Link> · {season}</span>
      </h2>
      {seasons.length > 1 && (
        <p className="links">
          Season:{' '}
          {[...seasons].reverse().map((y, i) => (
            <Fragment key={y}>
              {i > 0 && ' | '}
              {y === season ? <b>{y}</b> : <Link to={`/cfb/player/${aid}?season=${y}`}>{y}</Link>}
            </Fragment>
          ))}
        </p>
      )}
      <p className="muted">{s.games.length} games</p>

      {PLAYER_CATS.filter(([k]) => s.cats[k]).map(([k, title]) => {
        const c = s.cats[k];
        return (
          <Fragment key={k}>
            <h3>{title}</h3>
            <div className="cfb-scroll">
              <table className="cfb-t">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Wk</th>
                    <th />
                    <th className="l">Opponent</th>
                    <th>Result</th>
                    {cols[k].map((h) => <th key={h}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {c.rows.map(([gid, ...vals]) => {
                    const [, date, wk, site, oppId, opp, oppFbs, res, score] = games[gid];
                    return (
                      <tr key={gid}>
                        <td>{fmtDate(date)}</td>
                        <td>{wk}</td>
                        <td>{site}</td>
                        <td className="l">{oppFbs ? <Link to={teamHref(oppId, season)}>{opp}</Link> : <>{opp} <span className="muted">(FCS)</span></>}</td>
                        <td className={res === 'W' ? 'win' : 'loss'}>
                          <Link to={`/cfb/game/${gid}`} className="score">{res} {score}</Link>
                        </td>
                        {vals.map((v, j) => <td key={j}>{v}</td>)}
                      </tr>
                    );
                  })}
                  <tr className="totrow">
                    <td className="l" colSpan={5}>Season ({c.rows.length} g)</td>
                    {c.total.map((v, j) => <td key={j}>{v}</td>)}
                  </tr>
                </tbody>
              </table>
            </div>
          </Fragment>
        );
      })}
    </>
  );
}
