import { useState, useEffect, useRef, useCallback } from "react";

// ---------------------------------------------------------------------------
// 3D course viewer for Suntree CC (Challenge) built on Google's Photorealistic
// 3D Maps (Map3DElement). Course geometry comes from OpenStreetMap, baked into
// /data/suntree-challenge.json by scripts/fetch-suntree-osm.mjs.
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
    window.google.maps.importLibrary("maps3d").then(resolve, reject);
  });
  return mapsLoaded;
}

const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

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
  const dy = (b[0] - a[0]) * 111320;
  const dx = (b[1] - a[1]) * 111320 * Math.cos(toRad((a[0] + b[0]) / 2));
  return Math.hypot(dx, dy);
}

const toLatLng = (pair) => ({ lat: pair[0], lng: pair[1] });

// hex8 colors (#RRGGBBAA) — the 3D Maps API doesn't accept css color names/rgba()
const FEATURE_STYLES = {
  green: { fill: "#34d39961", stroke: "#34d399f2" },
  fairway: { fill: "#4ade8024", stroke: "#4ade808c" },
  tee: { fill: "#e2e8f059", stroke: "#e2e8f0e6" },
  bunker: { fill: "#facc1566", stroke: "#facc15f2" },
  water: { fill: "#38bdf859", stroke: "#38bdf8e6" },
};

export default function CourseMap() {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const libRef = useRef(null); // maps3d library classes
  const overlaysRef = useRef([]); // per-hole overlay elements
  const dataRef = useRef(null);
  const [status, setStatus] = useState(MAPS_KEY ? "loading" : "nokey");
  const [course, setCourse] = useState(null);
  const [hole, setHole] = useState(null); // null = course overview

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

        const { Map3DElement, MapMode, Marker3DElement, Marker3DInteractiveElement, AltitudeMode } = lib;
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
            label: String(h.num),
          });
          marker.addEventListener("gmp-click", () => setHole(h.num));
          map.appendChild(marker);
        }

        setStatus("ready");
      } catch (e) {
        console.error(e);
        if (!cancelled) setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // --- draw overlays + fly camera when selected hole changes ---
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    const data = dataRef.current;
    if (!map || !lib || !data || status !== "ready") return;

    const { Polyline3DElement, Polygon3DElement, AltitudeMode } = lib;

    // clear previous hole overlays
    for (const el of overlaysRef.current) el.remove();
    overlaysRef.current = [];

    if (hole == null) {
      // overview: fly out over the whole course
      map.flyCameraTo({
        endCamera: { center: { ...data.center, altitude: 0 }, range: 2000, tilt: 50, heading: 0 },
        durationMillis: 2000,
      });
      return;
    }

    const h = data.holes.find((x) => x.num === hole);
    if (!h) return;

    // hole routing line, tee -> green
    const line = new Polyline3DElement({
      path: h.line.map(toLatLng),
      strokeColor: "#ffffffe6",
      strokeWidth: 6,
      altitudeMode: AltitudeMode.CLAMP_TO_GROUND,
      drawsOccludedSegments: true,
    });
    map.appendChild(line);
    overlaysRef.current.push(line);

    // this hole's features
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

    // camera: stand behind the tee looking down the hole
    const tee = h.line[0];
    const target = h.pin || h.line[h.line.length - 1];
    const lengthM = distMeters(tee, target);
    const mid = [(tee[0] + target[0]) / 2, (tee[1] + target[1]) / 2];
    map.flyCameraTo({
      endCamera: {
        center: { lat: mid[0], lng: mid[1], altitude: 0 },
        heading: bearing(tee, target),
        tilt: 66,
        range: Math.max(300, lengthM * 1.5),
      },
      durationMillis: 2200,
    });
  }, [hole, status]);

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

  // ---- no-key / error screens ----
  if (status === "nokey" || status === "error") {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6">
          <h1 className="text-xl font-bold mb-2">Suntree CC &middot; 3D Course View</h1>
          {status === "nokey" ? (
            <>
              <p className="text-sm text-gray-400 mb-4">
                A Google Maps API key is required. Add it as{" "}
                <code className="text-cyan-400">VITE_GOOGLE_MAPS_API_KEY</code> in{" "}
                <code className="text-cyan-400">.env.local</code> (and in Vercel env settings for
                production), then rebuild.
              </p>
              <ol className="text-sm text-gray-400 list-decimal list-inside space-y-1">
                <li>console.cloud.google.com &rarr; create project</li>
                <li>Enable &ldquo;Maps JavaScript API&rdquo;</li>
                <li>Credentials &rarr; create API key</li>
              </ol>
            </>
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
                  Par {selected.par} &middot; {selected.yards} yds &middot; HCP {selected.hcp}
                </div>
              )}
            </div>
            {selected && (
              <div className="flex flex-col gap-2 pointer-events-auto">
                <button
                  onClick={() => setHole(null)}
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

        {/* legend (only when a hole is selected) */}
        {selected && (
          <div className="absolute bottom-2 left-3 pointer-events-none">
            <div className="bg-slate-950/70 backdrop-blur rounded-lg px-3 py-2 flex gap-3 text-[10px] text-gray-300">
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#34d399" }} />Green</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#facc15" }} />Sand</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: "#38bdf8" }} />Water</span>
            </div>
          </div>
        )}
      </div>

      {/* hole selector strip */}
      <div className="bg-slate-950 border-t border-slate-800 px-2 py-2 safe-area-bottom">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setHole(null)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              hole == null ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            All
          </button>
          {(course?.holes ?? []).map((h) => (
            <button
              key={h.num}
              onClick={() => setHole(h.num)}
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
