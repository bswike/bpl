import { useState, useEffect, useCallback, useMemo } from "react";

// ── constants ──────────────────────────────────────────────────────
const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";
const FIREBASE_URL =
  "https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations";
const GOOGLE_API_KEY = "AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I";
const SESSION_DEFAULTS = {
  appId: "1:884417644529:web:47fb315bc6c70242f72650",
  authVersion: "FIS_v2",
  fid: "fg6JfS0U01YmrelthLX9Iz",
  sdkVersion: "w:0.5.7",
};

// ── GHIN API helpers ───────────────────────────────────────────────
async function getFirebaseSession() {
  const res = await fetch(`${FIREBASE_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GOOGLE_API_KEY,
    },
    body: JSON.stringify(SESSION_DEFAULTS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.authToken?.token || null;
}

async function ghinLogin(email, password) {
  const sessionToken = await getFirebaseSession();
  const body = sessionToken
    ? { user: { email, password, token: sessionToken } }
    : { user: { email, password } };

  const res = await fetch(`${API_BASE}/users/login.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // try legacy login
    const res2 = await fetch(`${API_BASE}/golfer_login.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user: { email, password, remember_me: true },
        token: sessionToken,
      }),
    });
    if (!res2.ok) throw new Error("Login failed. Check your credentials.");
    const data2 = await res2.json();
    return {
      token: data2?.golfer_user?.golfer_user_token,
      golferId: null,
    };
  }

  const data = await res.json();
  return {
    token: data?.token,
    golferId: data?.user?.id || data?.golfer_user?.ghin_number,
  };
}

async function fetchGolferInfo(token) {
  const res = await fetch(`${API_BASE}/golfers.json?source=${SOURCE}&per_page=1&page=1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.golfers?.[0] || null;
}

async function fetchScores(token, golferId, opts = {}) {
  const params = new URLSearchParams();
  params.set("golfer_id", golferId.toString());
  params.set("source", SOURCE);
  if (opts.limit) params.set("limit", opts.limit.toString());
  if (opts.offset) params.set("offset", opts.offset.toString());

  const res = await fetch(`${API_BASE}/scores.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Scores fetch failed: ${res.status}`);
  return res.json();
}

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
  triple: "#95a5a6",
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

function LoginForm({ onLogin, loading, error }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={styles.loginCard}>
      <div style={styles.loginIcon}>⛳</div>
      <h1 style={styles.loginTitle}>Suntree CC</h1>
      <p style={styles.loginSubtitle}>Hole-by-Hole Analysis</p>
      <p style={styles.loginDesc}>
        Sign in with your GHIN credentials to analyze your scoring history
      </p>
      {error && <div style={styles.errorBox}>{error}</div>}
      <input
        style={styles.input}
        type="email"
        placeholder="GHIN Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onLogin(email, password)}
      />
      <input
        style={styles.input}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onLogin(email, password)}
      />
      <button
        style={{
          ...styles.button,
          opacity: loading ? 0.6 : 1,
        }}
        onClick={() => onLogin(email, password)}
        disabled={loading}
      >
        {loading ? "Connecting to GHIN..." : "Analyze My Scores"}
      </button>
      <p style={styles.loginNote}>
        Your credentials are sent directly to GHIN's API and are never stored.
      </p>
    </div>
  );
}

function CourseSelector({ courses, selected, onSelect }) {
  if (!courses.length) return null;
  return (
    <div style={styles.courseSelector}>
      <label style={styles.courseSelectorLabel}>Course</label>
      <select
        style={styles.select}
        value={selected || ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({c.count} rounds)
          </option>
        ))}
      </select>
    </div>
  );
}

function TeeSelector({ tees, selected, onSelect }) {
  if (!tees || tees.length <= 1) return null;
  return (
    <div style={styles.courseSelector}>
      <label style={styles.courseSelectorLabel}>Tees</label>
      <select
        style={styles.select}
        value={selected || "all"}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="all">All Tees</option>
        {tees.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
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
      label: "Avg to Par (18)",
      value: stats.avgToPar18 != null ? (stats.avgToPar18 > 0 ? "+" : "") + stats.avgToPar18.toFixed(1) : "—",
      sub: stats.par72 ? `Par ${stats.par72}` : "",
    },
    { label: "Holes w/ Data", value: stats.holesWithData, sub: `of 18` },
  ];

  return (
    <div style={styles.summaryGrid}>
      {cards.map((c, i) => (
        <div key={i} style={styles.summaryCard}>
          <div style={styles.summaryLabel}>{c.label}</div>
          <div style={styles.summaryValue}>{c.value}</div>
          <div style={styles.summarySub}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function HoleTable({ holeStats, viewMode }) {
  if (!holeStats.length) return null;

  const nines = [holeStats.slice(0, 9), holeStats.slice(9, 18)].filter(
    (n) => n.length > 0
  );
  const nineLabels = ["Front 9", "Back 9"];

  return (
    <div>
      {nines.map((nine, ni) => {
        const nineAvg =
          nine.reduce((s, h) => s + h.avg, 0) / nine.length || 0;
        const ninePar = nine.reduce((s, h) => s + h.par, 0);
        const nineAvgTotal = nine.reduce((s, h) => s + h.avg, 0);

        return (
          <div key={ni} style={{ marginBottom: 32 }}>
            <div style={styles.nineHeader}>
              <span style={styles.nineTitle}>{nineLabels[ni]}</span>
              <span style={styles.nineSummary}>
                Par {ninePar} • Avg {nineAvgTotal.toFixed(1)} •{" "}
                <span
                  style={{
                    color:
                      nineAvgTotal - ninePar > 0 ? "#e74c3c" : "#27ae60",
                  }}
                >
                  {nineAvgTotal - ninePar > 0 ? "+" : ""}
                  {(nineAvgTotal - ninePar).toFixed(1)}
                </span>
              </span>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: 50, textAlign: "center" }}>Hole</th>
                    <th style={{ ...styles.th, width: 42, textAlign: "center" }}>Par</th>
                    <th style={{ ...styles.th, width: 42, textAlign: "center" }}>Hcp</th>
                    <th style={{ ...styles.th, width: 55, textAlign: "center" }}>Avg</th>
                    <th style={{ ...styles.th, width: 55, textAlign: "center" }}>vs Par</th>
                    {viewMode === "distribution" ? (
                      <th style={{ ...styles.th, minWidth: 200 }}>Score Distribution</th>
                    ) : (
                      <>
                        <th style={{ ...styles.th, width: 50, textAlign: "center" }}>Best</th>
                        <th style={{ ...styles.th, width: 50, textAlign: "center" }}>Worst</th>
                        <th style={{ ...styles.th, width: 55, textAlign: "center" }}>Putts</th>
                        <th style={{ ...styles.th, width: 50, textAlign: "center" }}>GIR%</th>
                        <th style={{ ...styles.th, width: 50, textAlign: "center" }}>FIR%</th>
                      </>
                    )}
                    <th style={{ ...styles.th, width: 50, textAlign: "center" }}>#</th>
                  </tr>
                </thead>
                <tbody>
                  {nine.map((h) => {
                    const vsPar = h.avg - h.par;
                    const vsParStr =
                      (vsPar > 0 ? "+" : "") + vsPar.toFixed(2);
                    const vsParColor =
                      vsPar > 0.5
                        ? "#e74c3c"
                        : vsPar < -0.1
                        ? "#27ae60"
                        : "#c9a227";

                    return (
                      <tr key={h.hole} style={styles.tr}>
                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                          }}
                        >
                          {h.hole}
                        </td>
                        <td style={{ ...styles.td, textAlign: "center" }}>
                          {h.par}
                        </td>
                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            opacity: 0.6,
                          }}
                        >
                          {h.strokeAllocation || "—"}
                        </td>
                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 15,
                          }}
                        >
                          {h.avg.toFixed(2)}
                        </td>
                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            color: vsParColor,
                            fontWeight: 700,
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {vsParStr}
                        </td>

                        {viewMode === "distribution" ? (
                          <td style={styles.td}>
                            <DistributionBar dist={h.distribution} total={h.count} />
                          </td>
                        ) : (
                          <>
                            <td
                              style={{
                                ...styles.td,
                                textAlign: "center",
                                color: "#27ae60",
                              }}
                            >
                              {h.best}
                            </td>
                            <td
                              style={{
                                ...styles.td,
                                textAlign: "center",
                                color: "#e74c3c",
                              }}
                            >
                              {h.worst}
                            </td>
                            <td style={{ ...styles.td, textAlign: "center" }}>
                              {h.avgPutts != null ? h.avgPutts.toFixed(1) : "—"}
                            </td>
                            <td style={{ ...styles.td, textAlign: "center" }}>
                              {h.girPct != null ? h.girPct.toFixed(0) + "%" : "—"}
                            </td>
                            <td style={{ ...styles.td, textAlign: "center" }}>
                              {h.firPct != null ? h.firPct.toFixed(0) + "%" : "—"}
                            </td>
                          </>
                        )}
                        <td
                          style={{
                            ...styles.td,
                            textAlign: "center",
                            opacity: 0.5,
                            fontSize: 12,
                          }}
                        >
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

function DistributionBar({ dist, total }) {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 24 }}>
      <div
        style={{
          display: "flex",
          flex: 1,
          height: 20,
          borderRadius: 4,
          overflow: "hidden",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {order.map((key) => {
          const count = dist[key] || 0;
          if (!count) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              title={`${resultLabels[key]}: ${count} (${pct.toFixed(0)}%)`}
              style={{
                width: `${pct}%`,
                background: resultColors[key],
                minWidth: count > 0 ? 3 : 0,
                transition: "width 0.4s ease",
              }}
            />
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 10, opacity: 0.7, whiteSpace: "nowrap" }}>
        {order.map((key) => {
          const count = dist[key] || 0;
          if (!count) return null;
          return (
            <span key={key} style={{ color: resultColors[key] }}>
              {count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function DistributionLegend() {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
      {order.map((key) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: resultColors[key],
            }}
          />
          <span style={{ opacity: 0.7 }}>{resultLabels[key]}</span>
        </div>
      ))}
    </div>
  );
}

function ToughestEasiest({ holeStats }) {
  const sorted = [...holeStats].sort((a, b) => (b.avg - b.par) - (a.avg - a.par));
  const toughest = sorted.slice(0, 3);
  const easiest = sorted.slice(-3).reverse();

  return (
    <div style={styles.teGrid}>
      <div style={styles.teCard}>
        <div style={styles.teTitle}>🔥 Toughest Holes</div>
        {toughest.map((h, i) => (
          <div key={h.hole} style={styles.teRow}>
            <span style={styles.teRank}>#{i + 1}</span>
            <span style={styles.teHole}>Hole {h.hole}</span>
            <span style={styles.tePar}>Par {h.par}</span>
            <span style={{ ...styles.teVal, color: "#e74c3c" }}>
              +{(h.avg - h.par).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
      <div style={styles.teCard}>
        <div style={styles.teTitle}>💪 Best Holes</div>
        {easiest.map((h, i) => (
          <div key={h.hole} style={styles.teRow}>
            <span style={styles.teRank}>#{i + 1}</span>
            <span style={styles.teHole}>Hole {h.hole}</span>
            <span style={styles.tePar}>Par {h.par}</span>
            <span
              style={{
                ...styles.teVal,
                color: h.avg - h.par <= 0 ? "#27ae60" : "#c9a227",
              }}
            >
              {h.avg - h.par > 0 ? "+" : ""}
              {(h.avg - h.par).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VisualBarChart({ holeStats }) {
  if (!holeStats.length) return null;
  const maxDiff = Math.max(...holeStats.map((h) => Math.abs(h.avg - h.par)), 1);
  const barScale = 80 / maxDiff;

  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={styles.sectionTitle}>Scoring vs Par by Hole</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 200, paddingTop: 20 }}>
        {holeStats.map((h) => {
          const diff = h.avg - h.par;
          const height = Math.abs(diff) * barScale;
          const isOver = diff > 0;
          return (
            <div
              key={h.hole}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                height: "100%",
                justifyContent: "flex-end",
                position: "relative",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  opacity: 0.6,
                  marginBottom: 2,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {diff > 0 ? "+" : ""}
                {diff.toFixed(1)}
              </div>
              <div
                style={{
                  width: "70%",
                  height: Math.max(height, 2),
                  background: isOver
                    ? "linear-gradient(to top, #e74c3c, #c0392b)"
                    : "linear-gradient(to top, #27ae60, #2ecc71)",
                  borderRadius: "3px 3px 0 0",
                  transition: "height 0.5s ease",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  marginTop: 4,
                  fontWeight: 700,
                  opacity: 0.8,
                }}
              >
                {h.hole}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 0 }} />
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────────
export default function SuntreeAnalysis() {
  const [auth, setAuth] = useState(null);
  const [golfer, setGolfer] = useState(null);
  const [allScores, setAllScores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);
  const [status, setStatus] = useState("");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedTee, setSelectedTee] = useState("all");
  const [viewMode, setViewMode] = useState("stats");

  const handleLogin = useCallback(async (email, password) => {
    if (!email || !password) {
      setLoginError("Please enter both email and password.");
      return;
    }
    setLoading(true);
    setLoginError(null);
    setStatus("Authenticating with GHIN...");
    try {
      const loginResult = await ghinLogin(email, password);
      setAuth(loginResult);
      setStatus("Fetching golfer info...");

      const info = await fetchGolferInfo(loginResult.token);
      setGolfer(info);

      setStatus("Loading scores (this may take a moment)...");
      let allFetched = [];
      let offset = 0;
      const limit = 100;
      let keepGoing = true;

      while (keepGoing) {
        const batch = await fetchScores(
          loginResult.token,
          info?.id || loginResult.golferId,
          { limit, offset }
        );
        const scores = batch?.scores || [];
        allFetched = [...allFetched, ...scores];
        setStatus(`Loaded ${allFetched.length} scores...`);
        if (scores.length < limit) keepGoing = false;
        else offset += limit;
        // safety valve
        if (allFetched.length > 2000) keepGoing = false;
      }

      setAllScores(allFetched);
      setStatus("");
    } catch (err) {
      setLoginError(err.message || "Login failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }, []);

  // Derive courses from scores
  const courses = useMemo(() => {
    const map = {};
    allScores.forEach((s) => {
      const name = s.course_name || s.facility_name || "Unknown";
      const key = name;
      if (!map[key]) map[key] = { id: key, name, count: 0 };
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [allScores]);

  // Auto-select Suntree or top course
  useEffect(() => {
    if (courses.length && !selectedCourse) {
      const suntree = courses.find(
        (c) =>
          c.name.toLowerCase().includes("suntree") ||
          c.name.toLowerCase().includes("sun tree")
      );
      setSelectedCourse(suntree ? suntree.id : courses[0].id);
    }
  }, [courses, selectedCourse]);

  // Filter scores for selected course
  const courseScores = useMemo(() => {
    if (!selectedCourse) return [];
    return allScores.filter((s) => {
      const name = s.course_name || s.facility_name || "Unknown";
      return name === selectedCourse;
    });
  }, [allScores, selectedCourse]);

  // Get unique tee names
  const teeOptions = useMemo(() => {
    const tees = new Set();
    courseScores.forEach((s) => {
      if (s.tee_set_name || s.tee_name) tees.add(s.tee_set_name || s.tee_name);
    });
    return [...tees].sort();
  }, [courseScores]);

  // Filter by tee
  const filteredScores = useMemo(() => {
    if (selectedTee === "all") return courseScores;
    return courseScores.filter(
      (s) => (s.tee_set_name || s.tee_name) === selectedTee
    );
  }, [courseScores, selectedTee]);

  // Compute hole stats
  const holeStats = useMemo(() => {
    const holes = {};
    for (let i = 1; i <= 18; i++) {
      holes[i] = {
        hole: i,
        scores: [],
        putts: [],
        gir: [],
        fir: [],
        par: null,
        strokeAllocation: null,
      };
    }

    filteredScores.forEach((score) => {
      if (!score.hole_details?.length) return;
      score.hole_details.forEach((hd) => {
        const n = hd.hole_number;
        if (n < 1 || n > 18) return;
        holes[n].scores.push(hd.raw_score || hd.adjusted_gross_score);
        if (hd.par) holes[n].par = hd.par;
        if (hd.stroke_allocation) holes[n].strokeAllocation = hd.stroke_allocation;
        if (hd.putts != null && hd.putts > 0) holes[n].putts.push(hd.putts);
        if (hd.gir_flag != null) holes[n].gir.push(hd.gir_flag ? 1 : 0);
        if (hd.fairway_hit != null) holes[n].fir.push(hd.fairway_hit ? 1 : 0);
      });
    });

    return Object.values(holes)
      .filter((h) => h.scores.length > 0)
      .map((h) => {
        const avg = h.scores.reduce((a, b) => a + b, 0) / h.scores.length;
        const dist = {};
        h.scores.forEach((s) => {
          const key = scoreToPar(s, h.par);
          dist[key] = (dist[key] || 0) + 1;
        });

        return {
          hole: h.hole,
          par: h.par || 4,
          strokeAllocation: h.strokeAllocation,
          avg,
          best: Math.min(...h.scores),
          worst: Math.max(...h.scores),
          count: h.scores.length,
          avgPutts:
            h.putts.length > 0
              ? h.putts.reduce((a, b) => a + b, 0) / h.putts.length
              : null,
          girPct:
            h.gir.length > 0
              ? (h.gir.reduce((a, b) => a + b, 0) / h.gir.length) * 100
              : null,
          firPct:
            h.fir.length > 0
              ? (h.fir.reduce((a, b) => a + b, 0) / h.fir.length) * 100
              : null,
          distribution: dist,
        };
      });
  }, [filteredScores]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const eighteenScores = filteredScores.filter(
      (s) => s.number_of_holes === 18 || s.number_of_played_holes === 18
    );
    const nineScores = filteredScores.filter(
      (s) => s.number_of_holes === 9 || s.number_of_played_holes === 9
    );
    const totals18 = eighteenScores.map((s) => s.adjusted_gross_score);
    const totalPar =
      holeStats.length === 18
        ? holeStats.reduce((s, h) => s + h.par, 0)
        : null;

    return {
      rounds: filteredScores.length,
      eighteenHole: eighteenScores.length,
      nineHole: nineScores.length,
      avgScore18:
        totals18.length > 0
          ? totals18.reduce((a, b) => a + b, 0) / totals18.length
          : null,
      bestScore18: totals18.length > 0 ? Math.min(...totals18) : null,
      avgToPar18:
        totals18.length > 0 && totalPar
          ? totals18.reduce((a, b) => a + b, 0) / totals18.length - totalPar
          : null,
      par72: totalPar,
      holesWithData: holeStats.length,
    };
  }, [filteredScores, holeStats]);

  // ── Render ──
  if (!auth) {
    return (
      <div style={styles.page}>
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <div style={styles.loginWrapper}>
          <LoginForm
            onLogin={handleLogin}
            loading={loading}
            error={loginError}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap"
        rel="stylesheet"
      />

      {/* Header */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>
            ⛳ Hole-by-Hole Analysis
          </h1>
          <p style={styles.headerSub}>
            {golfer
              ? `${golfer.first_name} ${golfer.last_name} • HI: ${golfer.handicap_index}`
              : "Loading..."}
            {allScores.length > 0 && ` • ${allScores.length} total scores loaded`}
          </p>
        </div>
      </header>

      {status && (
        <div style={styles.statusBar}>
          <div style={styles.spinner} />
          {status}
        </div>
      )}

      {allScores.length > 0 && (
        <div style={styles.content}>
          {/* Controls */}
          <div style={styles.controls}>
            <CourseSelector
              courses={courses}
              selected={selectedCourse}
              onSelect={(id) => {
                setSelectedCourse(id);
                setSelectedTee("all");
              }}
            />
            <TeeSelector
              tees={teeOptions}
              selected={selectedTee}
              onSelect={setSelectedTee}
            />
            <div style={styles.courseSelector}>
              <label style={styles.courseSelectorLabel}>View</label>
              <div style={styles.toggleGroup}>
                <button
                  style={{
                    ...styles.toggleBtn,
                    ...(viewMode === "stats" ? styles.toggleBtnActive : {}),
                  }}
                  onClick={() => setViewMode("stats")}
                >
                  Stats
                </button>
                <button
                  style={{
                    ...styles.toggleBtn,
                    ...(viewMode === "distribution"
                      ? styles.toggleBtnActive
                      : {}),
                  }}
                  onClick={() => setViewMode("distribution")}
                >
                  Distribution
                </button>
              </div>
            </div>
          </div>

          {filteredScores.length === 0 ? (
            <div style={styles.emptyState}>
              No hole-by-hole data found for this course/tee combination.
              <br />
              Scores posted as totals only won't include hole detail.
            </div>
          ) : (
            <>
              <SummaryCards stats={summaryStats} />

              {holeStats.length > 0 && (
                <>
                  <VisualBarChart holeStats={holeStats} />
                  <ToughestEasiest holeStats={holeStats} />

                  <div style={{ marginTop: 32 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                      }}
                    >
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
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(145deg, #0a0f0d 0%, #0d1a14 40%, #0a1210 100%)",
    color: "#e8e6e1",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
  },
  loginWrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    padding: 24,
  },
  loginCard: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: "48px 40px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
    backdropFilter: "blur(20px)",
  },
  loginIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    letterSpacing: "-0.02em",
    color: "#c9a227",
  },
  loginSubtitle: {
    fontSize: 14,
    opacity: 0.5,
    margin: "4px 0 20px",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  loginDesc: {
    fontSize: 13,
    opacity: 0.6,
    lineHeight: 1.5,
    marginBottom: 24,
  },
  loginNote: {
    fontSize: 11,
    opacity: 0.35,
    marginTop: 16,
  },
  input: {
    display: "block",
    width: "100%",
    padding: "14px 16px",
    marginBottom: 12,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "#e8e6e1",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    boxSizing: "border-box",
  },
  button: {
    display: "block",
    width: "100%",
    padding: "14px",
    marginTop: 8,
    background: "linear-gradient(135deg, #c9a227, #a8871e)",
    border: "none",
    borderRadius: 8,
    color: "#0a0f0d",
    fontSize: 15,
    fontWeight: 700,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    letterSpacing: "0.01em",
  },
  errorBox: {
    background: "rgba(231,76,60,0.15)",
    border: "1px solid rgba(231,76,60,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    marginBottom: 16,
    fontSize: 13,
    color: "#e74c3c",
  },
  header: {
    padding: "24px 32px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
    letterSpacing: "-0.01em",
  },
  headerSub: {
    fontSize: 13,
    opacity: 0.5,
    margin: "4px 0 0",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 32px",
    background: "rgba(201,162,39,0.08)",
    borderBottom: "1px solid rgba(201,162,39,0.15)",
    fontSize: 13,
    color: "#c9a227",
  },
  spinner: {
    width: 14,
    height: 14,
    border: "2px solid rgba(201,162,39,0.2)",
    borderTopColor: "#c9a227",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  content: {
    padding: "24px 32px 48px",
    maxWidth: 1100,
  },
  controls: {
    display: "flex",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 24,
    alignItems: "flex-end",
  },
  courseSelector: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  courseSelectorLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    opacity: 0.4,
    fontWeight: 700,
  },
  select: {
    padding: "8px 12px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#e8e6e1",
    fontSize: 13,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    minWidth: 180,
  },
  toggleGroup: {
    display: "flex",
    borderRadius: 6,
    overflow: "hidden",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  toggleBtn: {
    padding: "8px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "none",
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    fontWeight: 500,
  },
  toggleBtnActive: {
    background: "rgba(201,162,39,0.2)",
    color: "#c9a227",
    fontWeight: 700,
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 32,
  },
  summaryCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: "16px 20px",
  },
  summaryLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    opacity: 0.4,
    marginBottom: 6,
    fontWeight: 700,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#c9a227",
    lineHeight: 1,
  },
  summarySub: {
    fontSize: 12,
    opacity: 0.4,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    margin: "0 0 16px",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    opacity: 0.7,
  },
  nineHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    padding: "8px 12px",
    background: "rgba(201,162,39,0.06)",
    borderRadius: 6,
    borderLeft: "3px solid #c9a227",
  },
  nineTitle: {
    fontWeight: 700,
    fontSize: 14,
    letterSpacing: "0.04em",
  },
  nineSummary: {
    fontSize: 13,
    opacity: 0.7,
    fontFamily: "'JetBrains Mono', monospace",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    padding: "8px 10px",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    opacity: 0.4,
    fontWeight: 700,
    textAlign: "left",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  tr: {
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  td: {
    padding: "10px 10px",
    fontSize: 13,
  },
  teGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginBottom: 32,
  },
  teCard: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 20,
  },
  teTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 12,
  },
  teRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 0",
    borderBottom: "1px solid rgba(255,255,255,0.03)",
  },
  teRank: {
    fontSize: 11,
    opacity: 0.4,
    fontFamily: "'JetBrains Mono', monospace",
    width: 24,
  },
  teHole: {
    fontWeight: 700,
    fontSize: 14,
    flex: 1,
  },
  tePar: {
    fontSize: 12,
    opacity: 0.5,
  },
  teVal: {
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
    fontSize: 14,
  },
  emptyState: {
    textAlign: "center",
    padding: "60px 20px",
    opacity: 0.5,
    lineHeight: 1.6,
    fontSize: 14,
  },
};

// inject keyframes
if (typeof document !== "undefined") {
  const styleEl = document.createElement("style");
  styleEl.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
  document.head.appendChild(styleEl);
}