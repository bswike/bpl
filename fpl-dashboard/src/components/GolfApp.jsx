import { useState, useEffect, useMemo, useRef } from "react";

const scoreToPar = (score, par) => {
  const diff = score - par;
  if (diff <= -2) return "eagle";
  if (diff === -1) return "birdie";
  if (diff === 0) return "par";
  if (diff === 1) return "bogey";
  if (diff === 2) return "double";
  return "triple";
};
const RC = { eagle: "#d4af37", birdie: "#e74c3c", par: "#27ae60", bogey: "#3498db", double: "#8e44ad", triple: "#6b7280" };
const RL = { eagle: "Eagle+", birdie: "Birdie", par: "Par", bogey: "Bogey", double: "Double", triple: "Triple+" };

function getCourseKey(s) {
  // Use course_name/facility_name if available (raw API), else fall back to rating/slope fingerprint
  if (s.course_name) return s.course_name;
  if (s.facility_name) return s.facility_name;
  if (s.course_display_value) return s.course_display_value;
  return `CR ${s.course_rating} / Slope ${s.slope_rating}`;
}

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
        if (!data.scores?.length) { setError("No scores found in file."); return; }
        onLoad(data);
      } catch { setError("Could not parse JSON."); }
    };
    reader.readAsText(file);
  };
  return (
    <div style={S.loginCard}>
      <div style={{ fontSize: 44, marginBottom: 4 }}>⛳</div>
      <h1 style={S.loginTitle}>Hole-by-Hole Analysis</h1>
      <p style={S.loginSub}>GHIN Score Dashboard</p>
      <div style={{ margin: "24px 0 16px", textAlign: "left" }}>
        <div style={S.stepBox}><div style={S.stepNum}>1</div><div><div style={S.stepLabel}>Run the fetcher on your machine</div><code style={S.code}>npm install @spicygolf/ghin{"\n"}node fetch-ghin-scores.mjs</code></div></div>
        <div style={S.stepBox}><div style={S.stepNum}>2</div><div><div style={S.stepLabel}>Drop the JSON file below</div></div></div>
      </div>
      {error && <div style={S.err}>{error}</div>}
      <div style={{ ...S.drop, borderColor: dragging ? "#c9a227" : "rgba(255,255,255,0.12)", background: dragging ? "rgba(201,162,39,0.08)" : "rgba(255,255,255,0.02)" }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}>
        <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📂</div>
        <div style={{ fontWeight: 600 }}>Drop <span style={{ color: "#c9a227" }}>ghin-scores.json</span> here</div>
        <div style={{ fontSize: 12, opacity: 0.4, marginTop: 4 }}>or click to browse</div>
        <input ref={fileRef} type="file" accept=".json" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) processFile(e.target.files[0]); }} />
      </div>
    </div>
  );
}

function SummaryCards({ stats }) {
  const cards = [
    { label: "Rounds", value: stats.rounds, sub: `${stats.e18} × 18  •  ${stats.n9} × 9` },
    { label: "Avg Score (18)", value: stats.avg18 ? stats.avg18.toFixed(1) : "—", sub: stats.best18 ? `Best: ${stats.best18}` : "" },
    { label: "Avg vs Par", value: stats.vsPar != null ? (stats.vsPar > 0 ? "+" : "") + stats.vsPar.toFixed(1) : "—", sub: stats.par ? `Par ${stats.par}` : "", color: stats.vsPar > 0 ? "#e74c3c" : "#27ae60" },
    { label: "Holes w/ Data", value: stats.holeCount, sub: "of 18" },
  ];
  return (
    <div style={S.grid4}>{cards.map((c, i) => (
      <div key={i} style={S.card}>
        <div style={S.cardLabel}>{c.label}</div>
        <div style={{ ...S.cardVal, color: c.color || "#c9a227" }}>{c.value}</div>
        <div style={S.cardSub}>{c.sub}</div>
      </div>
    ))}</div>
  );
}

function BarChart({ holes }) {
  if (!holes.length) return null;
  const mx = Math.max(...holes.map(h => Math.abs(h.avg - h.par)), 0.5);
  const sc = 80 / mx;
  return (
    <div style={{ marginBottom: 36 }}>
      <h3 style={S.sec}>Scoring vs Par</h3>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 180, paddingTop: 20, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {holes.map(h => {
          const d = h.avg - h.par; const over = d > 0;
          return (<div key={h.hole} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
            <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 2, fontFamily: "mono", color: over ? "#e74c3c" : "#27ae60" }}>{d > 0 ? "+" : ""}{d.toFixed(1)}</div>
            <div style={{ width: "65%", height: Math.max(Math.abs(d) * sc, 2), background: over ? "linear-gradient(to top,#c0392b,#e74c3c)" : "linear-gradient(to top,#1e8449,#27ae60)", borderRadius: "3px 3px 0 0" }} />
            <div style={{ fontSize: 10, marginTop: 6, fontWeight: 700, opacity: 0.6, fontFamily: "mono" }}>{h.hole}</div>
          </div>);
        })}
      </div>
    </div>
  );
}

function Extremes({ holes }) {
  const sorted = [...holes].sort((a, b) => (b.avg - b.par) - (a.avg - a.par));
  const tough = sorted.slice(0, 3), easy = sorted.slice(-3).reverse();
  const List = ({ items, icon, color }) => (
    <div style={S.teCard}><div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{icon}</div>
      {items.map((h, i) => { const d = h.avg - h.par; return (
        <div key={h.hole} style={S.teRow}><span style={S.teRank}>#{i + 1}</span><span style={{ fontWeight: 700, flex: 1 }}>Hole {h.hole}</span><span style={{ opacity: 0.4, fontSize: 11 }}>Par {h.par}</span>
          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 14, color }}>{d > 0 ? "+" : ""}{d.toFixed(2)}</span></div>); })}
    </div>);
  return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
    <List items={tough} icon="🔥 Toughest Holes" color="#e74c3c" /><List items={easy} icon="💪 Best Holes" color="#27ae60" /></div>);
}

function DistBar({ dist, total }) {
  const order = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  return (<div style={{ display: "flex", alignItems: "center", gap: 6, height: 22 }}>
    <div style={{ display: "flex", flex: 1, height: 18, borderRadius: 3, overflow: "hidden", background: "rgba(255,255,255,0.03)" }}>
      {order.map(k => { const c = dist[k] || 0; if (!c) return null; return <div key={k} title={`${RL[k]}: ${c}`} style={{ width: `${(c / total) * 100}%`, background: RC[k], minWidth: 2 }} />; })}
    </div>
    <div style={{ display: "flex", gap: 5, fontSize: 10, opacity: 0.6, whiteSpace: "nowrap", minWidth: 80 }}>
      {order.map(k => { const c = dist[k] || 0; if (!c) return null; return <span key={k} style={{ color: RC[k] }}>{c}</span>; })}
    </div>
  </div>);
}

function HoleTable({ holes, mode }) {
  if (!holes.length) return null;
  const nines = [holes.slice(0, 9), holes.slice(9, 18)].filter(n => n.length > 0);
  return (<div>{nines.map((nine, ni) => {
    const nP = nine.reduce((s, h) => s + h.par, 0), nA = nine.reduce((s, h) => s + h.avg, 0), nD = nA - nP;
    return (<div key={ni} style={{ marginBottom: 28 }}>
      <div style={S.nineHdr}><span style={{ fontWeight: 700, fontSize: 13 }}>{ni === 0 ? "Front 9" : "Back 9"}</span>
        <span style={{ fontSize: 12, opacity: 0.65, fontFamily: "monospace" }}>Par {nP} • Avg {nA.toFixed(1)} • <span style={{ color: nD > 0 ? "#e74c3c" : "#27ae60", fontWeight: 700 }}>{nD > 0 ? "+" : ""}{nD.toFixed(1)}</span></span></div>
      <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr>
          <th style={{ ...S.th, width: 48, textAlign: "center" }}>Hole</th><th style={{ ...S.th, width: 40, textAlign: "center" }}>Par</th>
          <th style={{ ...S.th, width: 40, textAlign: "center" }}>Hcp</th><th style={{ ...S.th, width: 56, textAlign: "center" }}>Avg</th>
          <th style={{ ...S.th, width: 56, textAlign: "center" }}>±Par</th>
          {mode === "dist" ? <th style={{ ...S.th, minWidth: 220 }}>Distribution</th> : <>
            <th style={{ ...S.th, width: 46, textAlign: "center" }}>Best</th><th style={{ ...S.th, width: 46, textAlign: "center" }}>Wrst</th>
            <th style={{ ...S.th, width: 50, textAlign: "center" }}>Putts</th><th style={{ ...S.th, width: 46, textAlign: "center" }}>GIR</th>
            <th style={{ ...S.th, width: 46, textAlign: "center" }}>FIR</th></>}
          <th style={{ ...S.th, width: 36, textAlign: "center" }}>n</th>
        </tr></thead>
        <tbody>{nine.map(h => {
          const vp = h.avg - h.par, vc = vp > 0.5 ? "#e74c3c" : vp < -0.05 ? "#27ae60" : "#c9a227";
          return (<tr key={h.hole} style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}>
            <td style={{ ...S.mono, textAlign: "center", fontWeight: 700, fontSize: 15 }}>{h.hole}</td>
            <td style={{ ...S.td, textAlign: "center" }}>{h.par}</td>
            <td style={{ ...S.td, textAlign: "center", opacity: 0.45 }}>{h.sa || "—"}</td>
            <td style={{ ...S.mono, textAlign: "center", fontWeight: 700, fontSize: 15 }}>{h.avg.toFixed(2)}</td>
            <td style={{ ...S.mono, textAlign: "center", fontWeight: 700, color: vc }}>{vp > 0 ? "+" : ""}{vp.toFixed(2)}</td>
            {mode === "dist" ? <td style={S.td}><DistBar dist={h.distribution} total={h.count} /></td> : <>
              <td style={{ ...S.td, textAlign: "center", color: "#27ae60" }}>{h.best}</td>
              <td style={{ ...S.td, textAlign: "center", color: "#e74c3c" }}>{h.worst}</td>
              <td style={{ ...S.td, textAlign: "center" }}>{h.avgPutts != null ? h.avgPutts.toFixed(1) : "—"}</td>
              <td style={{ ...S.td, textAlign: "center" }}>{h.girPct != null ? h.girPct.toFixed(0) + "%" : "—"}</td>
              <td style={{ ...S.td, textAlign: "center" }}>{h.firPct != null ? h.firPct.toFixed(0) + "%" : "—"}</td></>}
            <td style={{ ...S.td, textAlign: "center", opacity: 0.35, fontSize: 11 }}>{h.count}</td>
          </tr>);
        })}</tbody></table></div></div>);
  })}</div>);
}

function Trend({ scores }) {
  const e18 = scores.filter(s => (s.number_of_holes === 18 || s.number_of_played_holes === 18) && s.adjusted_gross_score).sort((a, b) => new Date(a.played_at) - new Date(b.played_at));
  if (e18.length < 3) return null;
  const vals = e18.map(s => s.adjusted_gross_score), mn = Math.min(...vals) - 2, mx = Math.max(...vals) + 2, rng = mx - mn;
  const W = 700, H = 140, p = { t: 10, r: 10, b: 24, l: 36 }, pW = W - p.l - p.r, pH = H - p.t - p.b;
  const pts = e18.map((s, i) => ({ x: p.l + (i / (e18.length - 1)) * pW, y: p.t + (1 - (s.adjusted_gross_score - mn) / rng) * pH, s: s.adjusted_gross_score, d: s.played_at }));
  const pathD = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x},${pt.y}`).join(" ");
  return (<div style={{ marginBottom: 36 }}><h3 style={S.sec}>18-Hole Score Trend</h3>
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {[0, .25, .5, .75, 1].map(pct => { const y = p.t + (1 - pct) * pH; return (<g key={pct}><line x1={p.l} x2={W - p.r} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" /><text x={p.l - 4} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.3)" fontSize={9} fontFamily="monospace">{Math.round(mn + pct * rng)}</text></g>); })}
      <path d={pathD} fill="none" stroke="#c9a227" strokeWidth={1.5} strokeLinejoin="round" />
      {pts.map((pt, i) => <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill="#c9a227" opacity={0.8}><title>{`${pt.d}: ${pt.s}`}</title></circle>)}
      {[pts[0], pts[pts.length - 1]].map((pt, i) => <text key={i} x={pt.x} y={H - 4} textAnchor={i === 0 ? "start" : "end"} fill="rgba(255,255,255,0.3)" fontSize={9}>{new Date(pt.d).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}</text>)}
    </svg></div>);
}

function Legend() {
  return (<div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
    {["eagle", "birdie", "par", "bogey", "double", "triple"].map(k => (
      <div key={k} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: RC[k] }} /><span style={{ opacity: 0.6 }}>{RL[k]}</span></div>))}
  </div>);
}

export default function App() {
  const [data, setData] = useState(null);
  const [course, setCourse] = useState(null);
  const [tee, setTee] = useState("all");
  const [mode, setMode] = useState("stats");

  const courses = useMemo(() => {
    if (!data) return [];
    const m = {};
    data.scores.forEach(s => {
      const k = getCourseKey(s);
      if (!m[k]) m[k] = { id: k, name: k, count: 0, hc: 0 };
      m[k].count++;
      if (s.hole_details?.length > 0) m[k].hc++;
    });
    return Object.values(m).sort((a, b) => b.count - a.count);
  }, [data]);

  useEffect(() => {
    if (courses.length && !course) {
      const st = courses.find(c => /suntree|sun tree/i.test(c.name));
      setCourse(st ? st.id : courses[0].id);
    }
  }, [courses, course]);

  const filtered = useMemo(() => {
    if (!data || !course) return [];
    let s = data.scores.filter(s => getCourseKey(s) === course);
    if (tee !== "all") s = s.filter(x => (x.tee_set_name || x.tee_name) === tee);
    return s;
  }, [data, course, tee]);

  const tees = useMemo(() => {
    const t = new Set();
    (data?.scores || []).filter(s => getCourseKey(s) === course).forEach(s => { if (s.tee_set_name || s.tee_name) t.add(s.tee_set_name || s.tee_name); });
    return [...t].sort();
  }, [data, course]);

  const holes = useMemo(() => {
    const h = {}; for (let i = 1; i <= 18; i++) h[i] = { hole: i, scores: [], putts: [], gir: [], fir: [], par: null, sa: null };
    filtered.forEach(sc => { if (!sc.hole_details?.length) return; sc.hole_details.forEach(hd => {
      const n = hd.hole_number; if (n < 1 || n > 18) return;
      const v = hd.raw_score || hd.adjusted_gross_score; if (v > 0) h[n].scores.push(v);
      if (hd.par) h[n].par = hd.par; if (hd.stroke_allocation) h[n].sa = hd.stroke_allocation;
      if (hd.putts > 0) h[n].putts.push(hd.putts);
      if (hd.gir_flag != null) h[n].gir.push(hd.gir_flag ? 1 : 0);
      if (hd.fairway_hit != null) h[n].fir.push(hd.fairway_hit ? 1 : 0);
    }); });
    return Object.values(h).filter(x => x.scores.length > 0).map(x => {
      const avg = x.scores.reduce((a, b) => a + b, 0) / x.scores.length;
      const dist = {}; x.scores.forEach(s => { const k = scoreToPar(s, x.par); dist[k] = (dist[k] || 0) + 1; });
      return { hole: x.hole, par: x.par || 4, sa: x.sa, avg, best: Math.min(...x.scores), worst: Math.max(...x.scores), count: x.scores.length,
        avgPutts: x.putts.length ? x.putts.reduce((a, b) => a + b, 0) / x.putts.length : null,
        girPct: x.gir.length ? (x.gir.reduce((a, b) => a + b, 0) / x.gir.length) * 100 : null,
        firPct: x.fir.length ? (x.fir.reduce((a, b) => a + b, 0) / x.fir.length) * 100 : null, distribution: dist };
    });
  }, [filtered]);

  const stats = useMemo(() => {
    const e18 = filtered.filter(s => s.number_of_holes === 18 || s.number_of_played_holes === 18);
    const n9 = filtered.filter(s => s.number_of_holes === 9 || s.number_of_played_holes === 9);
    const t = e18.map(s => s.adjusted_gross_score).filter(Boolean);
    const par = holes.length === 18 ? holes.reduce((s, h) => s + h.par, 0) : null;
    return { rounds: filtered.length, e18: e18.length, n9: n9.length,
      avg18: t.length ? t.reduce((a, b) => a + b, 0) / t.length : null,
      best18: t.length ? Math.min(...t) : null,
      vsPar: t.length && par ? t.reduce((a, b) => a + b, 0) / t.length - par : null,
      par, holeCount: holes.length };
  }, [filtered, holes]);

  if (!data) return (
    <div style={S.page}><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <div style={S.center}><FileLoader onLoad={d => { setData(d); setCourse(null); setTee("all"); }} /></div></div>);

  return (
    <div style={S.page}><link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet" />
      <header style={S.hdr}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>⛳ Hole-by-Hole Analysis</h1>
          <p style={{ fontSize: 12, opacity: 0.45, margin: "3px 0 0" }}>
            {data.golfer?.first_name ? `${data.golfer.first_name} ${data.golfer.last_name} • HI: ${data.golfer.handicap_index} • ` : ""}
            {data.total_scores} scores ({data.scores_with_hole_detail} with hole detail)
          </p>
        </div>
        <button style={{ ...S.btn, width: "auto", padding: "8px 16px", fontSize: 12 }} onClick={() => { setData(null); setCourse(null); }}>New File</button>
      </header>

      <div style={S.content}>
        <div style={S.ctrls}>
          <div style={S.fg}><label style={S.fl}>Course</label>
            <select style={S.sel} value={course || ""} onChange={e => { setCourse(e.target.value); setTee("all"); }}>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.count} rds, {c.hc} holes)</option>)}
            </select></div>
          {tees.length > 1 && <div style={S.fg}><label style={S.fl}>Tees</label>
            <select style={S.sel} value={tee} onChange={e => setTee(e.target.value)}>
              <option value="all">All Tees</option>{tees.map(t => <option key={t} value={t}>{t}</option>)}
            </select></div>}
          <div style={S.fg}><label style={S.fl}>View</label>
            <div style={S.tog}>{[["stats", "Stats"], ["dist", "Distribution"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} style={{ ...S.togBtn, ...(mode === k ? S.togA : {}) }}>{l}</button>))}</div></div>
        </div>

        {filtered.length === 0 ? <div style={S.empty}>No hole-by-hole data for this selection.</div> : <>
          <SummaryCards stats={stats} />
          <Trend scores={filtered} />
          {holes.length > 0 && <>
            <BarChart holes={holes} />
            <Extremes holes={holes} />
            <div style={{ marginTop: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={S.sec}>Hole Detail</h3>{mode === "dist" && <Legend />}
              </div>
              <HoleTable holes={holes} mode={mode} />
            </div></>}
        </>}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: "100vh", background: "linear-gradient(160deg,#080c0a 0%,#0d1a14 35%,#0a1210 100%)", color: "#e0ded8", fontFamily: "'DM Sans',sans-serif", fontSize: 14 },
  center: { display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", padding: 24 },
  loginCard: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "44px 36px", maxWidth: 440, width: "100%", textAlign: "center" },
  loginTitle: { fontSize: 26, fontWeight: 700, margin: 0, color: "#c9a227", letterSpacing: "-0.02em" },
  loginSub: { fontSize: 12, opacity: 0.4, margin: "4px 0 0", letterSpacing: "0.1em", textTransform: "uppercase" },
  stepBox: { display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14, padding: "12px 14px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)" },
  stepNum: { width: 24, height: 24, borderRadius: "50%", background: "rgba(201,162,39,0.15)", color: "#c9a227", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 },
  stepLabel: { fontSize: 13, fontWeight: 600 },
  code: { display: "block", background: "rgba(0,0,0,0.3)", borderRadius: 4, padding: "8px 10px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", color: "#a8c97e", whiteSpace: "pre", textAlign: "left", marginTop: 4 },
  drop: { border: "2px dashed rgba(255,255,255,0.12)", borderRadius: 12, padding: "32px 20px", cursor: "pointer", transition: "all 0.2s" },
  err: { background: "rgba(231,76,60,0.12)", border: "1px solid rgba(231,76,60,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#e74c3c" },
  btn: { display: "block", width: "100%", padding: 12, background: "linear-gradient(135deg,#c9a227,#a8871e)", border: "none", borderRadius: 8, color: "#0a0f0d", fontSize: 14, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", cursor: "pointer" },
  hdr: { display: "flex", alignItems: "center", gap: 16, padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" },
  content: { padding: "20px 28px 48px", maxWidth: 1100 },
  ctrls: { display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24, alignItems: "flex-end" },
  fg: { display: "flex", flexDirection: "column", gap: 4 },
  fl: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", opacity: 0.35, fontWeight: 700 },
  sel: { padding: "7px 10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 6, color: "#e0ded8", fontSize: 13, fontFamily: "'DM Sans',sans-serif", outline: "none", minWidth: 200 },
  tog: { display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" },
  togBtn: { padding: "7px 14px", background: "rgba(255,255,255,0.03)", border: "none", color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", fontWeight: 500 },
  togA: { background: "rgba(201,162,39,0.18)", color: "#c9a227", fontWeight: 700 },
  grid4: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10, marginBottom: 32 },
  card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: "14px 18px" },
  cardLabel: { fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em", opacity: 0.35, marginBottom: 5, fontWeight: 700 },
  cardVal: { fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", color: "#c9a227", lineHeight: 1 },
  cardSub: { fontSize: 11, opacity: 0.35, marginTop: 4 },
  sec: { fontSize: 13, fontWeight: 700, margin: "0 0 14px", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55 },
  nineHdr: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, padding: "7px 12px", background: "rgba(201,162,39,0.05)", borderRadius: 5, borderLeft: "3px solid #c9a227" },
  th: { padding: "7px 8px", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.35, fontWeight: 700, textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)" },
  td: { padding: "9px 8px", fontSize: 13 },
  mono: { padding: "9px 8px", fontSize: 13, fontFamily: "'JetBrains Mono',monospace" },
  teCard: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 10, padding: 18 },
  teRow: { display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.025)" },
  teRank: { fontSize: 10, opacity: 0.35, fontFamily: "monospace", width: 22 },
  empty: { textAlign: "center", padding: "50px 20px", opacity: 0.4, lineHeight: 1.6 },
};