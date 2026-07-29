import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  YD_TO_M,
  bearing,
  distMeters,
  ellipsePath,
  buildClassifier,
  evaluateChain,
  defaultAims,
  skillAlpha,
  dispersionFor,
  defaultDrive,
  cameraState,
  screenToGround,
  groundToScreen,
  calibrateGroundZ,
} from "./courseMapEngine";

// ---------------------------------------------------------------------------
// 3D course viewer for Suntree CC (Challenge) built on Google's Photorealistic
// 3D Maps. Course geometry from OpenStreetMap (baked JSON). Features: per-hole
// flyovers, tee selection, draggable shot plan with live strokes-gained.
// ---------------------------------------------------------------------------

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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
      window.google.maps.importLibrary("marker"),
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

// drag handle: white ring with emerald core
function handleGlyph() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("width", "26");
  svg.setAttribute("height", "26");
  svg.innerHTML =
    `<circle cx="13" cy="13" r="11" fill="#020617" fill-opacity="0.55" stroke="#ffffff" stroke-width="2.5"/>` +
    `<circle cx="13" cy="13" r="4.5" fill="#34d399"/>`;
  const tmpl = document.createElement("template");
  tmpl.content.append(svg);
  return tmpl;
}

const toLatLng = (pair) => ({ lat: pair[0], lng: pair[1] });

// hex8 colors — the 3D Maps API doesn't accept css color names/rgba()
const FEATURE_STYLES = {
  green: { fill: "#34d39961", stroke: "#34d399f2" },
  fairway: { fill: "#4ade8024", stroke: "#4ade808c" },
  tee: { fill: "#e2e8f059", stroke: "#e2e8f0e6" },
  bunker: { fill: "#facc1566", stroke: "#facc15f2" },
  water: { fill: "#38bdf859", stroke: "#38bdf8e6" },
};

const TEE_NAMES = ["I", "II", "III", "IV", "V", "VI"];
const LIE_LABELS = { fairway: "fwy", green: "green", rough: "rgh", sand: "sand", water: "wtr", ob: "OB" };
const LIE_COLORS = { fairway: "#4ade80", green: "#34d399", rough: "#a3a3a3", sand: "#facc15", water: "#38bdf8", ob: "#f87171" };

function sgColor(sg) {
  if (sg >= 0.03) return "text-emerald-400";
  if (sg <= -0.15) return "text-red-400";
  return "text-gray-300";
}

export default function CourseMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null);
  const overlaysRef = useRef([]);
  const holeMarkersRef = useRef([]);
  const dataRef = useRef(null);
  const lastFlownHole = useRef(undefined);
  const dragRef = useRef(null); // { idx, groundZ }
  const [status, setStatus] = useState(MAPS_KEY ? "idle" : "nokey");
  const [course, setCourse] = useState(null);
  const [hole, setHole] = useState(null);
  const [teeIdx, setTeeIdx] = useState(0);
  const [aims, setAims] = useState(null); // null -> defaults for hole/tee
  const [grabbing, setGrabbing] = useState(false);
  const [screen, setScreen] = useState("menu");
  const [manifest, setManifest] = useState(null);
  const [courseSlug, setCourseSlug] = useState(null);
  const [handicap, setHandicap] = useState(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem("swikle-hcp") : null;
    return v == null || v === "" ? null : Number(v);
  });
  const [hcpDraft, setHcpDraft] = useState(handicap ?? 12);
  // strokes-gained panel: collapsed by default on small screens
  const [sgOpen, setSgOpen] = useState(
    () => typeof window === "undefined" || !window.matchMedia("(max-width: 640px)").matches
  );

  const saveHandicap = useCallback((h) => {
    const v = Math.max(-5, Math.min(40, Math.round(h)));
    setHandicap(v);
    setAims(null); // re-plan with new distances/dispersion
    try { localStorage.setItem("swikle-hcp", String(v)); } catch { /* noop */ }
    return v;
  }, []);

  const startCourse = useCallback((slug, h) => {
    saveHandicap(h);
    setCourseSlug(slug);
    setScreen("map");
    try { localStorage.setItem("swikle-course", slug); } catch { /* noop */ }
  }, [saveHandicap]);

  const hcp = handicap ?? 12;
  const alpha = useMemo(() => skillAlpha(hcp), [hcp]);
  const disp = useMemo(() => dispersionFor(hcp), [hcp]);

  const selectHole = useCallback((num) => {
    setHole(num);
    setTeeIdx(0);
    setAims(null);
  }, []);

  const selected = course?.holes.find((x) => x.num === hole);
  const tee = selected?.tees[Math.min(teeIdx, (selected?.tees.length ?? 1) - 1)];
  const classify = useMemo(() => (course ? buildClassifier(course) : null), [course]);

  const effectiveAims = useMemo(() => {
    if (!selected || !tee) return null;
    return aims ?? defaultAims(tee, selected.par, selected.pin, defaultDrive(hcp));
  }, [selected, tee, aims, hcp]);

  const evalResult = useMemo(() => {
    if (!selected || !tee || !effectiveAims || !classify) return null;
    return evaluateChain({
      teePos: tee.pos,
      teePathYds: tee.yards,
      aims: effectiveAims,
      pin: selected.pin ?? tee.path[tee.path.length - 1],
      par: selected.par,
      classify,
      alpha,
      disp,
    });
  }, [selected, tee, effectiveAims, classify, alpha, disp]);

  // --- boot: menu manifest + optional ?course= deep link ---
  useEffect(() => {
    fetch("/data/courses.json")
      .then((r) => (r.ok ? r.json() : []))
      .then(setManifest)
      .catch(() => setManifest([]));
    const slug = new URLSearchParams(window.location.search).get("course");
    if (slug) {
      setCourseSlug(slug);
      setScreen("map");
    }
  }, []);

  // --- load / switch course ---
  useEffect(() => {
    if (!MAPS_KEY || !courseSlug) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        const [lib, data] = await Promise.all([
          loadGoogleMaps(MAPS_KEY),
          fetch(`/data/${courseSlug}.json`).then((r) => {
            if (!r.ok) throw new Error("course data missing");
            return r.json();
          }),
        ]);
        if (cancelled) return;
        libRef.current = lib;
        dataRef.current = data;
        setCourse(data);
        setHole(null);
        setTeeIdx(0);
        setAims(null);
        lastFlownHole.current = undefined; // force overview flight

        const { Map3DElement, MapMode, Marker3DElement, Marker3DInteractiveElement, AltitudeMode, PinElement } = lib;
        let map = mapRef.current;
        if (!map) {
          map = new Map3DElement({
            center: { ...data.center, altitude: data.elevM ?? 0 },
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

          // debug hooks for headless calibration tests
          if (import.meta.env.DEV) {
            window.__tgv = {
              map,
              cameraState: () => cameraState(map, containerRef.current.clientWidth, containerRef.current.clientHeight),
              screenToGround: (x, y, z = 0) =>
                screenToGround(cameraState(map, containerRef.current.clientWidth, containerRef.current.clientHeight), x, y, z),
              groundToScreen: (pt, z = 0) =>
                groundToScreen(cameraState(map, containerRef.current.clientWidth, containerRef.current.clientHeight), pt, z),
            };
          }
        }

        for (const m of holeMarkersRef.current) m.remove();
        holeMarkersRef.current = [];
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
          holeMarkersRef.current.push(marker);
        }

        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [courseSlug, selectHole]);

  // --- hole features + camera (hole changes only) ---
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    const data = dataRef.current;
    if (!map || !lib || !data || status !== "ready") return;

    const { Polygon3DElement, AltitudeMode } = lib;

    for (const el of overlaysRef.current) el.remove();
    overlaysRef.current = [];

    const flyNeeded = lastFlownHole.current !== hole;
    lastFlownHole.current = hole;

    if (hole == null) {
      if (flyNeeded) {
        map.flyCameraTo({
          endCamera: { center: { ...data.center, altitude: data.elevM ?? 0 }, range: 2000, tilt: 50, heading: 0 },
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
      const t = h.tees[0] ?? { pos: h.line[0], path: h.line };
      const target = h.pin || t.path[t.path.length - 1];
      const lengthM = distMeters(t.pos, target);
      const mid = [(t.pos[0] + target[0]) / 2, (t.pos[1] + target[1]) / 2];
      map.flyCameraTo({
        endCamera: {
          center: { lat: mid[0], lng: mid[1], altitude: h.elevM ?? data.elevM ?? 0 },
          heading: bearing(t.pos, target),
          tilt: 66,
          range: Math.max(300, lengthM * 1.5),
        },
        durationMillis: 2200,
      });
    }
  }, [hole, status, course]);

  // --- shot plan overlays: mutate in place while dragging ---
  const planRef = useRef(null); // { count, line, ellipses[], labels[], labelTexts[], handles[] }
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib || status !== "ready") return;

    const { Polyline3DElement, Polygon3DElement, Marker3DElement, AltitudeMode } = lib;

    const teardown = () => {
      const pr = planRef.current;
      if (!pr) return;
      pr.line.remove();
      for (const el of [...pr.ellipses, ...pr.labels, ...pr.handles]) el.remove();
      planRef.current = null;
    };

    if (!selected || !tee || !effectiveAims) {
      teardown();
      return;
    }

    const points = [tee.pos, ...effectiveAims];
    const segs = effectiveAims.map((aim, i) => {
      const from = points[i];
      const shotM = distMeters(from, aim);
      const head = bearing(from, aim);
      return {
        aim,
        ellipse: ellipsePath(aim, head, shotM * disp.lateral, shotM * disp.depth),
        mid: [(from[0] + aim[0]) / 2, (from[1] + aim[1]) / 2],
        text: `${Math.round(shotM / YD_TO_M)} yds`,
      };
    });

    const pr = planRef.current;
    if (pr && pr.count === segs.length) {
      // fast path (dragging): update geometry in place
      pr.line.path = points.map(toLatLng);
      segs.forEach((g, i) => {
        pr.ellipses[i].path = g.ellipse.map(toLatLng);
        pr.labels[i].position = { lat: g.mid[0], lng: g.mid[1], altitude: 15 };
        pr.handles[i].position = { lat: g.aim[0], lng: g.aim[1], altitude: 1 };
        if (pr.labelTexts[i] !== g.text) {
          pr.labels[i].querySelector("template")?.remove();
          pr.labels[i].append(yardageChip(g.text));
          pr.labelTexts[i] = g.text;
        }
      });
      return;
    }

    teardown();
    const line = new Polyline3DElement({
      path: points.map(toLatLng),
      strokeColor: "#ffffffe6",
      strokeWidth: 5,
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
      drawsOccludedSegments: true,
    });
    map.appendChild(line);

    const ellipses = [], labels = [], labelTexts = [], handles = [];
    for (const g of segs) {
      const disp = new Polygon3DElement({
        path: g.ellipse.map(toLatLng),
        fillColor: "#ffffff30",
        strokeColor: "#ffffffcc",
        strokeWidth: 2,
        altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
        drawsOccludedSegments: true,
      });
      map.appendChild(disp);
      ellipses.push(disp);

      const label = new Marker3DElement({
        position: { lat: g.mid[0], lng: g.mid[1], altitude: 15 },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
      });
      label.append(yardageChip(g.text));
      map.appendChild(label);
      labels.push(label);
      labelTexts.push(g.text);

      const handle = new Marker3DElement({
        position: { lat: g.aim[0], lng: g.aim[1], altitude: 1 },
        altitudeMode: AltitudeMode.RELATIVE_TO_GROUND,
      });
      handle.append(handleGlyph());
      map.appendChild(handle);
      handles.push(handle);
    }
    planRef.current = { count: segs.length, line, ellipses, labels, labelTexts, handles };
  }, [selected, tee, effectiveAims, disp, status]);

  // --- dragging aim points (pointer events + camera raycast) ---
  const aimsRef = useRef(null);
  aimsRef.current = effectiveAims;
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || status !== "ready") return;

    const HIT_PX = 34;

    const hitTest = (x, y) => {
      const a = aimsRef.current;
      if (!a) return -1;
      const cam = cameraState(map, el.clientWidth, el.clientHeight);
      let best = -1, bestD = HIT_PX;
      a.forEach((aim, i) => {
        const px = groundToScreen(cam, aim, cam.centerAlt);
        if (!px) return;
        const d = Math.hypot(px[0] - x, px[1] - y);
        if (d < bestD) { bestD = d; best = i; }
      });
      return best;
    };

    const onDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const idx = hitTest(x, y);
      if (idx < 0) return;
      const cam = cameraState(map, el.clientWidth, el.clientHeight);
      const groundZ = calibrateGroundZ(cam, x, y, aimsRef.current[idx]);
      dragRef.current = { idx, groundZ };
      setGrabbing(true);
      e.stopPropagation();
      e.preventDefault();
      try { el.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };

    const onMove = (e) => {
      const drag = dragRef.current;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (!drag) {
        // hover cursor feedback
        el.style.cursor = hitTest(x, y) >= 0 ? "grab" : "";
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      const cam = cameraState(map, el.clientWidth, el.clientHeight);
      const pt = screenToGround(cam, x, y, drag.groundZ);
      if (!pt) return;
      setAims((prev) => {
        const base = prev ?? aimsRef.current;
        if (!base) return prev;
        const next = base.slice();
        next[drag.idx] = pt;
        return next;
      });
    };

    const onUp = (e) => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setGrabbing(false);
      e.stopPropagation();
      try { el.releasePointerCapture(e.pointerId); } catch { /* noop */ }
    };

    // capture phase so the map's own camera-pan handlers never see the drag
    el.addEventListener("pointerdown", onDown, { capture: true });
    el.addEventListener("pointermove", onMove, { capture: true });
    el.addEventListener("pointerup", onUp, { capture: true });
    el.addEventListener("pointercancel", onUp, { capture: true });
    return () => {
      el.removeEventListener("pointerdown", onDown, { capture: true });
      el.removeEventListener("pointermove", onMove, { capture: true });
      el.removeEventListener("pointerup", onUp, { capture: true });
      el.removeEventListener("pointercancel", onUp, { capture: true });
    };
  }, [status]);

  const orbitGreen = useCallback(() => {
    const map = mapRef.current;
    const data = dataRef.current;
    if (!map || !data || hole == null) return;
    const h = data.holes.find((x) => x.num === hole);
    const target = h.pin || h.line[h.line.length - 1];
    map.flyCameraAround({
      camera: { center: { lat: target[0], lng: target[1], altitude: h.elevM ?? data.elevM ?? 0 }, tilt: 60, range: 160 },
      durationMillis: 16000,
      repeatCount: 1,
    });
  }, [hole]);

  if (status === "nokey" || status === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-2">3D Course View</h1>
          {status === "nokey" ? (
            <p className="text-sm text-gray-400">
              A Google Maps API key is required. Add it as{" "}
              <code className="text-cyan-400">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
              <code className="text-cyan-400">.env.local</code> (and in Vercel env settings), then rebuild.
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-400">
                Failed to load the course. Check the browser console — most likely the API key is invalid
                or the Maps JavaScript API isn&apos;t enabled for it.
              </p>
              <button
                onClick={() => { setStatus("idle"); setCourseSlug(null); setScreen("menu"); }}
                className="mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-bold text-white"
              >
                Back to menu
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] bg-slate-950 text-gray-100 flex flex-col overflow-hidden">
      <div className="relative flex-1" style={grabbing ? { cursor: "grabbing" } : undefined}>
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
                {course?.course ?? "3D Course View"}
              </div>
              <div className="text-lg font-bold leading-tight">
                {selected ? `Hole ${selected.num}` : course?.location ?? ""}
              </div>
              {selected && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Par {selected.par} &middot; {tee?.yards ?? selected.yards} yds
                  {selected.hcp != null && <> &middot; HCP {selected.hcp}</>}
                </div>
              )}
              <button
                onClick={() => { setHcpDraft(hcp); setScreen("menu"); }}
                className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold text-emerald-300 hover:bg-slate-700"
                title="Change your handicap or course"
              >
                You: {handicap == null ? "set handicap" : `${hcp} hcp`}
                <span className="text-gray-500">&#9998;</span>
              </button>
            </div>
            <div className="flex flex-col gap-2 pointer-events-auto">
              <button
                onClick={() => { setHcpDraft(hcp); setScreen("menu"); }}
                className="bg-slate-950/80 backdrop-blur rounded-lg px-3 py-2 text-xs font-semibold text-gray-300 hover:text-white"
              >
                Courses
              </button>
              {selected && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>

        {/* tee box + strokes gained panel */}
        {selected && !sgOpen && (
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none flex flex-col gap-2 items-start">
            <button
              onClick={() => setSgOpen(true)}
              className="bg-slate-950/85 backdrop-blur rounded-xl px-3 py-2 pointer-events-auto max-w-sm w-full sm:w-auto flex items-center gap-3 text-left"
            >
              <span className="shrink-0 rounded-lg bg-emerald-600 px-2 py-1 text-center">
                <span className="block text-[9px] font-bold leading-tight text-emerald-100">
                  {TEE_NAMES[Math.min(teeIdx, selected.tees.length - 1)] ?? "T"}
                </span>
                <span className="block text-xs font-bold leading-tight text-white">{tee?.yards}</span>
              </span>
              {evalResult ? (
                <span className="flex-1 min-w-0">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-semibold">
                    Expected score
                  </span>
                  <span className="block text-sm font-bold leading-tight">
                    {evalResult.expected.toFixed(2)}
                    <span
                      className={`ml-1.5 text-xs font-bold ${
                        evalResult.expected <= selected.par ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      ({evalResult.expected - selected.par >= 0 ? "+" : ""}
                      {(evalResult.expected - selected.par).toFixed(2)})
                    </span>
                  </span>
                </span>
              ) : (
                <span className="flex-1" />
              )}
              <span className="shrink-0 text-[10px] uppercase tracking-widest font-semibold text-emerald-300">
                Details &#9652;
              </span>
            </button>
          </div>
        )}
        {selected && sgOpen && (
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none flex flex-col gap-2 items-start">
            <div className="bg-slate-950/85 backdrop-blur rounded-xl px-3 py-2 pointer-events-auto max-w-sm w-full sm:w-auto">
              <div className="flex items-center justify-between gap-4 mb-1.5">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Tee box</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setAims(null)}
                    className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 hover:text-white"
                  >
                    Reset shots
                  </button>
                  <button
                    onClick={() => setSgOpen(false)}
                    className="text-[10px] uppercase tracking-widest font-semibold text-emerald-300 hover:text-white"
                    title="Collapse panel"
                  >
                    Hide &#9662;
                  </button>
                </div>
              </div>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {selected.tees.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => { setTeeIdx(i); setAims(null); }}
                    className={`shrink-0 rounded-lg px-2.5 py-1.5 text-center transition-colors ${
                      i === Math.min(teeIdx, selected.tees.length - 1)
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="text-[10px] font-bold leading-tight opacity-80">{TEE_NAMES[i] ?? i + 1}</div>
                    <div className="text-xs font-bold leading-tight">{t.yards}</div>
                  </button>
                ))}
              </div>

              {evalResult && (
                <div className="mt-2 border-t border-slate-800 pt-2">
                  {evalResult.shots.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5 text-xs">
                      <span className="w-4 text-gray-500 font-bold">{i + 1}</span>
                      <span className="w-14 font-semibold">{s.shotYds} yds</span>
                      <span className={`w-14 font-bold ${sgColor(s.sg)}`}>
                        {s.sg >= 0 ? "+" : ""}{s.sg.toFixed(2)}
                      </span>
                      <span className="flex-1 flex gap-1.5 text-[10px] text-gray-400 overflow-hidden whitespace-nowrap">
                        {Object.entries(s.pcts)
                          .filter(([, v]) => v >= 0.03)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 3)
                          .map(([lie, v]) => (
                            <span key={lie}>
                              <span
                                className="inline-block w-1.5 h-1.5 rounded-full mr-0.5"
                                style={{ background: LIE_COLORS[lie] }}
                              />
                              {Math.round(v * 100)}% {LIE_LABELS[lie]}
                            </span>
                          ))}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-slate-800">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">
                      Expected score
                    </span>
                    <span className="text-sm font-bold">
                      {evalResult.expected.toFixed(2)}
                      <span
                        className={`ml-1.5 text-xs font-bold ${
                          evalResult.expected <= selected.par ? "text-emerald-400" : "text-amber-400"
                        }`}
                      >
                        ({evalResult.expected - selected.par >= 0 ? "+" : ""}
                        {(evalResult.expected - selected.par).toFixed(2)} vs par)
                      </span>
                    </span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Drag the <span className="text-emerald-400">&#9679;</span> targets to re-plan shots &middot; SG vs your {hcp}-hcp baseline
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* menu screen: handicap + course selection */}
      {screen === "menu" && (
        <div className="absolute inset-0 z-50 overflow-y-auto bg-slate-950">
          <div className="min-h-full flex items-center justify-center p-6">
            <div className="w-full max-w-md">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-emerald-400 font-semibold">
                    Swikle Golf
                  </div>
                  <h1 className="text-2xl font-bold mt-0.5">3D Course Scout</h1>
                  <p className="text-xs text-gray-400 mt-1">
                    Photorealistic flyovers with shot planning tuned to your game.
                  </p>
                </div>
                {course && (
                  <button
                    onClick={() => { saveHandicap(hcpDraft); setScreen("map"); }}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-gray-300"
                    title="Back to the map"
                  >
                    &#10005;
                  </button>
                )}
              </div>

              <div className="mt-5 bg-slate-900 border border-slate-700 rounded-2xl p-5">
                <h2 className="text-sm font-bold">What&apos;s your handicap?</h2>
                <div className="flex items-center gap-3 mt-3">
                  <input
                    type="range"
                    min={-5}
                    max={36}
                    step={1}
                    value={hcpDraft}
                    onChange={(e) => setHcpDraft(Number(e.target.value))}
                    className="flex-1 accent-emerald-500"
                  />
                  <span className="w-14 text-center text-xl font-bold text-emerald-400">
                    {hcpDraft < 0 ? `+${-hcpDraft}` : hcpDraft}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[0, 5, 10, 15, 20, 25].map((v) => (
                    <button
                      key={v}
                      onClick={() => setHcpDraft(v)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                        hcpDraft === v ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
                      }`}
                    >
                      {v === 0 ? "Scratch" : v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <h2 className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold mb-2">
                  Pick a course
                </h2>
                {manifest == null && (
                  <div className="text-sm text-gray-500 animate-pulse py-4 text-center">Loading courses&hellip;</div>
                )}
                <div className="flex flex-col gap-2">
                  {(manifest ?? []).map((c) =>
                    c.available ? (
                      <button
                        key={c.slug}
                        onClick={() => startCourse(c.slug, hcpDraft)}
                        className={`text-left rounded-2xl border p-4 transition-colors ${
                          c.slug === courseSlug
                            ? "bg-emerald-950/60 border-emerald-600"
                            : "bg-slate-900 border-slate-700 hover:border-emerald-600"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold">{c.name}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {c.location} &middot; {c.holes} holes &middot; Par {c.par} &middot;{" "}
                              {c.yards.toLocaleString()} yds
                            </div>
                          </div>
                          <span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">
                            {c.slug === courseSlug ? "Resume" : "Play"}
                          </span>
                        </div>
                      </button>
                    ) : (
                      <div
                        key={c.slug}
                        className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 opacity-60"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-bold text-gray-400">{c.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {c.location} &middot; {c.note ?? "Coming soon"}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-bold text-gray-500">
                            Soon
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
