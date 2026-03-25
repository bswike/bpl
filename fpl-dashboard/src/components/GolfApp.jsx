import { useState, useEffect, useMemo, useRef } from "react";

// ── Utility ────────────────────────────────────────────────────────
const scoreToPar = (score, par) => {
  const diff = score - par;
  if (diff <= -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "double";
  return "triple";
};

const resultColors = {
  eagle: "#d4af37",
  birdie: "#e74c3c",
  par: "#27ae60",
  bogey: "#3498db",
  double: "#8e44ad",
  triple: "#6b7280",
};

const resultLabels = {
  eagle: "Eagle+",
  birdie: "Birdie",
  par: "Par",
  bogey: "Bogey",
  double: "Double",
  triple: "Triple+",
};

// ── Components ─────────────────────────────────────────────────────
function FileLoader({ onLoad }) {
  const fileRef = useRef();
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState(null);

  const processFile = (file) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.scores || !Array.isArray(data.scores)) {
          setError("Invalid file format. Expected output from fetch-ghin-scores.mjs");
          return;
        }
        onLoad(data);
      } catch {
        setError("Could not parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={styles.loginCard}>
      <div style={styles.loginIcon}>⛳</div>
      <h1 style={styles.loginTitle}>Suntree CC</h1>
      <p style={styles.loginSubtitle}>Hole-by-Hole Analysis</p>

      <div style={{ margin: "24px 0 16px", textAlign: "left" }}>
        <div style={styles.stepBox}>
          <div style={styles.stepNum}>1</div>
          <div>
            <div style={styles.stepLabel}>Run the fetcher on your machine</div>
            <code style={styles.codeBlock}>
              npm install @spicygolf/ghin{"\n"}
              node fetch-ghin-scores.mjs
            </code>
          </div>
        </div>
        <div style={styles.stepBox}>
          <div style={styles.stepNum}>2</div>
          <div>
            <div style={styles.stepLabel}>Load the exported JSON file here</div>
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      <div
        style={{
          ...styles.dropZone,
          borderColor: dragging ? "#c9a227" : "rgba(255,255,255,0.12)",
          background: dragging ? "rgba(201,162,39,0.08)" : "rgba(255,255,255,0.02)",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileRef.current?.click()}
      >
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📂</div>
        <div style={{ fontWeight: 600 }}>
          Drop <span style={{ color: "#c9a227" }}>ghin-scores.json</span> here
        </div>
        <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>or click to browse</div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files[0]) processFile(e.target.files[0]);
          }}
        />
      </div>

      <button
        style={{ ...styles.button, marginTop: 16, background: "rgba(255,255,255,0.06)", color: "#e8e6e1", fontSize: 13 }}
        onClick={() => {
          const sample = prompt("Paste your ghin-scores.json content:");
          if (sample) {
            try {
              const data = JSON.parse(sample);
              if (data.scores) onLoad(data);
              else setError("Invalid format");
            } catch {
              setError("Could not parse pasted JSON");
            }
          }
        }}
      >
        Or paste JSON directly
      </button>
    </div>
  );
}

function CourseSelector({ courses, selected, onSelect }) {
  if (!courses.length) return null;
  return (
    <div style={styles.filterGroup}>
      <label style={styles.filterLabel}>Course</label>
      <select style={styles.select} value={selected || ""} onChange={(e) => onSelect(e.target.value)}>
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.count} rds, {c.holeCount} w/ holes)
          </option>
        ))}
      </select>
    </div>
  );
}

function TeeSelector({ tees, selected, onSelect }) {
  if (!tees || tees.length <= 1) return null;
  return (
    <div style={styles.filterGroup}>
      <label style={styles.filterLabel}>Tees</label>
      <select style={styles.select} value={selected || "all"} onChange={(e) => onSelect(e.target.value)}>
        <option value="all">All Tees</option>
        {tees.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </div>
  );
}

function SummaryCards({ stats }) {
  const cards = [
    { label: "Rounds", value: stats.rounds, sub: `${stats.eighteenHole} × 18  •  ${stats.nineHole} × 9` },
    { label: "Avg Score (18)", value: stats.avgScore18 ? stats.avgScore18.toFixed(1) : "—", sub: stats.bestScore18 ? `Best: ${stats.bestScore18}` : "" },
    {
      label: "Avg vs Par (18)",
      value: stats.avgToPar18 != null ? (stats.avgToPar18 > 0 ? "+" : "") + stats.avgToPar18.toFixed(1) : "—",
      sub: stats.par72 ? `Par ${stats.par72}` : "",
      color: stats.avgToPar18 > 0 ? "#e74c3c" : "#27ae60",
    },
    { label: "Holes w/ Data", value: stats.holesWithData, sub: "of 18" },
  ];

  return (
    <div style={styles.summaryGrid}>
      {cards.map((c, i) => (
        <div key={i} style={styles.summaryCard}>
          <div style={styles.summaryLabel}>{c.label}</div>
          <div style={{ ...styles.summaryValue, color: c.color || "#c9a227" }}>{c.value}</div>
          <div style={styles.summarySub}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function VisualBarChart({ holeStats }) {
  if (!holeStats.length) return null;
  const maxDiff = Math.max(...holeStats.map((h) => Math.abs(h.avg - h.par)), 0.5);
  const barScale = 80 / maxDiff;

  return (
    <div style={{ marginBottom: 36 }}>
      <h3 style={styles.sectionTitle}>Scoring vs Par</h3>
      <div style={{
        display: "flex", alignItems: "flex-end", gap: 3, height: 180,
        paddingTop: 20, borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        {holeStats.map((h) => {
          const diff = h.avg - h.par;
          const height = Math.abs(diff) * barScale;
          const isOver = diff > 0;
          return (
            <div key={h.hole} style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", height: "100%", justifyContent: "flex-end",
            }}>
              <div style={{
                fontSize: 9, opacity: 0.5, marginBottom: 2,
                fontFamily: "'JetBrains Mono', monospace",
                color: isOver ? "#e74c3c" : "#27ae60",
              }}>
                {diff > 0 ? "+" : ""}{diff.toFixed(1)}
              </div>
              <div style={{
                width: "65%", height: Math.max(height, 2),
                background: isOver
                  ? "linear-gradient(to top, #c0392b, #e74c3c)"
                  : "linear-gradient(to top, #1e8449, #27ae60)",
                borderRadius: "3px 3px 0 0",
              }} />
              <div style={{
                fontSize: 10, marginTop: 6, fontWeight: 700, opacity: 0.6,
                fontFamily: "'JetBrains Mono', monospace",
              }}>
                {h.hole}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ToughestEasiest({ holeStats }) {
  const sorted = [...holeStats].sort((a, b) => (b.avg - b.par) - (a.avg - a.par));
  const toughest = sorted.slice(0, 3);
  const easiest = sorted.slice(-3).reverse();

  const RankList = ({ items, icon, color }) => (
    <div style={styles.teCard}>
      <div style={styles.teTitle}>{icon}</div>
      {items.map((h, i) => {
        const diff = h.avg - h.par;
        return (
          <div key={h.hole} style={styles.teRow}>
            <span style={styles.teRank}>#{i + 1}</span>
            <span style={styles.teHole}>Hole {h.hole}</span>
            <span style={styles.tePar}>Par {h.par}</span>
            <span style={{ ...styles.teVal, color }}>
              {diff > 0 ? "+" : ""}{diff.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={styles.teGrid}>
      <RankList items={toughest} icon="🔥 Toughest Holes" color="#e74c3c" />
      <RankList items={easiest} icon="💪 Best Holes" color="#27ae60" />
    </div>
  );
}

function DistributionBar({ dist, total }) {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, height: 22 }}>
      <div style={{
        display: "flex", flex: 1, height: 18, borderRadius: 3,
        overflow: "hidden", background: "rgba(255,255,255,0.03)",
      }}>
        {order.map((key) => {
          const count = dist[key] || 0;
          if (!count) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              title={`${resultLabels[key]}: ${count} (${pct.toFixed(0)}%)`}
              style={{
                width: `${pct}%`, background: resultColors[key],
                minWidth: count > 0 ? 2 : 0,
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 5, fontSize: 10, opacity: 0.6, whiteSpace: "nowrap", minWidth: 80 }}>
        {order.map((key) => {
          const count = dist[key] || 0;
          if (!count) return null;
          return <span key={key} style={{ color: resultColors[key] }}>{count}</span>;
        })}
      </div>
    </div>
  );
}

function DistributionLegend() {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (
    <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
      {order.map((key) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: resultColors[key] }} />
          <span style={{ opacity: 0.6 }}>{resultLabels[key]}</span>
        </div>
      ))}
    </div>
  );
}

function HoleTable({ holeStats, viewMode }) {
  if (!holeStats.length) return null;
  const nines = [holeStats.slice(0, 9), holeStats.slice(9, 18)].filter((n) => n.length > 0);
  const nineLabels = ["Front 9", "Back 9"];

  return (
    <div>
      {nines.map((nine, ni) => {
        const ninePar = nine.reduce((s, h) => s + h.par, 0);
        const nineAvgTotal = nine.reduce((s, h) => s + h.avg, 0);
        const nineDiff = nineAvgTotal - ninePar;

        return (
          <div key={ni} style={{ marginBottom: 28 }}>
            <div style={styles.nineHeader}>
              <span style={styles.nineTitle}>{nineLabels[ni]}</span>
              <span style={styles.nineSummary}>
                Par {ninePar} &nbsp;•&nbsp; Avg {nineAvgTotal.toFixed(1)} &nbsp;•&nbsp;
                <span style={{ color: nineDiff > 0 ? "#e74c3c" : "#27ae60", fontWeight: 700 }}>
                  {nineDiff > 0 ? "+" : ""}{nineDiff.toFixed(1)}
                </span>
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 48, textAlign: "center" }}>Hole</th>
                    <th style={{ ...styles.th, width: 40, textAlign: "center" }}>Par</th>
                    <th style={{ ...styles.th, width: 40, textAlign: "center" }}>Hcp</th>
                    <th style={{ ...styles.th, width: 56, textAlign: "center" }}>Avg</th>
                    <th style={{ ...styles.th, width: 56, textAlign: "center" }}>±Par</th>
                    {viewMode === "distribution" ? (
                      <th style={{ ...styles.th, minWidth: 220 }}>Distribution</th>
                    ) : (
                      <>
                        <th style={{ ...styles.th, width: 46, textAlign: "center" }}>Best</th>
                        <th style={{ ...styles.th, width: 46, textAlign: "center" }}>Wrst</th>
                        <th style={{ ...styles.th, width: 50, textAlign: "center" }}>Putts</th>
                        <th style={{ ...styles.th, width: 46, textAlign: "center" }}>GIR</th>
                        <th style={{ ...styles.th, width: 46, textAlign: "center" }}>FIR</th>
                      </>
                    )}
                    <th style={{ ...styles.th, width: 36, textAlign: "center" }}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {nine.map((h) => {
                    const vsPar = h.avg - h.par;
                    const vsColor = vsPar > 0.5 ? "#e74c3c" : vsPar < -0.05 ? "#27ae60" : "#c9a227";
                    return (
                      <tr key={h.hole} style={styles.tr}>
                        <td style={{ ...styles.tdMono, textAlign: "center", fontWeight: 700, fontSize: 15 }}>{h.hole}</td>
                        <td style={{ ...styles.td, textAlign: "center" }}>{h.par}</td>
                        <td style={{ ...styles.td, textAlign: "center", opacity: 0.45 }}>{h.strokeAllocation || "—"}</td>
                        <td style={{ ...styles.tdMono, textAlign: "center", fontWeight: 700, fontSize: 15 }}>{h.avg.toFixed(2)}</td>
                        <td style={{ ...styles.tdMono, textAlign: "center", fontWeight: 700, color: vsColor }}>
                          {vsPar > 0 ? "+" : ""}{vsPar.toFixed(2)}
                        </td>
                        {viewMode === "distribution" ? (
                          <td style={styles.td}><DistributionBar dist={h.distribution} total={h.count} /></td>
                        ) : (
                          <>
                            <td style={{ ...styles.td, textAlign: "center", color: "#27ae60" }}>{h.best}</td>
                            <td style={{ ...styles.td, textAlign: "center", color: "#e74c3c" }}>{h.worst}</td>
                            <td style={{ ...styles.td, textAlign: "center" }}>{h.avgPutts != null ? h.avgPutts.toFixed(1) : "—"}</td>
                            <td style={{ ...styles.td, textAlign: "center" }}>{h.girPct != null ? h.girPct.toFixed(0) + "%" : "—"}</td>
                            <td style={{ ...styles.td, textAlign: "center" }}>{h.firPct != null ? h.firPct.toFixed(0) + "%" : "—"}</td>
                          </>
                        )}
                        <td style={{ ...styles.td, textAlign: "center", opacity: 0.35, fontSize: 11 }}>{h.count}</td>
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

function TrendChart({ scores }) {
  const eighteens = scores
    .filter((s) => (s.number_of_holes === 18 || s.number_of_played_holes === 18) && s.adjusted_gross_score)
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  if (eighteens.length < 3) return null;

  const vals = eighteens.map((s) => s.adjusted_gross_score);
  const minScore = Math.min(...vals) - 2;
  const maxScore = Math.max(...vals) + 2;
  const range = maxScore - minScore;
  const W = 700, H = 140;
  const pad = { top: 10, right: 10, bottom: 24, left: 36 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const points = eighteens.map((s, i) => ({
    x: pad.left + (i / (eighteens.length - 1)) * plotW,
    y: pad.top + (1 - (s.adjusted_gross_score - minScore) / range) * plotH,
    score: s.adjusted_gross_score,
    date: s.played_at,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  return (
    <div style={{ marginBottom: 36 }}>
      <h3 style={styles.sectionTitle}>18-Hole Score Trend</h3>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
          const y = pad.top + (1 - pct) * plotH;
          const val = Math.round(minScore + pct * range);
          return (
            <g key={pct}>
              <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />
              <text x={pad.left - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="JetBrains Mono">{val}</text>
            </g>
          );
        })}
        <path d={pathD} fill="none" stroke="#c9a227" strokeWidth={1.5} strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#c9a227" opacity={0.8}>
            <title>{`${p.date}: ${p.score}`}</title>
          </circle>
        ))}
        {[points[0], points[points.length - 1]].map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor={i === 0 ? "start" : "end"} fill="rgba(255,255,255,0.3)" fontSize={9}>
            {new Date(p.date).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function SuntreeAnalysis() {
  const [data, setData] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTee, setSelectedTee] = useState("all");
  const [viewMode, setViewMode] = useState("stats");

  const courses = useMemo(() => {
    if (!data) return [];
    const map = {};
    data.scores.forEach((s) => {
      const name = s.course_name || s.facility_name || "Unknown";
      if (!map[name]) map[name] = { id: name, name, count: 0, holeCount: 0 };
      map[name].count++;
      if (s.hole_details?.length > 0) map[name].holeCount++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [data]);

  useEffect(() => {
    if (courses.length && !selectedCourse) {
      const suntree = courses.find((c) =>
        c.name.toLowerCase().includes("suntree") || c.name.toLowerCase().includes("sun tree")
      );
      setSelectedCourse(suntree ? suntree.id : courses[0].id);
    }
  }, [courses, selectedCourse]);

  const courseScores = useMemo(() => {
    if (!data || !selectedCourse) return [];
    return data.scores.filter((s) => (s.course_name || s.facility_name || "Unknown") === selectedCourse);
  }, [data, selectedCourse]);

  const teeOptions = useMemo(() => {
    const tees = new Set();
    courseScores.forEach((s) => { if (s.tee_set_name || s.tee_name) tees.add(s.tee_set_name || s.tee_name); });
    return [...tees].sort();
  }, [courseScores]);

  const filteredScores = useMemo(() => {
    if (selectedTee === "all") return courseScores;
    return courseScores.filter((s) => (s.tee_set_name || s.tee_name) === selectedTee);
  }, [courseScores, selectedTee]);

  const holeStats = useMemo(() => {
    const holes = {};
    for (let i = 1; i <= 18; i++) {
      holes[i] = { hole: i, scores: [], putts: [], gir: [], fir: [], par: null, strokeAllocation: null };
    }
    filteredScores.forEach((score) => {
      if (!score.hole_details?.length) return;
      score.hole_details.forEach((hd) => {
        const n = hd.hole_number;
        if (n < 1 || n > 18) return;
        const s = hd.raw_score || hd.adjusted_gross_score;
        if (s && s > 0) holes[n].scores.push(s);
        if (hd.par) holes[n].par = hd.par;
        if (hd.stroke_allocation) holes[n].strokeAllocation = hd.stroke_allocation;
        if (hd.putts != null && hd.putts > 0) holes[n].putts.push(hd.putts);
        if (hd.gir_flag != null) holes[n].gir.push(hd.gir_flag ? 1 : 0);
        if (hd.fairway_hit != null) holes[n].fir.push(hd.fairway_hit ? 1 : 0);
      });
    });
    return Object.values(holes).filter((h) => h.scores.length > 0).map((h) => {
      const avg = h.scores.reduce((a, b) => a + b, 0) / h.scores.length;
      const dist = {};
      h.scores.forEach((s) => { const key = scoreToPar(s, h.par); dist[key] = (dist[key] || 0) + 1; });
      return {
        hole: h.hole, par: h.par || 4, strokeAllocation: h.strokeAllocation,
        avg, best: Math.min(...h.scores), worst: Math.max(...h.scores), count: h.scores.length,
        avgPutts: h.putts.length > 0 ? h.putts.reduce((a, b) => a + b, 0) / h.putts.length : null,
        girPct: h.gir.length > 0 ? (h.gir.reduce((a, b) => a + b, 0) / h.gir.length) * 100 : null,
        firPct: h.fir.length > 0 ? (h.fir.reduce((a, b) => a + b, 0) / h.fir.length) * 100 : null,
        distribution: dist,
      };
    });
  }, [filteredScores]);

  const summaryStats = useMemo(() => {
    const e18 = filteredScores.filter((s) => s.number_of_holes === 18 || s.number_of_played_holes === 18);
    const n9 = filteredScores.filter((s) => s.number_of_holes === 9 || s.number_of_played_holes === 9);
    const t18 = e18.map((s) => s.adjusted_gross_score).filter(Boolean);
    const totalPar = holeStats.length === 18 ? holeStats.reduce((s, h) => s + h.par, 0) : null;
    return {
      rounds: filteredScores.length, eighteenHole: e18.length, nineHole: n9.length,
      avgScore18: t18.length > 0 ? t18.reduce((a, b) => a + b, 0) / t18.length : null,
      bestScore18: t18.length > 0 ? Math.min(...t18) : null,
      avgToPar18: t18.length > 0 && totalPar ? t18.reduce((a, b) => a + b, 0) / t18.length - totalPar : null,
      par72: totalPar, holesWithData: holeStats.length,
    };
  }, [filteredScores, holeStats]);

  if (!data) {
    return (
      <div style={styles.page}>
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
        <div style={styles.loginWrapper}>
          <FileLoader onLoad={(d) => { setData(d); setSelectedCourse(null); setSelectedTee("all"); }} />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <header style={styles.header}>
        <div style={{ flex: 1 }}>
          <h1 style={styles.headerTitle}>⛳ Hole-by-Hole Analysis</h1>
          <p style={styles.headerSub}>
            {data.golfer ? `${data.golfer.first_name} ${data.golfer.last_name} • HI: ${data.golfer.handicap_index}` : ""}
            {` • ${data.total_scores} scores loaded (${data.scores_with_hole_detail} with hole detail)`}
          </p>
        </div>
        <button
          style={{ ...styles.button, width: "auto", padding: "8px 16px", fontSize: 12 }}
          onClick={() => { setData(null); setSelectedCourse(null); }}
        >
          Load New File
        </button>
      </header>

      <div style={styles.content}>
        <div style={styles.controls}>
          <CourseSelector courses={courses} selected={selectedCourse}
            onSelect={(id) => { setSelectedCourse(id); setSelectedTee("all"); }} />
          <TeeSelector tees={teeOptions} selected={selectedTee} onSelect={setSelectedTee} />
          <div style={styles.filterGroup}>
            <label style={styles.filterLabel}>View</label>
            <div style={styles.toggleGroup}>
              {["stats", "distribution"].map((m) => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ ...styles.toggleBtn, ...(viewMode === m ? styles.toggleActive : {}) }}>
                  {m === "stats" ? "Stats" : "Distribution"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filteredScores.length === 0 ? (
          <div style={styles.emptyState}>
            No hole-by-hole data found for this course/tee combination.<br />
            Scores posted as totals only won't include hole detail.
          </div>
        ) : (
          <>
            <SummaryCards stats={summaryStats} />
            <TrendChart scores={filteredScores} />
            {holeStats.length > 0 && (
              <>
                <VisualBarChart holeStats={holeStats} />
                <ToughestEasiest holeStats={holeStats} />
                <div style={{ marginTop: 32 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h3 style={styles.sectionTitle}>Hole Detail</h3>
                    {viewMode === "distribution" && <DistributionLegend />}
                  </div>
                  <HoleTable holeStats={holeStats} viewMode={viewMode} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #080c0a 0%, #0d1a14 35%, #0a1210 100%)",
    color: "#e0ded8", fontFamily: "'DM Sans', sans-serif", fontSize: 14,
  },
  loginWrapper: {
    display: "flex", justifyContent: "center", alignItems: "center",
    minHeight: "100vh", padding: 24,
  },
  loginCard: {
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 16, padding: "44px 36px", maxWidth: 440, width: "100%",
    textAlign: "center", backdropFilter: "blur(20px)",
  },
  loginIcon: { fontSize: 44, marginBottom: 4 },
  loginTitle: { fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#c9a227" },
  loginSubtitle: { fontSize: 12, opacity: 0.4, margin: "4px 0 0", letterSpacing: "0.1em", textTransform: "uppercase" },
  stepBox: {
    display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14,
    padding: "12px 14px", background: "rgba(255,255,255,0.03)",
    borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)",
  },
  stepNum: {
    width: 24, height: 24, borderRadius: "50%", background: "rgba(201,162,39,0.15)",
    color: "#c9a227", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, flexShrink: 0,
  },
  stepLabel: { fontSize: 13, fontWeight: 600, marginBottom: 4 },
  codeBlock: {
    display: "block", background: "rgba(0,0,0,0.3)", borderRadius: 4,
    padding: "8px 10px", fontSize: 11, fontFamily: "'JetBrains Mono', monospace",
    color: "#a8c97e", whiteSpace: "pre", textAlign: "left", marginTop: 4,
  },
  dropZone: {
    border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 12,
    padding: "32px 20px", cursor: "pointer", transition: "all 0.2s ease",
  },
  errorBox: {
    background: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.25)",
    borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#e74c3c",
  },
  button: {
    display: "block", width: "100%", padding: "12px",
    background: "linear-gradient(135deg, #c9a227, #a8871e)",
    border: "none", borderRadius: 8, color: "#0a0f0d", fontSize: 14,
    fontWeight: 700, fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
  },
  header: {
    display: "flex", alignItems: "center", gap: 16,
    padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap",
  },
  headerTitle: { fontSize: 20, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" },
  headerSub: { fontSize: 12, opacity: 0.45, margin: "3px 0 0" },
  content: { padding: "20px 28px 48px", maxWidth: 1100 },
  controls: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24, alignItems: "flex-end" },
  filterGroup: { display: "flex", flexDirection: "column", gap: 4 },
  filterLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.35, fontWeight: 700 },
  select: {
    padding: "7px 10px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6,
    color: "#e0ded8", fontSize: 13, fontFamily: "'DM Sans', sans-serif", outline: "none", minWidth: 170,
  },
  toggleGroup: { display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" },
  toggleBtn: {
    padding: "7px 14px", background: "rgba(255,255,255,0.03)", border: "none",
    color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", fontWeight: 500,
  },
  toggleActive: { background: "rgba(201,162,39,0.18)", color: "#c9a227", fontWeight: 700 },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 10, marginBottom: 32 },
  summaryCard: {
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10, padding: "14px 18px",
  },
  summaryLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.35, marginBottom: 5, fontWeight: 700 },
  summaryValue: { fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: "#c9a227", lineHeight: 1 },
  summarySub: { fontSize: 11, opacity: 0.35, marginTop: 4 },
  sectionTitle: { fontSize: 13, fontWeight: 700, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55 },
  nineHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 6, padding: "7px 12px", background: "rgba(201,162,39,0.05)",
    borderRadius: 5, borderLeft: "3px solid #c9a227",
  },
  nineTitle: { fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" },
  nineSummary: { fontSize: 12, opacity: 0.65, fontFamily: "'JetBrains Mono', monospace" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "7px 8px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em",
    opacity: 0.35, fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  tr: { borderBottom: "1px solid rgba(255,255,255,0.025)" },
  td: { padding: "9px 8px", fontSize: 13 },
  tdMono: { padding: "9px 8px", fontSize: 13, fontFamily: "'JetBrains Mono', monospace" },
  teGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 },
  teCard: {
    background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)",
    borderRadius: 10, padding: 18,
  },
  teTitle: { fontSize: 14, fontWeight: 700, marginBottom: 10 },
  teRow: {
    display: "flex", alignItems: "center", gap: 10, padding: "7px 0",
    borderBottom: "1px solid rgba(255,255,255,0.025)",
  },
  teRank: { fontSize: 10, opacity: 0.35, fontFamily: "'JetBrains Mono', monospace", width: 22 },
  teHole: { fontWeight: 700, fontSize: 14, flex: 1 },
  tePar: { fontSize: 11, opacity: 0.4 },
  teVal: { fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14 },
  emptyState: { textAlign: "center", padding: "50px 20px", opacity: 0.4, lineHeight: 1.6 },
};
