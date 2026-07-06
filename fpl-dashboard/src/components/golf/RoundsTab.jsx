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
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm w-48 max-w-full focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      }
    >
      <div className="overflow-x-auto -mx-1 px-1">
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
                  <td className="py-2 px-1.5 text-center text-gray-400 text-xs">
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
        Click a row to see the full scorecard. <span className="text-green-600">•</span> = round
        counts toward your handicap index. To par:{" "}
        <span className="font-mono">{fmtToPar(0)}</span> = even.
      </p>
    </Card>
  );
}
