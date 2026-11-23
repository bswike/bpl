import { useMemo, useState } from 'react';

/**
 * Plain sortable table.
 *
 * column: {
 *   key, label, title?,        header text and hover help
 *   group?,                    shared label in a header row above (consecutive columns merge)
 *   value: row => sortable,    null/undefined always sorts last
 *   render?: row => node,      defaults to value
 *   desc?: true,               first click sorts high-to-low (the "better" direction for ranks)
 *   rank?: true,               show the row's rank among rankRows in small type after the value
 *   left?: true,               left-align
 *   sticky?: '0' | '2.6em',    pin the column at this left offset when scrolling sideways
 * }
 * rowKey identifies rows; rankKey (default rowKey) matches a row to its rankRows entry for the small ranks.
 */
export default function SortTable({ columns, rows, rankRows, rowKey = (r) => r.team_id, rankKey = rowKey, defaultSort, rowClass }) {
  const [sort, setSort] = useState(defaultSort);

  const ranks = useMemo(() => {
    const base = rankRows || rows;
    const out = {};
    for (const c of columns) {
      if (!c.rank) continue;
      const vals = base.map((r) => [rankKey(r), c.value(r)]).filter(([, v]) => v != null);
      vals.sort((a, b) => (c.desc ? b[1] - a[1] : a[1] - b[1]));
      const m = new Map();
      vals.forEach(([k, v], i) => m.set(k, i > 0 && v === vals[i - 1][1] ? m.get(vals[i - 1][0]) : i + 1));
      out[c.key] = m;
    }
    return out;
  }, [columns, rows, rankRows, rankKey]);

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const dir = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => {
      const va = col.value(a);
      const vb = col.value(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
  }, [columns, rows, sort]);

  const clickSort = (c) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key: c.key, dir: c.desc ? 'desc' : 'asc' }));

  const hasGroups = columns.some((c) => c.group);
  const groups = [];
  if (hasGroups) {
    for (const c of columns) {
      const last = groups[groups.length - 1];
      if (last && c.group && last.label === c.group) last.span += 1;
      else groups.push({ label: c.group || '', span: 1, sticky: c.sticky });
    }
  }

  const stickyStyle = (c) => (c.sticky != null ? { left: c.sticky } : undefined);

  return (
    <div className="cfb-scroll">
      <table className="cfb-t">
        <thead>
          {hasGroups && (
            <tr className="grp">
              {groups.map((g, i) => (
                <th key={i} colSpan={g.span} className={g.label ? 'g' : 'blank'}>
                  {g.label && <div>{g.label}</div>}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                title={c.title}
                onClick={() => clickSort(c)}
                className={[c.left && 'l', c.sticky != null && 'st', sort.key === c.key && 'on'].filter(Boolean).join(' ')}
                style={stickyStyle(c)}
              >
                {c.label}
                {sort.key === c.key ? (sort.dir === 'desc' ? ' ▾' : ' ▴') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className={rowClass ? rowClass(r) : undefined}>
              {columns.map((c) => {
                const rk = c.rank ? ranks[c.key].get(rankKey(r)) : null;
                return (
                  <td key={c.key} className={[c.left && 'l', c.sticky != null && 'st'].filter(Boolean).join(' ') || undefined} style={stickyStyle(c)}>
                    {c.render ? c.render(r) : c.value(r)}
                    {rk != null && <span className="rk">{rk}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
