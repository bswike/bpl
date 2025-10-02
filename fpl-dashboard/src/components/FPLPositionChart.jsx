import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import Papa from 'papaparse';

// ---- Constants ----
const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const MANIFEST_URL = `${PUBLIC_BASE}fpl-league-manifest.json`;
const SSE_URL = 'https://bpl-red-sun-894.fly.dev/sse/fpl-updates';
const FALLBACK_POLL_INTERVAL_MS = 300000; // 5 minutes

// Cache busting utility
const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Skeleton Loader Component
const ChartSkeleton = ({ progress, total }) => (
  <div className="space-y-6 animate-pulse">
    <div className="text-center">
      <div className="h-8 bg-gray-700/80 rounded-md w-1/3 mx-auto mb-3"></div>
      <div className="h-5 bg-gray-700/80 rounded-md w-1/4 mx-auto"></div>
    </div>
    <div className="bg-gray-800/40 rounded-xl border border-gray-700/50">
      <div className="p-6 border-b border-gray-700/50">
        <div className="h-7 bg-gray-700/80 rounded-md w-1/2"></div>
      </div>
      <div className="p-6 flex flex-col items-center justify-center h-[500px]">
        <div className="w-full h-full bg-gray-700/50 rounded-lg"></div>
        {total > 0 && (
          <div className="text-cyan-400 text-sm mt-4">
            Loading Gameweek Data... ({progress} / {total})
          </div>
        )}
      </div>
    </div>
    <div className="bg-gray-800/40 rounded-xl border border-red-700/50">
      <div className="p-6 border-b border-red-700/50">
        <div className="h-7 bg-gray-700/80 rounded-md w-1/3"></div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-red-900/20 rounded-lg border border-red-600/30"></div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const DarkFPLPositionChart = () => {
  const [chartData, setChartData] = useState([]);
  const [managers, setManagers] = useState([]);
  const [managerStats, setManagerStats] = useState({});
  const [benchData, setBenchData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);

  const [enter, setEnter] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });

  const abortRef = useRef(null);
  const fetchCycleIdRef = useRef(0);
  const eventSourceRef = useRef(null);
  const manifestVersionRef = useRef(null);
  const fallbackIntervalRef = useRef(null);

  const hardcodedGW1Data = {
    totals: [
      { manager_name: "Garrett Kunkel", total_points: 78, gameweek: 1 },
      { manager_name: "Andrew Vidal", total_points: 76, gameweek: 1 },
      { manager_name: "Brett Swikle", total_points: 74, gameweek: 1 },
      { manager_name: "John Matthew", total_points: 73, gameweek: 1 },
      { manager_name: "Jared Alexander", total_points: 67, gameweek: 1 },
      { manager_name: "Joe Curran", total_points: 64, gameweek: 1 },
      { manager_name: "John Sebastian", total_points: 62, gameweek: 1 },
      { manager_name: "Nate Cohen", total_points: 60, gameweek: 1 },
      { manager_name: "Chris Munoz", total_points: 60, gameweek: 1 },
      { manager_name: "Evan Bagheri", total_points: 57, gameweek: 1 },
      { manager_name: "Dean Maghsadi", total_points: 55, gameweek: 1 },
      { manager_name: "Brian Pleines", total_points: 53, gameweek: 1 },
      { manager_name: "Max Maier", total_points: 53, gameweek: 1 },
      { manager_name: "Adrian McLoughlin", total_points: 52, gameweek: 1 },
      { manager_name: "Wes H", total_points: 50, gameweek: 1 },
      { manager_name: "Kevin Tomek", total_points: 48, gameweek: 1 },
      { manager_name: "Kevin K", total_points: 41, gameweek: 1 },
      { manager_name: "Tony Tharakan", total_points: 39, gameweek: 1 },
      { manager_name: "JP Fischer", total_points: 35, gameweek: 1 },
      { manager_name: "Patrick McCleary", total_points: 34, gameweek: 1 }
    ],
    bench: [
      { manager_name: "John Sebastian", bench_points: 11, gameweek: 1 },
      { manager_name: "Garrett Kunkel", bench_points: 8, gameweek: 1 },
      { manager_name: "Andrew Vidal", bench_points: 7, gameweek: 1 },
      { manager_name: "JP Fischer", bench_points: 13, gameweek: 1 },
      { manager_name: "Adrian McLoughlin", bench_points: 9, gameweek: 1 },
      { manager_name: "John Matthew", bench_points: 9, gameweek: 1 },
      { manager_name: "Jared Alexander", bench_points: 7, gameweek: 1 },
      { manager_name: "Patrick McCleary", bench_points: 6, gameweek: 1 },
      { manager_name: "Kevin Tomek", bench_points: 22, gameweek: 1 },
      { manager_name: "Joe Curran", bench_points: 11, gameweek: 1 },
      { manager_name: "Evan Bagheri", bench_points: 13, gameweek: 1 },
      { manager_name: "Brian Pleines", bench_points: 10, gameweek: 1 },
      { manager_name: "Max Maier", bench_points: 19, gameweek: 1 },
      { manager_name: "Wes H", bench_points: 9, gameweek: 1 },
      { manager_name: "Dean Maghsadi", bench_points: 9, gameweek: 1 },
      { manager_name: "Nate Cohen", bench_points: 7, gameweek: 1 },
      { manager_name: "Kevin K", bench_points: 10, gameweek: 1 },
      { manager_name: "Brett Swikle", bench_points: 8, gameweek: 1 },
      { manager_name: "Chris Munoz", bench_points: 8, gameweek: 1 },
      { manager_name: "Tony Tharakan", bench_points: 4, gameweek: 1 }
    ]
  };

  const darkColors = [
    '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#8b5cf6',
    '#ec4899', '#14b8a6', '#84cc16', '#6366f1', '#ef4444',
    '#22d3ee', '#fbbf24', '#34d399', '#fb923c', '#a78bfa',
    '#f472b6', '#2dd4bf', '#a3e635', '#818cf8', '#fb7185'
  ];

  const CustomTooltip = () => null;

  const CustomDot = (props) => {
    const { cx, cy, payload, dataKey, fill } = props;
    if (payload && dataKey) {
      const initials = dataKey.split(' ').map(name => name[0]).join('').substring(0, 2).toUpperCase();
      const isSelected = selectedManager === dataKey;
      const isDimmed = selectedManager && selectedManager !== dataKey;
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={isSelected ? 14 : 8}
            fill={fill}
            stroke={isSelected ? "#06b6d4" : "#374151"}
            strokeWidth={isSelected ? 3 : 2}
            opacity={isDimmed ? 0.3 : 1}
            style={{ cursor: 'pointer' }}
            onClick={() => setSelectedManager(dataKey === selectedManager ? null : dataKey)}
          />
          <text
            x={cx}
            y={cy + 2}
            textAnchor="middle"
            fill="#ffffff"
            fontSize={isSelected ? "9" : "7"}
            fontWeight="600"
            opacity={isDimmed ? 0.3 : 1}
            style={{ cursor: 'pointer', pointerEvents: 'none' }}
          >
            {initials}
          </text>
        </g>
      );
    }
    return <circle cx={cx} cy={cy} r={4} fill={fill} />;
  };

  const processGameweekData = async (gameweek, manifest, signal) => {
    if (gameweek === 1) return hardcodedGW1Data;

    try {
      const pointerUrl = manifest?.gameweeks?.[gameweek];
      if (!pointerUrl) throw new Error(`No pointer URL for GW${gameweek} in manifest`);

      const pointerRes = await fetch(`${pointerUrl}?v=${bust()}`, { cache: 'no-store', signal });
      if (!pointerRes.ok) throw new Error(`Could not fetch pointer for GW${gameweek} (${pointerRes.status})`);
      const pointerData = await pointerRes.json();
      
      const csvUrl = pointerData?.url;
      if (!csvUrl) throw new Error(`Malformed pointer for GW${gameweek}`);

      const csvRes = await fetch(csvUrl, { cache: 'no-store', signal });
      if (!csvRes.ok) throw new Error(`HTTP ${csvRes.status} for ${csvUrl}`);
      const csvText = await csvRes.text();
      
      if (csvText.trim() === "The game is being updated.") return { totals: [], bench: [] };
      
      return parseCsv(csvText, gameweek);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(`GW${gameweek} fetch failed:`, err);
      }
      return { totals: [], bench: [] };
    }
  };

  const parseCsv = (csvText, gameweek) => {
    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
    const rows = parsed.data || [];

    const totalRows = rows.filter(row => row.player === "TOTAL");
    const benchPlayers = rows.filter(row =>
      row.multiplier === 0 &&
      row.player !== "TOTAL" &&
      (Number(row.points_gw) || 0) > 0
    );

    const benchPointsByManager = {};
    benchPlayers.forEach(player => {
      const name = player.manager_name;
      if (!name) return;
      benchPointsByManager[name] = (benchPointsByManager[name] || 0) + (Number(player.points_gw) || 0);
    });

    return {
      totals: totalRows.map(row => ({
        manager_name: row.manager_name,
        total_points: Number(row.points_applied) || 0,
        gameweek
      })),
      bench: Object.entries(benchPointsByManager).map(([manager_name, bench_points]) => ({
        manager_name,
        bench_points,
        gameweek
      }))
    };
  };

  const fetchData = async () => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    const myId = ++fetchCycleIdRef.current;

    setLoading(true);
    setError(null);
    setEnter(false);
    setProgress({ loaded: 0, total: 0 });

    try {
      const manifestRes = await fetch(`${MANIFEST_URL}?v=${bust()}`, { 
        method: 'GET', 
        cache: 'no-store', 
        signal: abort.signal 
      });
      
      if (!manifestRes.ok) {
        throw new Error(`Could not load league manifest (${manifestRes.status})`);
      }
      
      const manifest = await manifestRes.json();
      
      // Store manifest version for SSE comparison
      manifestVersionRef.current = manifest.version;

      const remoteGameweeks = Object.keys(manifest?.gameweeks || {}).map(Number);
      const availableGameweeks = [...new Set([1, ...remoteGameweeks])].sort((a, b) => a - b);
      
      if (availableGameweeks.length === 0) {
        throw new Error("No gameweek data found in manifest.");
      }

      const latestGW = availableGameweeks[availableGameweeks.length - 1];
      setProgress({ loaded: 0, total: latestGW });

      const results = await Promise.all(
        availableGameweeks.map(async (gw) => {
          const data = await processGameweekData(gw, manifest, abort.signal);
          setProgress(p => ({ ...p, loaded: p.loaded + 1 }));
          return { ...data, gw };
        })
      );

      if (fetchCycleIdRef.current !== myId || abort.signal.aborted) return;

      const allGameweekData = results.sort((a, b) => a.gw - b.gw);

      const firstValidIndex = allGameweekData.findIndex(d => d?.totals?.length > 0);
      if (firstValidIndex === -1) throw new Error('No valid gameweek data found');

      const cumulativeData = allGameweekData[firstValidIndex].totals.map(firstManager => {
        const managerData = { manager_name: firstManager.manager_name };
        let runningTotal = 0;
        for (let gw = 1; gw <= latestGW; gw++) {
          const gwData = allGameweekData[gw - 1];
          if (gwData?.totals?.length) {
            const gwManager = gwData.totals.find(m => m.manager_name === firstManager.manager_name);
            if (gwManager) runningTotal += gwManager.total_points || 0;
          }
          managerData[`gw${gw}_cumulative`] = runningTotal;
        }
        return managerData;
      });

      const benchPoints = allGameweekData[firstValidIndex].totals.map(manager => {
        const row = { manager_name: manager.manager_name, total_bench_points: 0 };
        for (let gw = 1; gw <= latestGW; gw++) {
          const gwData = allGameweekData[gw - 1];
          const gwBench = gwData?.bench.find(b => b.manager_name === manager.manager_name)?.bench_points || 0;
          row[`gw${gw}_bench`] = gwBench;
          row.total_bench_points += gwBench;
        }
        return row;
      });

      const sortedBenchData = benchPoints
        .sort((a, b) => b.total_bench_points - a.total_bench_points)
        .slice(0, 10);
      setBenchData(sortedBenchData);

      const rankedData = [];
      for (let gw = 1; gw <= latestGW; gw++) {
        const gwRanked = [...cumulativeData]
          .sort((a, b) => (b[`gw${gw}_cumulative`] || 0) - (a[`gw${gw}_cumulative`] || 0))
          .map((manager, index) => ({ ...manager, [`gw${gw}_position`]: index + 1 }));
        rankedData.push(gwRanked);
      }

      const allManagers = rankedData[0].map(m => m.manager_name);
      setManagers(allManagers);

      const statsLookup = {};
      rankedData[0].forEach(m => {
        const s = { manager_name: m.manager_name };
        for (let gw = 1; gw <= latestGW; gw++) {
          const gwRow = rankedData[gw - 1].find(x => x.manager_name === m.manager_name);
          if (gwRow) {
            s[`gw${gw}_position`] = gwRow[`gw${gw}_position`];
            s[`gw${gw}_cumulative`] = gwRow[`gw${gw}_cumulative`];
          }
        }
        statsLookup[m.manager_name] = s;
      });
      setManagerStats(statsLookup);

      const chartPoints = [];
      for (let gw = 1; gw <= latestGW; gw++) {
        const point = { gameweek: gw };
        rankedData[gw - 1].forEach(m => {
          point[m.manager_name] = m[`gw${gw}_position`];
        });
        chartPoints.push(point);
      }
      setChartData(chartPoints);

      setError(null);
      setLoading(false);
      setLastUpdate(new Date());
      requestAnimationFrame(() => setEnter(true));

    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Error loading data:', err);
        setError(err.message || 'Unknown error');
        if (fetchCycleIdRef.current === myId) setLoading(false);
      }
    }
  };

  // SSE Connection Effect
  useEffect(() => {
    fetchData();

    console.log('Attempting SSE connection to:', SSE_URL);
    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection established');
      setConnectionStatus('connected');
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('SSE message received:', message);

        switch (message.type) {
          case 'connected':
            console.log('SSE connected at', message.timestamp);
            break;
          
          case 'heartbeat':
            break;
          
          case 'gameweek_updated':
            console.log('Gameweek update detected:', message.data);
            if (message.data.manifest_version !== manifestVersionRef.current) {
              console.log('New data version detected, refreshing...');
              fetchData();
            }
            break;
          
          default:
            console.log('Unknown SSE message type:', message.type);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('disconnected');
      
      if (!fallbackIntervalRef.current) {
        console.log('SSE failed, falling back to polling every 5 minutes');
        fallbackIntervalRef.current = setInterval(fetchData, FALLBACK_POLL_INTERVAL_MS);
      }
    };

    return () => {
      console.log('Cleaning up SSE connection');
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const maxGameweek = chartData.length > 0 ? chartData.length : 1;

  const generateGameweekTicks = (maxGW) => {
    const ticks = [];
    for (let i = 1; i <= maxGW; i++) ticks.push(i);
    return ticks;
  };

  const statusColor = connectionStatus === 'connected' ? 'bg-green-500' : 
                     connectionStatus === 'disconnected' ? 'bg-yellow-500' : 'bg-gray-500';
  const statusText = connectionStatus === 'connected' ? 'Live' : 
                    connectionStatus === 'disconnected' ? 'Polling' : 'Connecting';

  if (loading) {
    return <ChartSkeleton progress={progress.loaded} total={progress.total} />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center bg-red-500/10 border border-red-500/20 rounded-lg p-6">
          <div className="text-red-400 text-xl mb-2">Connection Error</div>
          <div className="text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Position Tracker</h1>
        <div className="flex items-center justify-center gap-2">
          <p className="text-gray-400">GW 1-{maxGameweek} • {managers.length} managers</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
            <span className="text-xs text-gray-400">{statusText}</span>
          </div>
        </div>
        {lastUpdate && (
          <p className="text-xs text-gray-500 mt-1">
            Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        )}
      </div>

      <div
        className={`bg-gray-800/40 backdrop-blur-xl rounded-xl border border-gray-700/50 overflow-hidden transform transition-all duration-700 ease-out ${
          enter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="p-6 border-b border-gray-700/50">
          {selectedManager && managerStats[selectedManager] ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <h2 className="text-lg font-semibold text-gray-100">
                  {selectedManager.toLowerCase().includes('kevin tomek') ? 'noles suck' : selectedManager}
                </h2>
                <div className="text-sm text-gray-400">Position: <span className="font-semibold text-cyan-400">#{managerStats[selectedManager][`gw${maxGameweek}_position`]}</span></div>
                <div className="text-sm text-gray-400">Points: <span className="font-semibold text-gray-100">{managerStats[selectedManager][`gw${maxGameweek}_cumulative`]}</span></div>
                <div className="text-sm text-gray-400">
                  Change:
                  <span className="font-semibold ml-1">
                    {(() => {
                      const startPos = managerStats[selectedManager].gw1_position;
                      const endPos = managerStats[selectedManager][`gw${maxGameweek}_position`];
                      const change = startPos - endPos;
                      if (change > 0) return <span className="text-green-400">+{change}</span>;
                      if (change < 0) return <span className="text-red-400">{change}</span>;
                      return <span className="text-gray-400">0</span>;
                    })()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedManager(null)}
                className="text-gray-400 hover:text-gray-200 text-sm px-3 py-1 rounded-lg border border-gray-600 hover:border-gray-500 transition-colors"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-100">League Standings</h2>
              <p className="text-gray-400 text-sm">Click any point to view details</p>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="md:hidden">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={chartData} margin={{ top: 20, right: 15, left: 5, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                <XAxis dataKey="gameweek" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[1, maxGameweek]} type="number" ticks={generateGameweekTicks(maxGameweek)} />
                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[1, managers.length]} reversed tickMargin={4} width={25} />
                <Tooltip content={<CustomTooltip />} />
                {managers.map((manager, index) => (
                    <Line key={manager} type="linear" dataKey={manager} stroke={darkColors[index % darkColors.length]} strokeWidth={selectedManager === manager ? 3 : 2} strokeOpacity={selectedManager && selectedManager !== manager ? 0.2 : 1} dot={<CustomDot fill={darkColors[index % darkColors.length]} />} activeDot={false} connectNulls={false} isAnimationActive={true} animationDuration={700} animationEasing="ease-out" animationBegin={index * 60} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="hidden md:block">
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 50, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                <XAxis dataKey="gameweek" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} domain={[1, maxGameweek]} type="number" ticks={generateGameweekTicks(maxGameweek)} label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }} />
                <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} domain={[1, managers.length]} reversed tickMargin={10} width={45} label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }} />
                <Tooltip content={<CustomTooltip />} />
                {managers.map((manager, index) => (
                    <Line key={manager} type="linear" dataKey={manager} stroke={darkColors[index % darkColors.length]} strokeWidth={selectedManager === manager ? 4 : 2.5} strokeOpacity={selectedManager && selectedManager !== manager ? 0.15 : 1} dot={<CustomDot fill={darkColors[index % darkColors.length]} />} activeDot={false} connectNulls={false} isAnimationActive={true} animationDuration={800} animationEasing="ease-out" animationBegin={index * 60} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {benchData.length > 0 && (
        <div
          className={`bg-gray-800/40 backdrop-blur-xl rounded-xl border border-red-700/50 overflow-hidden transform transition-all duration-700 ease-out delay-150 ${
            enter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="p-6 border-b border-red-700/50 bg-gradient-to-r from-red-900/20 to-red-800/20">
            <h2 className="text-lg font-semibold text-gray-100">Bench Champions</h2>
            <p className="text-gray-400 text-sm">Highest unused substitute points</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benchData.slice(0, 6).map((manager, index) => (
                <div key={manager.manager_name} className="flex items-center justify-between p-4 bg-red-900/20 rounded-lg border border-red-600/30 hover:bg-red-900/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-b from-red-500 to-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">{index + 1}</div>
                    <div className="flex flex-col">
                      <span className="text-gray-100 font-medium">{manager.manager_name}</span>
                      <span className="text-gray-400 text-xs">({Array.from({ length: maxGameweek }, (_, gwIndex) => manager[`gw${gwIndex + 1}_bench`] || 0).join(', ')})</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-400">{manager.total_bench_points}</div>
                    <div className="text-gray-400 text-xs">points</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DarkFPLPositionChart;