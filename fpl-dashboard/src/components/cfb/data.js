import { useEffect, useState } from 'react';

// Tables written by scripts/cfb-export.mjs into public/data/cfb.
const cache = new Map();

export function loadCfb(name) {
  if (!cache.has(name)) {
    const p = fetch(`/data/cfb/${name}.json`).then((r) => {
      if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => cache.delete(name));
    cache.set(name, p);
  }
  return cache.get(name);
}

/** Load several tables; returns { data: {name: rows} | null, error }. */
export function useCfb(...names) {
  const key = names.join('|');
  const [state, setState] = useState({ key: null, data: null, error: null });
  useEffect(() => {
    let live = true;
    const list = key.split('|');
    Promise.all(list.map(loadCfb))
      .then((rows) => live && setState({ key, data: Object.fromEntries(list.map((n, i) => [n, rows[i]])), error: null }))
      .catch((error) => live && setState({ key, data: null, error }));
    return () => { live = false; };
  }, [key]);
  return state.key === key ? state : { data: null, error: null };
}

// ---- formatting -------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11-21" -> "Nov 21" (no Date parsing, so no time-zone shifts). */
export const fmtDate = (iso, withYear = false) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? `, ${y}` : ''}`;
};

export const rec = (w, l) => (w + l === 0 ? '–' : `${w}-${l}`);
export const pct = (x) => (x == null ? '' : (x * 100).toFixed(1));
export const signed = (x, digits = 1) => (x == null ? '' : `${x > 0 ? '+' : ''}${x.toFixed(digits)}`);
export const num = (x) => (x == null ? '' : String(x));

/** Sort key for a W-L split: win pct, then more wins; null (no games) sorts last. */
export const recKey = (w, l) => (w + l === 0 ? null : w / (w + l) + w * 1e-4);

export const CONFS = ['ACC', 'Big 12', 'Big Ten', 'SEC', 'Pac-12', 'Ind', 'American', 'C-USA', 'MAC', 'Mountain West', 'Sun Belt'];

/** Filter rows by ?set=power or ?conf=X. */
export function filterTeams(rows, params, teamsById) {
  const conf = params.get('conf');
  const set = params.get('set');
  return rows.filter((r) => {
    const t = teamsById ? teamsById.get(r.team_id) : r;
    if (conf) return t.conference === conf;
    if (set === 'power') return t.in_power_set;
    return true;
  });
}
