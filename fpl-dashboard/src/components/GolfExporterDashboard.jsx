/**
 * GHIN Score Exporter summary dashboard (matches ghin-app / standalone exporter UI).
 */

function computeStats(data) {
  const scores = data.scores;
  const eighteen = scores.filter((s) => s.number_of_holes === 18);
  const ags = eighteen
    .map((s) => s.adjusted_gross_score)
    .filter((n) => n != null);
  const diffs = eighteen
    .map((s) => s.differential)
    .filter((n) => n != null);

  const avg = ags.length ? ags.reduce((a, b) => a + b, 0) / ags.length : 0;
  const best = ags.length ? Math.min(...ags) : 0;
  const worst = ags.length ? Math.max(...ags) : 0;
  const avgDiff = diffs.length
    ? diffs.reduce((a, b) => a + b, 0) / diffs.length
    : 0;
  const bestDiff = diffs.length ? Math.min(...diffs) : 0;

  const buckets = {
    "70s": 0,
    "80–84": 0,
    "85–89": 0,
    "90–94": 0,
    "95–99": 0,
    "100+": 0,
  };
  ags.forEach((a) => {
    if (a < 80) buckets["70s"]++;
    else if (a < 85) buckets["80–84"]++;
    else if (a < 90) buckets["85–89"]++;
    else if (a < 95) buckets["90–94"]++;
    else if (a < 100) buckets["95–99"]++;
    else buckets["100+"]++;
  });

  const byYear = {};
  eighteen.forEach((s) => {
    const yr = s.played_at.slice(0, 4);
    if (!byYear[yr])
      byYear[yr] = { rounds: 0, totalAGS: 0, best: Infinity };
    byYear[yr].rounds++;
    byYear[yr].totalAGS += s.adjusted_gross_score ?? 0;
    if (
      s.adjusted_gross_score != null &&
      s.adjusted_gross_score < byYear[yr].best
    )
      byYear[yr].best = s.adjusted_gross_score;
  });

  const holeResults = {
    eagle: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    double: 0,
    triple: 0,
  };
  let totalHoles = 0;
  const parScoring = {
    3: { count: 0, sum: 0 },
    4: { count: 0, sum: 0 },
    5: { count: 0, sum: 0 },
  };

  scores.forEach((s) => {
    if (!s.hole_details) return;
    s.hole_details.forEach((h) => {
      totalHoles++;
      const vs = h.raw_score - h.par;
      if (vs <= -2) holeResults.eagle++;
      else if (vs === -1) holeResults.birdie++;
      else if (vs === 0) holeResults.par++;
      else if (vs === 1) holeResults.bogey++;
      else if (vs === 2) holeResults.double++;
      else holeResults.triple++;

      if (parScoring[h.par]) {
        parScoring[h.par].count++;
        parScoring[h.par].sum += h.raw_score;
      }
    });
  });

  const courses = {};
  scores.forEach((s) => {
    const name = s.course_name || s.facility_name || "Unknown";
    if (!courses[name]) courses[name] = { count: 0, totalAGS: 0, best: Infinity };
    courses[name].count++;
    courses[name].totalAGS += s.adjusted_gross_score ?? 0;
    if (
      s.adjusted_gross_score != null &&
      s.adjusted_gross_score < courses[name].best
    )
      courses[name].best = s.adjusted_gross_score;
  });
  const topCourses = Object.entries(courses)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  const recent = [...eighteen]
    .sort((a, b) => b.played_at.localeCompare(a.played_at))
    .slice(0, 10);

  const dates = scores.map((s) => s.played_at).sort();

  return {
    avg,
    best,
    worst,
    avgDiff,
    bestDiff,
    eighteenCount: eighteen.length,
    buckets,
    byYear,
    holeResults,
    totalHoles,
    parScoring,
    topCourses,
    recent,
    dateRange: { from: dates[0] || "—", to: dates[dates.length - 1] || "—" },
  };
}

function Card({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${className}`}
    >
      {title ? (
        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
          {title}
        </h3>
      ) : null}
      {children}
    </div>
  );
}

function StatBox({ label, value, sub }) {
  return (
    <div className="text-center">
      <div className="text-3xl font-bold text-green-800">{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

export function GolfExporterDashboard({ data, onDownload }) {
  const s = computeStats(data);
  const g = data.golfer || {};
  const maxBucket = Math.max(...Object.values(s.buckets), 1);

  const holeRows = [
    ["Eagle+", s.holeResults.eagle, "text-yellow-600 bg-yellow-100"],
    ["Birdie", s.holeResults.birdie, "text-red-600 bg-red-50"],
    ["Par", s.holeResults.par, "text-green-700 bg-green-50"],
    ["Bogey", s.holeResults.bogey, "text-blue-600 bg-blue-50"],
    ["Double", s.holeResults.double, "text-orange-600 bg-orange-50"],
    ["Triple+", s.holeResults.triple, "text-gray-600 bg-gray-100"],
  ];

  return (
    <div className="space-y-6">
      <header className="bg-green-800 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            {g.first_name} {g.last_name}
          </h2>
          <p className="text-green-200 text-sm">
            GHIN #{g.ghin_number ?? "—"} &bull; {g.club_name || "No club"}
          </p>
          <p className="text-green-300 text-xs mt-1">
            {s.dateRange.from} to {s.dateRange.to} &bull; {data.total_scores}{" "}
            rounds
          </p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold">{g.handicap_index ?? "—"}</div>
          <div className="text-green-200 text-xs">Handicap Index</div>
        </div>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="!p-4">
          <StatBox
            label="Avg Score"
            value={s.eighteenCount ? s.avg.toFixed(1) : "—"}
            sub="18-hole"
          />
        </Card>
        <Card className="!p-4">
          <StatBox
            label="Best Round"
            value={s.eighteenCount ? s.best : "—"}
            sub="18-hole"
          />
        </Card>
        <Card className="!p-4">
          <StatBox
            label="Avg Differential"
            value={s.eighteenCount ? s.avgDiff.toFixed(1) : "—"}
          />
        </Card>
        <Card className="!p-4">
          <StatBox
            label="Best Differential"
            value={s.eighteenCount ? s.bestDiff.toFixed(1) : "—"}
          />
        </Card>
      </div>

      <Card title="Scoring Distribution (18-hole)">
        <div className="space-y-2">
          {Object.entries(s.buckets).map(([label, count]) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <span className="w-14 text-right font-mono text-gray-600">
                {label}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${(count / maxBucket) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-mono text-gray-500">
                {count}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Year-by-Year Trends">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Year</th>
                <th className="pb-2 text-center">Rounds</th>
                <th className="pb-2 text-right">Avg</th>
                <th className="pb-2 text-right">Best</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(s.byYear)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([yr, d]) => (
                  <tr key={yr} className="border-b border-gray-50">
                    <td className="py-1.5 font-medium">{yr}</td>
                    <td className="py-1.5 text-center text-gray-600">
                      {d.rounds}
                    </td>
                    <td className="py-1.5 text-right font-mono">
                      {(d.totalAGS / d.rounds).toFixed(1)}
                    </td>
                    <td className="py-1.5 text-right font-mono text-green-700">
                      {d.best === Infinity ? "—" : d.best}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>

        <Card title={`Hole-by-Hole Breakdown (${s.totalHoles} holes)`}>
          {s.totalHoles === 0 ? (
            <p className="text-sm text-gray-400">
              No hole-by-hole data available.
            </p>
          ) : (
            <div className="space-y-2">
              {holeRows.map(([label, count, colors]) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`w-16 text-center text-xs font-semibold px-2 py-0.5 rounded-full ${colors}`}
                  >
                    {label}
                  </span>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-green-400 h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${(count / s.totalHoles) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-mono text-gray-500">
                    {count}{" "}
                    <span className="text-gray-400">
                      ({((count / s.totalHoles) * 100).toFixed(0)}%)
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Average Score by Par">
        <div className="grid grid-cols-3 gap-4 text-center">
          {[3, 4, 5].map((p) => {
            const d = s.parScoring[p];
            if (!d || d.count === 0) return null;
            const avg = d.sum / d.count;
            const over = avg - p;
            return (
              <div key={p} className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-500 mb-1">
                  PAR {p}
                </div>
                <div className="text-2xl font-bold text-green-800">
                  {avg.toFixed(2)}
                </div>
                <div className="text-xs text-gray-400">
                  +{over.toFixed(2)} over &bull; {d.count} holes
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Most Played Courses">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="pb-2">Course</th>
              <th className="pb-2 text-center">Rounds</th>
              <th className="pb-2 text-right">Avg</th>
              <th className="pb-2 text-right">Best</th>
            </tr>
          </thead>
          <tbody>
            {s.topCourses.map(([name, d]) => (
              <tr key={name} className="border-b border-gray-50">
                <td className="py-1.5 font-medium truncate max-w-[200px]">
                  {name}
                </td>
                <td className="py-1.5 text-center text-gray-600">{d.count}</td>
                <td className="py-1.5 text-right font-mono">
                  {(d.totalAGS / d.count).toFixed(1)}
                </td>
                <td className="py-1.5 text-right font-mono text-green-700">
                  {d.best === Infinity ? "—" : d.best}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Recent Rounds">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Date</th>
                <th className="pb-2">Course</th>
                <th className="pb-2 text-right">Score</th>
                <th className="pb-2 text-right">Diff</th>
                <th className="pb-2 text-center">Used</th>
              </tr>
            </thead>
            <tbody>
              {s.recent.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="py-1.5 font-mono text-gray-600">
                    {r.played_at}
                  </td>
                  <td className="py-1.5 font-medium truncate max-w-[180px]">
                    {r.course_name || r.facility_name}
                  </td>
                  <td className="py-1.5 text-right font-mono font-bold">
                    {r.adjusted_gross_score}
                  </td>
                  <td className="py-1.5 text-right font-mono text-gray-600">
                    {r.differential != null
                      ? Number(r.differential).toFixed(1)
                      : "—"}
                  </td>
                  <td className="py-1.5 text-center">
                    {r.used ? (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                    ) : (
                      <span className="inline-block w-2 h-2 bg-gray-200 rounded-full" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pb-4">
        <button
          type="button"
          onClick={onDownload}
          className="bg-green-700 hover:bg-green-600 text-white font-semibold px-8 py-3 rounded-xl transition-colors flex items-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
            />
          </svg>
          Download Full JSON
        </button>
      </div>
    </div>
  );
}
