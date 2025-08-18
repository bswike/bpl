import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import Papa from 'papaparse';

const FPLPointsChart = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch('/fpl_rosters_points_gw1.csv');
        const csvData = await response.text();
        
        const parsedData = Papa.parse(csvData, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true
        });

        const managerRemainingPlayers = {};
        
        parsedData.data
          .filter(row => row.player !== "TOTAL" && row.multiplier >= 1)
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
            
            managerRemainingPlayers[manager].total_players++;
            
            if (row.fixture_finished === "True" || row.status === "dnp") {
              managerRemainingPlayers[manager].finished_players++;
            } else {
              managerRemainingPlayers[manager].remaining_players++;
              managerRemainingPlayers[manager].remaining_player_names.push(row.player);
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
          
          return {
            manager_name: row.manager_name,
            team_name: row.entry_team_name,
            total_points: row.points_applied,
            regular_points: regularPoints,
            captain_points: captainPoints,
            captain_player: captainInfo?.captain_player || 'Unknown',
            captain_base_points: captainInfo?.captain_base_points || 0,
            remaining_players: managerRemainingPlayers[row.manager_name]?.remaining_players || 0,
            remaining_player_names: managerRemainingPlayers[row.manager_name]?.remaining_player_names || []
          };
        });

        const sortedData = managerTotals
          .sort((a, b) => b.total_points - a.total_points)
          .map((item, index) => ({
            ...item,
            rank: index + 1,
            displayName: item.manager_name.length > 12 ?
              item.manager_name.substring(0, 12) + '...' :
              item.manager_name
          }));

        setData(sortedData);
        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 text-white p-4 rounded-lg shadow-xl border border-gray-700">
          <p className="font-bold text-lg">{data.manager_name}</p>
          <p className="text-gray-300 text-sm mb-2">"{data.team_name}"</p>
          <div className="space-y-1">
            <p className="font-semibold text-teal-400">
              Total: {data.total_points} points
            </p>
            <p className="text-gray-400">
              Regular: {data.regular_points} pts
            </p>
            <p className="text-gray-400">
              Captain: {data.captain_points} pts ({data.captain_player})
            </p>
            <p className="text-gray-400">
              Starting XI Remaining: {data.remaining_players}
            </p>
          </div>
          <p className="text-gray-400 text-sm mt-2">
            Rank: #{data.rank}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-gray-900">
        <div className="text-white text-xl animate-pulse">Loading FPL data...</div>
      </div>
    );
  }

  const topScorer = data[0];
  const avgPoints = data.length > 0 ? Math.round(data.reduce((sum, item) => sum + item.total_points, 0) / data.length) : 0;

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

  return (
    <div className="min-h-screen bg-gray-900 p-4 sm:p-6 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header and Summary Stats */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-teal-400 mb-2">
            ⚽ FPL Gameweek 1 Leaderboard
          </h1>
          <p className="text-md sm:text-lg text-gray-400">A quick look at the league standings and key stats.</p>
        </div>

        {/* Top Stats Section - Stack on mobile, grid on larger screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-gray-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-1">🏆 League Champion</h3>
            <p className="text-2xl sm:text-3xl font-bold text-teal-400">{topScorer?.manager_name || 'N/A'}</p>
            <p className="text-xs sm:text-sm text-gray-400 truncate">"{topScorer?.team_name || 'N/A'}"</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-gray-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-1">📊 Average Points</h3>
            <p className="text-2xl sm:text-3xl font-bold text-teal-400">{avgPoints}</p>
            <p className="text-xs sm:text-sm text-gray-400">Across the League</p>
          </div>
          
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-lg border border-gray-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-gray-200 mb-1">⏰ Total Players Left</h3>
            <p className="text-2xl sm:text-3xl font-bold text-teal-400">{data.reduce((sum, m) => sum + m.remaining_players, 0)}</p>
            <p className="text-xs sm:text-sm text-gray-400">Still to play</p>
          </div>
        </div>

        {/* Main Chart and Podiums */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8 sm:mb-12">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl lg:col-span-2 border border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-4 sm:mb-6 text-center">
              All Managers Performance
            </h2>
            
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data}
                margin={{ top: 20, right: 10, left: 10, bottom: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="displayName"
                  stroke="#a0aec0"
                  angle={-45}
                  textAnchor="end"
                  height={50}
                  fontSize={10}
                />
                <YAxis stroke="#a0aec0" />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="regular_points"
                  stackId="points"
                  fill="#0021A5"
                  name="Regular Points"
                />
                <Bar 
                  dataKey="captain_points"
                  stackId="points"
                  fill="#FF6600"
                  radius={[4, 4, 0, 0]}
                  name="Captain Points"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          {/* Top 3 Podium List */}
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-100 mb-4 text-center">
              Top 3 Managers
            </h2>
            <div className="space-y-4">
              {data.slice(0, 3).map((manager, index) => (
                <div key={manager.manager_name} className="flex items-center space-x-4 bg-gray-700 p-3 rounded-lg shadow-inner">
                  <div className="text-2xl sm:text-3xl">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-lg">{manager.manager_name}</p>
                    <p className="text-xs text-gray-400">"{manager.team_name}"</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl sm:text-2xl font-extrabold text-teal-400">{manager.total_points}</p>
                    <p className="text-xs text-gray-500">Total Points</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Analysis Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 text-center">
              ⏳ Players Still To Play
            </h2>
            <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {data.filter(manager => manager.remaining_players > 0).map((manager) => (
                <li key={manager.manager_name} className="bg-gray-700 rounded p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-md text-teal-300">{manager.manager_name}</span>
                    <span className="text-xl font-extrabold text-teal-400">{manager.remaining_players}</span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    {manager.remaining_player_names.join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 shadow-2xl border border-gray-700">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4 text-center">
              ⚡ Captains Analysis
            </h2>
            <ul className="space-y-2">
              {popularCaptains.map(([captain, captainData]) => (
                <li key={captain} className="flex justify-between items-center bg-gray-700 p-3 rounded">
                  <div>
                    <span className="font-bold text-gray-300">{captain}</span>
                    <p className="text-sm text-gray-400 mt-1">{captainData.count} managers captained</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-teal-400">{captainData.points} pts</span>
                    <p className="text-xs text-gray-500">x2 = {captainData.points * 2}</p>
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