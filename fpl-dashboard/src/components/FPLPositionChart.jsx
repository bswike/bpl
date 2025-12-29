import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, BarChart, Bar, Cell } from 'recharts';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';

// ---- Constants ----
const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
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
  // Use shared data context instead of local fetching - INSTANT tab switch!
  const {
    gameweekData: contextGameweekData,
    availableGameweeks,
    isInitialLoading,
    error: contextError,
    connectionStatus,
    lastUpdate,
  } = useData();

  const [selectedManager, setSelectedManager] = useState(null);
  const [enter, setEnter] = useState(false);
  const [mobileGwRange, setMobileGwRange] = useState('last8'); // 'last8' or 'all'

  // Derive all chart data from context using useMemo
  const { chartData, managers, managerStats, benchData, standingsData } = useMemo(() => {
    if (!contextGameweekData || Object.keys(contextGameweekData).length === 0) {
      return { chartData: [], managers: [], managerStats: {}, benchData: [], standingsData: [] };
    }

    // Get all unique manager names
    const allManagers = contextGameweekData[availableGameweeks[0]]?.map(m => m.manager_name) || [];
    const latestGW = availableGameweeks[availableGameweeks.length - 1];
    
    // Build cumulative points and positions per gameweek
    const cumulativeData = {}; // manager_name -> { gw1_cumulative, gw1_position, etc. }
    const benchPoints = {}; // manager_name -> total bench points
    
    allManagers.forEach(name => {
      cumulativeData[name] = { manager_name: name };
      benchPoints[name] = { manager_name: name, total_bench_points: 0 };
    });

    // Calculate cumulative points for each gameweek
    availableGameweeks.forEach((gw, gwIdx) => {
      allManagers.forEach(name => {
        const managerGwData = contextGameweekData[gw]?.find(m => m.manager_name === name);
        const pts = managerGwData?.total_points || 0;
        const bench = managerGwData?.bench_points || 0;
        
        const prevCumulative = gwIdx > 0 ? (cumulativeData[name][`gw${availableGameweeks[gwIdx - 1]}_cumulative`] || 0) : 0;
        cumulativeData[name][`gw${gw}_cumulative`] = prevCumulative + pts;
        benchPoints[name].total_bench_points += bench;
      });

      // Sort by cumulative to get positions for this GW
      const sorted = allManagers
        .map(name => ({
          manager_name: name,
          cumulative: cumulativeData[name][`gw${gw}_cumulative`]
        }))
        .sort((a, b) => b.cumulative - a.cumulative);

      sorted.forEach((m, idx) => {
        cumulativeData[m.manager_name][`gw${gw}_position`] = idx + 1;
      });
    });

    // Build chart data points
    const chartPoints = availableGameweeks.map(gw => {
      const point = { gameweek: gw };
      allManagers.forEach(name => {
        point[name] = cumulativeData[name][`gw${gw}_position`];
      });
      return point;
    });

    // Build standings data for bar chart
    const finalStandings = allManagers
      .map(name => ({
        manager_name: name,
        total_points: cumulativeData[name][`gw${latestGW}_cumulative`] || 0
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .map((m, idx) => {
        let designation = 'Mid-table';
        if (idx < 4) designation = 'Champions League';
        else if (idx < 7) designation = 'Europa League';
        else if (idx >= allManagers.length - 3) designation = 'Relegation';
        
        const nameParts = m.manager_name.split(' ');
        const displayName = nameParts.length > 1 
          ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
          : m.manager_name;
        
        return { ...m, displayName, designation, position: idx + 1 };
      });

    // Build bench data (sorted by total bench points)
    const benchDataSorted = Object.values(benchPoints)
      .sort((a, b) => b.total_bench_points - a.total_bench_points);

    return {
      chartData: chartPoints,
      managers: allManagers,
      managerStats: benchPoints,
      benchData: benchDataSorted,
      standingsData: finalStandings,
    };
  }, [contextGameweekData, availableGameweeks]);

  const loading = isInitialLoading;
  const error = contextError;
  const progress = { loaded: availableGameweeks.length, total: availableGameweeks.length };

  // Trigger enter animation when data loads
  useEffect(() => {
    if (!loading && chartData.length > 0) {
      requestAnimationFrame(() => setEnter(true));
    }
  }, [loading, chartData.length]);

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

  // All data fetching is now handled by DataContext - no local fetch needed!

  const maxGameweek = chartData.length > 0 ? chartData.length : 1;

  // Filter chart data for mobile based on selected range
  const mobileChartData = useMemo(() => {
    if (mobileGwRange === 'all' || chartData.length <= 8) {
      return chartData;
    }
    // Show last 8 gameweeks
    const startGw = Math.max(1, maxGameweek - 7);
    return chartData.filter(d => d.gameweek >= startGw);
  }, [chartData, mobileGwRange, maxGameweek]);

  const mobileMinGw = mobileChartData.length > 0 ? mobileChartData[0].gameweek : 1;
  const mobileMaxGw = mobileChartData.length > 0 ? mobileChartData[mobileChartData.length - 1].gameweek : maxGameweek;

  const generateGameweekTicks = (minGW, maxGW) => {
    const ticks = [];
    for (let i = minGW; i <= maxGW; i++) ticks.push(i);
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

        <div className="p-4 md:p-6">
          {/* Mobile: Gameweek Range Toggle */}
          <div className="md:hidden mb-4">
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setMobileGwRange('last8')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mobileGwRange === 'last8'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                }`}
              >
                Last 8 GWs
              </button>
              <button
                onClick={() => setMobileGwRange('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mobileGwRange === 'all'
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                }`}
              >
                All Season
              </button>
            </div>
            {mobileGwRange === 'all' && maxGameweek > 8 && (
              <p className="text-center text-xs text-gray-500 mt-2">← Scroll horizontally →</p>
            )}
          </div>

          {/* Mobile Chart */}
          <div className="md:hidden">
            {mobileGwRange === 'all' && maxGameweek > 8 ? (
              // Scrollable chart for "All Season" on mobile
              <div className="overflow-x-auto -mx-4 px-4">
                <div style={{ width: `${Math.max(100, maxGameweek * 40)}px`, minWidth: '100%' }}>
                  <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={chartData} margin={{ top: 20, right: 15, left: 5, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                      <XAxis dataKey="gameweek" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[1, maxGameweek]} type="number" ticks={generateGameweekTicks(1, maxGameweek)} />
                      <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[1, managers.length]} reversed tickMargin={4} width={25} />
                      <Tooltip content={<CustomTooltip />} />
                      {managers.map((manager, index) => (
                        <Line key={manager} type="linear" dataKey={manager} stroke={darkColors[index % darkColors.length]} strokeWidth={selectedManager === manager ? 3 : 2} strokeOpacity={selectedManager && selectedManager !== manager ? 0.2 : 1} dot={<CustomDot fill={darkColors[index % darkColors.length]} />} activeDot={false} connectNulls={false} isAnimationActive={false} />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              // Fixed-width chart for "Last 8" on mobile
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={mobileChartData} margin={{ top: 20, right: 15, left: 5, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                  <XAxis dataKey="gameweek" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 11 }} domain={[mobileMinGw, mobileMaxGw]} type="number" ticks={generateGameweekTicks(mobileMinGw, mobileMaxGw)} />
                  <YAxis stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 10 }} domain={[1, managers.length]} reversed tickMargin={4} width={25} />
                  <Tooltip content={<CustomTooltip />} />
                  {managers.map((manager, index) => (
                    <Line key={manager} type="linear" dataKey={manager} stroke={darkColors[index % darkColors.length]} strokeWidth={selectedManager === manager ? 3 : 2} strokeOpacity={selectedManager && selectedManager !== manager ? 0.2 : 1} dot={<CustomDot fill={darkColors[index % darkColors.length]} />} activeDot={false} connectNulls={false} isAnimationActive={true} animationDuration={700} animationEasing="ease-out" animationBegin={index * 60} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {/* Desktop Chart - always show full season */}
          <div className="hidden md:block">
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData} margin={{ top: 30, right: 30, left: 50, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                <XAxis dataKey="gameweek" stroke="#9CA3AF" tick={{ fill: '#9CA3AF', fontSize: 12 }} domain={[1, maxGameweek]} type="number" ticks={generateGameweekTicks(1, maxGameweek)} label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }} />
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

      {/* Total Points Bar Chart */}
      {standingsData.length > 0 && (
        <div
          className={`bg-gray-800/40 backdrop-blur-xl rounded-xl border border-gray-700/50 overflow-hidden transform transition-all duration-700 ease-out delay-100 ${
            enter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div className="p-4 border-b border-gray-700/50">
            <h2 className="text-lg font-semibold text-gray-100">Season Standings</h2>
            <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 text-xs mt-2">
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-600 mr-1.5"></span>Champions League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></span>Europa League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1.5"></span>Mid-table</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-600 mr-1.5"></span>Relegation</div>
            </div>
          </div>
          <div className="p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={standingsData} margin={{ top: 5, right: 5, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.1)" />
                <XAxis 
                  dataKey="displayName" 
                  stroke="#94A3B8" 
                  angle={-60} 
                  textAnchor="end" 
                  height={60} 
                  fontSize={10} 
                  interval={0} 
                />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-800 text-white p-2 rounded-md shadow-lg border border-slate-600">
                          <p className="font-bold text-sm">{d.manager_name}</p>
                          <p className="font-semibold text-cyan-300 text-xs">#{d.position} • {d.total_points} pts</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                />
                <Bar dataKey="total_points" radius={[2, 2, 0, 0]}>
                  {standingsData.map((entry, index) => {
                    let color = '#6B7280';
                    if (entry.designation === 'Champions League') color = '#2563EB';
                    if (entry.designation === 'Europa League') color = '#EA580C';
                    if (entry.designation === 'Relegation') color = '#DC2626';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bench Champions */}
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