/** Hand-rolled SVG charts for the /golf dashboard (no chart deps). */

/**
 * Score trend line chart. Expects rounds of a single length (all 18 or all 9),
 * oldest-first ordering is handled internally.
 */
export function TrendChart({ rounds, label }) {
  const pts0 = rounds
    .filter((r) => r.ags != null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (pts0.length < 3) return null;

  const vals = pts0.map((r) => r.ags);
  const mn = Math.min(...vals) - 2;
  const mx = Math.max(...vals) + 2;
  const rng = mx - mn || 1;
  const W = 700;
  const H = 160;
  const p = { t: 12, r: 12, b: 22, l: 34 };
  const pW = W - p.l - p.r;
  const pH = H - p.t - p.b;
  const x = (i) => p.l + (pts0.length === 1 ? pW / 2 : (i / (pts0.length - 1)) * pW);
  const y = (v) => p.t + (1 - (v - mn) / rng) * pH;

  const best = Math.min(...vals);
  const pathD = pts0.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.ags)}`).join(" ");

  // 5-round moving average
  const maD = pts0
    .map((r, i) => {
      const win = vals.slice(Math.max(0, i - 4), i + 1);
      const m = win.reduce((a, b) => a + b, 0) / win.length;
      return `${i === 0 ? "M" : "L"}${x(i)},${y(m)}`;
    })
    .join(" ");

  // vertical markers at year boundaries
  const yearTicks = [];
  for (let i = 1; i < pts0.length; i++) {
    const yr = pts0[i].date.slice(0, 4);
    if (yr !== pts0[i - 1].date.slice(0, 4)) yearTicks.push({ x: x(i), yr });
  }

  const svgW = Math.min(1400, Math.max(680, pts0.length * 26));

  return (
    <div className="min-w-0">
      <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-gray-200 bg-gray-50/50 touch-pan-x">
        <svg
          width={svgW}
          height={(svgW * H) / W}
          viewBox={`0 0 ${W} ${H}`}
          className="block shrink-0"
          preserveAspectRatio="xMinYMid meet"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const gy = p.t + (1 - pct) * pH;
            return (
              <g key={pct}>
                <line x1={p.l} x2={W - p.r} y1={gy} y2={gy} stroke="#e5e7eb" />
                <text
                  x={p.l - 4}
                  y={gy + 3}
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
          {yearTicks.map((t) => (
            <g key={t.yr}>
              <line
                x1={t.x}
                x2={t.x}
                y1={p.t}
                y2={p.t + pH}
                stroke="#d1d5db"
                strokeDasharray="2,3"
              />
              <text x={t.x + 3} y={p.t + 8} fill="#9ca3af" fontSize={8}>
                {t.yr}
              </text>
            </g>
          ))}
          <path d={maD} fill="none" stroke="#f59e0b" strokeWidth={1.5} opacity={0.75} />
          <path
            d={pathD}
            fill="none"
            stroke="#15803d"
            strokeWidth={1.5}
            strokeLinejoin="round"
            opacity={0.55}
          />
          {pts0.map((r, i) => (
            <circle
              key={r.id ?? i}
              cx={x(i)}
              cy={y(r.ags)}
              r={r.ags === best ? 3.5 : 2.5}
              fill={r.ags === best ? "#d4af37" : "#16a34a"}
              stroke={r.ags === best ? "#a16207" : "none"}
              strokeWidth={r.ags === best ? 1 : 0}
            >
              <title>{`${r.date} — ${r.ags} @ ${r.courseName}`}</title>
            </circle>
          ))}
          {[pts0[0], pts0[pts0.length - 1]].map((r, i) => (
            <text
              key={i}
              x={i === 0 ? p.l : W - p.r}
              y={H - 4}
              textAnchor={i === 0 ? "start" : "end"}
              fill="#9ca3af"
              fontSize={9}
            >
              {new Date(r.date + "T12:00:00").toLocaleDateString("en-US", {
                month: "short",
                year: "2-digit",
              })}
            </text>
          ))}
        </svg>
      </div>
      <div className="flex gap-4 mt-1.5 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-green-700" /> {label || "Score"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-0.5 bg-amber-500" /> 5-round avg
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-[#d4af37]" /> Best
        </span>
      </div>
    </div>
  );
}

/** Average vs par per hole, as a bar chart. */
export function HoleBarChart({ holes }) {
  if (!holes.length) return null;
  const mx = Math.max(...holes.map((h) => Math.abs(h.avg - h.par)), 0.5);
  const sc = 80 / mx;
  return (
    <div className="w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain rounded-lg border border-gray-200 bg-gray-50/50 touch-pan-x">
      <div className="inline-flex items-end gap-2 h-[170px] pt-5 pb-1 px-3 min-h-[170px]">
        {holes.map((h) => {
          const d = h.avg - h.par;
          const over = d > 0;
          return (
            <div
              key={h.hole}
              className="flex w-10 shrink-0 flex-col items-center h-full justify-end"
              title={`Hole ${h.hole} (par ${h.par}): avg ${h.avg.toFixed(2)}`}
            >
              <div
                className={`text-[9px] mb-0.5 font-mono tabular-nums ${
                  over ? "text-red-600" : "text-green-600"
                }`}
              >
                {d > 0 ? "+" : ""}
                {d.toFixed(1)}
              </div>
              <div
                className="w-[70%] max-w-[26px] rounded-t"
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
              <div className="text-[9px] text-gray-400">P{h.par}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
