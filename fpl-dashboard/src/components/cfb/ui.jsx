import { Fragment } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CONFS, fmtDate } from './data';

export const TeamLink = ({ id, children }) => <Link to={`/cfb/team/${id}`}>{children}</Link>;

export function Status({ error }) {
  if (error) return <p className="err">Could not load data ({String(error.message || error)}).</p>;
  return <p className="muted">Loading…</p>;
}

/** Top-50 rank cell. Projected ranks carry a "p" and the row is shaded (see ProjectedNote). */
export function T50({ rank, basis }) {
  if (rank == null) return '';
  if (basis === 'Projected') return <span className="proj" title="Projected by this site's model, not a published ranking">{rank}p</span>;
  return rank;
}

export const ProjectedNote = () => (
  <p className="note">
    <span className="proj">p</span> = projected by this site’s model, not a published ranking.
  </p>
);

/** "All FBS | Power conf + ND | ACC | ..." as plain links that keep the current page. */
export function ConfFilter() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const conf = params.get('conf');
  const set = params.get('set');
  const href = (next) => {
    const p = new URLSearchParams(params);
    p.delete('conf');
    p.delete('set');
    for (const [k, v] of Object.entries(next)) p.set(k, v);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };
  const items = [
    { label: 'All FBS', to: href({}), on: !conf && !set },
    { label: 'Power conf. + ND', to: href({ set: 'power' }), on: set === 'power' && !conf, title: 'ACC, Big 12, Big Ten, SEC, Notre Dame and the eight-team 2026 Pac-12 (76 teams)' },
    ...CONFS.map((c) => ({ label: c, to: href({ conf: c }), on: conf === c })),
  ];
  return (
    <p className="links">
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 && ' | '}
          {it.on ? <b>{it.label}</b> : <Link to={it.to} title={it.title}>{it.label}</Link>}
        </Fragment>
      ))}
    </p>
  );
}

export function AsOf({ meta }) {
  if (!meta) return null;
  return (
    <p className="asof">
      Games through {fmtDate(meta.games_through)} · AP {fmtDate(meta.ap_poll.released)} · CFP {fmtDate(meta.cfp.released)} · 247
      talent {fmtDate(meta.talent.last_updated)}
    </p>
  );
}
