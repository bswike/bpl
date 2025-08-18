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

        // Calculate remaining players for each manager (starting lineup only)
        const managerRemainingPlayers = {};
        
        parsedData.data
          .filter(row => row.player !== "TOTAL" && row.multiplier >= 1) // Starting lineup only (excludes bench)
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
            
            // Count as finished if fixture_finished is True OR status is 'dnp'
            if (row.fixture_finished === "True" || row.status === "dnp") {
              managerRemainingPlayers[manager].finished_players++;
            } else {
              managerRemainingPlayers[manager].remaining_players++;
              managerRemainingPlayers[manager].remaining_player_names.push(row.player);
            }
          });

        // Get captain data
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

        // Get totals from rows where player = "TOTAL" and combine with captain data
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

        // Sort by points descending
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
        <div className="bg-gray-900 text-white p-4 rounded-lg shadow-xl border border-gray-700">
          <p className="font-bold text-lg">{data.manager_name}</p>
          <p className="text-gray-300 text-sm mb-2">"{data.team_name}"</p>
          <div className="space-y-1">
            <p className="text-green-400 font-semibold">
              Total: {data.total_points} points
            </p>
            <p className="text-blue-400">
              Regular: {data.regular_points} pts
            </p>
            <p className="text-yellow-400">
              Captain: {data.captain_points} pts ({data.captain_player})
            </p>
            <p className="text-purple-400">
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
      <div className="flex items-center justify-center h-96 bg-gradient-to-br from-purple-900 to-blue-900">
        <div className="text-white text-xl">Loading FPL data...</div>
      </div>
    );
  }

  const topScorer = data[0];
  const avgPoints = Math.round(data.reduce((sum, item) => sum + item.total_points, 0) / data.length);

  // Calculate captain statistics
  const captainCounts = {};
  data.forEach(manager => {
    const captain = manager.captain_player;
    if (!captainCounts[captain]) {
      captainCounts[captain] = { count: 0, points: manager.captain_base_points };
    }
    captainCounts[captain].count++;
  });

  const popularCaptains = Object.entries(captainCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-4">
            ⚽ FPL Gameweek 1 Leaderboard
          </h1>
          <div className="flex justify-center space-x-8 text-lg">
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-white">
              <div className="text-2xl font-bold text-yellow-400">{topScorer?.total_points}</div>
              <div className="text-sm">Top Score</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-white">
              <div className="text-2xl font-bold text-blue-400">{avgPoints}</div>
              <div className="text-sm">Average</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-white">
              <div className="text-2xl font-bold text-purple-400">{data.reduce((sum, m) => sum + m.remaining_players, 0)}</div>
              <div className="text-sm">Total Players Left</div>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        <div className="flex justify-center items-end mb-8 space-x-4">
          {data.slice(0, 3).map((manager, index) => {
            const heights = ['h-32', 'h-40', 'h-28'];
            const positions = [1, 0, 2];
            const actualIndex = positions[index];
            
            return (
              <div key={manager.manager_name} className={`bg-white/20 backdrop-blur rounded-t-lg p-4 ${heights[actualIndex]} flex flex-col justify-end items-center text-white min-w-32`}>
                <div className="text-3xl mb-2">
                  {actualIndex === 0 ? '🥇' : actualIndex === 1 ? '🥈' : '🥉'}
                </div>
                <div className="text-lg font-bold">{manager.total_points}</div>
                <div className="text-sm text-center font-medium">{manager.displayName}</div>
                <div className="text-xs text-gray-300 text-center">#{manager.rank}</div>
              </div>
            );
          })}
        </div>

        {/* Main Chart */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6 text-center">
            All Managers Performance
          </h2>
          
          <div className="mb-4 flex justify-center">
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-blue-500 rounded mr-2"></div>
                <span className="text-white">Regular Points</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 bg-yellow-500 rounded mr-2"></div>
                <span className="text-white">Captain Points (×2)</span>
              </div>
            </div>
          </div>
          
          <ResponsiveContainer width="100%" height={500}>
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="displayName"
                stroke="#ffffff"
                angle={-45}
                textAnchor="end"
                height={100}
                fontSize={12}
              />
              <YAxis stroke="#ffffff" />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="regular_points"
                stackId="points"
                fill="#3b82f6"
                radius={[0, 0, 0, 0]}
                name="Regular Points"
              />
              <Bar 
                dataKey="captain_points"
                stackId="points"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                name="Captain Points"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Players Remaining Analysis */}
        <div className="mt-8 bg-white/10 backdrop-blur rounded-xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            ⏳ Starting XI Still To Play
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-white">
              <h3 className="text-lg font-bold mb-3">Most Starting XI Remaining</h3>
              <div className="space-y-2">
                {data
                  .slice()
                  .sort((a, b) => b.remaining_players - a.remaining_players)
                  .slice(0, 8)
                  .map((manager) => (
                  <div key={manager.manager_name} className="flex justify-between items-center bg-white/5 rounded p-2">
                    <div>
                      <div className="font-medium">{manager.manager_name}</div>
                      <div className="text-sm text-gray-300">Current: {manager.total_points} pts</div>
                    </div>
                    <div className="text-purple-400 font-bold">{manager.remaining_players} left</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="text-white">
              <h3 className="text-lg font-bold mb-3">Starting XI Yet To Play</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {data
                  .filter(manager => manager.remaining_players > 0)
                  .sort((a, b) => b.remaining_players - a.remaining_players)
                  .map((manager) => (
                  <div key={manager.manager_name} className="bg-white/5 rounded p-2">
                    <div className="font-medium text-purple-400">{manager.manager_name}</div>
                    <div className="text-sm text-gray-300">
                      {manager.remaining_player_names.join(', ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Captain Analysis */}
        <div className="mt-8 bg-white/10 backdrop-blur rounded-xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">
            ⚡ Captain Choices Analysis
          </h2>
          
          <div className="grid grid-cols-1 gap-6">
            <div className="text-white">
              <h3 className="text-lg font-bold mb-3">Most Popular Captains</h3>
              <div className="space-y-2">
                {popularCaptains.map(([captain, captainData]) => (
                  <div key={captain} className="flex justify-between items-center bg-white/5 rounded p-2">
                    <span>{captain}</span>
                    <div className="text-right">
                      <div className="text-yellow-400">{captainData.count} managers</div>
                      <div className="text-sm text-gray-300">{captainData.points} pts (×2 = {captainData.points * 2})</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">🏆 League Champion</h3>
            <p className="text-lg">{topScorer?.manager_name}</p>
            <p className="text-gray-300 text-sm">"{topScorer?.team_name}"</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">📊 Points Range</h3>
            <p className="text-lg">{data[data.length - 1]?.total_points} - {topScorer?.total_points}</p>
            <p className="text-gray-300 text-sm">Lowest to Highest</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur rounded-lg p-6 text-center text-white">
            <h3 className="text-xl font-bold mb-2">⏰ Starting XI Left</h3>
            <p className="text-lg">{data.reduce((sum, m) => sum + m.remaining_players, 0)} total</p>
            <p className="text-gray-300 text-sm">Across all managers</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLPointsChart;