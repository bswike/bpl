import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import Papa from 'papaparse';

const FPLMultiGameweekDashboard = () => {
  const [gw1Data, setGw1Data] = useState([]);
  const [gw2Data, setGw2Data] = useState([]);
  const [combinedData, setCombinedData] = useState([]);
  const [selectedView, setSelectedView] = useState('combined'); // 'gw1', 'gw2', 'combined'
  const [loading, setLoading] = useState(true);

  const processGameweekData = async (gameweek) => {
    try {
      // Fetch from Vercel Blob (your Fly worker overwrites this file every 5 minutes)
      const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
      // tiny cache-buster tied to 5min intervals
      const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

      const csvData = await response.text();
      
      // Check if the game is being updated
      if (csvData.trim() === "The game is being updated.") {
        console.log(`GW${gameweek} is being updated, returning empty data`);
        return [];
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

      const managerStats = {};
      
      // Process non-total rows
      parsed.data
        .filter(row => row.player !== "TOTAL")
        .forEach(row => {
          const manager = row.manager_name;
          if (!managerStats[manager]) {
            managerStats[manager] = {
              manager_name: manager,
              team_name: row.entry_team_name,
              total_points: 0,
              captain_points: 0,
              captain_player: '',
              remaining_players: 0,
              bench_points: 0,
              gameweek: gameweek
            };
          }

          // Track captain
          if (row.is_captain === "True") {
            managerStats[manager].captain_player = row.player;
            managerStats[manager].captain_points = row.points_applied;
          }

          // Count remaining players
          if (row.multiplier >= 1) {
            if (row.fixture_finished !== "True" && row.status !== "dnp") {
              managerStats[manager].remaining_players++;
            }
          } else if (row.multiplier === 0) {
            // Bench points
            managerStats[manager].bench_points += parseFloat(row.points_gw) || 0;
          }
        });

      // Get total points from TOTAL rows
      const totalRows = parsed.data.filter(row => row.player === "TOTAL");
      totalRows.forEach(row => {
        if (managerStats[row.manager_name]) {
          managerStats[row.manager_name].total_points = row.points_applied;
        }
      });

      // Convert to array and sort by points
      const sortedManagers = Object.values(managerStats)
        .sort((a, b) => b.total_points - a.total_points)
        .map((manager, index) => ({
          ...manager,
          position: index + 1,
          gameweek: gameweek
        }));

      return sortedManagers;
    } catch (error) {
      console.error(`Error processing GW${gameweek} data:`, error);
      return [];
    }
  };

  const fetchData = async () => {
    try {
      // Process both gameweeks
      const [gw1Managers, gw2Managers] = await Promise.all([
        processGameweekData(1),
        processGameweekData(2)
      ]);

      setGw1Data(gw1Managers);
      setGw2Data(gw2Managers);

      // Create combined data showing cumulative points
      // If GW2 data is empty (being updated), set all GW2 values to 0
      const combined = gw1Managers.map(gw1Manager => {
        const gw2Manager = gw2Managers.find(m => m.manager_name === gw1Manager.manager_name);
        const gw2Points = gw2Manager ? gw2Manager.total_points : 0;
        const isGw2Updated = gw2Managers.length === 0;
        
        return {
          manager_name: gw1Manager.manager_name,
          team_name: gw1Manager.team_name,
          gw1_points: gw1Manager.total_points,
          gw2_points: gw2Points,
          total_points: gw1Manager.total_points + gw2Points,
          gw1_captain: gw1Manager.captain_player,
          gw2_captain: gw2Manager ? gw2Manager.captain_player : (isGw2Updated ? 'Updating...' : 'N/A'),
          gw1_position: gw1Manager.position,
          gw2_position: gw2Manager ? gw2Manager.position : (isGw2Updated ? null : null),
          position_change: gw2Manager ? gw1Manager.position - gw2Manager.position : 0,
          gw2_updating: isGw2Updated
        };
      }).sort((a, b) => b.total_points - a.total_points)
        .map((manager, index) => ({
          ...manager,
          current_position: index + 1,
          overall_position_change: manager.gw1_position - (index + 1)
        }));

      setCombinedData(combined);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, 300000); // Update every 5 minutes (300000ms)
    return () => clearInterval(intervalId);
  }, []);

  const getCurrentData = () => {
    switch(selectedView) {
      case 'gw1': return gw1Data;
      case 'gw2': return gw2Data;
      case 'combined': return combinedData;
      default: return combinedData;
    }
  };

  const getPositionChangeIcon = (change) => {
    if (change > 0) return <span className="text-green-400">↗️ +{change}</span>;
    if (change < 0) return <span className="text-red-400">↘️ {change}</span>;
    return <span className="text-gray-400">➡️ 0</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900">
        <div className="text-cyan-400 text-xl animate-pulse">Loading Multi-GW Data...</div>
      </div>
    );
  }

  const currentData = getCurrentData();

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto">
        {/* Header with View Toggle */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-cyan-400 mb-4 drop-shadow-lg">
            ⚽ BPL Multi-Gameweek Dashboard
          </h1>
          
          {/* View Toggle Buttons */}
          <div className="flex justify-center space-x-2 mb-4">
            <button
              onClick={() => setSelectedView('gw1')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedView === 'gw1' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              GW1 Only
            </button>
            <button
              onClick={() => setSelectedView('gw2')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedView === 'gw2' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              GW2 Only
            </button>
            <button
              onClick={() => setSelectedView('combined')}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                selectedView === 'combined' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              Combined Total
            </button>
          </div>
          
          <p className="text-md sm:text-lg text-gray-400">
            {selectedView === 'gw1' && 'Gameweek 1 Performance'}
            {selectedView === 'gw2' && 'Gameweek 2 Performance'} 
            {selectedView === 'combined' && 'Overall Season Performance (GW1 + GW2)'}
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">👑 Current Leader</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-400">{currentData[0]?.manager_name || 'N/A'}</p>
            <p className="text-xs sm:text-sm text-gray-400">
              {selectedView === 'combined' 
                ? `${currentData[0]?.total_points || 0} total pts`
                : `${currentData[0]?.total_points || 0} pts`
              }
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">📊 Average Score</h3>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400">
              {Math.round(currentData.reduce((sum, m) => sum + (selectedView === 'combined' ? m.total_points : m.total_points), 0) / currentData.length) || 0}
            </p>
            <p className="text-xs sm:text-sm text-gray-400">Points</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">🔥 Highest Score</h3>
            <p className="text-2xl sm:text-3xl font-bold text-green-400">
              {Math.max(...currentData.map(m => selectedView === 'combined' ? m.total_points : m.total_points)) || 0}
            </p>
            <p className="text-xs sm:text-sm text-gray-400">Points</p>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-slate-700 text-center">
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">👥 Total Managers</h3>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{currentData.length}</p>
            <p className="text-xs sm:text-sm text-gray-400">In League</p>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-black rounded-md overflow-hidden shadow-xl mb-8">
          <div className="bg-black px-4 py-2 border-b border-gray-700">
            <h2 className="text-lg md:text-xl font-bold text-white">
              {selectedView === 'gw1' && 'GW1 Leaderboard'}
              {selectedView === 'gw2' && 'GW2 Leaderboard'}
              {selectedView === 'combined' && 'Overall Leaderboard'}
            </h2>
          </div>

          {/* Table Header */}
          <div className="hidden md:block bg-gray-900 px-4 py-2 border-b border-gray-700">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-400 uppercase">
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-3">Manager</div>
              <div className="col-span-2 text-center">
                {selectedView === 'combined' ? 'Total' : 'Points'}
              </div>
              {selectedView === 'combined' && (
                <>
                  <div className="col-span-1 text-center">GW1</div>
                  <div className="col-span-1 text-center">GW2</div>
                  <div className="col-span-2 text-center">Change</div>
                </>
              )}
              {selectedView !== 'combined' && (
                <>
                  <div className="col-span-2 text-center">Captain</div>
                  <div className="col-span-2 text-center">Left</div>
                </>
              )}
              <div className="col-span-2 text-center">
                {selectedView === 'combined' ? 'Captains' : 'Bench'}
              </div>
            </div>
          </div>

          {/* Table Body */}
          <div className="bg-black">
            {currentData.map((manager, index) => (
              <div 
                key={manager.manager_name}
                className="hover:bg-gray-900/30 transition-colors duration-150 border-b border-gray-800"
              >
                {/* Mobile Layout */}
                <div className="md:hidden px-3 py-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gray-800 rounded text-center">
                        <span className="text-white font-bold text-xs leading-6">
                          {selectedView === 'combined' ? manager.current_position : manager.position}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-medium text-sm truncate">{manager.manager_name}</div>
                        <div className="text-gray-400 text-xs truncate">"{manager.team_name}"</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-bold text-lg">
                        {selectedView === 'combined' ? manager.total_points : manager.total_points}
                      </div>
                      {selectedView === 'combined' && manager.overall_position_change !== 0 && (
                        <div className="text-xs">
                          {getPositionChangeIcon(manager.overall_position_change)}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {selectedView === 'combined' && (
                    <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-blue-400">GW1: {manager.gw1_points}</span>
                      </div>
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-green-400">GW2: {manager.gw2_points}</span>
                      </div>
                    </div>
                  )}
                  
                  {selectedView !== 'combined' && (
                    <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-cyan-400">Cap: {manager.captain_player.split(' ').pop()}</span>
                      </div>
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-yellow-400">Left: {manager.remaining_players}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:block px-4 py-2">
                  <div className="grid grid-cols-12 gap-2 items-center text-sm">
                    {/* Position */}
                    <div className="col-span-1 text-center">
                      <div className="w-6 h-6 bg-gray-800 rounded text-center mx-auto">
                        <span className="text-white font-bold text-xs leading-6">
                          {selectedView === 'combined' ? manager.current_position : manager.position}
                        </span>
                      </div>
                    </div>

                    {/* Manager Info */}
                    <div className="col-span-3 flex items-center space-x-2">
                      <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-blue-600 rounded text-center">
                        <span className="text-white font-bold text-xs leading-6">
                          {manager.manager_name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-white font-medium truncate">{manager.manager_name}</div>
                        <div className="text-gray-400 text-xs truncate">"{manager.team_name}"</div>
                      </div>
                    </div>

                    {/* Points */}
                    <div className="col-span-2 text-center">
                      <div className="text-white font-bold text-lg">
                        {selectedView === 'combined' ? manager.total_points : manager.total_points}
                      </div>
                    </div>

                    {selectedView === 'combined' ? (
                      <>
                        {/* GW1 Points */}
                        <div className="col-span-1 text-center">
                          <div className="text-blue-400 font-medium text-sm">{manager.gw1_points}</div>
                        </div>

                        {/* GW2 Points */}
                        <div className="col-span-1 text-center">
                          <div className="text-green-400 font-medium text-sm">{manager.gw2_points}</div>
                        </div>

                        {/* Position Change */}
                        <div className="col-span-2 text-center text-xs">
                          {getPositionChangeIcon(manager.overall_position_change)}
                        </div>

                        {/* Captains */}
                        <div className="col-span-2 text-center">
                          <div className="text-white text-xs">
                            GW1: {manager.gw1_captain.split(' ').pop()}
                          </div>
                          <div className="text-gray-400 text-xs">
                            GW2: {manager.gw2_updating ? 
                              <span className="text-yellow-400">Updating...</span> : 
                              manager.gw2_captain.split(' ').pop()
                            }
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Captain */}
                        <div className="col-span-2 text-center">
                          <div className="text-white font-medium text-sm">{manager.captain_player.split(' ').pop()}</div>
                          <div className="text-cyan-400 text-xs">{manager.captain_points} pts</div>
                        </div>

                        {/* Remaining */}
                        <div className="col-span-2 text-center">
                          <div className="text-cyan-400 font-bold text-lg">{manager.remaining_players}</div>
                          <div className="text-gray-400 text-xs">left</div>
                        </div>

                        {/* Bench */}
                        <div className="col-span-2 text-center">
                          <div className="text-yellow-400 font-medium text-sm">{Math.round(manager.bench_points)}</div>
                          <div className="text-gray-400 text-xs">bench</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLMultiGameweekDashboard;