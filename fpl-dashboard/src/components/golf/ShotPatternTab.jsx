import { useMemo, useState } from "react";
import HOLES from "./data/suntreeClassic.json";
import { aggregateHoles, RESULT_ORDER, RESULT_COLORS, RESULT_LABELS, fmtToPar } from "./data";
import { Card } from "./ui";

/**
 * Shot Pattern (beta) — Suntree Classic only.
 *
 * GHIN provides per-hole scores but no shot GPS, so instead of literal shot
 * dots this renders each hole from OpenStreetMap course geometry and overlays
 * the golfer's scoring: how they play the hole, and a "strokes gained vs your
 * own Classic baseline" that flags relative strengths and weaknesses.
 */

const COURSE_KEY = "suntree-classic";

// map palette
const FILL = {
  water: "#5aa9dd",
  fairway: "#6fae52",
  bunker: "#e7d9a6",
  green: "#9ed86b",
  tee: "#b7c79c",
};
const ROUGH = "#3f6b3a";

/** Strokes gained per hole vs the golfer's own difficulty-adjusted baseline.
 *  Distributes their total over-par across played holes by stroke index, so
 *  SG sums to ~0 — positive means a relative strength. */
function strokesGained(statByHole) {
  const played = HOLES.filter((h) => statByHole[h.n]?.count > 0);
  const totalOver = played.reduce((s, h) => s + (statByHole[h.n].avg - h.par), 0);
  const wsum = played.reduce((s, h) => s + (19 - h.hcp), 0) || 1;
  const sg = {};
  for (const h of played) {
    const expectedOver = totalOver * ((19 - h.hcp) / wsum);
    const expected = h.par + expectedOver;
    sg[h.n] = expected - statByHole[h.n].avg; // + = better than expected
  }
  return sg;
}

function sgColor(v) {
  if (v == null) return "#e5e7eb";
  if (v > 0.15) return "#16a34a";
  if (v > 0.03) return "#86c06c";
  if (v < -0.15) return "#dc2626";
  if (v < -0.03) return "#f59e0b";
  return "#9ca3af";
}

function HoleMap({ hole }) {
  const { w, h } = hole;
  // flip Y so the green sits at the top (world +Y = toward green)
  const fy = (p) => [p[0], h - p[1]];
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${fy(p).join(",")}`).join(" ") + "Z";
  const linePath = hole.line.map((p, i) => `${i ? "L" : "M"}${fy(p).join(",")}`).join(" ");
  const tee = fy(hole.tee);
  const green = fy(hole.green);
  const layer = (t) => hole.shapes.filter((s) => s.t === t);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-auto block rounded-xl"
      style={{ maxHeight: 460, background: ROUGH }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <clipPath id="holeclip">
          <rect x="0" y="0" width={w} height={h} />
        </clipPath>
        <radialGradient id="greensheen" cx="0.5" cy="0.4" r="0.7">
          <stop offset="0%" stopColor="#b9e88a" />
          <stop offset="100%" stopColor={FILL.green} />
        </radialGradient>
      </defs>
      <g clipPath="url(#holeclip)">
        {layer("water").map((s, i) => (
          <path key={`w${i}`} d={path(s.pts)} fill={FILL.water} opacity={0.9} />
        ))}
        {layer("fairway").map((s, i) => (
          <path key={`f${i}`} d={path(s.pts)} fill={FILL.fairway} />
        ))}
        {layer("bunker").map((s, i) => (
          <path
            key={`b${i}`}
            d={path(s.pts)}
            fill={FILL.bunker}
            stroke="#d8c98a"
            strokeWidth={0.6}
          />
        ))}
        {/* centerline tee->green */}
        <path
          d={linePath}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.35}
          strokeWidth={1.4}
          strokeDasharray="4 4"
          strokeLinecap="round"
        />
        {layer("green").map((s, i) => (
          <path key={`g${i}`} d={path(s.pts)} fill="url(#greensheen)" stroke="#7fbf50" strokeWidth={0.5} />
        ))}
        {layer("tee").map((s, i) => (
          <path key={`t${i}`} d={path(s.pts)} fill={FILL.tee} />
        ))}
        {/* tee marker */}
        <circle cx={tee[0]} cy={tee[1]} r={3.4} fill="#fff" stroke="#166534" strokeWidth={1.2} />
        {/* flag at green */}
        <g>
          <line x1={green[0]} y1={green[1]} x2={green[0]} y2={green[1] - 14} stroke="#1f2937" strokeWidth={1.2} />
          <path d={`M${green[0]},${green[1] - 14} l8,3 l-8,3 z`} fill="#dc2626" />
          <circle cx={green[0]} cy={green[1]} r={2} fill="#1f2937" />
        </g>
      </g>
    </svg>
  );
}

function DistBar({ dist, total }) {
  return (
    <div className="flex h-3 rounded overflow-hidden bg-gray-100">
      {RESULT_ORDER.map((k) => {
        const c = dist[k] || 0;
        if (!c) return null;
        return (
          <div
            key={k}
            title={`${RESULT_LABELS[k]}: ${c}`}
            style={{ width: `${(c / total) * 100}%`, background: RESULT_COLORS[k] }}
          />
        );
      })}
    </div>
  );
}

export default function ShotPatternTab({ rounds }) {
  const classicRounds = useMemo(
    () => rounds.filter((r) => r.courseKey === COURSE_KEY && r.hd),
    [rounds]
  );
  const statByHole = useMemo(() => {
    const agg = aggregateHoles(classicRounds);
    const m = {};
    for (const h of agg) m[h.hole] = h;
    return m;
  }, [classicRounds]);
  const sg = useMemo(() => strokesGained(statByHole), [statByHole]);

  const [sel, setSel] = useState(1);
  const hole = HOLES.find((h) => h.n === sel);
  const stat = statByHole[sel];
  const holeSG = sg[sel];

  const totalTracked = classicRounds.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-bold uppercase tracking-wider text-white bg-green-700 px-2 py-0.5 rounded">
          Beta
        </span>
        <h2 className="text-lg font-bold text-green-900">Shot Pattern · Suntree Classic</h2>
      </div>

      {totalTracked === 0 ? (
        <Card>
          <p className="text-center text-gray-400 py-10">
            No hole-by-hole Suntree Classic rounds found yet. Play the Classic and post
            your scores hole-by-hole in GHIN to unlock this.
          </p>
        </Card>
      ) : (
        <>
          {/* SG heat strip */}
          <Card title={`Strokes gained by hole · ${totalTracked} rounds`}>
            <div className="grid grid-cols-9 gap-1.5">
              {HOLES.map((h) => {
                const v = sg[h.n];
                const active = h.n === sel;
                return (
                  <button
                    key={h.n}
                    type="button"
                    onClick={() => setSel(h.n)}
                    className={`rounded-lg py-1.5 text-center cursor-pointer border transition-all ${
                      active ? "ring-2 ring-green-700 border-green-700" : "border-transparent"
                    }`}
                    style={{ background: v == null ? "#f3f4f6" : sgColor(v) + "22" }}
                  >
                    <div className="text-[11px] font-bold text-gray-800 font-mono">{h.n}</div>
                    <div
                      className="text-[9px] font-mono font-semibold"
                      style={{ color: sgColor(v) }}
                    >
                      {v == null ? "—" : (v > 0 ? "+" : "") + v.toFixed(1)}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#16a34a]" /> strength
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#dc2626]" /> weakness
              </span>
              <span className="text-gray-400">
                vs your own difficulty-adjusted Classic baseline
              </span>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <Card>
              <div className="flex items-baseline justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSel((s) => (s > 1 ? s - 1 : 18))}
                    className="w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-green-600"
                  >
                    ‹
                  </button>
                  <span className="text-xl font-bold text-green-900">Hole {sel}</span>
                  <button
                    type="button"
                    onClick={() => setSel((s) => (s < 18 ? s + 1 : 1))}
                    className="w-7 h-7 rounded-full border border-gray-200 bg-white text-gray-600 cursor-pointer hover:border-green-600"
                  >
                    ›
                  </button>
                </div>
                <div className="text-xs text-gray-500 font-mono">
                  Par {hole.par} · {hole.yards}y · Hcp {hole.hcp}
                </div>
              </div>
              <HoleMap hole={hole} />
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px] text-gray-500">
                {[
                  ["fairway", "Fairway"],
                  ["green", "Green"],
                  ["bunker", "Bunker"],
                  ["water", "Water"],
                ].map(([k, l]) => (
                  <span key={k} className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: FILL[k] }} />
                    {l}
                  </span>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-2xl font-bold font-mono text-gray-900">
                      {stat ? stat.avg.toFixed(2) : "—"}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Your avg
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {stat ? fmtToPar(stat.avg - hole.par, { decimals: 2 }) + " vs par" : ""}
                    </div>
                  </div>
                  <div>
                    <div
                      className="text-2xl font-bold font-mono"
                      style={{ color: sgColor(holeSG) }}
                    >
                      {holeSG == null ? "—" : (holeSG > 0 ? "+" : "") + holeSG.toFixed(2)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Strokes gained
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {holeSG == null
                        ? ""
                        : holeSG > 0.03
                          ? "strength"
                          : holeSG < -0.03
                            ? "weakness"
                            : "neutral"}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono text-gray-900">
                      {stat ? stat.count : 0}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                      Times played
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {stat ? `best ${stat.best} · worst ${stat.worst}` : ""}
                    </div>
                  </div>
                </div>
              </Card>

              {stat && (
                <Card title="Scoring distribution">
                  <DistBar dist={stat.distribution} total={stat.count} />
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[10px]">
                    {RESULT_ORDER.map((k) => {
                      const c = stat.distribution[k] || 0;
                      if (!c) return null;
                      return (
                        <span key={k} className="flex items-center gap-1 text-gray-600">
                          <span className="w-2 h-2 rounded-sm" style={{ background: RESULT_COLORS[k] }} />
                          {RESULT_LABELS[k]} {c}
                        </span>
                      );
                    })}
                  </div>
                </Card>
              )}

              <p className="text-[11px] text-gray-400 px-1">
                Beta: GHIN doesn't share shot GPS, so this maps your scoring onto the hole
                rather than individual shots. Strokes gained compares your average to your
                own difficulty-adjusted baseline across Classic rounds.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
