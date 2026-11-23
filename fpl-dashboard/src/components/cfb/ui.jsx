import { Fragment, useEffect, useRef } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { CONFS, fmtDate } from './data';

export const TeamLink = ({ id, children }) => <Link to={`/cfb/team/${id}`}>{children}</Link>;

export function Status({ error }) {
  if (error) return <p className="err">Could not load data ({String(error.message || error)}).</p>;
  return <p className="muted">Loading…</p>;
}

/** Rank cell. Projected ranks carry a "p" and the row is shaded (see ProjectedNote). */
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

/** Refs for a one-line .scroll-row and its selected item; centres the selected item whenever `key` changes. */
function useScrollRow(key) {
  const row = useRef(null);
  const on = useRef(null);
  useEffect(() => {
    const r = row.current, b = on.current;
    if (r && b && r.scrollWidth > r.clientWidth) r.scrollLeft = Math.max(0, b.offsetLeft - r.offsetLeft - r.clientWidth / 2 + b.offsetWidth / 2);
  }, [key]);
  return [row, on];
}

/** "All FBS | Power conf + ND | ACC | ..." as plain links that keep the current page. */
export function ConfFilter({ confs = CONFS }) {
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
    { label: 'Power conf. + ND', to: href({ set: 'power' }), on: set === 'power' && !conf, title: 'Power conferences of that season plus Notre Dame' },
    ...confs.map((c) => ({ label: c, to: href({ conf: c }), on: conf === c })),
  ];
  const [row, on] = useScrollRow(`${conf}|${set}`);
  return (
    <p className="links scroll-row" ref={row}>
      {items.map((it, i) => (
        <Fragment key={it.label}>
          {i > 0 && ' | '}
          {it.on ? <b ref={on}>{it.label}</b> : <Link to={it.to} title={it.title}>{it.label}</Link>}
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

/**
 * "Season: 2026 | 2025 | ..." on one line that scrolls sideways when it doesn't fit (phones), with the selected
 * season scrolled into view. hrefFor(year) gives each link.
 */
export function SeasonStrip({ seasons, season, hrefFor, extra = null }) {
  const [row, on] = useScrollRow(`${season}|${seasons.length}`);
  return (
    <p className="links scroll-row" ref={row}>
      Season:{' '}
      {seasons.map((y, i) => (
        <Fragment key={y}>
          {i > 0 && ' | '}
          {y === season ? <b ref={on}>{y}</b> : <Link to={hrefFor(y)}>{y}</Link>}
        </Fragment>
      ))}
      {extra}
    </p>
  );
}
