import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Constants ---
const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const MANIFEST_URL = `${PUBLIC_BASE}fpl-league-manifest.json`;
const REFRESH_INTERVAL_MS = 300000; // 5 minutes

// --- Helper Functions ---
const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeStr = (s) => (s ?? '').toString().normalize('NFC').replace(/\u00A0/g, ' ').trim();

// --- Main Dashboard Component ---
const FPLMultiGameweekDashboard = () => {
  const [data, setData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [papaReady, setPapaReady] = useState(false);

  // Refs for managing fetch cycles and preventing race conditions
  const cycleAbortRef = useRef(null);
  const fetchCycleIdRef = useRef(0);

  // Load PapaParse script from a CDN
  useEffect(() => {
    if (window.Papa) {
      setPapaReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'papaparse-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    script.async = true;
    script.onload = () => setPapaReady(true);
    script.onerror = () => {
      setError("Error: Failed to load data parsing library.");
      setLoading(false);
    };
    document.body.appendChild(script);
  }, []);

  // Process gameweek data using manifest system
  const processGameweekData = useCallback(async (gameweek, manifest, signal) => {
    try {
      const pointerUrl = manifest?.gameweeks?.[gameweek];
      if (!pointerUrl) throw new Error(`No pointer URL for GW${gameweek} in manifest`);

      // Fetch the unique pointer file
      const pointerRes = await fetch(`${pointerUrl}?v=${bust()}`, { cache: 'no-store', signal });
      if (!pointerRes.ok) throw new Error(`Could not fetch pointer for GW${gameweek} (${pointerRes.status})`);
      const pointerData = await pointerRes.json();
      
      const csvUrl = pointerData?.url;
      if (!csvUrl) throw new Error(`Malformed pointer for GW${gameweek}`);

      // Fetch the final versioned CSV
      const csvRes = await fetch(csvUrl, { cache: 'no-store', signal });
      if (!csvRes.ok) throw new Error(`HTTP ${csvRes.status} for ${csvUrl}`);
      const csvText = await csvRes.text();
      
      if (csvText.trim() === "The game is being updated.") return [];

      // Parse CSV data
      const parsed = window.Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
      if (parsed.errors?.length) console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);

      // Apply any necessary data normalization
      parsed.data.forEach(row => {
        if (row.player === 'JoÃ£o Pedro Junqueira de Jesus') row.player = 'JoÃ£o Pedro';
      });

      return parsed.data;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(`GW${gameweek} fetch failed:`, err);
      }
      return [];
    }
  }, []);

  // --- Advanced Data Fetching & Processing ---
  const fetchData = useCallback(async () => {
    // Abort any previous fetch cycle and start a new one
    if (cycleAbortRef.current) cycleAbortRef.current.abort();
    const abort = new AbortController();
    cycleAbortRef.current = abort;
    const myId = ++fetchCycleIdRef.current;

    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch the manifest file
      const manifestRes = await fetch(`${MANIFEST_URL}?v=${bust()}`, { 
        method: 'GET', 
        cache: 'no-store', 
        signal: abort.signal 
      });
      
      if (!manifestRes.ok) {
        throw new Error(`Could not load league manifest (${manifestRes.status})`);
      }
      
      const manifest = await manifestRes.json();

      // Step 2: Determine available gameweeks from the manifest
      const remoteGameweeks = Object.keys(manifest?.gameweeks || {}).map(Number);
      const available = [...new Set([1, ...remoteGameweeks])].sort((a, b) => a - b);
      
      if (available.length === 0) {
        throw new Error("No gameweek data found in manifest.");
      }

      // Guard: only the latest fetch cycle may update state
      if (fetchCycleIdRef.current !== myId || abort.signal.aborted) return;
      setAvailableGameweeks(available);

      // Step 3: Fetch all gameweeks in parallel
      const gameweekPromises = available.map(async (gw) => {
        if (gw === 1) {
          // Hardcoded GW1 data for reliability
          return [
            { manager_name: "Garrett Kunkel", entry_team_name: "kunkel_fpl", player: "TOTAL", points_applied: 78, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Andrew Vidal", entry_team_name: "Las Cucarachas", player: "TOTAL", points_applied: 76, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Brett Swikle", entry_team_name: "swikle_time", player: "TOTAL", points_applied: 74, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "John Matthew", entry_team_name: "matthewfpl", player: "TOTAL", points_applied: 73, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Jared Alexander", entry_team_name: "Jared's Jinxes", player: "TOTAL", points_applied: 67, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Joe Curran", entry_team_name: "Curran's Crew", player: "TOTAL", points_applied: 64, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "John Sebastian", entry_team_name: "Sebastian Squad", player: "TOTAL", points_applied: 62, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Nate Cohen", entry_team_name: "Cohen's Corner", player: "TOTAL", points_applied: 60, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Chris Munoz", entry_team_name: "Munoz Magic", player: "TOTAL", points_applied: 60, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Evan Bagheri", entry_team_name: "Bagheri's Best", player: "TOTAL", points_applied: 57, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Dean Maghsadi", entry_team_name: "Dean's Dream", player: "TOTAL", points_applied: 55, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Brian Pleines", entry_team_name: "Pleines Power", player: "TOTAL", points_applied: 53, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Max Maier", entry_team_name: "Maier's Marvels", player: "TOTAL", points_applied: 53, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Adrian McLoughlin", entry_team_name: "McLoughlin FC", player: "TOTAL", points_applied: 52, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Wes H", entry_team_name: "Wes Warriors", player: "TOTAL", points_applied: 50, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Kevin Tomek", entry_team_name: "Tomek's Team", player: "TOTAL", points_applied: 48, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Kevin K", entry_team_name: "Kevin's Kicks", player: "TOTAL", points_applied: 41, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Tony Tharakan", entry_team_name: "Tharakan's Threat", player: "TOTAL", points_applied: 39, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "JP Fischer", entry_team_name: "Fischer's Force", player: "TOTAL", points_applied: 35, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Patrick McCleary", entry_team_name: "McCleary's Might", player: "TOTAL", points_applied: 34, is_captain: 'False', multiplier: 1, points_gw: 0 }
          ];
        }
        return await processGameweekData(gw, manifest, abort.signal);
      });
      
      const results = await Promise.all(gameweekPromises);

      // --- This data aggregation logic is preserved from the original FPLDashboard ---
      // Aggregate data across all gameweeks into a cumulative total
      const managerData = {};

      results.forEach((gwData, gwIndex) => {
        const gameweek = available[gwIndex];
        const managerStatsThisGw = {};

        gwData.forEach(row => {
            if (!row.manager_name) return;

            if (!managerStatsThisGw[row.manager_name]) {
                managerStatsThisGw[row.manager_name] = {
                    total_points: 0,
                    bench_points: 0,
                    captain_player: 'N/A',
                    team_name: normalizeStr(row.entry_team_name)
                };
            }

            if (row.player === 'TOTAL') {
                managerStatsThisGw[row.manager_name].total_points = row.points_applied;
            }
            if (row.is_captain === 'True') {
                 managerStatsThisGw[row.manager_name].captain_player = row.player;
            }
            if (row.multiplier === 0) {
                 managerStatsThisGw[row.manager_name].bench_points += parseFloat(row.points_gw) || 0;
            }
        });

        Object.entries(managerStatsThisGw).forEach(([name, stats]) => {
            if (!managerData[name]) {
                managerData[name] = {
                    manager_name: name,
                    team_name: stats.team_name,
                    total_points: 0,
                    bench_points: 0,
                    gameweeks: {}
                };
            }
            managerData[name].total_points += stats.total_points;
            managerData[name].bench_points += stats.bench_points;
            managerData[name].gameweeks[gameweek] = {
                points: stats.total_points,
                captain: stats.captain_player
            };
        });
      });
      
      // Sort and add league designations for the chart
      const combinedData = Object.values(managerData);
      const sortedData = combinedData
        .sort((a, b) => {
          // Primary sort: by total_points descending
          if (b.total_points !== a.total_points) {
            return b.total_points - a.total_points;
          }
          // Secondary sort (tie-breaker): by manager_name alphabetically
          return a.manager_name.localeCompare(b.manager_name);
        })
        .map((item, index) => {
          const totalManagers = combinedData.length;
          let designation = 'Mid-table';
          if (index < 4) designation = 'Champions League';
          else if (index === 4) designation = 'Europa League';
          else if (index >= totalManagers - 3) designation = 'Relegation';

          return { ...item, rank: index + 1, designation, displayName: item.manager_name };
        });

      if (fetchCycleIdRef.current === myId && !abort.signal.aborted) {
        setData(sortedData);
        setError(null);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Error loading data:', err);
        if (fetchCycleIdRef.current === myId) setError(err.message);
      }
    } finally {
      if (fetchCycleIdRef.current === myId && !abort.signal.aborted) {
        setLoading(false);
      }
    }
  }, [processGameweekData]);

  // Effect to run fetchData on mount and at a set interval
  useEffect(() => {
    if (papaReady) {
        fetchData();
        const intervalId = setInterval(fetchData, REFRESH_INTERVAL_MS);
        return () => {
          clearInterval(intervalId);
          if (cycleAbortRef.current) cycleAbortRef.current.abort(); // Cleanup on unmount
        };
    }
  }, [papaReady, fetchData]);

  // --- UI Components (Unchanged) ---
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const gwBreakdown = availableGameweeks.map(gw => `GW${gw}: ${data.gameweeks[gw]?.points || 0}`).join(' | ');
      return (
        <div className="bg-slate-800 text-white p-2 rounded-md shadow-lg border border-slate-600">
          <p className="font-bold text-sm">{data.manager_name}</p>
          <p className="text-gray-400 text-xs mb-1">"{data.team_name}"</p>
          <p className="font-semibold text-cyan-300 text-xs">Total: {data.total_points} pts</p>
          <p className="text-gray-300 text-[10px] mt-1">{gwBreakdown}</p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-cyan-400 text-xl animate-pulse">Loading Chart Data...</div>;
  }
  if (error) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-red-400 text-xl p-4 text-center">{error}</div>;
  }

  const gameweekRangeText = availableGameweeks.length > 0 ? `GW${availableGameweeks[0]}-${availableGameweeks[availableGameweeks.length - 1]}` : '';

  return (
    <div className="min-h-screen bg-slate-900 p-2 sm:p-4 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-4">
          <h1 className="text-xl sm:text-3xl font-light text-white mb-2">BPL Season Chart</h1>
          <p className="text-sm text-gray-400">{gameweekRangeText}</p>
        </header>

        <main>
          <div className="bg-slate-800/50 rounded-lg p-2 sm:p-4 shadow-lg border border-slate-700">
            <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-600 mr-1.5"></span>Champions League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></span>Europa League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1.5"></span>Mid-table</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-600 mr-1.5"></span>Relegation</div>
            </div>
            
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="displayName" stroke="#94A3B8" angle={-60} textAnchor="end" height={60} fontSize={10} interval={0} />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}/>
                <Bar dataKey="total_points" radius={[2, 2, 0, 0]}>
                  {data.map((entry, index) => {
                    let color = '#6B7280'; // Mid-table
                    if (entry.designation === 'Champions League') color = '#2563EB';
                    if (entry.designation === 'Europa League') color = '#EA580C';
                    if (entry.designation === 'Relegation') color = '#DC2626';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default FPLMultiGameweekDashboard;