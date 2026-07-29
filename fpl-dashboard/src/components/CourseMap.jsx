import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// 3D course viewer for Suntree CC (Challenge) built on Google's Photorealistic
// 3D Maps (Map3DElement). Course geometry comes from OpenStreetMap, baked into
// /data/suntree-challenge.json by scripts/fetch-suntree-osm.mjs.
// Features: per-hole flyovers, tee box selection, shot planning with landing
// points + dispersion ellipses, segment yardages.
// ---------------------------------------------------------------------------

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Official Google Maps JS API bootstrap (importLibrary loader)
let mapsLoaded = null;
function loadGoogleMaps(key) {
  if (mapsLoaded) return mapsLoaded;
  mapsLoaded = new Promise((resolve, reject) => {
    /* eslint-disable */
    ((g) => {
      var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary",
        q = "__ib__", m = document, b = window;
      b = b[c] || (b[c] = {});
      var d = b.maps || (b.maps = {}), r = new Set(), e = new URLSearchParams(),
        u = () => h || (h = new Promise(async (f, n) => {
          await (a = m.createElement("script"));
          e.set("libraries", [...r] + "");
          for (k in g) e.set(k.replace(/[A-Z]/g, (t) => "_" + t[0].toLowerCase()), g[k]);
          e.set("callback", c + ".maps." + q);
          a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
          d[q] = f;
          a.onerror = () => (h = n(Error(p + " could not load.")));
          a.nonce = m.querySelector("script[nonce]")?.nonce || "";
          m.head.append(a);
        }));
      d[l] ? console.warn(p + " only loads once. Ignoring:", g)
        : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
    })({ key, v: "beta" });
    /* eslint-enable */
    Promise.all([
      window.google.maps.importLibrary("maps3d"),
      window.google.maps.importLibrary("marker"), // PinElement for custom pins
    ]).then(([maps3d, marker]) => resolve({ ...maps3d, PinElement: marker.PinElement }), reject);
  });
  return mapsLoaded;
}

// small dark "chip" with text, used for floating yardage labels
function yardageChip(text) {
  const w = text.length * 9 + 18;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", "28");
  svg.innerHTML =
    `<rect x="1" y="1" width="${w - 2}" height="26" rx="13" fill="#020617" fill-opacity="0.85" stroke="#ffffff" stroke-opacity="0.35"/>` +
    `<text x="${w / 2}" y="19" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="700" font-family="Helvetica, Arial, sans-serif">${text}</text>`;
  const tmpl = document.createElement("template");
  tmpl.content.append(svg);
  return tmpl;
}

// ---- geo helpers (equirectangular approx, fine at course scale) ----
const M_PER_DEG_LAT = 111320;
const YD_TO_M = 0.9144;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;
const toLatLng = (pair) => ({ lat: pair[0], lng: pair[1] });

function bearing(a, b) {
  // a, b: [lat, lng]
  const [lat1, lng1] = [toRad(a[0]), toRad(a[1])];
  const [lat2, lng2] = [toRad(b[0]), toRad(b[1])];
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function distMeters(a, b) {
  const dy = (b[0] - a[0]) * M_PER_DEG_LAT;
  const dx = (b[1] - a[1]) * M_PER_DEG_LAT * Math.cos(toRad((a[0] + b[0]) / 2));
  return Math.hypot(dx, dy);
}

// move from point along heading (deg) by dist meters -> [lat, lng]
function offset(p, headingDeg, distM) {
  const th = toRad(headingDeg);
  const dLat = (distM * Math.cos(th)) / M_PER_DEG_LAT;
  const dLng = (distM * Math.sin(th)) / (M_PER_DEG_LAT * Math.cos(toRad(p[0])));
  return [p[0] + dLat, p[1] + dLng];
}

// walk `distM` meters along a polyline path; returns { point, heading }
function pointAlong(path, distM) {
  let remaining = distM;
  for (let i = 0; i < path.length - 1; i++) {
    const seg = distMeters(path[i], path[i + 1]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      const point = [
        path[i][0] + (path[i + 1][0] - path[i][0]) * t,
        path[i][1] + (path[i + 1][1] - path[i][1]) * t,
      ];
      return { point, heading: bearing(path[i], path[i + 1]) };
    }
    remaining -= seg;
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2] || last;
  return { point: last, heading: bearing(prev, last) };
}

function pathLengthM(path) {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) total += distMeters(path[i], path[i + 1]);
  return total;
}

// dispersion ellipse polygon: lateral half-width a, depth half-length b (meters)
function ellipse(center, headingDeg, aM, bM, n = 36) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const phi = (i / n) * 2 * Math.PI;
    const lateral = aM * Math.sin(phi); // across the line of play
    const depth = bM * Math.cos(phi); // along the line of play
    const p1 = offset(center, headingDeg, depth);
    pts.push(toLatLng(offset(p1, headingDeg + 90, lateral)));
  }
  return pts;
}

// plan shots from a tee: returns { points: [[lat,lng]...], shots: [{from,to,yds,heading}] }
function planShots(tee, par) {
  const path = tee.path;
  const totalM = pathLengthM(path);
  const targets = []; // distances (m) along path where each shot lands
  if (par >= 4) {
    // cap the drive so at least a 20yd pitch remains
    const driveM = Math.min(tee.driveYds * YD_TO_M, totalM - 20 * YD_TO_M);
    targets.push(driveM);
    if (par >= 5) {
      const remainingM = totalM - driveM;
      const approachM = 100 * YD_TO_M; // leave a 100yd approach
      if (remainingM > 220 * YD_TO_M) targets.push(totalM - approachM);
    }
  }
  targets.push(totalM); // final shot to the green

  const points = [path[0]];
  const shots = [];
  let prevM = 0;
  let prevPt = path[0];
  for (const d of targets) {
    const { point, heading } = pointAlong(path, d);
    const yds = Math.round((d - prevM) / YD_TO_M);
    shots.push({ from: prevPt, to: point, yds, heading: bearing(prevPt, point) || heading });
    points.push(point);
    prevM = d;
    prevPt = point;
  }
  return { points, shots };
}

// hex8 colors (#RRGGBBAA) — the 3D Maps API doesn't accept css color names/rgba()
const FEATURE_STYLES = {
  green: { fill: "#34d39961", stroke: "#34d399f2" },
  fairway: { fill: "#4ade8024", stroke: "#4ade808c" },
  tee: { fill: "#e2e8f059", stroke: "#e2e8f0e6" },
  bunker: { fill: "#facc1566", stroke: "#facc15f2" },
  water: { fill: "#38bdf859", stroke: "#38bdf8e6" },
};

const TEE_NAMES = ["I", "II", "III", "IV", "V", "VI"];

export default function CourseMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null); // maps3d library classes
  const overlaysRef = useRef([]); // per-hole overlay elements
  const dataRef = useRef(null);
  const lastFlownHole = useRef(undefined);
  const [status, setStatus] = useState(MAPS_KEY ? "loading" : "nokey");
  const [course, setCourse] = useState(null);
  const [hole, setHole] = useState(null); // null = course overview
  const [teeIdx, setTeeIdx] = useState(0);
  const [driveYds, setDriveYds] = useState(250);

  const selectHole = useCallback((num) => {
    setHole(num);
    setTeeIdx(0);
  }, []);

  // --- boot: load data + maps, create the 3D map ---
  useEffect(() => {
    if (!MAPS_KEY) return;
    let cancelled = false;
    (async () => {
      try {
        const [lib, data] = await Promise.all([
          loadGoogleMaps(MAPS_KEY),
          fetch("/data/suntree-challenge.json").then((r) => {
            if (!r.ok) throw new Error("course data missing");
            return r.json();
          }),
        ]);
        if (cancelled) return;
        libRef.current = lib;
        dataRef.current = data;
        setCourse(data);

        const { Map3DElement, MapMode, Marker3DElement, Marker3DInteractiveElement, AltitudeMode, PinElement } = lib;
        const map = new Map3DElement({
          center: { ...data.center, altitude: 0 },
          range: 2000,
          tilt: 50,
          heading: 0,
          ...(MapMode ? { mode: MapMode.SATELLITE } : {}),
        });
        map.style.width = "100%";
        map.style.height = "100%";
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(map);
        mapRef.current = map;

        // hole-number markers at each tee (interactive variant supports clicks)
        const MarkerClass = Marker3DInteractiveElement || Marker3DElement;
        for (const h of data.holes) {
          const marker = new MarkerClass({
            position: { lat: h.line[0][0], lng: h.line[0][1], altitude: 12 },
            altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
            extruded: true,
          });
          if (PinElement) {
            const pin = new PinElement({
              background: "#059669",
              borderColor: "#022c22",
              glyphColor: "#ffffff",
              glyph: String(h.num),
              scale: 1.0,
            });
            marker.append(pin.element ?? pin);
          } else {
            marker.label = String(h.num);
          }
          marker.addEventListener("gmp-click", () => selectHole(h.num));
          map.appendChild(marker);
        }

        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [selectHole]);

  // --- hole features + camera: redrawn only when the hole changes ---
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    const data = dataRef.current;
    if (!map || !lib || !data || status !== "ready") return;

    const { Polygon3DElement, AltitudeMode } = lib;

    // clear previous hole's feature overlays
    for (const el of overlaysRef.current) el.remove();
    overlaysRef.current = [];

    const flyNeeded = lastFlownHole.current !== hole;
    lastFlownHole.current = hole;

    if (hole == null) {
      if (flyNeeded) {
        map.flyCameraTo({
          endCamera: { center: { ...data.center, altitude: 0 }, range: 2000, tilt: 50, heading: 0 },
          durationMillis: 2000,
        });
      }
      return;
    }

    const h = data.holes.find((x) => x.num === hole);
    if (!h) return;

    for (const f of data.features) {
      if (f.hole !== h.num) continue;
      const style = FEATURE_STYLES[f.type];
      if (!style) continue;
      const poly = new Polygon3DElement({
        path: f.coords.map(toLatLng),
        fillColor: style.fill,
        strokeColor: style.stroke,
        strokeWidth: 2,
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
        drawsOccludedSegments: true,
      });
      map.appendChild(poly);
      overlaysRef.current.push(poly);
    }

    if (flyNeeded) {
      const tee = h.tees[0] ?? { pos: h.line[0], path: h.line };
      const target = h.pin || tee.path[tee.path.length - 1];
      const lengthM = distMeters(tee.pos, target);
      const mid = [(tee.pos[0] + target[0]) / 2, (tee.pos[1] + target[1]) / 2];
      map.flyCameraTo({
        endCamera: {
          center: { lat: mid[0], lng: mid[1], altitude: 0 },
          heading: bearing(tee.pos, target),
          tilt: 66,
          range: Math.max(300, lengthM * 1.5),
        },
        durationMillis: 2200,
      });
    }
  }, [hole, status]);

  // --- shot plan: mutated in place so slider drags don't churn 3D elements ---
  const planRef = useRef(null); // { key, line, ellipses[], labels[], labelTexts[] }
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    const data = dataRef.current;
    if (!map || !lib || !data || status !== "ready") return;

    const { Polyline3DElement, Polygon3DElement, Marker3DElement, AltitudeMode } = lib;

    const teardown = () => {
      const pr = planRef.current;
      if (!pr) return;
      pr.line.remove();
      for (const el of pr.ellipses) el.remove();
      for (const el of pr.labels) el.remove();
      planRef.current = null;
    };

    const h = hole != null && data.holes.find((x) => x.num === hole);
    const tee = h && h.tees[Math.min(teeIdx, h.tees.length - 1)];
    if (!h || !tee) {
      teardown();
      return;
    }

    const plan = planShots({ ...tee, driveYds }, h.par);
    const shotGeom = plan.shots.map((shot) => {
      const aM = shot.yds * YD_TO_M * 0.09; // lateral half-width ~9%
      const bM = shot.yds * YD_TO_M * 0.055; // depth half-length ~5.5%
      const mid = [(shot.from[0] + shot.to[0]) / 2, (shot.from[1] + shot.to[1]) / 2];
      return {
        ellipsePath: ellipse(shot.to, shot.heading, aM, bM),
        labelPos: { lat: mid[0], lng: mid[1], altitude: 15 },
        labelText: `${shot.yds} yds`,
      };
    });

    const key = `${hole}:${teeIdx}`;
    const pr = planRef.current;

    if (pr && pr.key === key && pr.ellipses.length === plan.shots.length) {
      // fast path: update geometry on the existing elements
      pr.line.path = plan.points.map(toLatLng);
      shotGeom.forEach((g, i) => {
        pr.ellipses[i].path = g.ellipsePath;
        pr.labels[i].position = g.labelPos;
        if (pr.labelTexts[i] !== g.labelText) {
          pr.labels[i].querySelector("template")?.remove();
          pr.labels[i].append(yardageChip(g.labelText));
          pr.labelTexts[i] = g.labelText;
        }
      });
      return;
    }

    // slow path: (re)build the plan elements
    teardown();
    const line = new Polyline3DElement({
      path: plan.points.map(toLatLng),
      strokeColor: "#ffffffe6",
      strokeWidth: 5,
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
      drawsOccludedSegments: true,
    });
    map.appendChild(line);

    const ellipses = [];
    const labels = [];
    const labelTexts = [];
    for (const g of shotGeom) {
      const disp = new Polygon3DElement({
        path: g.ellipsePath,
        fillColor: "#ffffff30",
        strokeColor: "#ffffffcc",
        strokeWidth: 2,
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
        drawsOccludedSegments: true,
      });
      map.appendChild(disp);
      ellipses.push(disp);

      const label = new Marker3DElement({
        position: g.labelPos,
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
      });
      label.append(yardageChip(g.labelText));
      map.appendChild(label);
      labels.push(label);
      labelTexts.push(g.labelText);
    }
    planRef.current = { key, line, ellipses, labels, labelTexts };
  }, [hole, teeIdx, driveYds, status]);

  const orbitGreen = useCallback(() => {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data || hole == null) return;
    const h = data.holes.find((x) => x.num === hole);
    const target = h.pin || h.line[h.line.length - 1];
    map.flyCameraAround({
      camera: {
        center: { lat: target[0], lng: target[1], altitude: 0 },
        tilt: 60,
        range: 160,
      },
      durationMillis: 16000,
      repeatCount: 1,
    });
  }, [hole]);

  const selected = course?.holes.find((x) => x.num === hole);
  const selectedTee = selected?.tees[Math.min(teeIdx, (selected?.tees.length ?? 1) - 1)];

  // ---- no-key / error screens ----
  if (status === "nokey" || status === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-2">Suntree CC &middot; 3D Course View</h1>
          {status === "nokey" ? (
            <p className="text-sm text-gray-400">
              A Google Maps API key is required. Add it as{" "}
              <code className="text-cyan-400">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
              <code className="text-cyan-400">.env.local</code> (and in Vercel env settings), then
              rebuild.
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Failed to load the map. Check the browser console — most likely the API key is
              invalid or the Maps JavaScript API isn&apos;t enabled for it.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-slate-950 text-gray-100 flex flex-col overflow-hidden">
      {/* map */}
      <div className="relative flex-1">
        <div ref={containerRef} className="absolute inset-0" />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
            <div className="text-gray-400 text-sm animate-pulse">Loading 3D course&hellip;</div>
          </div>
        )}

        {/* header */}
        <div className="absolute top-0 left-0 right-0 p-3 pointer-events-none">
          <div className="flex items-start justify-between gap-2">
            <div className="bg-slate-950/80 backdrop-blur rounded-xl px-4 py-2.5 pointer-events-auto">
              <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
                Suntree Country Club
              </div>
              <div className="text-lg font-bold leading-tight">
                {selected ? `Hole ${selected.num}` : "Challenge Course"}
              </div>
              {selected && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Par {selected.par} &middot; {selectedTee?.yards ?? selected.yards} yds &middot;
                  {" "}HCP {selected.hcp}
                </div>
              )}
            </div>
            {selected && (
              <div className="flex flex-col gap-2 pointer-events-auto">
                <button
                  onClick={() => selectHole(null)}
                  className="bg-slate-950/80 backdrop-blur rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white"
                >
                  Overview
                </button>
                <button
                  onClick={orbitGreen}
                  className="bg-emerald-600/90 backdrop-blur rounded-lg px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Orbit green
                </button>
              </div>
            )}
          </div>
        </div>

        {/* tee + drive controls */}
        {selected && (
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none flex flex-col gap-2 items-start">
            <div className="bg-slate-950/80 backdrop-blur rounded-xl px-3 py-2 pointer-events-auto max-w-full">
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-1.5">
                Tee box
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {selected.tees.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setTeeIdx(i)}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center transition-colors ${
                      i === Math.min(teeIdx, selected.tees.length - 1)
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="text-[10px] font-bold leading-tight opacity-80">
                      {TEE_NAMES[i] ?? i + 1}
                    </div>
                    <div className="text-xs font-bold leading-tight">{t.yards}</div>
                  </button>
                ))}
              </div>
              {selected.par >= 4 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                    Drive
                  </span>
                  <input
                    type="range"
                    min={180}
                    max={320}
                    step={5}
                    value={driveYds}
                    onChange={(e) => setDriveYds(Number(e.target.value))}
                    className="w-36 accent-emerald-500"
                  />
                  <span className="text-xs font-bold text-emerald-400 w-14">{driveYds} yds</span>
                </div>
              )}
            </div>

            {/* legend */}
            <div className="bg-slate-950/70 backdrop-blur rounded-lg px-3 py-1.5 flex gap-3 text-[10px] text-gray-300 pointer-events-none">
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#34d399" }} />Green</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#facc15" }} />Sand</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#38bdf8" }} />Water</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1 border border-white/70" style={{ background: "#ffffff30" }} />Dispersion</span>
            </div>
          </div>
        )}
      </div>

      {/* hole selector strip */}
      <div className="bg-slate-950 border-t border-slate-800 px-2 py-2 safe-area-bottom">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => selectHole(null)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              hole == null ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          {(course?.holes ?? []).map((h) => (
            <button
              key={h.num}
              onClick={() => selectHole(h.num)}
              className={`shrink-0 rounded-lg px-2.5 py-1 text-center transition-colors ${
                hole === h.num ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              <div className="text-sm font-bold leading-tight">{h.num}</div>
              <div className="text-[9px] opacity-75 leading-tight">Par {h.par}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
