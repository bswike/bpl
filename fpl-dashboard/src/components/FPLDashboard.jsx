import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// --- Main Dashboard Component ---
const FPLMultiGameweekDashboard = () => {
  const [data, setData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [papaReady, setPapaReady] = useState(false);

  // Load PapaParse script from a CDN to resolve potential build issues
  useEffect(() => {
    const scriptId = 'papaparse-script';
    if (document.getElementById(scriptId) || window.Papa) {
        setPapaReady(true);
        return;
    }
    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    script.async = true;
    script.onload = () => setPapaReady(true);
    script.onerror = () => {
        setError("Error: Failed to load the data parsing library.");
        setLoading(false);
    };
    document.body.appendChild(script);

    return () => {
        const el = document.getElementById(scriptId);
        if (el) document.body.removeChild(el);
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // --- Data Fetching and Processing Logic ---
      const CSV_BASE_URL = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw';
      const MAX_GAMEWEEK_TO_CHECK = 38;

      const gwChecks = Array.from({ length: MAX_GAMEWEEK_TO_CHECK }, (_, i) => i + 1);
      const available = [];
      for (const gw of gwChecks) {
          const res = await fetch(`${CSV_BASE_URL}${gw}.csv`, { method: 'HEAD', cache: 'no-store' });
          if (res.ok) available.push(gw);
          else break;
      }

      if (available.length === 0) throw new Error("No gameweek data found.");
      setAvailableGameweeks(available);

      const gameweekPromises = available.map(async (gw) => {
        const url = `${CSV_BASE_URL}${gw}.csv?t=${Math.floor(Date.now() / 300000)}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) return [];
        const csvText = await response.text();
        if (csvText.trim() === "The game is being updated.") return [];
        
        const parsed = window.Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
        parsed.data.forEach(row => {
            if (row.player === 'JoÃ£o Pedro Junqueira de Jesus') row.player = 'JoÃ£o Pedro';
        });
        return parsed.data;
      });
      
      const results = await Promise.all(gameweekPromises);

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
                    team_name: row.entry_team_name
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
      
      const combinedData = Object.values(managerData);
      const sortedData = combinedData
        .sort((a, b) => b.total_points - a.total_points)
        .map((item, index) => {
          const totalManagers = combinedData.length;
          let designation = 'Mid-table';
          if (index < 4) designation = 'Champions League';
          else if (index === 4) designation = 'Europa League';
          else if (index >= totalManagers - 3) designation = 'Relegation';

          return { ...item, rank: index + 1, designation, displayName: item.manager_name };
        });

      setData(sortedData);
      setError(null);
    } catch (err) {
      console.error('Error loading data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [papaReady]);

  useEffect(() => {
    if (papaReady) {
        fetchData();
        const intervalId = setInterval(fetchData, 300000); // REFRESH_INTERVAL_MS
        return () => clearInterval(intervalId);
    }
  }, [papaReady, fetchData]);

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

