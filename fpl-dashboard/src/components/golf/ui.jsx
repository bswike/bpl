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

function postedScore(hole) {
  return hole?.raw_score || hole?.adjusted_gross_score || null;
}

function holeSum(holes, valueOf) {
  const values = holes.map(valueOf).filter((value) => typeof value === "number");
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}

function ScoreMark({ score, par }) {
  if (score == null) return <span className="text-[9px] text-gray-300">—</span>;
  const result = par ? resultKey(score, par) : null;
  const circle = "rounded-full border border-emerald-600/80";
  const square = "border border-rose-500/80";
  const bogey = "border border-gray-500/70";
  const shape =
    result === "eagle" || result === "birdie"
      ? circle
      : result === "bogey"
        ? bogey
        : result === "double" || result === "triple"
          ? square
          : "";
  const mark = (
    <span className={`flex h-4 w-4 items-center justify-center text-[9px] font-semibold leading-none text-gray-800 ${shape}`}>
      {score}
    </span>
  );
  return result === "eagle" || result === "double" || result === "triple" ? (
    <span className={`inline-flex items-center justify-center p-px ${shape}`}>{mark}</span>
  ) : mark;
}

/** Expanded paper-style scorecard for one round (needs round.hd). */
export function Scorecard({ round }) {
  const hd = round.hd || [];
  if (!hd.length) return null;
  const nines =
    hd.length > 9
      ? [
          { label: "Front", holes: hd.slice(0, 9) },
          { label: "Back", holes: hd.slice(9, 18) },
        ]
      : [{ label: round.holes === 9 ? "9 holes" : "Holes", holes: hd }];
  const frontPar = holeSum(nines[0].holes, (hole) => hole.par);
  const frontScore = holeSum(nines[0].holes, postedScore);
  const totalPar = holeSum(hd, (hole) => hole.par);
  const totalScore = holeSum(hd, postedScore);

  return (
    <div className="my-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-50/80 p-1.5">
      {nines.map(({ label, holes }, sectionIndex) => {
        const back = sectionIndex === 1;
        const ninePar = holeSum(holes, (hole) => hole.par);
        const nineScore = holeSum(holes, postedScore);
        const hasHcp = holes.some((hole) => hole.stroke_allocation);
        const grid = {
          display: "grid",
          gridTemplateColumns: `4rem repeat(${holes.length}, minmax(0, 1fr)) ${back ? "1.75rem 1.75rem 2.15rem" : "2.15rem"}`,
        };
        const split = back ? "mt-2.5 border-t border-gray-300 pt-2.5" : nines.length > 1 ? "mb-2.5" : "";
        return (
          <div key={label} className={split}>
            <div style={grid} className="mb-0.5 text-[9px] font-semibold uppercase tracking-wider text-gray-500">
              <div className="flex items-center pl-1">{label}</div>
              {holes.map((hole) => (
                <div key={hole.hole_number} className="flex h-5 items-center justify-center rounded-sm bg-gray-100 text-gray-600">
                  {hole.hole_number}
                </div>
              ))}
              <div className="flex items-center justify-center">{back ? "B9" : nines.length > 1 ? "F9" : "Tot"}</div>
              {back && <div className="flex items-center justify-center">F9</div>}
              {back && <div className="mx-0.5 flex items-center justify-center rounded-sm bg-gray-200/70">Tot</div>}
            </div>

            <div style={grid} className="border-b border-gray-200 text-[9px] text-gray-500">
              <div className="flex items-center pl-1 uppercase tracking-wider">Par</div>
              {holes.map((hole) => (
                <div key={hole.hole_number} className="flex h-4 items-center justify-center tabular-nums">{hole.par || "—"}</div>
              ))}
              <div className="flex items-center justify-center font-semibold tabular-nums">{ninePar ?? "—"}</div>
              {back && <div className="flex items-center justify-center font-semibold tabular-nums">{frontPar ?? "—"}</div>}
              {back && <div className="flex items-center justify-center font-semibold tabular-nums">{totalPar ?? "—"}</div>}
            </div>

            {hasHcp && (
              <div style={grid} className="text-[8px] text-gray-400">
                <div className="flex items-center pl-1 uppercase tracking-wider">Hcp</div>
                {holes.map((hole) => (
                  <div key={hole.hole_number} className="flex h-4 items-center justify-center tabular-nums">
                    {hole.stroke_allocation || "—"}
                  </div>
                ))}
                <div />
                {back && <div />}
                {back && <div />}
              </div>
            )}

            <div style={grid}>
              <div className="flex items-center pl-1 text-[9px] uppercase tracking-wider text-gray-500">Score</div>
              {holes.map((hole) => (
                <div key={hole.hole_number} className="flex h-7 items-center justify-center tabular-nums">
                  <ScoreMark score={postedScore(hole)} par={hole.par} />
                </div>
              ))}
              <div className="flex items-center justify-center text-[10px] font-semibold text-gray-700 tabular-nums">{nineScore ?? "—"}</div>
              {back && <div className="flex items-center justify-center text-[10px] font-semibold text-gray-700 tabular-nums">{frontScore ?? "—"}</div>}
              {back && (
                <div className="mx-0.5 flex h-7 items-center justify-center rounded-sm bg-gray-200/70 text-[11px] font-bold text-gray-900 tabular-nums">
                  {totalScore ?? "—"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
