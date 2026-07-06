/** Shared presentational pieces for the /golf dashboard. */
import { RESULT_ORDER, RESULT_COLORS, RESULT_LABELS, resultKey, fmtToPar } from "./data";

export function Card({ title, right, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5 min-w-0 ${className}`}
    >
      {(title || right) && (
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          {title && (
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {title}
            </h3>
          )}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Avatar({ golfer, size = "md", onClick, ring = false }) {
  const initials =
    `${golfer?.first_name?.[0] || ""}${golfer?.last_name?.[0] || ""}`.toUpperCase() || "⛳";
  const sizes = {
    sm: "w-9 h-9 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-20 h-20 text-2xl",
  };
  const cls = `${sizes[size]} rounded-full bg-gradient-to-br from-green-600 to-green-900 text-white font-bold flex items-center justify-center shrink-0 select-none ${
    ring ? "ring-2 ring-[#d4af37]/70 ring-offset-1 ring-offset-transparent" : ""
  }`;
  if (!onClick) return <div className={cls}>{initials}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      title="View profile"
      className={`${cls} border-none cursor-pointer hover:brightness-110 transition-all p-0`}
    >
      {initials}
    </button>
  );
}

export function StatCard({ label, value, sub, tone = "default" }) {
  const toneClass =
    tone === "good"
      ? "text-green-600"
      : tone === "bad"
        ? "text-red-600"
        : "text-green-900";
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2.5 sm:px-4 sm:py-3 min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        {label}
      </div>
      <div className={`text-xl sm:text-2xl font-bold font-mono mt-0.5 ${toneClass}`}>{value}</div>
      <div className="text-[11px] sm:text-xs text-gray-400 mt-0.5 truncate">{sub || " "}</div>
    </div>
  );
}

export function HolesBadge({ holes }) {
  return holes === 9 ? (
    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
      9
    </span>
  ) : (
    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800">
      18
    </span>
  );
}

export function ToParChip({ toPar }) {
  if (toPar == null) return <span className="text-gray-300">—</span>;
  const cls =
    toPar <= 0
      ? "bg-green-100 text-green-800"
      : toPar <= 9
        ? "bg-blue-50 text-blue-700"
        : toPar <= 18
          ? "bg-amber-50 text-amber-700"
          : "bg-red-50 text-red-600";
  return (
    <span className={`inline-block font-mono text-xs font-bold px-1.5 py-0.5 rounded ${cls}`}>
      {fmtToPar(toPar)}
    </span>
  );
}

/** Sortable table header cell. */
export function Th({ label, k, sort, onSort, align = "left", className = "" }) {
  const active = sort.key === k;
  const arrow = active ? (sort.dir === "asc" ? "▲" : "▼") : "";
  return (
    <th
      className={`pb-2 px-1.5 text-[10px] uppercase tracking-wide font-bold border-b border-gray-200 whitespace-nowrap ${
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
      } ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`border-none bg-transparent cursor-pointer p-0 text-[10px] uppercase tracking-wide font-bold ${
          active ? "text-green-700" : "text-gray-500 hover:text-gray-700"
        }`}
      >
        {label}
        {arrow && <span className="ml-0.5 text-[8px]">{arrow}</span>}
      </button>
    </th>
  );
}

export function Legend() {
  return (
    <div className="flex gap-3 flex-wrap">
      {RESULT_ORDER.map((k) => (
        <div key={k} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <div className="w-2 h-2 rounded-sm" style={{ background: RESULT_COLORS[k] }} />
          {RESULT_LABELS[k]}
        </div>
      ))}
    </div>
  );
}

export function DistBar({ dist, total }) {
  return (
    <div className="flex items-center gap-2 h-6 min-w-[96px] sm:min-w-[160px]">
      <div className="flex flex-1 h-4 rounded overflow-hidden bg-gray-100">
        {RESULT_ORDER.map((k) => {
          const c = dist[k] || 0;
          if (!c) return null;
          return (
            <div
              key={k}
              title={`${RESULT_LABELS[k]}: ${c}`}
              className="min-w-[2px]"
              style={{ width: `${(c / total) * 100}%`, background: RESULT_COLORS[k] }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Expanded scorecard for one round (needs round.hd). */
export function Scorecard({ round }) {
  const nines = [];
  const hd = round.hd || [];
  if (hd.length > 9) {
    nines.push(["Front 9", hd.slice(0, 9)]);
    nines.push(["Back 9", hd.slice(9)]);
  } else {
    nines.push([round.holes === 9 ? "9 holes" : "Holes", hd]);
  }
  return (
    <div className="space-y-3 py-2">
      {nines.map(([label, holes]) => {
        const parSum = holes.reduce((s, h) => s + (h.par || 0), 0);
        const scoreSum = holes.reduce(
          (s, h) => s + (h.raw_score || h.adjusted_gross_score || 0),
          0
        );
        return (
          <div key={label} className="overflow-x-auto">
            <table className="border-collapse text-xs font-mono">
              <tbody>
                <tr className="text-gray-400">
                  <td className="pr-3 py-0.5 text-[10px] uppercase tracking-wide font-sans font-semibold">
                    {label}
                  </td>
                  {holes.map((h) => (
                    <td key={h.hole_number} className="w-8 text-center py-0.5">
                      {h.hole_number}
                    </td>
                  ))}
                  <td className="w-10 text-center text-[10px] font-sans font-semibold">TOT</td>
                </tr>
                <tr className="text-gray-500">
                  <td className="pr-3 py-0.5 text-[10px] uppercase tracking-wide font-sans">
                    Par
                  </td>
                  {holes.map((h) => (
                    <td key={h.hole_number} className="text-center py-0.5">
                      {h.par || "—"}
                    </td>
                  ))}
                  <td className="text-center font-semibold">{parSum || "—"}</td>
                </tr>
                <tr>
                  <td className="pr-3 py-1 text-[10px] uppercase tracking-wide font-sans text-gray-500">
                    Score
                  </td>
                  {holes.map((h) => {
                    const raw = h.raw_score || h.adjusted_gross_score;
                    const k = raw && h.par ? resultKey(raw, h.par) : null;
                    return (
                      <td key={h.hole_number} className="text-center py-1">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-white"
                          style={{ background: k ? RESULT_COLORS[k] : "#d1d5db" }}
                        >
                          {raw || "—"}
                        </span>
                      </td>
                    );
                  })}
                  <td className="text-center font-bold text-gray-900">{scoreSum || "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        );
      })}
      <Legend />
    </div>
  );
}
