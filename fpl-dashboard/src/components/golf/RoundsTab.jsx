import { useMemo, useState } from "react";
import { fmtToPar } from "./data";
import { Card, Th, HolesBadge, ToParChip, Scorecard } from "./ui";
import { useSortState } from "./useSort";

const getters = {
  date: (r) => r.date,
  course: (r) => r.courseName.toLowerCase(),
  holes: (r) => r.holes,
  ags: (r) => r.ags,
  toPar: (r) => (r.toPar != null ? r.toPar : 999),
  diff: (r) => (r.diff != null ? r.diff : 999),
  birdies: (r) => (r.counts ? r.counts.birdie + r.counts.eagle : -1),
  pars: (r) => (r.counts ? r.counts.par : -1),
};

const SORT_LABELS = [
  ["date", "Date"],
  ["course", "Course"],
  ["ags", "Score"],
  ["toPar", "To par"],
  ["diff", "Diff"],
  ["birdies", "Birdies"],
  ["pars", "Pars"],
];

export default function RoundsTab({ rounds }) {
  const [query, setQuery] = useState("");
  const [sort, onSort] = useSortState("date");
  const [expanded, setExpanded] = useState(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rounds.filter((r) => r.courseName.toLowerCase().includes(q))
      : rounds;
    const get = getters[sort.key] || getters.date;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * mul;
    });
  }, [rounds, query, sort]);

  return (
    <Card
      title={`All rounds · ${visible.length}`}
      right={
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by course…"
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-full sm:w-48 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      }
    >
      {/* Mobile: stacked rows, no side-scroll */}
      <div className="sm:hidden">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
            Sort
          </label>
          <select
            value={sort.key}
            onChange={(e) => e.target.value !== sort.key && onSort(e.target.value)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-gray-900 focus:outline-none"
          >
            {SORT_LABELS.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onSort(sort.key)}
            className="px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white text-gray-600 cursor-pointer"
          >
            {sort.dir === "asc" ? "↑ asc" : "↓ desc"}
          </button>
        </div>
        {visible.map((r) => {
          const isOpen = expanded === r.id;
          const canExpand = !!r.hd;
          return (
            <div
              key={r.id}
              onClick={() => canExpand && setExpanded(isOpen ? null : r.id)}
              className={`py-2.5 border-b border-gray-100 last:border-0 ${
                canExpand ? "cursor-pointer active:bg-green-50/40" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-gray-800 truncate">
                    {r.courseName}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono">
                    {r.date}
                    {r.tee ? ` · ${r.tee}` : ""}
                  </div>
                </div>
                <HolesBadge holes={r.holes} />
                <ToParChip toPar={r.toPar} />
                <div className="text-lg font-bold font-mono text-gray-900 w-9 text-right">
                  {r.ags}
                  {r.used && (
                    <span className="text-green-600" title="Counts toward index">
                      •
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 font-mono">
                <span>Diff {r.diff != null ? r.diff.toFixed(1) : "—"}</span>
                <span className="text-red-500 font-semibold">
                  🐦 {r.counts ? r.counts.birdie + r.counts.eagle : "—"}
                </span>
                <span>Pars {r.counts ? r.counts.par : "—"}</span>
                {canExpand && (
                  <span className="ml-auto text-gray-400">
                    {isOpen ? "Hide scorecard ▴" : "Scorecard ▾"}
                  </span>
                )}
              </div>
              {isOpen && (
                <div className="mt-1">
                  <Scorecard round={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop: full sortable table */}
      <div className="hidden sm:block overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <Th label="Date" k="date" sort={sort} onSort={onSort} />
              <Th label="Course" k="course" sort={sort} onSort={onSort} />
              <Th label="" k="holes" sort={sort} onSort={onSort} align="center" />
              <Th label="Score" k="ags" sort={sort} onSort={onSort} align="right" />
              <Th label="To Par" k="toPar" sort={sort} onSort={onSort} align="center" />
              <Th label="Diff" k="diff" sort={sort} onSort={onSort} align="right" />
              <Th label="Birdies+" k="birdies" sort={sort} onSort={onSort} align="right" />
              <Th label="Pars" k="pars" sort={sort} onSort={onSort} align="right" />
              <th className="pb-2 border-b border-gray-200 w-6" />
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const isOpen = expanded === r.id;
              const canExpand = !!r.hd;
              return [
                <tr
                  key={r.id}
                  onClick={() => canExpand && setExpanded(isOpen ? null : r.id)}
                  className={`border-b border-gray-50 ${
                    canExpand ? "cursor-pointer hover:bg-green-50/40" : ""
                  } ${isOpen ? "bg-green-50/60" : ""}`}
                >
                  <td className="py-2 pr-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                    {r.date}
                  </td>
                  <td className="py-2 pr-2 font-medium text-gray-800 max-w-[220px] truncate">
                    {r.courseName}
                    {r.tee && (
                      <span className="text-[10px] text-gray-400 ml-1.5 uppercase">{r.tee}</span>
                    )}
                  </td>
                  <td className="py-2 px-1.5 text-center">
                    <HolesBadge holes={r.holes} />
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono font-bold text-gray-900">
                    {r.ags}
                    {r.used && (
                      <span className="text-green-600 ml-0.5" title="Counts toward index">
                        •
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-1.5 text-center">
                    <ToParChip toPar={r.toPar} />
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono text-gray-600 text-xs">
                    {r.diff != null ? r.diff.toFixed(1) : "—"}
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono text-red-500 font-semibold">
                    {r.counts ? r.counts.birdie + r.counts.eagle : "—"}
                  </td>
                  <td className="py-2 px-1.5 text-right font-mono text-gray-700">
                    {r.counts ? r.counts.par : "—"}
                  </td>
                  <td className="py-2 text-center text-gray-400 text-xs">
                    {canExpand ? (isOpen ? "▾" : "▸") : ""}
                  </td>
                </tr>,
                isOpen && (
                  <tr key={`${r.id}-card`} className="border-b border-gray-100 bg-green-50/30">
                    <td colSpan={9} className="px-2">
                      <Scorecard round={r} />
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && (
        <p className="text-center text-gray-400 py-10">No rounds match.</p>
      )}
      <p className="text-[11px] text-gray-400 mt-3">
        Tap a round for the full scorecard. <span className="text-green-600">•</span> = round
        counts toward your handicap index. To par:{" "}
        <span className="font-mono">{fmtToPar(0)}</span> = even. Diff for rounds under 18 holes
        is the USGA scaled-up 18-hole equivalent.
      </p>
    </Card>
  );
}
