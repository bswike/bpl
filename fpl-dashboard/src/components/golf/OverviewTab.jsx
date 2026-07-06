import { useMemo } from "react";
import {
  aggregate,
  groupBy,
  fmtToPar,
  RESULT_ORDER,
  RESULT_COLORS,
  RESULT_LABELS,
} from "./data";
import { Card, StatCard } from "./ui";
import { TrendChart } from "./charts";

function ScoreBuckets({ rounds }) {
  const scores = rounds.filter((r) => r.holes === 18).map((r) => r.ags);
  if (!scores.length) return null;
  const buckets = [
    ["<80", (s) => s < 80],
    ["80–84", (s) => s >= 80 && s < 85],
    ["85–89", (s) => s >= 85 && s < 90],
    ["90–94", (s) => s >= 90 && s < 95],
    ["95–99", (s) => s >= 95 && s < 100],
    ["100+", (s) => s >= 100],
  ].map(([label, fn]) => [label, scores.filter(fn).length]);
  const max = Math.max(...buckets.map(([, c]) => c), 1);
  return (
    <Card title={`Score distribution · ${scores.length} rounds of 18`}>
      <div className="space-y-2">
        {buckets.map(([label, count]) => (
          <div key={label} className="flex items-center gap-3 text-sm">
            <span className="w-14 text-right font-mono text-gray-600 text-xs">{label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
              <div
                className="bg-green-500 h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-gray-500 text-xs">{count}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ResultsBreakdown({ agg }) {
  if (!agg.trackedHoles) return null;
  return (
    <Card
      title={`Hole results · ${agg.trackedHoles} holes tracked`}
      className="min-w-0"
    >
      <div className="space-y-2">
        {RESULT_ORDER.map((k) => {
          const count = agg.counts[k];
          const pct = (count / agg.trackedHoles) * 100;
          return (
            <div key={k} className="flex items-center gap-3 text-sm">
              <span
                className="w-16 text-center text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ background: RESULT_COLORS[k] }}
              >
                {RESULT_LABELS[k]}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, background: RESULT_COLORS[k], opacity: 0.75 }}
                />
              </div>
              <span className="w-20 text-right text-xs font-mono text-gray-500">
                {count} <span className="text-gray-400">({pct.toFixed(0)}%)</span>
              </span>
            </div>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-3 mt-4 text-center">
        {[3, 4, 5].map((p) => {
          const d = agg.parScoring[p];
          if (!d?.n) return null;
          const a = d.sum / d.n;
          return (
            <div key={p} className="bg-gray-50 rounded-xl px-2 py-3">
              <div className="text-[10px] font-semibold text-gray-500">PAR {p}s</div>
              <div className="text-xl font-bold font-mono text-green-900">{a.toFixed(2)}</div>
              <div className="text-[10px] text-gray-400">
                {fmtToPar(a - p, { decimals: 2 })} · {d.n} holes
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function YearTable({ rounds }) {
  const byYear = groupBy(rounds, (r) => r.year);
  const years = Object.keys(byYear).sort().reverse();
  if (years.length < 2) return null;
  return (
    <Card title="Year by year">
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 text-[10px] uppercase tracking-wide">
              <th className="pb-2">Year</th>
              <th className="pb-2 px-1.5 text-center">Rounds</th>
              <th className="pb-2 px-1.5 text-right">Avg (18)</th>
              <th className="pb-2 px-1.5 text-right">Best</th>
              <th className="pb-2 px-1.5 text-right">Avg Diff</th>
              <th className="pb-2 px-1.5 text-right">Birdies+</th>
              <th className="pb-2 px-1.5 text-right">Pars/rd</th>
            </tr>
          </thead>
          <tbody>
            {years.map((yr) => {
              const a = aggregate(byYear[yr]);
              const birdies = a.counts.birdie + a.counts.eagle;
              return (
                <tr key={yr} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="py-1.5 font-semibold">{yr}</td>
                  <td className="py-1.5 px-1.5 text-center text-gray-600">
                    {a.n18 > 0 && `${a.n18}×18`}
                    {a.n18 > 0 && a.n9 > 0 && ", "}
                    {a.n9 > 0 && `${a.n9}×9`}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono">
                    {a.avg18 != null ? a.avg18.toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-green-700 font-semibold">
                    {a.best18 ? a.best18.ags : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-gray-600">
                    {a.avgDiff != null ? a.avgDiff.toFixed(1) : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-red-500 font-semibold">
                    {a.trackedRounds ? birdies : "—"}
                  </td>
                  <td className="py-1.5 px-1.5 text-right font-mono text-gray-600">
                    {a.trackedRounds ? (a.counts.par / a.trackedRounds).toFixed(1) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-gray-400 mt-2">
        Birdies+ and Pars/rd only count rounds with hole-by-hole data.
      </p>
    </Card>
  );
}

export default function OverviewTab({ rounds, yearRounds }) {
  const agg = useMemo(() => aggregate(rounds), [rounds]);
  const trend18 = rounds.filter((r) => r.holes === 18);
  const trend9 = rounds.filter((r) => r.holes === 9);
  const birdies = agg.counts.birdie + agg.counts.eagle;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
          sub={agg.avgToPar18 != null ? `${fmtToPar(agg.avgToPar18, { decimals: 1 })} vs par` : ""}
        />
        <StatCard
          label="Best 18"
          value={agg.best18 ? agg.best18.ags : "—"}
          sub={
            agg.best18 ? `${agg.best18.courseName} · ${agg.best18.date.slice(0, 7)}` : ""
          }
          tone="good"
        />
        {agg.n9 > 0 ? (
          <StatCard
            label="Avg score (9)"
            value={agg.avg9 != null ? agg.avg9.toFixed(1) : "—"}
            sub={agg.best9 ? `Best: ${agg.best9.ags}` : ""}
          />
        ) : (
          <StatCard
            label="Avg differential"
            value={agg.avgDiff != null ? agg.avgDiff.toFixed(1) : "—"}
            sub={agg.bestDiff != null ? `Best: ${agg.bestDiff.toFixed(1)}` : ""}
          />
        )}
        <StatCard
          label="Birdies or better"
          value={agg.trackedRounds ? birdies : "—"}
          sub={
            agg.trackedRounds
              ? `${(birdies / agg.trackedRounds).toFixed(2)} per round`
              : "no hole data"
          }
        />
        <StatCard
          label="Pars per round"
          value={agg.trackedRounds ? (agg.counts.par / agg.trackedRounds).toFixed(1) : "—"}
          sub={agg.trackedRounds ? `${agg.trackedRounds} rounds tracked` : "no hole data"}
        />
      </div>

      {trend18.length >= 3 && (
        <Card title={`Score trend · 18-hole rounds (${trend18.length})`}>
          <TrendChart rounds={trend18} label="18-hole score" />
        </Card>
      )}
      {trend18.length < 3 && trend9.length >= 3 && (
        <Card title={`Score trend · 9-hole rounds (${trend9.length})`}>
          <TrendChart rounds={trend9} label="9-hole score" />
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-5 min-w-0">
        <ScoreBuckets rounds={rounds} />
        <ResultsBreakdown agg={agg} />
      </div>

      <YearTable rounds={yearRounds} />
    </div>
  );
}
