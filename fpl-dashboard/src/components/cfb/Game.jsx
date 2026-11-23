import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, useCfb } from './data';
import { Status } from './ui';

const CURRENT = 2026;
const CATS = [
  ['passing', 'Passing'],
  ['rushing', 'Rushing'],
  ['receiving', 'Receiving'],
  ['fumbles', 'Fumbles'],
  ['defensive', 'Defense'],
  ['interceptions', 'Interceptions'],
  ['kickReturns', 'Kick returns'],
  ['puntReturns', 'Punt returns'],
  ['kicking', 'Kicking'],
  ['punting', 'Punting'],
];

const teamHref = (id, season) => (season === CURRENT ? `/cfb/team/${id}` : `/cfb/team/${id}?season=${season}`);

function TeamName({ side, season }) {
  return side.fbs ? <Link to={teamHref(side.id, season)}>{side.name}</Link> : <>{side.name} <span className="muted">(FCS)</span></>;
}

function PlayerTable({ title, cols, rows }) {
  return (
    <div className="cfb-scroll">
      <table className="cfb-t box-p">
        <thead>
          <tr>
            <th className="l">{title}</th>
            {cols.map((c) => <th key={c}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((r, i) => (
              <tr key={i}>
                <td className="l">{r[0]}</td>
                {r.slice(1).map((v, j) => <td key={j}>{v}</td>)}
              </tr>
            ))
          ) : (
            <tr><td className="l muted" colSpan={cols.length + 1}>None</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function Game() {
  const { gameId } = useParams();
  const key = `box/${Number(gameId)}`;
  const { data, error } = useCfb(key);
  const b = data?.[key];

  useEffect(() => {
    if (b) document.title = `${b.away.name} ${b.away.score}, ${b.home.name} ${b.home.score} · CFB`;
  }, [b]);

  if (error) return <p>No box score for game {gameId}. <Link to="/cfb">Back to ratings</Link></p>;
  if (!b) return <Status />;

  const { away, home, season } = b;
  const periods = Math.max(away.lines.length, home.lines.length);
  const label = (i) => (i < 4 ? String(i + 1) : i === 4 ? 'OT' : `${i - 3}OT`);
  const winner = away.score > home.score ? 'away' : 'home';

  return (
    <>
      <h2 className="box-head">
        <span className={winner === 'away' ? 'win-name' : undefined}><TeamName side={away} season={season} /> {away.score}</span>
        {b.neutral ? ' vs ' : ' @ '}
        <span className={winner === 'home' ? 'win-name' : undefined}><TeamName side={home} season={season} /> {home.score}</span>
      </h2>
      <p className="muted">
        {fmtDate(b.date, true)} · {b.season_type === 'Postseason' ? `${season} postseason` : `${season} week ${b.week}`}
        {b.note ? ` · ${b.note}` : ''}
        {b.venue ? ` · ${b.venue}` : ''}
        {b.neutral ? ' · neutral site' : ''}
      </p>

      {periods > 0 && (
        <div className="cfb-scroll">
          <table className="cfb-t">
            <thead>
              <tr>
                <th className="l">Team</th>
                {Array.from({ length: periods }, (_, i) => <th key={i}>{label(i)}</th>)}
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              {[away, home].map((s) => (
                <tr key={s.id}>
                  <td className="l">{s.name}</td>
                  {Array.from({ length: periods }, (_, i) => <td key={i}>{s.lines[i] ?? ''}</td>)}
                  <td><b>{s.score}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3>Team stats</h3>
      <div className="cfb-scroll">
        <table className="cfb-t">
          <thead>
            <tr>
              <th className="l" />
              <th>{away.name}</th>
              <th>{home.name}</th>
            </tr>
          </thead>
          <tbody>
            {b.team_stats.map(([labelText, a, h]) => (
              <tr key={labelText}>
                <td className="l">{labelText}</td>
                <td>{a}</td>
                <td>{h}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Player stats</h3>
      {CATS.filter(([k]) => b.players[k]).map(([k, title]) => {
        const p = b.players[k];
        return (
          <div key={k} className="box-cat">
            <PlayerTable title={`${away.name} ${title}`} cols={p.cols} rows={p.away} />
            <PlayerTable title={`${home.name} ${title}`} cols={p.cols} rows={p.home} />
          </div>
        );
      })}
      {!b.players.defensive && (
        <p className="note">No defensive player stats in the feed for this game (ESPN’s data has them for most games only from 2023 on).</p>
      )}
      <p className="note">
        Box score from ESPN via the sportsdataverse cfbfastR data. QBR is ESPN’s adjusted QBR. Defense: TOT total tackles,
        TFL tackles for loss, PD passes defended, QB HUR quarterback hurries.
      </p>
    </>
  );
}
