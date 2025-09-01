import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * GuillotineLeagueLive.jsx
 * A single-file React component that renders a fun, live-updating "guillotine" visualization
 * for a Sleeper guillotine league. Lowest weekly score inches closest to the blade.
 *
 * ⚙️ Quick Start
 * 1) Replace LEAGUE_ID below with your Sleeper league id (string).
 * 2) Drop this component anywhere in your React app and render <GuillotineLeagueLive />.
 * 3) Optionally tweak POLL_MS, theme colors, and the layout sizes.
 *
 * 🧠 How it works
 * - Polls Sleeper API for: state (current week), users, rosters, and week matchups.
 * - Normalizes weekly points to a 0–1 scale and maps that to distance from the guillotine.
 * - Animates avatars sliding toward the blade as scores change.
 * - Highlights the current lowest scorer in red; shows a dotted “danger zone” line.
 *
 * Notes:
 * - Sleeper is read-only and public (no API key needed). Endpoints used are lightweight.
 * - If games are live, /matchups/{week} typically updates as points change.
 */

const LEAGUE_ID = "1263224475726385152"; // ← replace me!
const POLL_MS = 30000; // 30s polling (adjust as desired)

// Minimal shadcn-style button replacement to keep this file standalone
const Button = ({ children, className = "", ...props }) => (
  <button
    className={`px-3 py-2 rounded-2xl shadow-sm border text-sm hover:shadow transition ${className}`}
    {...props}
  >
    {children}
  </button>
);

const useSleeperData = (leagueId, selectedWeek) => {
  const [users, setUsers] = useState([]);
  const [rosters, setRosters] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [week, setWeek] = useState(selectedWeek || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = async (activeWeek) => {
    try {
      setLoading(true);
      setError("");

      // 1) Get current NFL week if not provided
      let wk = activeWeek;
      if (!wk) {
        const state = await fetch("https://api.sleeper.app/v1/state/nfl").then((r) => r.json());
        wk = state?.week ?? null;
      }
      setWeek(wk);

      // 2) League users & rosters
      const [usersRes, rostersRes, matchupsRes] = await Promise.all([
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/users`).then((r) => r.json()),
        fetch(`https://api.sleeper.app/v1/league/${leagueId}/rosters`).then((r) => r.json()),
        wk ? fetch(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${wk}`).then((r) => r.json()) : Promise.resolve([])
      ]);

      setUsers(Array.isArray(usersRes) ? usersRes : []);
      setRosters(Array.isArray(rostersRes) ? rostersRes : []);
      setMatchups(Array.isArray(matchupsRes) ? matchupsRes : []);
    } catch (e) {
      console.error(e);
      setError("Failed fetching Sleeper data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!leagueId) return;
    fetchAll(selectedWeek);
    const id = setInterval(() => fetchAll(selectedWeek), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId, selectedWeek]);

  return { users, rosters, matchups, week, loading, error, refetch: fetchAll };
};

const avatarUrl = (user) => {
  if (!user?.avatar) return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.display_name || "?")}`;
  return `https://sleepercdn.com/avatars/thumbs/${user.avatar}`;
};

const buildOwnerMap = (users) => {
  const map = new Map();
  users.forEach((u) => map.set(u.user_id, u));
  return map;
};

const buildRosterOwnerMap = (rosters, usersById) => {
  const map = new Map();
  rosters.forEach((r) => {
    const owner = usersById.get(r.owner_id) || null;
    map.set(r.roster_id, owner);
  });
  return map;
};

const normalizeScores = (entries) => {
  if (!entries.length) return [];
  const pts = entries.map((e) => e.points ?? 0);
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(0.001, max - min);
  return entries.map((e) => ({
    ...e,
    _norm: (e.points - min) / span, // 0 for min, 1 for max
    _min: min,
    _max: max,
  }));
};

const GuillotineSVG = () => (
  <svg viewBox="0 0 120 200" className="w-20 h-40 md:w-28 md:h-56">
    {/* Frame */}
    <rect x="10" y="10" width="100" height="180" rx="6" className="fill-gray-200 stroke-gray-400" strokeWidth="2" />
    {/* Uprights */}
    <rect x="25" y="20" width="15" height="160" className="fill-gray-500" />
    <rect x="80" y="20" width="15" height="160" className="fill-gray-500" />
    {/* Crossbeam */}
    <rect x="25" y="20" width="70" height="10" className="fill-gray-600" />
    {/* Blade */}
    <polygon points="25,60 95,60 60,95" className="fill-red-500" />
    {/* Base */}
    <rect x="15" y="170" width="90" height="15" className="fill-gray-700" />
  </svg>
);

const ParticipantCard = ({ p, idx, total, laneHeight }) => {
  const name = p?.owner?.display_name || `Team ${p.roster_id}`;
  const pts = (p.points ?? 0).toFixed(2);
  const isLowest = p._isLowest;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2 shadow-sm border bg-white/80 backdrop-blur ${isLowest ? "border-red-400" : "border-gray-200"}`}
      style={{ height: laneHeight - 8 }}
    >
      <img src={avatarUrl(p.owner)} alt={name} className="w-8 h-8 rounded-full object-cover" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`truncate font-medium ${isLowest ? "text-red-600" : "text-gray-800"}`}>{name}</span>
          {isLowest && <span className="text-xs text-red-500">(lowest)</span>}
        </div>
        <div className="text-xs text-gray-500">Week pts: {pts}</div>
      </div>
    </motion.div>
  );
};

export default function GuillotineLeagueLive() {
  const [leagueId, setLeagueId] = useState(LEAGUE_ID);
  const [manualWeek, setManualWeek] = useState("");
  const [paused, setPaused] = useState(false);
  const { users, rosters, matchups, week, loading, error, refetch } = useSleeperData(leagueId, manualWeek ? Number(manualWeek) : null);
  const usersById = useMemo(() => buildOwnerMap(users), [users]);
  const rosterOwner = useMemo(() => buildRosterOwnerMap(rosters, usersById), [rosters, usersById]);

  const lanesRef = useRef(null);
  const width = lanesRef.current?.clientWidth || 0;
  const height = lanesRef.current?.clientHeight || 0;

  // Merge matchup entries by roster_id (Sleeper returns one per roster)
  const entries = useMemo(() => {
    const byRoster = new Map();
    (matchups || []).forEach((m) => {
      const rosterId = m.roster_id;
      const points = typeof m.points === "number" ? m.points : 0;
      const prev = byRoster.get(rosterId) || { roster_id: rosterId, points: 0 };
      byRoster.set(rosterId, { ...prev, points });
    });

    const arr = Array.from(byRoster.values()).map((e) => ({
      ...e,
      owner: rosterOwner.get(e.roster_id) || null,
    }));

    // Normalize for positioning
    const normalized = normalizeScores(arr);

    // Flag lowest
    let min = Infinity;
    normalized.forEach((n) => (min = Math.min(min, n.points ?? 0)));
    return normalized
      .map((n) => ({ ...n, _isLowest: (n.points ?? 0) === min }))
      .sort((a, b) => (a.points ?? 0) - (b.points ?? 0)); // lowest first
  }, [matchups, rosterOwner]);

  const minPts = useMemo(() => (entries.length ? Math.min(...entries.map((e) => e.points ?? 0)) : 0), [entries]);
  const maxPts = useMemo(() => (entries.length ? Math.max(...entries.map((e) => e.points ?? 0)) : 0), [entries]);

  const lanes = entries.length || 10;
  const laneHeight = Math.min(72, Math.max(44, Math.floor((height || 520) / Math.max(8, lanes))));

  // Map normalized score to X position: 0 (min) near blade; 1 (max) far left
  const xFor = (norm) => {
    const padding = 100; // px padding on both sides
    const bladeWidth = 120; // Guillotine width area at right
    const usable = Math.max(200, (width || 900) - padding * 2 - bladeWidth);
    // Reverse: low score -> norm=0 -> x close to blade
    const x = padding + usable * (1 - norm);
    return x;
  };

  const bladeX = useMemo(() => (width || 900) - 120, [width]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => refetch(manualWeek ? Number(manualWeek) : undefined), POLL_MS);
    return () => clearInterval(id);
  }, [paused, manualWeek, refetch]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl md:text-2xl font-semibold">Guillotine League Live</span>
          <span className="text-sm text-gray-500">(Sleeper)</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="px-3 py-2 rounded-xl border text-sm w-52"
            placeholder="Sleeper League ID"
            value={leagueId}
            onChange={(e) => setLeagueId(e.target.value)}
          />
          <input
            className="px-3 py-2 rounded-xl border text-sm w-28"
            placeholder="Week (auto if blank)"
            value={manualWeek}
            onChange={(e) => setManualWeek(e.target.value)}
          />
          <Button onClick={() => refetch(manualWeek ? Number(manualWeek) : undefined)}>
            Refresh
          </Button>
          <Button className={paused ? "bg-amber-100" : ""} onClick={() => setPaused((p) => !p)}>
            {paused ? "Resume" : "Pause"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4">
        {/* Lanes with avatars */}
        <div ref={lanesRef} className="relative rounded-3xl p-4 md:p-6 border bg-gradient-to-b from-gray-50 to-white min-h-[520px] overflow-hidden">
          {/* Danger line at current min */}
          {entries.length > 0 && (
            <div className="absolute top-0 bottom-0 border-dashed border-r-2 border-red-300" style={{ left: xFor((minPts - minPts) / Math.max(0.001, maxPts - minPts)) }} />
          )}

          <div className="absolute inset-0">
            <AnimatePresence>
              {entries.map((p, idx) => {
                const y = 16 + idx * laneHeight;
                const x = xFor(p._norm);
                return (
                  <motion.div
                    key={p.roster_id}
                    className="absolute"
                    initial={{ opacity: 0, x: x - 40, y }}
                    animate={{ opacity: 1, x, y }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    style={{ width: Math.min(520, (width || 900) * 0.55) }}
                  >
                    <ParticipantCard p={p} idx={idx} total={entries.length} laneHeight={laneHeight} />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Legend / scale */}
          <div className="absolute bottom-3 left-4 right-36 text-xs text-gray-500 flex items-center gap-2">
            <span>Far left = highest score</span>
            <span>•</span>
            <span>Blade side = lowest score</span>
          </div>
        </div>

        {/* Guillotine column */}
        <div className="flex md:flex-col items-center md:items-stretch gap-3 md:gap-4">
          <div className="flex items-center justify-center rounded-3xl border bg-white/70 p-3">
            <GuillotineSVG />
          </div>
          <div className="rounded-2xl border p-3 bg-white/80">
            <div className="text-sm text-gray-700">Week: <span className="font-semibold">{manualWeek || week || "—"}</span></div>
            <div className="text-sm text-gray-700">Teams: <span className="font-semibold">{entries.length || rosters.length || "—"}</span></div>
            <div className="text-sm text-gray-700">Min pts: <span className="font-semibold">{minPts.toFixed(2)}</span></div>
            <div className="text-sm text-gray-700">Max pts: <span className="font-semibold">{maxPts.toFixed(2)}</span></div>
            <div className="text-xs text-gray-500 mt-2">Polling every {Math.round(POLL_MS / 1000)}s</div>
          </div>
          <div className="rounded-2xl border p-3 bg-white/80 text-xs text-gray-600 leading-snug">
            <div className="font-semibold text-gray-800 mb-1">Tips</div>
            <ul className="list-disc ml-4 space-y-1">
              <li>Paste your league ID above (from Sleeper URL).</li>
              <li>Leave week blank to auto‑detect; set manually for past weeks.</li>
              <li>Lowest scorer is outlined in red.</li>
              <li>Use your own CSS to theme the blade ⚔️.</li>
            </ul>
          </div>
        </div>
      </div>

      {loading && (
        <div className="mt-4 text-sm text-gray-500">Loading Sleeper data…</div>
      )}
      {error && (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-6 text-sm text-gray-500">
        <span>Built for guillotine leagues — visualize the weekly squeeze!</span>
      </div>
    </div>
  );
}
