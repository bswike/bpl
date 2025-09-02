import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import Papa from 'papaparse';

const FPLMultiGameweekDashboard = () => {
  const [gameweekData, setGameweekData] = useState({}); // Store all gameweek data dynamically
  const [combinedData, setCombinedData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [selectedView, setSelectedView] = useState('latest'); // Default to latest gameweek
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
    
    console.log('Available gameweeks:', available);
    return available;
  };

  const processGameweekData = async (gameweek) => {
    try {
      const CSV_URL = `https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw${gameweek}.csv`;
      const url = `${CSV_URL}?t=${Math.floor(Date.now() / 300000)}`;

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

      const csvData = await response.text();
      
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

          if (row.is_captain === "True") {
            managerStats[manager].captain_player = row.player;
            managerStats[manager].captain_points = row.points_applied;
          }

          if (row.multiplier >= 1) {
            if (row.fixture_finished !== "True" && row.status !== "dnp") {
              managerStats[manager].remaining_players++;
            }
          } else if (row.multiplier === 0) {
            managerStats[manager].bench_points += parseFloat(row.points_gw) || 0;
          }
        });

      const totalRows = parsed.data.filter(row => row.player === "TOTAL");
      totalRows.forEach(row => {
        if (managerStats[row.manager_name]) {
          managerStats[row.manager_name].total_points = row.points_applied;
        }
      });

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
      // Find all available gameweeks
      const available = await findAvailableGameweeks();
      if (available.length === 0) {
        throw new Error('No gameweek data available');
      }

      setAvailableGameweeks(available);
      setLatestGameweek(available[available.length - 1]);

      // Process all available gameweeks
      const gameweekPromises = available.map(gw => 
        processGameweekData(gw).then(data => ({ gameweek: gw, data }))
      );
      
      const results = await Promise.all(gameweekPromises);
      
      // Store data by gameweek
      const gwData = {};
      results.forEach(({ gameweek, data }) => {
        gwData[gameweek] = data;
      });
      setGameweekData(gwData);

      // Create combined data with cumulative points
      if (results[0] && results[0].data.length > 0) {
        const combined = results[0].data.map(firstGwManager => {
          const managerData = {
            manager_name: firstGwManager.manager_name,
            team_name: firstGwManager.team_name,
            [`gw${available[0]}_points`]: firstGwManager.total_points,
            [`gw${available[0]}_captain`]: firstGwManager.captain_player,
            [`gw${available[0]}_position`]: firstGwManager.position,
            total_points: firstGwManager.total_points
          };

          // Add data from subsequent gameweeks
          let runningTotal = firstGwManager.total_points;
          for (let i = 1; i < available.length; i++) {
            const gw = available[i];
            const gwManager = gwData[gw]?.find(m => m.manager_name === firstGwManager.manager_name);
            const gwPoints = gwManager ? gwManager.total_points : 0;
            const isUpdating = gwData[gw]?.length === 0;

            runningTotal += gwPoints;
            managerData[`gw${gw}_points`] = gwPoints;
            managerData[`gw${gw}_captain`] = gwManager ? gwManager.captain_player : (isUpdating ? 'Updating...' : 'N/A');
            managerData[`gw${gw}_position`] = gwManager ? gwManager.position : null;
            managerData[`gw${gw}_updating`] = isUpdating;
          }

          managerData.total_points = runningTotal;
          return managerData;
        }).sort((a, b) => b.total_points - a.total_points)
          .map((manager, index) => ({
            ...manager,
            current_position: index + 1,
            overall_position_change: manager[`gw${available[0]}_position`] - (index + 1)
          }));

        setCombinedData(combined);
      }

      // Set default view to latest gameweek
      setSelectedView(`gw${available[available.length - 1]}`);

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

  const getCurrentData = () => {
    if (selectedView === 'combined') return combinedData;
    
    const gwNumber = parseInt(selectedView.replace('gw', ''));
    return gameweekData[gwNumber] || [];
  };

  const getPositionChangeIcon = (change) => {
    if (change > 0) return <span className="text-green-400">↗️ +{change}</span>;
    if (change < 0) return <span className="text-red-400">↘️ {change}</span>;
    return <span className="text-gray-400">➡️ 0</span>;
  };

  // Generate color for each gameweek button (maintaining original colors)
  const getGameweekColor = (gw, isSelected) => {
    const colorMap = {
      1: isSelected ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600',
      2: isSelected ? 'bg-green-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600',
      3: isSelected ? 'bg-orange-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600',
    };
    
    // For GW4 and beyond, use a cycling color scheme
    if (gw > 3) {
      const colors = ['purple', 'pink', 'indigo', 'teal', 'red', 'amber', 'emerald', 'rose'];
      const colorIndex = (gw - 4) % colors.length;
      const color = colors[colorIndex];
      return isSelected 
        ? `bg-${color}-600 text-white` 
        : `bg-slate-700 text-gray-300 hover:bg-slate-600`;
    }
    
    return colorMap[gw] || 'bg-slate-700 text-gray-300 hover:bg-slate-600';
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
          
          {/* Dynamic View Toggle Buttons */}
          <div className="flex justify-center flex-wrap gap-2 mb-4">
            {availableGameweeks.map(gw => (
              <button
                key={gw}
                onClick={() => setSelectedView(`gw${gw}`)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  selectedView === `gw${gw}` 
                    ? getGameweekColor(gw, true)
                    : getGameweekColor(gw, false)
                }`}
              >
                GW{gw} Only
              </button>
            ))}
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
            {selectedView === 'combined' && `Overall Season Performance (GW1-${latestGameweek})`}
            {selectedView !== 'combined' && `Gameweek ${selectedView.replace('gw', '')} Performance`}
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
            <h3 className="text-lg sm:text-xl font-bold text-cyan-300 mb-1">🎯 Latest GW</h3>
            <p className="text-2xl sm:text-3xl font-bold text-cyan-400">{latestGameweek}</p>
            <p className="text-xs sm:text-sm text-gray-400">Available</p>
          </div>
        </div>

        {/* Leaderboard Table */}
        <div className="bg-black rounded-md overflow-hidden shadow-xl mb-8">
          <div className="bg-black px-4 py-2 border-b border-gray-700">
            <h2 className="text-lg md:text-xl font-bold text-white">
              {selectedView === 'combined' && 'Overall Leaderboard'}
              {selectedView !== 'combined' && `GW${selectedView.replace('gw', '')} Leaderboard`}
            </h2>
          </div>

          {/* Dynamic Table Header */}
          <div className="hidden md:block bg-gray-900 px-4 py-2 border-b border-gray-700">
            <div className={`grid gap-2 text-xs font-medium text-gray-400 uppercase ${
              selectedView === 'combined' 
                ? `grid-cols-${Math.min(12, 5 + availableGameweeks.length)}` 
                : 'grid-cols-12'
            }`}>
              <div className="col-span-1 text-center">#</div>
              <div className="col-span-3">Manager</div>
              <div className="col-span-1 text-center">
                {selectedView === 'combined' ? 'Total' : 'Points'}
              </div>
              {selectedView === 'combined' && (
                <>
                  {availableGameweeks.map(gw => (
                    <div key={gw} className="col-span-1 text-center">GW{gw}</div>
                  ))}
                  <div className="col-span-1 text-center">Change</div>
                </>
              )}
              {selectedView !== 'combined' && (
                <>
                  <div className="col-span-2 text-center">Captain</div>
                  <div className="col-span-2 text-center">Left</div>
                  <div className="col-span-2 text-center">Bench</div>
                </>
              )}
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
                    <div className={`grid gap-1 text-xs mt-1 grid-cols-${Math.min(4, availableGameweeks.length)}`}>
                      {availableGameweeks.slice(0, 4).map(gw => (
                        <div key={gw} className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                          <span className={`${gw === 1 ? 'text-blue-400' : gw === 2 ? 'text-green-400' : gw === 3 ? 'text-orange-400' : 'text-purple-400'}`}>
                            GW{gw}: {manager[`gw${gw}_points`] || 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {selectedView !== 'combined' && (
                    <div className="grid grid-cols-2 gap-2 text-xs mt-1">
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-cyan-400">Cap: {manager.captain_player?.split(' ').pop() || 'N/A'}</span>
                      </div>
                      <div className="text-center bg-gray-800/30 rounded px-1 py-0.5">
                        <span className="text-yellow-400">Left: {manager.remaining_players || 0}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Desktop Layout */}
                <div className="hidden md:block px-4 py-2">
                  <div className={`grid gap-2 items-center text-sm ${
                    selectedView === 'combined' 
                      ? `grid-cols-${Math.min(12, 5 + availableGameweeks.length)}` 
                      : 'grid-cols-12'
                  }`}>
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

                    {selectedView === 'combined' ? (
                      <>
                        {/* Total Points */}
                        <div className="col-span-1 text-center">
                          <div className="text-white font-bold text-lg">{manager.total_points}</div>
                        </div>

                        {/* Individual Gameweek Points */}
                        {availableGameweeks.map(gw => (
                          <div key={gw} className="col-span-1 text-center">
                            <div className={`font-medium text-sm ${
                              gw === 1 ? 'text-blue-400' : 
                              gw === 2 ? 'text-green-400' : 
                              gw === 3 ? 'text-orange-400' : 'text-purple-400'
                            }`}>
                              {manager[`gw${gw}_points`] || 0}
                            </div>
                          </div>
                        ))}

                        {/* Position Change */}
                        <div className="col-span-1 text-center text-xs">
                          {getPositionChangeIcon(manager.overall_position_change)}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Points */}
                        <div className="col-span-1 text-center">
                          <div className="text-white font-bold text-lg">{manager.total_points}</div>
                        </div>

                        {/* Captain */}
                        <div className="col-span-2 text-center">
                          <div className="text-white font-medium text-sm">{manager.captain_player?.split(' ').pop() || 'N/A'}</div>
                          <div className="text-cyan-400 text-xs">{manager.captain_points || 0} pts</div>
                        </div>

                        {/* Remaining */}
                        <div className="col-span-2 text-center">
                          <div className="text-cyan-400 font-bold text-lg">{manager.remaining_players || 0}</div>
                          <div className="text-gray-400 text-xs">left</div>
                        </div>

                        {/* Bench */}
                        <div className="col-span-2 text-center">
                          <div className="text-yellow-400 font-medium text-sm">{Math.round(manager.bench_points) || 0}</div>
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