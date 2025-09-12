import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, ReferenceArea } from 'recharts';
import Papa from 'papaparse';

const DarkFPLPositionChart = () => {
  const [chartData, setChartData] = useState([]);
  const [managers, setManagers] = useState([]);
  const [managerStats, setManagerStats] = useState({});
  const [benchData, setBenchData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);

  // Modern vibrant colors that work well on dark backgrounds
  const darkColors = [
    '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#8b5cf6',
    '#ec4899', '#14b8a6', '#84cc16', '#6366f1', '#ef4444',
    '#22d3ee', '#fbbf24', '#34d399', '#fb923c', '#a78bfa',
    '#f472b6', '#2dd4bf', '#a3e635', '#818cf8', '#fb7185'
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    return null;
  };

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

  const processGameweekData = async (gameweek) => {
    try {
      const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
      const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

      const csvData = await response.text();
      
      if (csvData.trim() === "The game is being updated.") {
        return { totals: [], bench: [] };
      }

      const parsed = Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      const totalRows = parsed.data.filter(row => row.player === "TOTAL");
      
      const benchPlayers = parsed.data.filter(row => 
        row.multiplier === 0 && 
        row.player !== "TOTAL" && 
        row.points_gw > 0
      );
      
      const benchPointsByManager = {};
      benchPlayers.forEach(player => {
        if (!benchPointsByManager[player.manager_name]) {
          benchPointsByManager[player.manager_name] = 0;
        }
        benchPointsByManager[player.manager_name] += player.points_gw;
      });
      
      return {
        totals: totalRows.map(row => ({
          manager_name: row.manager_name,
          total_points: row.points_applied,
          gameweek: gameweek
        })),
        bench: Object.entries(benchPointsByManager).map(([manager_name, bench_points]) => ({
          manager_name,
          bench_points,
          gameweek: gameweek
        }))
      };

    } catch (error) {
      console.error(`Error processing GW${gameweek}:`, error);
      throw error;
    }
  };

  const findLatestGameweek = async () => {
    let latestGW = 1;
    const maxGWToCheck = 38;
    
    for (let gw = 1; gw <= maxGWToCheck; gw++) {
      try {
        const data = await processGameweekData(gw);
        if (data.totals.length > 0) {
          latestGW = gw;
        } else {
          break;
        }
      } catch (error) {
        break;
      }
    }
    return latestGW;
  };

  const fetchData = async () => {
    try {
      setError(null);
      
      const latestGW = await findLatestGameweek();
      
      const gameweekPromises = [];
      for (let gw = 1; gw <= latestGW; gw++) {
        gameweekPromises.push(processGameweekData(gw));
      }
      
      const allGameweekData = await Promise.all(gameweekPromises);

      if (allGameweekData[0].totals.length === 0) {
        throw new Error('No GW1 data found');
      }

      const cumulativeData = allGameweekData[0].totals.map(gw1Manager => {
        const managerData = {
          manager_name: gw1Manager.manager_name,
          gw1_cumulative: gw1Manager.total_points
        };
        
        let runningTotal = gw1Manager.total_points;
        for (let gw = 2; gw <= latestGW; gw++) {
          const gwManager = allGameweekData[gw - 1].totals.find(m => m.manager_name === gw1Manager.manager_name);
          if (gwManager) {
            runningTotal += gwManager.total_points;
          }
          managerData[`gw${gw}_cumulative`] = runningTotal;
        }
        
        return managerData;
      });

      const benchPoints = allGameweekData[0].totals.map(manager => {
        const benchData = {
          manager_name: manager.manager_name,
          total_bench_points: 0
        };
        
        for (let gw = 1; gw <= latestGW; gw++) {
          const gwBench = allGameweekData[gw - 1].bench.find(b => b.manager_name === manager.manager_name)?.bench_points || 0;
          benchData[`gw${gw}_bench`] = gwBench;
          benchData.total_bench_points += gwBench;
        }
        
        return benchData;
      });

      const sortedBenchData = benchPoints
        .sort((a, b) => b.total_bench_points - a.total_bench_points)
        .slice(0, 10);
      
      setBenchData(sortedBenchData);

      const rankedData = [];
      for (let gw = 1; gw <= latestGW; gw++) {
        const gwRanked = [...cumulativeData]
          .sort((a, b) => b[`gw${gw}_cumulative`] - a[`gw${gw}_cumulative`])
          .map((manager, index) => ({
            ...manager,
            [`gw${gw}_position`]: index + 1
          }));
        rankedData.push(gwRanked);
      }

      const allManagers = rankedData[0].map(m => m.manager_name);
      setManagers(allManagers);

      const statsLookup = {};
      rankedData[0].forEach(manager => {
        const managerStats = { manager_name: manager.manager_name };
        
        for (let gw = 1; gw <= latestGW; gw++) {
          const gwManager = rankedData[gw - 1].find(m => m.manager_name === manager.manager_name);
          if (gwManager) {
            managerStats[`gw${gw}_position`] = gwManager[`gw${gw}_position`];
            managerStats[`gw${gw}_cumulative`] = gwManager[`gw${gw}_cumulative`];
          }
        }
        
        statsLookup[manager.manager_name] = managerStats;
      });
      setManagerStats(statsLookup);

      const chartPoints = [];
      for (let gw = 1; gw <= latestGW; gw++) {
        const gwPoint = { gameweek: gw };
        rankedData[gw - 1].forEach(manager => {
          gwPoint[manager.manager_name] = manager[`gw${gw}_position`];
        });
        chartPoints.push(gwPoint);
      }

      setChartData(chartPoints);
    } catch (error) {
      console.error('Error loading data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const hasLatestGameweekData = chartData.length > 0;
  const maxGameweek = hasLatestGameweekData ? chartData.length : 1;

  const generateGameweekTicks = (maxGW) => {
    const ticks = [];
    for (let i = 1; i <= maxGW; i++) {
      ticks.push(i);
    }
    return ticks;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-cyan-400 text-xl mb-4">Loading Position Chart...</div>
          <div className="flex justify-center space-x-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.2}s` }}
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
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
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">Position Tracker</h1>
        <p className="text-gray-400">GW 1-{maxGameweek} • {managers.length} managers</p>
      </div>

      {/* Main Chart */}
      <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl border border-gray-700/50 overflow-hidden">
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
          {/* Mobile Chart */}
          <div className="md:hidden">
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 15, left: 5, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                
                <XAxis 
                  dataKey="gameweek" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  domain={[1, maxGameweek]}
                  type="number"
                  ticks={generateGameweekTicks(maxGameweek)}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 10 }}
                  domain={[1, managers.length]}
                  reversed={true}
                  tickMargin={4}
                  width={25}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {managers.map((manager, index) => {
                  const isSelected = selectedManager === manager;
                  const isDimmed = selectedManager && selectedManager !== manager;
                  
                  return (
                    <Line
                      key={manager}
                      type="linear"
                      dataKey={manager}
                      stroke={darkColors[index % darkColors.length]}
                      strokeWidth={isSelected ? 3 : 2}
                      strokeOpacity={isDimmed ? 0.2 : 1}
                      dot={<CustomDot fill={darkColors[index % darkColors.length]} />}
                      activeDot={false}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Desktop Chart */}
          <div className="hidden md:block">
            <ResponsiveContainer width="100%" height={500}>
              <LineChart
                data={chartData}
                margin={{ top: 30, right: 30, left: 50, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.6} />
                
                <XAxis 
                  dataKey="gameweek" 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  domain={[1, maxGameweek]}
                  type="number"
                  ticks={generateGameweekTicks(maxGameweek)}
                  label={{ value: 'Gameweek', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
                />
                <YAxis 
                  stroke="#9CA3AF"
                  tick={{ fill: '#9CA3AF', fontSize: 12 }}
                  domain={[1, managers.length]}
                  reversed={true}
                  tickMargin={10}
                  width={45}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
                />
                <Tooltip content={<CustomTooltip />} />
                
                {managers.map((manager, index) => {
                  const isSelected = selectedManager === manager;
                  const isDimmed = selectedManager && selectedManager !== manager;
                  
                  return (
                    <Line
                      key={manager}
                      type="linear"
                      dataKey={manager}
                      stroke={darkColors[index % darkColors.length]}
                      strokeWidth={isSelected ? 4 : 2.5}
                      strokeOpacity={isDimmed ? 0.15 : 1}
                      dot={<CustomDot fill={darkColors[index % darkColors.length]} />}
                      activeDot={false}
                      connectNulls={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bench Champions */}
      {benchData.length > 0 && (
        <div className="bg-gray-800/40 backdrop-blur-xl rounded-xl border border-red-700/50 overflow-hidden">
          <div className="p-6 border-b border-red-700/50 bg-gradient-to-r from-red-900/20 to-red-800/20">
            <h2 className="text-lg font-semibold text-gray-100">Bench Champions</h2>
            <p className="text-gray-400 text-sm">Highest unused substitute points</p>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {benchData.slice(0, 6).map((manager, index) => (
                <div 
                  key={manager.manager_name} 
                  className="flex items-center justify-between p-4 bg-red-900/20 rounded-lg border border-red-600/30 hover:bg-red-900/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-b from-red-500 to-red-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-gray-100 font-medium">{manager.manager_name}</span>
                      <span className="text-gray-400 text-xs">
                        ({Array.from({length: maxGameweek}, (_, gwIndex) => {
                          const gw = gwIndex + 1;
                          return manager[`gw${gw}_bench`] || 0;
                        }).join(', ')})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-red-400">
                      {manager.total_bench_points}
                    </div>
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