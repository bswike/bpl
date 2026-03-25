import { useState, useEffect, useMemo, useRef } from "react";
import { GolfExporterDashboard } from "./GolfExporterDashboard";

const scoreToPar = (score, par) => {
  const d = score - par;
  if (d <= -2) return "eagle";
  if (d === -1) return "birdie";
  if (d === 0) return "par";
  if (d === 1) return "bogey";
  if (d === 2) return "double";
  return "triple";
};
const RC = {
  eagle: "#d4af37",
  birdie: "#e74c3c",
  par: "#22c55e",
  bogey: "#3b82f6",
  double: "#8b5cf6",
  triple: "#6b7280",
};
const RL = {
  eagle: "Eagle+",
  birdie: "Birdie",
  par: "Par",
  bogey: "Bogey",
  double: "Double",
  triple: "Triple+",
};

const KNOWN_COURSES = {
  "Suntree CC - Classic": [4, 5, 3, 4, 5, 4, 3, 4, 4, 5, 4, 4, 4, 3, 4, 3, 4, 5],
  "Suntree CC - Challenge": [4, 3, 4, 4, 5, 4, 5, 3, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5],
};

function identifyCourse(score) {
  if (score.course_name) return score.course_name;
  if (score.facility_name) return score.facility_name;
  if (score.course_display_value) return score.course_display_value;

  const hds = score.hole_details;
  if (hds?.length >= 9) {
    const sorted = [...hds].sort((a, b) => a.hole_number - b.hole_number);
    const pars = sorted.map((h) => h.par);

    if (pars.length >= 18) {
      const p18 = pars.slice(0, 18);
      for (const [name, known] of Object.entries(KNOWN_COURSES)) {
        if (known.length === 18 && known.every((p, i) => p === p18[i]))
          return name;
      }
    }

    const p9 = pars.slice(0, Math.min(pars.length, 18));
    for (const [name, known] of Object.entries(KNOWN_COURSES)) {
      const front = known.slice(0, 9);
      const back = known.slice(9, 18);
      if (p9.length >= 9) {
        if (front.every((p, i) => p === p9[i])) return name + " (Front)";
        if (back.every((p, i) => p === p9[i])) return name + " (Back)";
      }
    }
  }

  return `CR ${score.course_rating} / Slope ${score.slope_rating}`;
}

function LandingPage({ onLoad }) {
  const fileRef = useRef();
  const [tab, setTab] = useState("login");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ghinNumber, setGhinNumber] = useState("");

  const processFile = (file) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.scores?.length) {
          setError("No scores found in file.");
          return;
        }
        onLoad(data);
      } catch {
        setError("Could not parse JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setLoadingMsg("Authenticating with GHIN...");
    try {
      const res = await fetch("/api/ghin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          ghinNumber: ghinNumber.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      setLoadingMsg("Processing scores...");
      const data = await res.json();
      if (!data.scores?.length)
        throw new Error("No scores found for this GHIN number.");
      onLoad(data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setLoadingMsg("");
    }
  };

  const tabBtn =
    "flex-1 py-2.5 text-sm font-medium transition-colors border-none cursor-pointer";
  const tabInactive = "bg-gray-50 text-gray-500 hover:text-gray-700";
  const tabActive = "bg-green-50 text-green-800 font-semibold";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 max-w-md w-full min-w-0 mx-auto">
      <div className="text-5xl mb-1 text-center">⛳</div>
      <h1 className="text-2xl font-bold text-center text-gray-900 tracking-tight">
        GHIN Score Exporter
      </h1>
      <p className="text-xs text-gray-500 text-center uppercase tracking-widest mt-1">
        Sign in or upload JSON
      </p>

      <div className="flex mt-6 rounded-lg overflow-hidden border border-gray-200">
        <button
          type="button"
          className={`${tabBtn} ${tab === "login" ? tabActive : tabInactive}`}
          onClick={() => {
            setTab("login");
            setError(null);
          }}
        >
          Sign In to GHIN
        </button>
        <button
          type="button"
          className={`${tabBtn} ${tab === "file" ? tabActive : tabInactive}`}
          onClick={() => {
            setTab("file");
            setError(null);
          }}
        >
          Upload File
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {tab === "login" && (
        <form onSubmit={handleLogin} className="mt-5 space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GHIN email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GHIN number{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={ghinNumber}
              onChange={(e) => setGhinNumber(e.target.value)}
              placeholder="Only if you have several golfers or auto-detect fails"
              disabled={loading}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {loading ? loadingMsg : "Fetch My Scores"}
          </button>
          <p className="text-xs text-gray-400 text-center">
            Credentials go to GHIN only; nothing is stored on this server.
          </p>
        </form>
      )}

      {tab === "file" && (
        <div className="mt-5 space-y-4 text-left">
          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="w-7 h-7 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold shrink-0">
              1
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">
                Run the fetcher locally (optional)
              </div>
              <code className="block mt-1 text-[11px] font-mono bg-gray-900 text-green-100 rounded px-2 py-1.5 whitespace-pre overflow-x-auto max-w-full">
                npm install @spicygolf/ghin{"\n"}node fetch-ghin-scores.mjs
              </code>
            </div>
          </div>
          <div className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="w-7 h-7 rounded-full bg-green-100 text-green-800 flex items-center justify-center text-xs font-bold shrink-0">
              2
            </div>
            <div className="text-sm font-semibold text-gray-800">
              Drop your JSON file below
            </div>
          </div>
          <button
            type="button"
            className={`w-full border-2 border-dashed rounded-xl py-8 px-4 text-center cursor-pointer transition-colors ${
              dragging
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300 bg-gray-50/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current?.click()}
          >
            <div className="text-2xl mb-2 opacity-50">📂</div>
            <div className="font-semibold text-gray-800">
              Drop <span className="text-green-700">ghin-scores.json</span> here
            </div>
            <div className="text-xs text-gray-400 mt-1">or click to browse</div>
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) processFile(e.target.files[0]);
              }}
            />
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCards({ stats }) {
  const cards = [
    {
      label: "Rounds",
      value: stats.rounds,
      sub:
        stats.e18 > 0 && stats.n9 > 0
          ? `${stats.e18} × 18  •  ${stats.n9} × 9`
          : stats.e18 > 0
            ? `${stats.e18} × 18`
            : `${stats.n9} × 9`,
    },
    {
      label: "Avg Score (18)",
      value: stats.avg18 ? stats.avg18.toFixed(1) : "—",
      sub: stats.best18 ? `Best: ${stats.best18}` : "",
    },
    {
      label: "Avg vs Par",
      value:
        stats.vsPar != null
          ? (stats.vsPar > 0 ? "+" : "") + stats.vsPar.toFixed(1)
          : "—",
      sub: stats.par ? `Par ${stats.par}` : "",
      color:
        stats.vsPar != null
          ? stats.vsPar > 0
            ? "text-red-600"
            : "text-green-600"
          : "text-green-800",
    },
    {
      label: "Total Holes",
      value: stats.totalHoles,
      sub: `across ${stats.roundsWithHoles} rounds`,
    },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {cards.map((c, i) => (
        <div
          key={i}
          className="bg-gray-50 rounded-xl border border-gray-100 px-4 py-3"
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-1">
            {c.label}
          </div>
          <div
            className={`text-2xl font-bold font-mono ${c.color || "text-green-800"}`}
          >
            {c.value}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function BarChart({ holes }) {
  if (!holes.length) return null;
  const mx = Math.max(...holes.map((h) => Math.abs(h.avg - h.par)), 0.5);
  const sc = 80 / mx;
  return (
    <div className="mb-8 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Scoring vs Par
      </h3>
      <p className="text-xs text-gray-400 mb-2 sm:hidden">
        Scroll sideways to see all holes
      </p>
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-gray-200 bg-gray-50/50 touch-pan-x">
        <div className="inline-flex items-end gap-2 h-[180px] pt-5 pb-1 px-3 min-h-[180px] border-b border-gray-200">
          {holes.map((h) => {
            const d = h.avg - h.par;
            const over = d > 0;
            return (
              <div
                key={h.hole}
                className="flex w-11 shrink-0 flex-col items-center h-full justify-end"
              >
                <div
                  className={`text-[9px] mb-0.5 font-mono tabular-nums ${over ? "text-red-600" : "text-green-600"}`}
                >
                  {d > 0 ? "+" : ""}
                  {d.toFixed(1)}
                </div>
                <div
                  className="w-[70%] max-w-[28px] rounded-t"
                  style={{
                    height: Math.max(Math.abs(d) * sc, 2),
                    background: over
                      ? "linear-gradient(to top,#dc2626,#f87171)"
                      : "linear-gradient(to top,#166534,#22c55e)",
                  }}
                />
                <div className="text-[10px] mt-1.5 font-bold text-gray-500 font-mono tabular-nums">
                  {h.hole}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Extremes({ holes }) {
  const sorted = [...holes].sort(
    (a, b) => b.avg - b.par - (a.avg - a.par)
  );
  const tough = sorted.slice(0, 3);
  const easy = sorted.slice(-3).reverse();
  const List = ({ items, icon, colorClass }) => (
    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
      <div className="text-sm font-bold text-gray-800 mb-3">{icon}</div>
      {items.map((h, i) => {
        const d = h.avg - h.par;
        return (
          <div
            key={h.hole}
            className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
          >
            <span className="text-[10px] text-gray-400 font-mono w-5">
              #{i + 1}
            </span>
            <span className="font-bold flex-1 text-gray-800">Hole {h.hole}</span>
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
    <div className="grid sm:grid-cols-2 gap-3 mb-8">
      <List items={tough} icon="🔥 Toughest Holes" colorClass="text-red-600" />
      <List items={easy} icon="💪 Best Holes" colorClass="text-green-600" />
    </div>
  );
}

function DistBar({ dist, total }) {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (
    <div className="flex items-center gap-2 h-6">
      <div className="flex flex-1 h-4 rounded overflow-hidden bg-gray-100">
        {order.map((k) => {
          const c = dist[k] || 0;
          if (!c) return null;
          return (
            <div
              key={k}
              title={`${RL[k]}: ${c}`}
              className="min-w-[2px]"
              style={{
                width: `${(c / total) * 100}%`,
                background: RC[k],
              }}
            />
          );
        })}
      </div>
      <div className="flex gap-1 text-[10px] text-gray-500 whitespace-nowrap min-w-[72px] justify-end">
        {order.map((k) => {
          const c = dist[k] || 0;
          if (!c) return null;
          return (
            <span key={k} style={{ color: RC[k] }}>
              {c}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function HoleTable({ holes, mode }) {
  if (!holes.length) return null;
  const maxHole = Math.max(...holes.map((h) => h.hole));
  const isFull18 = maxHole >= 18 && holes.length >= 18;
  const nines = isFull18
    ? [holes.filter((h) => h.hole <= 9), holes.filter((h) => h.hole > 9)]
    : [holes];
  const nineLabels = isFull18 ? ["Front 9", "Back 9"] : ["Holes"];

  const th =
    "pb-2 text-[9px] uppercase tracking-wide text-gray-500 font-bold text-left border-b border-gray-200";

  return (
    <div>
      {nines.map((nine, ni) => {
        if (!nine.length) return null;
        const nP = nine.reduce((s, h) => s + h.par, 0);
        const nA = nine.reduce((s, h) => s + h.avg, 0);
        const nD = nA - nP;
        return (
          <div key={ni} className="mb-7">
            <div className="flex justify-between items-center mb-2 px-3 py-2 bg-green-50 rounded-lg border-l-4 border-green-600">
              <span className="font-bold text-sm text-gray-900">
                {nineLabels[ni]}
              </span>
              <span className="text-xs text-gray-600 font-mono">
                Par {nP} • Avg {nA.toFixed(1)} •{" "}
                <span
                  className={
                    nD > 0 ? "text-red-600 font-bold" : "text-green-600 font-bold"
                  }
                >
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
                    {mode === "dist" ? (
                      <th className={`${th} min-w-[220px]`}>Distribution</th>
                    ) : (
                      <>
                        <th className={`${th} w-11 text-center`}>Best</th>
                        <th className={`${th} w-11 text-center`}>Wrst</th>
                        <th className={`${th} w-12 text-center`}>Putts</th>
                        <th className={`${th} w-11 text-center`}>GIR</th>
                        <th className={`${th} w-11 text-center`}>FIR</th>
                      </>
                    )}
                    <th className={`${th} w-8 text-center`}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {nine.map((h) => {
                    const vp = h.avg - h.par;
                    const vc =
                      vp > 0.5
                        ? "text-red-600"
                        : vp < -0.05
                          ? "text-green-600"
                          : "text-amber-600";
                    return (
                      <tr
                        key={h.hole}
                        className="border-b border-gray-50 hover:bg-gray-50/80"
                      >
                        <td className="py-2 text-center font-mono font-bold text-gray-900">
                          {h.hole}
                        </td>
                        <td className="py-2 text-center text-gray-600">
                          {h.par}
                        </td>
                        <td className="py-2 text-center text-gray-400 text-xs">
                          {h.sa || "—"}
                        </td>
                        <td className="py-2 text-center font-mono font-bold text-gray-900">
                          {h.avg.toFixed(2)}
                        </td>
                        <td className={`py-2 text-center font-mono font-bold ${vc}`}>
                          {vp > 0 ? "+" : ""}
                          {vp.toFixed(2)}
                        </td>
                        {mode === "dist" ? (
                          <td className="py-2 pr-2">
                            <DistBar dist={h.distribution} total={h.count} />
                          </td>
                        ) : (
                          <>
                            <td className="py-2 text-center text-green-600 font-medium">
                              {h.best}
                            </td>
                            <td className="py-2 text-center text-red-600 font-medium">
                              {h.worst}
                            </td>
                            <td className="py-2 text-center text-gray-700">
                              {h.avgPutts != null ? h.avgPutts.toFixed(1) : "—"}
                            </td>
                            <td className="py-2 text-center text-gray-700">
                              {h.girPct != null
                                ? h.girPct.toFixed(0) + "%"
                                : "—"}
                            </td>
                            <td className="py-2 text-center text-gray-700">
                              {h.firPct != null
                                ? h.firPct.toFixed(0) + "%"
                                : "—"}
                            </td>
                          </>
                        )}
                        <td className="py-2 text-center text-gray-400 text-xs">
                          {h.count}
                        </td>
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

function Trend({ scores }) {
  const e18 = scores
    .filter(
      (s) =>
        (s.number_of_holes === 18 || s.number_of_played_holes === 18) &&
        s.adjusted_gross_score
    )
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  if (e18.length < 3) return null;
  const vals = e18.map((s) => s.adjusted_gross_score);
  const mn = Math.min(...vals) - 2;
  const mx = Math.max(...vals) + 2;
  const rng = mx - mn;
  const W = 700;
  const H = 140;
  const p = { t: 10, r: 10, b: 24, l: 36 };
  const pW = W - p.l - p.r;
  const pH = H - p.t - p.b;
  const pts = e18.map((s, i) => ({
    x: p.l + (i / (e18.length - 1)) * pW,
    y: p.t + (1 - (s.adjusted_gross_score - mn) / rng) * pH,
    sc: s.adjusted_gross_score,
    d: s.played_at,
  }));
  const pathD = pts
    .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`)
    .join(" ");
  const svgW = Math.min(1400, Math.max(720, e18.length * 36));
  const svgH = (svgW * H) / W;
  return (
    <div className="mb-8 min-w-0">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
        Score trend (this course)
      </h3>
      <p className="text-xs text-gray-400 mb-2 sm:hidden">
        Scroll sideways to see the full chart
      </p>
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-gray-200 bg-gray-50/50 touch-pan-x">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${W} ${H}`}
          className="block shrink-0"
          preserveAspectRatio="xMinYMid meet"
        >
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = p.t + (1 - pct) * pH;
          return (
            <g key={pct}>
              <line
                x1={p.l}
                x2={W - p.r}
                y1={y}
                y2={y}
                stroke="#e5e7eb"
              />
              <text
                x={p.l - 4}
                y={y + 3}
                textAnchor="end"
                fill="#9ca3af"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
              >
                {Math.round(mn + pct * rng)}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke="#15803d"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        {pts.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill="#16a34a" opacity={0.85}>
            <title>{`${pt.d}: ${pt.sc}`}</title>
          </circle>
        ))}
        {[pts[0], pts[pts.length - 1]].map((pt, i) => (
          <text
            key={i}
            x={pt.x}
            y={H - 4}
            textAnchor={i === 0 ? "start" : "end"}
            fill="#9ca3af"
            fontSize={9}
          >
            {new Date(pt.d).toLocaleDateString("en-US", {
              month: "short",
              year: "2-digit",
            })}
          </text>
        ))}
        </svg>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex gap-3 flex-wrap">
      {["eagle", "birdie", "par", "bogey", "double", "triple"].map((k) => (
        <div key={k} className="flex items-center gap-1.5 text-[11px] text-gray-600">
          <div
            className="w-2 h-2 rounded-sm"
            style={{ background: RC[k] }}
          />
          {RL[k]}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(null);
  const [course, setCourse] = useState(null);
  const [mode, setMode] = useState("stats");

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prevHtml = html.style.overflowX;
    const prevBody = body.style.overflowX;
    const prevRoot = root?.style.overflowX ?? "";
    html.style.overflowX = "hidden";
    body.style.overflowX = "hidden";
    if (root) {
      root.style.overflowX = "hidden";
      root.style.maxWidth = "100%";
    }
    return () => {
      html.style.overflowX = prevHtml;
      body.style.overflowX = prevBody;
      if (root) {
        root.style.overflowX = prevRoot;
        root.style.maxWidth = "";
      }
    };
  }, []);

  const courses = useMemo(() => {
    if (!data) return [];
    const m = {};
    data.scores.forEach((s) => {
      const name = identifyCourse(s);
      if (!m[name])
        m[name] = { id: name, name, rounds: 0, totalHoles: 0, e18: 0, n9: 0 };
      m[name].rounds++;
      m[name].totalHoles += s.hole_details?.length || 0;
      if (s.number_of_holes === 9) m[name].n9++;
      else m[name].e18++;
    });
    return Object.values(m).sort((a, b) => b.rounds - a.rounds);
  }, [data]);

  useEffect(() => {
    if (courses.length && !course) {
      const st = courses.find((c) => /suntree/i.test(c.name));
      setCourse(st ? st.id : courses[0].id);
    }
  }, [courses, course]);

  const filtered = useMemo(() => {
    if (!data || !course) return [];
    return data.scores.filter((s) => identifyCourse(s) === course);
  }, [data, course]);

  const holes = useMemo(() => {
    const h = {};
    filtered.forEach((sc) => {
      if (!sc.hole_details?.length) return;
      sc.hole_details.forEach((hd) => {
        const n = hd.hole_number;
        if (!n || n < 1 || n > 18) return;
        if (!h[n])
          h[n] = {
            hole: n,
            scores: [],
            putts: [],
            gir: [],
            fir: [],
            par: null,
            sa: null,
          };
        const v = hd.raw_score || hd.adjusted_gross_score;
        if (v > 0) h[n].scores.push(v);
        if (hd.par) h[n].par = hd.par;
        if (hd.stroke_allocation) h[n].sa = hd.stroke_allocation;
        if (hd.putts != null && hd.putts > 0) h[n].putts.push(hd.putts);
        if (hd.gir_flag != null) h[n].gir.push(hd.gir_flag ? 1 : 0);
        if (hd.fairway_hit != null) h[n].fir.push(hd.fairway_hit ? 1 : 0);
      });
    });
    return Object.values(h)
      .sort((a, b) => a.hole - b.hole)
      .filter((x) => x.scores.length > 0)
      .map((x) => {
        const avg = x.scores.reduce((a, b) => a + b, 0) / x.scores.length;
        const dist = {};
        x.scores.forEach((s) => {
          const k = scoreToPar(s, x.par);
          dist[k] = (dist[k] || 0) + 1;
        });
        return {
          hole: x.hole,
          par: x.par || 4,
          sa: x.sa,
          avg,
          best: Math.min(...x.scores),
          worst: Math.max(...x.scores),
          count: x.scores.length,
          avgPutts: x.putts.length
            ? x.putts.reduce((a, b) => a + b, 0) / x.putts.length
            : null,
          girPct: x.gir.length
            ? (x.gir.reduce((a, b) => a + b, 0) / x.gir.length) * 100
            : null,
          firPct: x.fir.length
            ? (x.fir.reduce((a, b) => a + b, 0) / x.fir.length) * 100
            : null,
          distribution: dist,
        };
      });
  }, [filtered]);

  const stats = useMemo(() => {
    const e18 = filtered.filter(
      (s) => s.number_of_holes === 18 || s.number_of_played_holes === 18
    );
    const n9 = filtered.filter(
      (s) => s.number_of_holes === 9 || s.number_of_played_holes === 9
    );
    const t = e18.map((s) => s.adjusted_gross_score).filter(Boolean);
    const par =
      holes.length >= 18
        ? holes.filter((h) => h.hole <= 18).reduce((s, h) => s + h.par, 0)
        : null;
    const roundsWithHoles = filtered.filter(
      (s) => s.hole_details?.length > 0
    ).length;
    const totalHoles = filtered.reduce(
      (sum, s) => sum + (s.hole_details?.length || 0),
      0
    );
    return {
      rounds: filtered.length,
      e18: e18.length,
      n9: n9.length,
      avg18: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null,
      best18: t.length ? Math.min(...t) : null,
      vsPar:
        t.length && par
          ? t.reduce((a, b) => a + b, 0) / t.length - par
          : null,
      par,
      totalHoles,
      roundsWithHoles,
    };
  }, [filtered, holes]);

  const handleDownload = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ghin-scores-${data.golfer?.ghin_number || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setData(null);
    setCourse(null);
  };

  if (!data) {
    return (
      <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
        <header className="bg-green-800 text-white shrink-0 w-full min-w-0">
          <div className="max-w-4xl mx-auto px-4 py-6 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              GHIN Score Exporter
            </h1>
            <p className="text-green-200 text-sm mt-0.5">
              Export &amp; analyze your golf handicap scores
            </p>
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-4 py-10 min-w-0 w-full">
          <LandingPage
            onLoad={(d) => {
              setData(d);
              setCourse(null);
            }}
          />
        </div>
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 shrink-0">
          GHIN Score Exporter — Not affiliated with the USGA or GHIN
        </footer>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full min-w-0 overflow-x-hidden bg-[#f8faf8] text-gray-900 flex flex-col">
      <header className="bg-green-800 text-white shrink-0 w-full min-w-0">
        <div className="max-w-4xl mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3 min-w-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              GHIN Score Exporter
            </h1>
            <p className="text-green-200 text-sm">
              Export &amp; analyze your golf handicap scores
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            className="text-sm bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            New export
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-4xl w-full min-w-0 mx-auto px-4 py-8">
        <GolfExporterDashboard data={data} onDownload={handleDownload} />

        <section className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-lg font-bold text-green-900 mb-1">
            Hole-by-hole by course
          </h2>
          <p className="text-sm text-gray-500 mb-5">
            Deep dive into a single course — averages, trends, and distributions.
          </p>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6 min-w-0 overflow-x-hidden">
            <div className="flex flex-wrap gap-4 mb-6 items-end min-w-0">
              <div className="flex flex-col gap-1 min-w-0 flex-1 basis-full sm:basis-auto max-w-full">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  Course
                </label>
                <select
                  value={course || ""}
                  onChange={(e) => setCourse(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.rounds} rds (
                      {c.e18 > 0 ? `${c.e18}×18` : ""}
                      {c.e18 > 0 && c.n9 > 0 ? ", " : ""}
                      {c.n9 > 0 ? `${c.n9}×9` : ""}) • {c.totalHoles} holes
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                  View
                </label>
                <div className="flex rounded-lg overflow-hidden border border-gray-200">
                  {[
                    ["stats", "Stats"],
                    ["dist", "Distribution"],
                  ].map(([k, l]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setMode(k)}
                      className={`px-4 py-2 text-xs font-medium border-none cursor-pointer ${
                        mode === k
                          ? "bg-green-50 text-green-800 font-semibold"
                          : "bg-white text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="text-center text-gray-400 py-12">
                No data for this selection.
              </p>
            ) : (
              <>
                <SummaryCards stats={stats} />
                <Trend scores={filtered} />
                {holes.length > 0 && (
                  <>
                    <BarChart holes={holes} />
                    <Extremes holes={holes} />
                    <div className="mt-6">
                      <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
                          Hole detail
                        </h3>
                        {mode === "dist" && <Legend />}
                      </div>
                      <HoleTable holes={holes} mode={mode} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100 shrink-0">
        GHIN Score Exporter — Not affiliated with the USGA or GHIN
      </footer>
    </main>
  );
}
