import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

const FPLPointsChart = () => {
  const [data, setData] = useState([]);
  const [gameweekData, setGameweekData] = useState({}); // Store parsed data for all gameweeks
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latestGameweek, setLatestGameweek] = useState(1);

  // Dynamically detect available gameweeks
  const findAvailableGameweeks = async () => {
    const maxGWToCheck = 38;
    const available = [];
    
    for (let gw = 1; gw <= maxGWToCheck; gw++) {
      try {
        const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gw}.csv`;
        const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;
        
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) break;
        
        const csvData = await response.text();
        if (csvData.trim() === "The game is being updated.") {
          available.push(gw); // Still available, just updating
          continue;
        }
        
        // Try to parse to see if it's valid data
        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        if (parsed.data && parsed.data.length > 0) {
          available.push(gw);
        } else {
          break;
        }
      } catch (error) {
        console.log(`GW${gw} not available:`, error);
        break;
      }
    }
    
    return available;
  };

  const fetchGameweekData = async (gameweek) => {
    try {
      const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
      const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch GW${gameweek} CSV: ${response.status}`);

      const csvData = await response.text();
      
      if (csvData.trim() === "The game is being updated.") {
        console.log(`GW${gameweek} is being updated`);
        return { data: [] };
      }

      const parsed = Papa.parse(csvData, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      // Fix name formatting
      parsed.data.forEach(row => {
        if (row.player === 'JoÃ£o Pedro Junqueira de Jesus') {
          row.player = 'JoÃ£o Pedro';
        }
      });

      return parsed;
    } catch (error) {
      console.error(`Error loading GW${gameweek} data:`, error);
      return { data: [] };
    }
  };

  const fetchData = async () => {
    try {
      // Find all available gameweeks
      const available = await findAvailableGameweeks();
      if (available.length === 0) {
        throw new Error('No gameweek data available');
      }

      setAvailableGameweeks(available);
      setLatestGameweek(available[available.length - 1]);

      // Fetch all available gameweeks
      const gameweekPromises = available.map(gw => 
        fetchGameweekData(gw).then(data => ({ gameweek: gw, data }))
      );
      
      const results = await Promise.all(gameweekPromises);
      
      // Store data by gameweek
      const gwData = {};
      results.forEach(({ gameweek, data }) => {
        gwData[gameweek] = data;
      });
      setGameweekData(gwData);

      // Process manager data for each gameweek
      const processManagerData = (parsedData, gameweek) => {
        const managerBenchPoints = {};
        
        parsedData.data
          .filter(row => row.player !== "TOTAL")
          .forEach(row => {
            const manager = row.manager_name;
            if (!managerBenchPoints[manager]) {
                managerBenchPoints[manager] = {
                    bench_points: 0,
                    bench_players: []
                };
            }
            
            if (row.multiplier === 0) {
                const benchPoints = parseFloat(row.points_gw) || 0;
                managerBenchPoints[manager].bench_points += benchPoints;
                managerBenchPoints[manager].bench_players.push({
                    name: row.player,
                    points: benchPoints,
                    club: row.club
                });
            }
          });

        const captainData = {};
        
        parsedData.data
          .filter(row => row.is_captain === "True")
          .forEach(row => {
            captainData[row.manager_name] = {
              captain_player: row.player,
              captain_points: row.points_applied,
              captain_base_points: row.points_gw
            };
          });

        const totalRows = parsedData.data.filter(row => row.player === "TOTAL");
        
        return totalRows.map(row => {
          const captainInfo = captainData[row.manager_name];
          const captainPoints = captainInfo?.captain_points || 0;
          const regularPoints = row.points_applied - captainPoints;
          const benchInfo = managerBenchPoints[row.manager_name];
          
          return {
            manager_name: row.manager_name,
            team_name: row.entry_team_name,
            total_points: row.points_applied,
            regular_points: regularPoints,
            captain_points: captainPoints,
            captain_player: captainInfo?.captain_player || 'Unknown',
            captain_base_points: captainInfo?.captain_base_points || 0,
            bench_points: benchInfo?.bench_points || 0,
            bench_players: benchInfo?.bench_players || [],
            gameweek: gameweek
          };
        });
      };

      // Process all available gameweeks
      const processedGameweeks = [];
      for (const gw of available) {
        if (gwData[gw] && gwData[gw].data.length > 0) {
          processedGameweeks.push(processManagerData(gwData[gw], gw));
        } else {
          processedGameweeks.push([]); // Empty array for updating gameweeks
        }
      }

      // Combine data for cumulative totals
      if (processedGameweeks[0] && processedGameweeks[0].length > 0) {
        const combinedData = processedGameweeks[0].map(firstGwManager => {
          const managerData = {
            manager_name: firstGwManager.manager_name,
            team_name: firstGwManager.team_name,
            [`gw${available[0]}_points`]: firstGwManager.total_points,
            [`gw${available[0]}_captain`]: firstGwManager.captain_player,
            captain_points: firstGwManager.captain_points,
            captain_base_points: firstGwManager.captain_base_points,
            bench_points: firstGwManager.bench_points,
            bench_players: [...firstGwManager.bench_players],
            total_points: firstGwManager.total_points
          };

          // Add data from subsequent gameweeks
          let runningTotal = firstGwManager.total_points;
          let totalCaptainPoints = firstGwManager.captain_points;
          let totalCaptainBasePoints = firstGwManager.captain_base_points;
          let totalBenchPoints = firstGwManager.bench_points;
          let allBenchPlayers = [...firstGwManager.bench_players];

          for (let i = 1; i < available.length; i++) {
            const gw = available[i];
            const gwManager = processedGameweeks[i]?.find(m => m.manager_name === firstGwManager.manager_name);
            
            if (gwManager) {
              runningTotal += gwManager.total_points;
              totalCaptainPoints += gwManager.captain_points;
              totalCaptainBasePoints += gwManager.captain_base_points;
              totalBenchPoints += gwManager.bench_points;
              allBenchPlayers = [...allBenchPlayers, ...gwManager.bench_players];
              
              managerData[`gw${gw}_points`] = gwManager.total_points;
              managerData[`gw${gw}_captain`] = gwManager.captain_player;
            } else {
              managerData[`gw${gw}_points`] = 0;
              managerData[`gw${gw}_captain`] = 'N/A';
            }
          }

          managerData.total_points = runningTotal;
          managerData.captain_points = totalCaptainPoints;
          managerData.captain_base_points = totalCaptainBasePoints;
          managerData.bench_points = totalBenchPoints;
          managerData.bench_players = allBenchPlayers;
          
          // Set the latest captain as the display captain
          managerData.captain_player = managerData[`gw${available[available.length - 1]}_captain`] || 
                                     managerData[`gw${available[0]}_captain`];

          return managerData;
        });

        const sortedData = combinedData
          .sort((a, b) => b.total_points - a.total_points)
          .map((item, index) => {
            const totalManagers = combinedData.length;
            let designation = 'Mid-table';
            
            if (index < 4) {
              designation = 'Champions League';
            } else if (index === 4) {
              designation = 'Europa League';
            } else if (index >= totalManagers - 3) {
              designation = 'Relegation';
            }

            return {
              ...item,
              rank: index + 1,
              designation,
              displayName: item.manager_name.length > 12 ?
                item.manager_name.substring(0, 12) + '...' :
                item.manager_name
            };
          });

        setData(sortedData);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 300000);
    return () => clearInterval(intervalId);
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const bgColor = data.designation === 'Champions League' ? 'bg-blue-900' :
                     data.designation === 'Europa League' ? 'bg-orange-900' :
                     data.designation === 'Relegation' ? 'bg-red-900' : 'bg-gray-800';
      
      const captainLastName = data.captain_player.split(' ').pop();
      
      // Generate gameweek breakdown dynamically
      const gwBreakdown = availableGameweeks.map(gw => 
        `GW${gw}: ${data[`gw${gw}_points`] || 0}`
      ).join(' | ');
      
      return (
        <div className={`${bgColor} text-white p-1 rounded-lg shadow-xl border-2 border-white/20`}>
          <p className="font-bold text-sm">{data.manager_name}</p>
          <p className="text-gray-300 text-xs mb-0.5">"{data.team_name}"</p>
          <div className="space-y-0.5">
            <p className="font-semibold text-cyan-300 text-xs">
              Total: {data.total_points} points
            </p>
            <p className="text-gray-300 text-xxs">
              {gwBreakdown}
            </p>
            <p className="text-gray-300 text-xxs">
              Captain: {data.captain_points} pts ({captainLastName})
            </p>
          </div>
          <p className="text-cyan-200 text-xxs mt-1 font-medium">
            Rank: #{data.rank} ({data.designation})
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900">
        <div className="text-cyan-400 text-xl animate-pulse">Loading BPL data...</div>
      </div>
    );
  }

  const topScorer = data[0];
  const avgPoints = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.total_points, 0) / data.length) : 0;
  const highPoints = data.length > 0 ? Math.max(...data.map(item => item.total_points)) : 0;
  const lowPoints = data.length > 0 ? Math.min(...data.map(item => item.total_points)) : 0;
  const avgBenchPoints = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.bench_points, 0) / data.length) : 0;

  // Dynamic captain counting
  const captainCounts = {};
  data.forEach(manager => {
    availableGameweeks.forEach(gw => {
      const captain = manager[`gw${gw}_captain`];
      if (captain && captain !== 'N/A') {
        if (!captainCounts[captain]) {
          captainCounts[captain] = { count: 0, points: 0 };
        }
        captainCounts[captain].count++;
      }
    });
  });

  const popularCaptains = Object.entries(captainCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const sortedBenchPoints = [...data]
    .sort((a, b) => b.bench_points - a.bench_points)
    .filter(manager => manager.bench_points > 0);

  // Generate gameweek range text
  const gameweekRangeText = availableGameweeks.length === 1 
    ? `GW${availableGameweeks[0]}` 
    : `GW${availableGameweeks[0]}-${availableGameweeks[availableGameweeks.length - 1]}`;

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-cyan-400 mb-2 drop-shadow-lg">
            BPL Season Leaderboard ({gameweekRangeText})
          </h1>
          <p className="text-md sm:text-lg text-gray-400">
            Combined points from {availableGameweeks.length === 1 
              ? `gameweek ${availableGameweeks[0]}` 
              : `gameweeks ${availableGameweeks.join(', ')}`}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">Season Leader</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-400">{topScorer?.manager_name || 'N/A'}</p>
            <p className="text-xs sm:text-sm text-gray-400 truncate">"{topScorer?.team_name || 'N/A'}"</p>
            <p className="text-xs text-gray-500 mt-1">
              {availableGameweeks.map(gw => 
                `GW${gw}: ${topScorer?.[`gw${gw}_points`] || 0}`
              ).join(' | ')}
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-3">Points Distribution</h3>
            <div className="space-y-2">
              <div className="text-center">
                <span className="text-sm text-gray-400">High: </span>
                <span className="text-lg font-bold text-green-400">{highPoints}</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-gray-400">Avg: </span>
                <span className="text-xl font-bold text-cyan-400">{avgPoints}</span>
              </div>
              <div className="text-center">
                <span className="text-sm text-gray-400">Low: </span>
                <span className="text-lg font-bold text-red-400">{lowPoints}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">Avg Bench Points</h3>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{avgBenchPoints}</p>
            <p className="text-xs sm:text-sm text-gray-400">Points left on bench</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">Latest GW</h3>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{latestGameweek}</p>
            <p className="text-xs sm:text-sm text-gray-400">Available</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl lg:col-span-2 border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 sm:mb-6 text-center">
              Season Performance ({gameweekRangeText})
            </h2>

            <div className="flex justify-center flex-wrap gap-4 text-sm mb-6">
              <div className="flex items-center bg-slate-700/50 px-3 py-1 rounded-full">
                <span className="w-4 h-4 rounded-full bg-blue-700 mr-2"></span> 
                <span className="text-blue-300">Champions League</span>
              </div>
              <div className="flex items-center bg-slate-700/50 px-3 py-1 rounded-full">
                <span className="w-4 h-4 rounded-full bg-orange-500 mr-2"></span> 
                <span className="text-orange-300">Europa League</span>
              </div>
              <div className="flex items-center bg-slate-700/50 px-3 py-1 rounded-full">
                <span className="w-4 h-4 rounded-full bg-gray-500 mr-2"></span> 
                <span className="text-gray-300">Mid-table</span>
              </div>
              <div className="flex items-center bg-slate-700/50 px-3 py-1 rounded-full">
                <span className="w-4 h-4 rounded-full bg-red-500 mr-2"></span> 
                <span className="text-red-300">Relegation</span>
              </div>
            </div>
            
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 60 }}>
                <defs>
                  <linearGradient id="championsLeague" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#1E40AF" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="europaLeague" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F47E01" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#C1440E" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="midTable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6B7280" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#374151" stopOpacity={0.8}/>
                  </linearGradient>
                  <linearGradient id="relegation" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.9}/>
                    <stop offset="95%" stopColor="#B91C1C" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                <XAxis 
                  dataKey="displayName"
                  stroke="#94A3B8"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={11}
                  interval={0}
                />
                <YAxis stroke="#94A3B8" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_points" name="Total Points" radius={[4, 4, 0, 0]}>
                  {data.map((entry, index) => {
                    let fillColor;
                    switch(entry.designation) {
                      case 'Champions League':
                        fillColor = 'url(#championsLeague)';
                        break;
                      case 'Europa League':
                        fillColor = 'url(#europaLeague)';
                        break;
                      case 'Relegation':
                        fillColor = 'url(#relegation)';
                        break;
                      default:
                        fillColor = 'url(#midTable)';
                    }
                    return <Cell key={`cell-${index}`} fill={fillColor} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              Top 3 Managers
            </h2>
            <div className="space-y-4">
              {data.slice(0, 3).map((manager, index) => (
                <div key={manager.manager_name} className="flex items-center space-x-4 bg-gradient-to-r from-slate-700 to-slate-600 p-3 rounded-lg shadow-inner border border-slate-500/50">
                  <div className="text-2xl sm:text-3xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg text-cyan-200">{manager.manager_name}</p>
                    <p className="text-xs text-gray-400">"{manager.team_name}"</p>
                    <p className="text-xs text-gray-500">
                      {availableGameweeks.map(gw => 
                        `GW${gw}: ${manager[`gw${gw}_points`] || 0}`
                      ).join(' | ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl sm:text-2xl font-extrabold text-green-400">{manager.total_points}</p>
                    <p className="text-xs text-gray-500">Total Points</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              Popular Captains ({gameweekRangeText})
            </h2>
            <ul className="space-y-2">
              {popularCaptains.map(([captain, captainData]) => (
                <li key={captain} className="flex justify-between items-center bg-gradient-to-r from-slate-700 to-slate-600 p-3 rounded border border-slate-500/30">
                  <div>
                    <span className="font-bold text-cyan-200">{captain}</span>
                    <p className="text-sm text-gray-400 mt-1">{captainData.count} times captained</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-cyan-400">{captainData.count}</span>
                    <p className="text-xs text-gray-500 mt-1">selections</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              Bench Points Leaders ({gameweekRangeText})
            </h2>
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {sortedBenchPoints.map((manager, index) => (
                <li key={index} className="bg-gradient-to-r from-slate-700 to-slate-600 rounded p-3 border border-slate-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-bold text-md text-yellow-300">{manager.manager_name}</span>
                      <p className="text-sm text-gray-400">
                        Rank #{manager.rank} ({manager.total_points} pts)
                      </p>
                      <p className="text-xs text-gray-500">
                        {availableGameweeks.map(gw => 
                          `GW${gw}: ${manager[`gw${gw}_points`] || 0}`
                        ).join(' | ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xl text-yellow-400">{Math.round(manager.bench_points)}</span>
                      <p className="text-sm text-gray-500 mt-1">bench pts</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLPointsChart;