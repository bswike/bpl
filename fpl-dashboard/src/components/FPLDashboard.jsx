import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

const FPLPointsChart = () => {
  const [data, setData] = useState([]);
  const [parsedData, setParsedData] = useState({ data: [] });
  const [loading, setLoading] = useState(true);

const fetchData = async () => {
  try {
    // Fetch from Vercel Blob (your Fly worker overwrites this file every 30s)
    const CSV_URL = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw1.csv';
    // tiny cache-buster tied to 30s intervals
    const url = `${CSV_URL}?t=${Math.floor(Date.now() / 30000)}`;

    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

    const csvData = await response.text();

    const parsed = Papa.parse(csvData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });

    setParsedData(parsed);

      parsedData.data.forEach(row => {
        if (row.player === 'João Pedro Junqueira de Jesus') {
          row.player = 'João Pedro';
        }
      });

      const managerRemainingPlayers = {};
      const managerBenchPoints = {};
      
      parsedData.data
        .filter(row => row.player !== "TOTAL")
        .forEach(row => {
          const manager = row.manager_name;
          if (!managerRemainingPlayers[manager]) {
            managerRemainingPlayers[manager] = {
              total_players: 0,
              finished_players: 0,
              remaining_players: 0,
              remaining_player_names: []
            };
          }
          if (!managerBenchPoints[manager]) {
              managerBenchPoints[manager] = {
                  bench_points: 0,
                  bench_players: []
              }
          }
          
          if (row.multiplier >= 1) {
            managerRemainingPlayers[manager].total_players++;
            
            if (row.fixture_finished === "True" || row.status === "dnp") {
              managerRemainingPlayers[manager].finished_players++;
            } else {
              managerRemainingPlayers[manager].remaining_players++;
              
              let kickoffString = 'Time TBD';
              if (row.kickoff_time) {
                  const kickoffTimeUTC = new Date(row.kickoff_time);
                  if (!isNaN(kickoffTimeUTC.getTime())) {
                    const dateOptions = { timeZone: 'America/New_York', month: 'numeric', day: 'numeric' };
                    const timeOptions = { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit' };
                    const datePart = kickoffTimeUTC.toLocaleDateString('en-US', dateOptions);
                    const timePart = kickoffTimeUTC.toLocaleTimeString('en-US', timeOptions);
                    kickoffString = `${datePart} - ${timePart}`;
                  }
              }

              const formattedPlayerName = `${row.player} (${row.club} - ${kickoffString})`;
              managerRemainingPlayers[manager].remaining_player_names.push(formattedPlayerName);
            }
          } else if (row.multiplier === 0) {
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
      
      const managerTotals = totalRows.map(row => {
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
          remaining_players: managerRemainingPlayers[row.manager_name]?.remaining_players || 0,
          remaining_player_names: managerRemainingPlayers[row.manager_name]?.remaining_player_names || [],
          bench_points: benchInfo?.bench_points || 0,
          bench_players: benchInfo?.bench_players || []
        };
      });

      const sortedData = managerTotals
        .sort((a, b) => b.total_points - a.total_points)
        .map((item, index) => {
          const totalManagers = managerTotals.length;
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
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 30000);
    return () => clearInterval(intervalId);
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const bgColor = data.designation === 'Champions League' ? 'bg-blue-900' :
                     data.designation === 'Europa League' ? 'bg-orange-900' :
                     data.designation === 'Relegation' ? 'bg-red-900' : 'bg-gray-800';
      
      const captainLastName = data.captain_player.split(' ').pop();
      return (
        <div className={`${bgColor} text-white p-1 rounded-lg shadow-xl border-2 border-white/20`}>
          <p className="font-bold text-sm">{data.manager_name}</p>
          <p className="text-gray-300 text-xs mb-0.5">"{data.team_name}"</p>
          <div className="space-y-0.5">
            <p className="font-semibold text-cyan-300 text-xs">
              Total: {data.total_points} points
            </p>
            <p className="text-gray-300 text-xxs">
              Captain: {data.captain_points} pts ({captainLastName})
            </p>
            <p className="text-gray-300 text-xxs">
              Starting XI Remaining: {data.remaining_players}
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
  
  const uniquePlayersRemaining = [...new Set(data.flatMap(manager => manager.remaining_player_names))].length;

  // Value analysis
  let valueHeroes = [];
  let premiumFlops = [];
  let differentials = [];
  let bestManagerPicks = [];
  let worstManagerPicks = [];

  if (parsedData && parsedData.data && parsedData.data.length > 0) {
    const allPlayers = parsedData.data.filter(row => 
      row && row.player && row.player !== "TOTAL" && row.points_gw > 0
    );
    
    const totalManagers = data.length;
    
    const uniquePlayers = {};
    allPlayers.forEach(player => {
      if (player && player.player && !uniquePlayers[player.player]) {
        uniquePlayers[player.player] = player;
      }
    });
    const uniquePlayersList = Object.values(uniquePlayers);
    
    const playerOwnership = {};
    allPlayers.forEach(p => {
      if (p && p.player) {
        if (!playerOwnership[p.player]) {
          playerOwnership[p.player] = { count: 0, playerData: p };
        }
        playerOwnership[p.player].count++;
      }
    });

    const playersWithOwnership = uniquePlayersList
      .filter(player => player && player.player)
      .map(player => {
        const ownership = playerOwnership[player.player];
        return {
          ...player,
          ownershipCount: ownership?.count || 0,
          ownershipPercentage: Math.round(((ownership?.count || 0) / totalManagers) * 100)
        };
      });
    
    valueHeroes = playersWithOwnership
      .filter(p => p && p.points_gw >= 3 && p.value_ratio)
      .sort((a, b) => b.value_ratio - a.value_ratio)
      .slice(0, 15);

    premiumFlops = playersWithOwnership
      .filter(p => p && p.player_cost >= 8.0 && p.points_gw <= 3 && p.value_ratio)
      .sort((a, b) => a.value_ratio - b.value_ratio)
      .slice(0, 15);

    differentials = Object.values(playerOwnership)
      .filter(p => p && p.playerData && p.playerData.player && p.count <= 2 && p.playerData.points_gw >= 6)
      .map(p => ({
        ...p.playerData,
        ownershipCount: p.count,
        ownershipPercentage: Math.round((p.count / totalManagers) * 100)
      }))
      .sort((a, b) => b.points_gw - a.points_gw)
      .slice(0, 15);

    bestManagerPicks = data.map(manager => {
      const managerPlayers = allPlayers.filter(p => 
        p && p.manager_name === manager.manager_name && p.multiplier >= 1
      );
      const bestPick = managerPlayers
        .filter(p => p && p.value_ratio)
        .sort((a, b) => b.value_ratio - a.value_ratio)[0];
      return bestPick ? {
        manager_name: manager.manager_name,
        rank: manager.rank,
        total_points: manager.total_points,
        bestPlayer: bestPick.player,
        bestCost: bestPick.player_cost,
        bestPoints: bestPick.points_gw,
        bestValue: bestPick.value_ratio
      } : null;
    }).filter(Boolean).sort((a, b) => b.bestValue - a.bestValue);

    worstManagerPicks = data.map(manager => {
      const managerPlayers = allPlayers.filter(p => 
        p && p.manager_name === manager.manager_name && p.multiplier >= 1 && p.player_cost >= 6.0
      );
      const worstPick = managerPlayers
        .filter(p => p && p.value_ratio)
        .sort((a, b) => a.value_ratio - b.value_ratio)[0];
      return worstPick ? {
        manager_name: manager.manager_name,
        rank: manager.rank,
        total_points: manager.total_points,
        worstPlayer: worstPick.player,
        worstCost: worstPick.player_cost,
        worstPoints: worstPick.points_gw,
        worstValue: worstPick.value_ratio
      } : null;
    }).filter(Boolean).sort((a, b) => a.worstValue - b.worstValue);
  }

  const captainCounts = {};
  data.forEach(manager => {
    const captain = manager.captain_player;
    if (captain && !captainCounts[captain]) {
      captainCounts[captain] = { count: 0, points: manager.captain_base_points };
    }
    if (captain) {
      captainCounts[captain].count++;
    }
  });

  const popularCaptains = Object.entries(captainCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const sortedBenchPoints = [...data]
    .sort((a, b) => b.bench_points - a.bench_points)
    .filter(manager => manager.bench_points > 0);

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-cyan-400 mb-2 drop-shadow-lg">
            ⚽ BPL Gameweek 1 Leaderboard
          </h1>
          <p className="text-md sm:text-lg text-gray-400">A quick look at the league standings and key stats.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">🏆 Current League Champion</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-400">{topScorer?.manager_name || 'N/A'}</p>
            <p className="text-xs sm:text-sm text-gray-400 truncate">"{topScorer?.team_name || 'N/A'}"</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-3">📊 Points Distribution</h3>
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
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">🪑 Avg Bench Points</h3>
            <p className="text-2xl sm:text-3xl font-bold text-yellow-400">{avgBenchPoints}</p>
            <p className="text-xs sm:text-sm text-gray-400">Points left on bench</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">⏰ Unique Players Left</h3>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{uniquePlayersRemaining}</p>
            <p className="text-xs sm:text-sm text-gray-400">Still to play</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl lg:col-span-2 border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 sm:mb-6 text-center">
              All Managers Performance
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              ⏳ XI Remaining
            </h2>
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {data.map((manager, index) => (
                <li key={index} className="bg-gradient-to-r from-slate-700 to-slate-600 rounded p-3 border border-slate-500/30">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <span className="font-bold text-md text-cyan-300">{manager.manager_name}</span>
                      <p className="text-sm text-gray-400">
                        {manager.total_points} pts | Rank #{manager.rank}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xl text-cyan-400">{manager.remaining_players}</span>
                      <p className="text-sm text-gray-500 mt-1">players left</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {manager.remaining_player_names.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              ⚡ Captains Analysis
            </h2>
            <ul className="space-y-2">
              {popularCaptains.map(([captain, captainData]) => (
                <li key={captain} className="flex justify-between items-center bg-gradient-to-r from-slate-700 to-slate-600 p-3 rounded border border-slate-500/30">
                  <div>
                    <span className="font-bold text-cyan-200">{captain}</span>
                    <p className="text-sm text-gray-400 mt-1">{captainData.count} managers captained</p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-cyan-400">{captainData.points * 2} pts</span>
                    <p className="text-xs text-gray-500 mt-1">(Original: {captainData.points} pts)</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700">
            <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
              🪑 Bench Points Leaders
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
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xl text-yellow-400">{manager.bench_points}</span>
                      <p className="text-sm text-gray-500 mt-1">bench pts</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-300 mt-1">
                    {manager.bench_players.map(player => 
                      `${player.name} (${player.club}): ${player.points}pts`
                    ).join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-yellow-400 mb-6 text-center">
            💰 GW1 VALUE ANALYSIS
          </h1>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-green-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-green-700/30">
              <h2 className="text-xl sm:text-2xl font-bold text-green-300 mb-4 text-center">
                🔥 Value Heroes (Best Points per £)
              </h2>
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {valueHeroes && valueHeroes.length > 0 ? valueHeroes.map((player, index) => (
                  player && player.player ? (
                    <li key={index} className="bg-gradient-to-r from-green-800/30 to-slate-700 rounded p-3 border border-green-600/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-bold text-md text-green-200">{player.player}</span>
                          <p className="text-sm text-gray-400">
                            {player.club} | £{player.player_cost}m | {player.points_gw} pts | {player.ownershipPercentage}% owned
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xl text-green-400">{player.value_ratio}</span>
                          <p className="text-sm text-gray-500 mt-1">pts/£</p>
                        </div>
                      </div>
                    </li>
                  ) : null
                )) : (
                  <li className="text-gray-400 text-center py-4">Loading value heroes...</li>
                )}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-red-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-red-700/30">
              <h2 className="text-xl sm:text-2xl font-bold text-red-300 mb-4 text-center">
                💸 Premium Flops (8m+ & ≤3 pts)
              </h2>
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {premiumFlops && premiumFlops.length > 0 ? premiumFlops.map((player, index) => (
                  player && player.player ? (
                    <li key={index} className="bg-gradient-to-r from-red-800/30 to-slate-700 rounded p-3 border border-red-600/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-bold text-md text-red-200">{player.player}</span>
                          <p className="text-sm text-gray-400">
                            {player.club} | £{player.player_cost}m | {player.points_gw} pts | {player.ownershipPercentage}% owned
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xl text-red-400">{player.value_ratio}</span>
                          <p className="text-sm text-gray-500 mt-1">pts/£</p>
                        </div>
                      </div>
                    </li>
                  ) : null
                )) : (
                  <li className="text-gray-400 text-center py-4">Loading premium flops...</li>
                )}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gradient-to-br from-purple-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-purple-700/30">
              <h2 className="text-xl sm:text-2xl font-bold text-purple-300 mb-4 text-center">
                💎 Differential Gold (≤2 owners, 6+ pts)
              </h2>
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {differentials && differentials.length > 0 ? differentials.map((player, index) => (
                  player && player.player ? (
                    <li key={index} className="bg-gradient-to-r from-purple-800/30 to-slate-700 rounded p-3 border border-purple-600/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-bold text-md text-purple-200">{player.player}</span>
                          <p className="text-sm text-gray-400">
                            {player.club} | £{player.player_cost}m | {player.ownershipPercentage}% owned
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xl text-purple-400">{player.points_gw}</span>
                          <p className="text-sm text-gray-500 mt-1">points</p>
                        </div>
                      </div>
                    </li>
                  ) : null
                )) : (
                  <li className="text-gray-400 text-center py-4">Loading differentials...</li>
                )}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-blue-700/30">
              <h2 className="text-xl sm:text-2xl font-bold text-blue-300 mb-4 text-center">
                🎯 Best Manager Picks (Best XI Value)
              </h2>
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {bestManagerPicks && bestManagerPicks.length > 0 ? bestManagerPicks.slice(0, 15).map((pick, index) => (
                  pick && pick.bestPlayer ? (
                    <li key={index} className="bg-gradient-to-r from-blue-800/30 to-slate-700 rounded p-3 border border-blue-600/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-bold text-md text-blue-200">{pick.manager_name}</span>
                          <p className="text-sm text-gray-400">
                            {pick.bestPlayer} | £{pick.bestCost}m | {pick.bestPoints} pts
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xl text-blue-400">{pick.bestValue}</span>
                          <p className="text-sm text-gray-500 mt-1">pts/£</p>
                        </div>
                      </div>
                    </li>
                  ) : null
                )) : (
                  <li className="text-gray-400 text-center py-4">Loading best picks...</li>
                )}
              </ul>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-orange-700/30">
              <h2 className="text-xl sm:text-2xl font-bold text-orange-300 mb-4 text-center">
                📉 Manager's Worst Picks (Worst XI Value, 6m+ only)
              </h2>
              <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                {worstManagerPicks && worstManagerPicks.length > 0 ? worstManagerPicks.slice(0, 15).map((pick, index) => (
                  pick && pick.worstPlayer ? (
                    <li key={index} className="bg-gradient-to-r from-orange-800/30 to-slate-700 rounded p-3 border border-orange-600/30">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <span className="font-bold text-md text-orange-200">{pick.manager_name}</span>
                          <p className="text-sm text-gray-400">
                            {pick.worstPlayer} | £{pick.worstCost}m | {pick.worstPoints} pts | Rank #{pick.rank}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xl text-orange-400">{pick.worstValue}</span>
                          <p className="text-sm text-gray-500 mt-1">pts/£</p>
                        </div>
                      </div>
                    </li>
                  ) : null
                )) : (
                  <li className="text-gray-400 text-center py-4">Loading worst picks...</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLPointsChart;