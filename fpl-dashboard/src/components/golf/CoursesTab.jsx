import { useMemo } from "react";
import { aggregate, aggregateHoles, groupBy, fmtToPar } from "./data";
import { Card, StatCard, Th, DistBar, Legend, HolesBadge } from "./ui";
import { useSortState } from "./useSort";
import { TrendChart, HoleBarChart } from "./charts";

function CourseList({ rounds, onSelect }) {
  const [sort, onSort] = useSortState("n");

  const courses = useMemo(() => {
    const grouped = groupBy(rounds, (r) => r.courseKey);
    return Object.entries(grouped).map(([key, rs]) => {
      const a = aggregate(rs);
      return {
        key,
        name: rs[0].courseName,
        n: a.n,
        n18: a.n18,
        n9: a.n9,
        avg18: a.avg18,
        best: a.best18 ? a.best18.ags : a.best9 ? a.best9.ags : null,
        avgToPar: a.avgToPar18 ?? a.avgToPar9,
        birdies: a.trackedRounds ? a.counts.birdie + a.counts.eagle : null,
        pars: a.trackedRounds ? a.counts.par : null,
        last: rs[0].date,
      };
    });
  }, [rounds]);

  const sorted = useMemo(() => {
    const get = (c) => {
      const v = c[sort.key];
      if (v == null) return sort.dir === "asc" ? Infinity : -Infinity;
      return typeof v === "string" ? v.toLowerCase() : v;
    };
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...courses].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * mul;
    });
  }, [courses, sort]);

  return (
    <Card title={`Courses · ${courses.length}`}>
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <Th label="Course" k="name" sort={sort} onSort={onSort} />
              <Th label="Rounds" k="n" sort={sort} onSort={onSort} align="center" />
              <Th label="Avg (18)" k="avg18" sort={sort} onSort={onSort} align="right" />
              <Th label="Best" k="best" sort={sort} onSort={onSort} align="right" />
              <Th label="Avg ± Par" k="avgToPar" sort={sort} onSort={onSort} align="right" />
              <Th label="Birdies+" k="birdies" sort={sort} onSort={onSort} align="right" />
              <Th label="Pars" k="pars" sort={sort} onSort={onSort} align="right" />
              <Th label="Last played" k="last" sort={sort} onSort={onSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr
                key={c.key}
                onClick={() => onSelect(c.key)}
                className="border-b border-gray-50 cursor-pointer hover:bg-green-50/50"
              >
                <td className="py-2 pr-2 font-medium text-green-900 max-w-[240px] truncate">
                  {c.name}
                </td>
                <td className="py-2 px-1.5 text-center text-gray-600 text-xs whitespace-nowrap">
                  {c.n18 > 0 && `${c.n18}×18`}
                  {c.n18 > 0 && c.n9 > 0 && ", "}
                  {c.n9 > 0 && `${c.n9}×9`}
                </td>
                <td className="py-2 px-1.5 text-right font-mono">
                  {c.avg18 != null ? c.avg18.toFixed(1) : "—"}
                </td>
                <td className="py-2 px-1.5 text-right font-mono text-green-700 font-semibold">
                  {c.best ?? "—"}
                  {c.best != null && c.n18 === 0 && (
                    <span className="text-[9px] text-amber-600 ml-0.5">(9)</span>
                  )}
                </td>
                <td className="py-2 px-1.5 text-right font-mono text-gray-700">
                  {c.avgToPar != null ? fmtToPar(c.avgToPar, { decimals: 1 }) : "—"}
                </td>
                <td className="py-2 px-1.5 text-right font-mono text-red-500 font-semibold">
                  {c.birdies ?? "—"}
                </td>
                <td className="py-2 px-1.5 text-right font-mono text-gray-700">{c.pars ?? "—"}</td>
                <td className="py-2 px-1.5 text-right font-mono text-xs text-gray-500">{c.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-3">
        Avg and Best use 18-hole rounds only (9-hole rounds are never mixed in). Click a course
        for the hole-by-hole breakdown.
      </p>
    </Card>
  );
}

function CourseYearTable({ rounds }) {
  const byYear = groupBy(rounds, (r) => r.year);
  const years = Object.keys(byYear).sort().reverse();
  if (years.length < 2) return null;
  return (
    <Card title="Year by year at this course">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 text-[10px] uppercase tracking-wide">
              <th className="pb-2">Year</th>
              <th className="pb-2 px-1.5 text-center">Rounds</th>
              <th className="pb-2 px-1.5 text-right">Avg (18)</th>
              <th className="pb-2 px-1.5 text-right">Best</th>
              <th className="pb-2 px-1.5 text-right">Eagles</th>
              <th className="pb-2 px-1.5 text-right">Birdies</th>
              <th className="pb-2 px-1.5 text-right">Pars</th>
              <th className="pb-2 px-1.5 text-right">Bogeys</th>
              <th className="pb-2 px-1.5 text-right">Dbl+</th>
            </tr>
          </thead>
          <tbody>
            {years.map((yr) => {
              const a = aggregate(byYear[yr]);
              return (
                <tr key={yr} className="border-b border-gray-50">
                  <td className="py-1.5 font-semibold">{yr}</td>
                  <td className="py-1.5 px-1.5 text-center text-gray-600 text-xs">
                    {a.n18 > 0 && `${a.n18}×18`}
                    {a.n18 > 0 && a.n9 > 0 && ", "}
                    {a.n9 > 0 && `${a.n9}×9`}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono">
                    {a.avg18 != null ? a.avg18.toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-green-700 font-semibold">
                    {a.best18 ? a.best18.ags : a.best9 ? `${a.best9.ags} (9)` : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-yellow-600">
                    {a.trackedRounds ? a.counts.eagle : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-red-500 font-semibold">
                    {a.trackedRounds ? a.counts.birdie : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-green-600">
                    {a.trackedRounds ? a.counts.par : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-blue-500">
                    {a.trackedRounds ? a.counts.bogey : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-gray-500">
                    {a.trackedRounds ? a.counts.double + a.counts.triple : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Extremes({ holes }) {
  if (holes.length < 6) return null;
  const sorted = [...holes].sort((a, b) => b.avg - b.par - (a.avg - a.par));
  const List = ({ items, icon, colorClass }) => (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <div className="text-sm font-bold text-gray-800 mb-2">{icon}</div>
      {items.map((h) => {
        const d = h.avg - h.par;
        return (
          <div
            key={h.hole}
            className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
          >
            <span className="font-bold flex-1 text-gray-800 text-sm">Hole {h.hole}</span>
            <span className="text-[11px] text-gray-400">Par {h.par}</span>
            <span className={`font-mono font-bold text-sm ${colorClass}`}>
              {d > 0 ? "+" : ""}
              {d.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <List items={sorted.slice(0, 3)} icon="🔥 Toughest holes" colorClass="text-red-600" />
      <List
        items={sorted.slice(-3).reverse()}
        icon="💪 Best holes"
        colorClass="text-green-600"
      />
    </div>
  );
}

function HoleTable({ holes }) {
  if (!holes.length) return null;
  const isFull18 = holes.length >= 18;
  const nines = isFull18
    ? [
        ["Front 9", holes.filter((h) => h.hole <= 9)],
        ["Back 9", holes.filter((h) => h.hole > 9)],
      ]
    : [["Holes", holes]];
  const th =
    "pb-2 text-[9px] uppercase tracking-wide text-gray-500 font-bold border-b border-gray-200";
  return (
    <div>
      {nines.map(([label, nine]) => {
        if (!nine.length) return null;
        const nP = nine.reduce((s, h) => s + h.par, 0);
        const nA = nine.reduce((s, h) => s + h.avg, 0);
        const nD = nA - nP;
        return (
          <div key={label} className="mb-6 last:mb-0">
            <div className="flex justify-between items-center mb-2 px-3 py-2 bg-green-50 rounded-lg border-l-4 border-green-600">
              <span className="font-bold text-sm text-gray-900">{label}</span>
              <span className="text-xs text-gray-600 font-mono">
                Par {nP} · Avg {nA.toFixed(1)} ·{" "}
                <span className={nD > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                  {nD > 0 ? "+" : ""}
                  {nD.toFixed(1)}
                </span>
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={`${th} w-12 text-center`}>Hole</th>
                    <th className={`${th} w-10 text-center`}>Par</th>
                    <th className={`${th} w-10 text-center`}>Hcp</th>
                    <th className={`${th} w-14 text-center`}>Avg</th>
                    <th className={`${th} w-14 text-center`}>±Par</th>
                    <th className={`${th} w-11 text-center`}>Best</th>
                    <th className={`${th} w-11 text-center`}>Worst</th>
                    <th className={`${th} min-w-[170px] text-left`}>Distribution</th>
                    <th className={`${th} w-8 text-center`}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {nine.map((h) => {
                    const vp = h.avg - h.par;
                    const vc =
                      vp > 0.5
                        ? "text-red-600"
                        : vp < 0.15
                          ? "text-green-600"
                          : "text-amber-600";
                    return (
                      <tr key={h.hole} className="border-b border-gray-50 hover:bg-gray-50/80">
                        <td className="py-2 px-1.5 text-center font-mono font-bold text-gray-900">
                          {h.hole}
                        </td>
                        <td className="py-2 px-1.5 text-center text-gray-600">{h.par}</td>
                        <td className="py-2 px-1.5 text-center text-gray-400 text-xs">{h.sa || "—"}</td>
                        <td className="py-2 px-1.5 text-center font-mono font-bold text-gray-900">
                          {h.avg.toFixed(2)}
                        </td>
                        <td className={`py-2 px-1.5 text-center font-mono font-bold ${vc}`}>
                          {vp > 0 ? "+" : ""}
                          {vp.toFixed(2)}
                        </td>
                        <td className="py-2 px-1.5 text-center text-green-600 font-medium">{h.best}</td>
                        <td className="py-2 px-1.5 text-center text-red-600 font-medium">{h.worst}</td>
                        <td className="py-2 pr-2">
                          <DistBar dist={h.distribution} total={h.count} />
                        </td>
                        <td className="py-2 px-1.5 text-center text-gray-400 text-xs">{h.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CourseDetail({ rounds, courseKey, onBack }) {
  const courseRounds = rounds.filter((r) => r.courseKey === courseKey);
  const agg = useMemo(() => aggregate(courseRounds), [courseRounds]);
  const holes = useMemo(() => aggregateHoles(courseRounds), [courseRounds]);
  if (!courseRounds.length) {
    return (
      <Card>
        <button type="button" onClick={onBack} className="text-sm text-green-700 font-semibold">
          ← All courses
        </button>
        <p className="text-center text-gray-400 py-10">
          No rounds at this course match the current filters.
        </p>
      </Card>
    );
  }
  const name = courseRounds[0].courseName;
  const birdies = agg.counts.birdie + agg.counts.eagle;
  const trend18 = courseRounds.filter((r) => r.holes === 18);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="text-sm bg-white border border-gray-200 hover:border-green-600 text-green-800 font-semibold px-3 py-1.5 rounded-lg cursor-pointer"
        >
          ← All courses
        </button>
        <h2 className="text-lg font-bold text-green-900">{name}</h2>
        <span className="text-xs text-gray-500">
          {courseRounds[0].date} back to {courseRounds[courseRounds.length - 1].date}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Rounds"
          value={agg.n}
          sub={[agg.n18 ? `${agg.n18}×18` : null, agg.n9 ? `${agg.n9}×9` : null]
            .filter(Boolean)
            .join(" · ")}
        />
        <StatCard
          label="Avg score (18)"
          value={agg.avg18 != null ? agg.avg18.toFixed(1) : "—"}
          sub={
            agg.avgToPar18 != null ? `${fmtToPar(agg.avgToPar18, { decimals: 1 })} vs par` : ""
          }
        />
        <StatCard
          label="Best"
          value={agg.best18 ? agg.best18.ags : agg.best9 ? `${agg.best9.ags}` : "—"}
          sub={
            agg.best18
              ? agg.best18.date
              : agg.best9
                ? `9 holes · ${agg.best9.date}`
                : ""
          }
          tone="good"
        />
        <StatCard
          label="Birdies or better"
          value={agg.trackedRounds ? birdies : "—"}
          sub={agg.trackedRounds ? `${agg.trackedRounds} rounds tracked` : "no hole data"}
        />
        <StatCard
          label="Pars"
          value={agg.trackedRounds ? agg.counts.par : "—"}
          sub={
            agg.trackedRounds
              ? `${(agg.counts.par / agg.trackedRounds).toFixed(1)} per round`
              : ""
          }
        />
      </div>

      {trend18.length >= 3 && (
        <Card title="Score trend at this course">
          <TrendChart rounds={trend18} label="18-hole score" />
        </Card>
      )}

      <CourseYearTable rounds={courseRounds} />

      {holes.length > 0 && (
        <>
          <Card title="Average vs par by hole">
            <HoleBarChart holes={holes} />
          </Card>
          <Extremes holes={holes} />
          <Card title="Hole by hole" right={<Legend />}>
            <HoleTable holes={holes} />
          </Card>
        </>
      )}

      <Card title={`Rounds here · ${courseRounds.length}`}>
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200 text-[10px] uppercase tracking-wide">
                <th className="pb-2">Date</th>
                <th className="pb-2">Tee</th>
                <th className="pb-2 px-1.5 text-center">Holes</th>
                <th className="pb-2 px-1.5 text-right">Score</th>
                <th className="pb-2 px-1.5 text-right">To Par</th>
                <th className="pb-2 px-1.5 text-right">Birdies+</th>
                <th className="pb-2 px-1.5 text-right">Pars</th>
              </tr>
            </thead>
            <tbody>
              {courseRounds.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-1.5 font-mono text-xs text-gray-600">{r.date}</td>
                  <td className="py-1.5 text-xs text-gray-500 uppercase">{r.tee || "—"}</td>
                  <td className="py-1.5 px-1.5 text-center">
                    <HolesBadge holes={r.holes} />
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono font-bold">{r.ags}</td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-gray-600">
                    {fmtToPar(r.toPar)}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-red-500 font-semibold">
                    {r.counts ? r.counts.birdie + r.counts.eagle : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-gray-700">
                    {r.counts ? r.counts.par : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function CoursesTab({ rounds, selected, onSelect }) {
  if (selected)
    return <CourseDetail rounds={rounds} courseKey={selected} onBack={() => onSelect(null)} />;
  return <CourseList rounds={rounds} onSelect={onSelect} />;
}
