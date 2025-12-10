import React, { useState, useEffect, useMemo, useCallback } from 'react';

// ====== OVERALL LEADERBOARD COMPONENT ======
// Self-contained - fetches its own data

const OverallLeaderboard = () => {
  const [combinedData, setCombinedData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [gameweekData, setGameweekData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [selectedManager, setSelectedManager] = useState(null);
  const [squadData, setSquadData] = useState(null);
  const [squadLoading, setSquadLoading] = useState(false);
  const [gwStatus, setGwStatus] = useState(null);
  const [countdown, setCountdown] = useState('');

  // Entry ID mapping
  const entryIdMap = {
    'Garrett Kunkel': 394273,
    'Andrew Vidal': 373574,
    'Brett Swikle': 650881,
    'John Matthew': 6197529,
    'Jared Alexander': 1094601,
    'Joe Curran': 6256408,
    'John Sebastian': 62221,
    'Nate Cohen': 701623,
    'Chris Munoz': 3405299,
    'Evan Bagheri': 5438502,
    'Dean Maghsadi': 5423005,
    'Brian Pleines': 4807443,
    'Max Maier': 581156,
    'Adrian McLoughlin': 4912819,
    'Wes H': 876871,
    'Kevin Tomek': 4070923,
    'Kevin K': 5898648,
    'Tony Tharakan': 872442,
    'JP Fischer': 468791,
    'Patrick McCleary': 8592148,
  };

  // Fetch leaderboard data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch manifest
        const manifestRes = await fetch('https://bpl-red-sun-894.fly.dev/api/manifest', {
          cache: 'no-store'
        });
        if (!manifestRes.ok) throw new Error('Failed to load manifest');
        const manifest = await manifestRes.json();

        const gameweeks = Object.keys(manifest.gameweeks || {}).map(Number).sort((a, b) => a - b);
        if (gameweeks.length === 0) throw new Error('No gameweek data');

        // Fetch all gameweek CSVs
        const gwData = {};
        
        await Promise.all(gameweeks.map(async (gw) => {
          const res = await fetch(`https://bpl-red-sun-894.fly.dev/api/data/${gw}`);
          if (!res.ok) return;
          const csvText = await res.text();
          
          if (csvText.includes('The game is being updated')) return;
          
          // Parse CSV
          const lines = csvText.split('\n').filter(line => line.trim());
          if (lines.length < 2) return;
          
          const headers = lines[0].split(',');
          const managerIdx = headers.indexOf('manager_name');
          const pointsIdx = headers.indexOf('points_applied');
          const playerIdx = headers.indexOf('player');
          const teamNameIdx = headers.indexOf('entry_team_name');
          
          // Check if we found the required columns
          if (managerIdx === -1 || pointsIdx === -1 || playerIdx === -1) return;
          
          const managers = {};
          
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            if (cols.length > playerIdx && cols[playerIdx] === 'TOTAL') {
              const name = cols[managerIdx];
              if (name) {
                managers[name] = {
                  manager_name: name,
                  team_name: cols[teamNameIdx] || '',
                  total_points: parseInt(cols[pointsIdx]) || 0,
                };
              }
            }
          }
          
          gwData[gw] = Object.values(managers);
        }));

        // Build combined data
        const managerTotals = {};
        
        gameweeks.forEach(gw => {
          (gwData[gw] || []).forEach(m => {
            if (!managerTotals[m.manager_name]) {
              managerTotals[m.manager_name] = {
                manager_name: m.manager_name,
                team_name: m.team_name,
                total_points: 0,
              };
            }
            managerTotals[m.manager_name].total_points += m.total_points;
            managerTotals[m.manager_name][`gw${gw}_points`] = m.total_points;
          });
        });

        const combined = Object.values(managerTotals)
          .sort((a, b) => b.total_points - a.total_points);

        setCombinedData(combined);
        setAvailableGameweeks(gameweeks);
        setGameweekData(gwData);
        setLoading(false);

      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch gameweek status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('https://bpl-red-sun-894.fly.dev/api/gameweek-status');
        if (res.ok) {
          const data = await res.json();
          setGwStatus(data);
        }
      } catch (err) {
        console.error('Failed to fetch GW status:', err);
      }
    };
    
    fetchStatus();
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!gwStatus?.next_gameweek?.deadline_time) return;
    
    const updateCountdown = () => {
      const deadline = new Date(gwStatus.next_gameweek.deadline_time);
      const now = new Date();
      const diff = deadline - now;
      
      if (diff <= 0) {
        setCountdown('Locked!');
        return;
      }
      
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      if (days > 0) {
        setCountdown(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [gwStatus]);

  // Calculate position changes from previous GW
  const leaderboardData = useMemo(() => {
    if (!combinedData || combinedData.length === 0 || availableGameweeks.length === 0) return [];
    
    const latestGW = availableGameweeks[availableGameweeks.length - 1];
    const prevGW = availableGameweeks.length > 1 ? availableGameweeks[availableGameweeks.length - 2] : null;
    
    // Get previous GW standings
    const prevStandings = { positions: {} };
    if (prevGW && gameweekData[prevGW]) {
      combinedData.forEach(manager => {
        let cumulative = 0;
        for (let i = 0; i < availableGameweeks.length - 1; i++) {
          const gw = availableGameweeks[i];
          cumulative += manager[`gw${gw}_points`] || 0;
        }
        prevStandings[manager.manager_name] = cumulative;
      });
      
      const prevSorted = Object.entries(prevStandings)
        .filter(([key]) => key !== 'positions')
        .sort((a, b) => b[1] - a[1])
        .map(([name], idx) => ({ name, position: idx + 1 }));
      
      prevSorted.forEach(({ name, position }) => {
        prevStandings.positions[name] = position;
      });
    }
    
    return combinedData.map((manager, idx) => {
      const currentPos = idx + 1;
      const prevPos = prevStandings.positions?.[manager.manager_name] || currentPos;
      const posChange = prevPos - currentPos;
      
      return {
        ...manager,
        position: currentPos,
        positionChange: posChange,
        entryId: entryIdMap[manager.manager_name],
      };
    });
  }, [combinedData, availableGameweeks, gameweekData]);

  // Fetch squad when manager selected
  const handleManagerClick = useCallback(async (manager) => {
    if (!manager.entryId) {
      console.warn('No entry ID for manager:', manager.manager_name);
      return;
    }
    
    setSelectedManager(manager);
    setSquadLoading(true);
    setSquadData(null);
    
    try {
      const res = await fetch(`https://bpl-red-sun-894.fly.dev/api/squad/${manager.entryId}`);
      if (res.ok) {
        const data = await res.json();
        setSquadData(data);
      }
    } catch (err) {
      console.error('Failed to fetch squad:', err);
    } finally {
      setSquadLoading(false);
    }
  }, []);

  const closeModal = useCallback(() => {
    setSelectedManager(null);
    setSquadData(null);
  }, []);

  const formatDeadline = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  const getPositionChangeDisplay = (change) => {
    if (change > 0) return <span className="text-green-400 font-semibold">↑{change}</span>;
    if (change < 0) return <span className="text-red-400 font-semibold">↓{Math.abs(change)}</span>;
    return <span className="text-gray-500">-</span>;
  };

  const latestGW = availableGameweeks[availableGameweeks.length - 1] || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-cyan-400 text-xl animate-pulse">Loading standings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-red-400 text-xl mb-4">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with countdown */}
      <header className="text-center mb-8">
        <h1 className="text-2xl sm:text-3xl font-light text-white tracking-wide mb-2">
          League Standings
        </h1>
        <p className="text-gray-400 mb-4">After Gameweek {latestGW}</p>
        
        {/* Countdown Card */}
        {gwStatus?.next_gameweek && (
          <div className="inline-block bg-gradient-to-r from-cyan-900/40 to-blue-900/40 border border-cyan-700/50 rounded-xl px-6 py-4">
            <div className="text-sm text-cyan-400 mb-1">
              {gwStatus.next_gameweek.name} Deadline
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
              {countdown}
            </div>
            <div className="text-xs text-gray-400">
              {formatDeadline(gwStatus.next_gameweek.deadline_time)}
            </div>
          </div>
        )}
      </header>

      {/* Podium - Top 3 */}
      <div className="flex justify-center items-end gap-2 mb-6 px-2">
        {/* 2nd Place */}
        {leaderboardData[1] && (
          <div 
            className="flex-1 max-w-[100px] cursor-pointer transform hover:scale-105 transition-transform"
            onClick={() => handleManagerClick(leaderboardData[1])}
          >
            <div className="bg-slate-700/80 rounded-lg p-2 text-center border border-slate-600/50">
              <div className="text-lg mb-0.5">🥈</div>
              <div className="text-white font-semibold text-xs truncate">
                {leaderboardData[1].manager_name.split(' ')[0]}
              </div>
              <div className="text-lg font-bold text-white">
                {leaderboardData[1].total_points}
              </div>
              <div className="text-[10px] text-gray-400">
                {getPositionChangeDisplay(leaderboardData[1].positionChange)}
              </div>
            </div>
          </div>
        )}

        {/* 1st Place */}
        {leaderboardData[0] && (
          <div 
            className="flex-1 max-w-[110px] cursor-pointer transform hover:scale-105 transition-transform"
            onClick={() => handleManagerClick(leaderboardData[0])}
          >
            <div className="bg-gradient-to-b from-yellow-600/30 to-yellow-700/20 rounded-lg p-2 text-center border border-yellow-600/40">
              <div className="text-xl mb-0.5">👑</div>
              <div className="text-white font-semibold text-sm truncate">
                {leaderboardData[0].manager_name.split(' ')[0]}
              </div>
              <div className="text-xl font-bold text-white">
                {leaderboardData[0].total_points}
              </div>
              <div className="text-[10px] text-gray-300">
                {getPositionChangeDisplay(leaderboardData[0].positionChange)}
              </div>
            </div>
          </div>
        )}

        {/* 3rd Place */}
        {leaderboardData[2] && (
          <div 
            className="flex-1 max-w-[100px] cursor-pointer transform hover:scale-105 transition-transform"
            onClick={() => handleManagerClick(leaderboardData[2])}
          >
            <div className="bg-slate-700/80 rounded-lg p-2 text-center border border-slate-600/50">
              <div className="text-lg mb-0.5">🥉</div>
              <div className="text-white font-semibold text-xs truncate">
                {leaderboardData[2].manager_name.split(' ')[0]}
              </div>
              <div className="text-lg font-bold text-white">
                {leaderboardData[2].total_points}
              </div>
              <div className="text-[10px] text-gray-400">
                {getPositionChangeDisplay(leaderboardData[2].positionChange)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rest of leaderboard */}
      <div className="space-y-2">
        {leaderboardData.slice(3).map((manager) => (
          <div
            key={manager.manager_name}
            onClick={() => handleManagerClick(manager)}
            className="bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between cursor-pointer transition-all hover:border-cyan-700/50"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-lg font-bold text-gray-300">
                {manager.position}
              </div>
              <div>
                <div className="text-white font-medium">{manager.manager_name}</div>
                <div className="text-gray-500 text-sm">"{manager.team_name}"</div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-xs text-gray-500">Change</div>
                <div>{getPositionChangeDisplay(manager.positionChange)}</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-white">{manager.total_points}</div>
                <div className="text-xs text-gray-500">points</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Squad Modal */}
      {selectedManager && (
        <SquadModal
          manager={selectedManager}
          squadData={squadData}
          loading={squadLoading}
          onClose={closeModal}
        />
      )}
    </div>
  );
};


// ====== SQUAD MODAL COMPONENT ======
const SquadModal = ({ manager, squadData, loading, onClose }) => {
  const getPositionColor = (pos) => {
    const colors = { 
      'GK': 'text-yellow-400 bg-yellow-900/30 border-yellow-700/50', 
      'DEF': 'text-green-400 bg-green-900/30 border-green-700/50', 
      'MID': 'text-blue-400 bg-blue-900/30 border-blue-700/50', 
      'FWD': 'text-red-400 bg-red-900/30 border-red-700/50' 
    };
    return colors[pos] || 'text-gray-400 bg-gray-900/30 border-gray-700/50';
  };

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 2) return 'bg-green-600 text-white';
    if (difficulty === 3) return 'bg-gray-500 text-white';
    if (difficulty === 4) return 'bg-orange-500 text-white';
    return 'bg-red-600 text-white';
  };

  const formatKickoff = (isoString) => {
    if (!isoString) return 'TBD';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const starters = squadData?.squad?.filter(p => p.slot <= 11) || [];
  const bench = squadData?.squad?.filter(p => p.slot > 11) || [];

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-900 border-b border-slate-700 p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">{manager.manager_name}</h2>
            <p className="text-gray-400 text-sm">
              {squadData ? `"${squadData.team_name}"` : `"${manager.team_name}"`}
              {squadData && <span className="ml-2">• {squadData.overall_points} pts</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-80px)] p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-cyan-400 animate-pulse">Loading squad...</div>
            </div>
          ) : squadData ? (
            <div className="space-y-4">
              {/* Next GW Info */}
              <div className="text-center text-sm text-gray-400 mb-4">
                Showing fixtures for Gameweek {squadData.next_gameweek}
              </div>

              {/* Starters */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Starting XI</h3>
                <div className="space-y-2">
                  {starters.map((player) => (
                    <PlayerRow 
                      key={player.element_id} 
                      player={player} 
                      getPositionColor={getPositionColor}
                      getDifficultyColor={getDifficultyColor}
                      formatKickoff={formatKickoff}
                    />
                  ))}
                </div>
              </div>

              {/* Bench */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Bench</h3>
                <div className="space-y-2 opacity-70">
                  {bench.map((player) => (
                    <PlayerRow 
                      key={player.element_id} 
                      player={player}
                      getPositionColor={getPositionColor}
                      getDifficultyColor={getDifficultyColor}
                      formatKickoff={formatKickoff}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400">Failed to load squad</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// ====== PLAYER ROW COMPONENT ======
const PlayerRow = ({ player, getPositionColor, getDifficultyColor, formatKickoff }) => {
  const fixture = player.next_fixture;
  
  // Format record as W-D-L
  const formatRecord = (f) => {
    if (!f || f.opponent_wins === undefined) return null;
    return `${f.opponent_wins}-${f.opponent_draws}-${f.opponent_losses}`;
  };
  
  return (
    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/50 hover:border-slate-600/50 transition-colors">
      <div className="flex items-center justify-between">
        {/* Player Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className={`text-xs font-bold px-2 py-1 rounded border ${getPositionColor(player.position)}`}>
            {player.position}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-medium truncate">{player.name}</span>
              {player.is_captain && (
                <span className="text-xs bg-cyan-600 text-white px-1.5 py-0.5 rounded font-bold">C</span>
              )}
              {player.is_vice_captain && (
                <span className="text-xs bg-gray-600 text-white px-1.5 py-0.5 rounded font-bold">V</span>
              )}
            </div>
            <div className="text-xs text-gray-500">{player.team_name} • £{player.now_cost}m</div>
          </div>
        </div>

        {/* Fixture Info */}
        <div className="text-right ml-3">
          {fixture ? (
            <div>
              <div className="flex items-center justify-end gap-2">
                <span className="text-white font-medium">
                  {fixture.is_home ? '' : '@'}{fixture.opponent_name}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${getDifficultyColor(fixture.difficulty)}`}>
                  {fixture.difficulty}
                </span>
              </div>
              <div className="text-[10px] text-gray-400 flex items-center justify-end gap-1.5">
                {fixture.opponent_position > 0 && (
                  <span className="text-gray-300">{fixture.opponent_position}{getOrdinalSuffix(fixture.opponent_position)}</span>
                )}
                {formatRecord(fixture) && (
                  <span className="text-gray-500">({formatRecord(fixture)})</span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatKickoff(fixture.kickoff_time)}
              </div>
            </div>
          ) : (
            <span className="text-gray-500 text-sm">No fixture</span>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="flex gap-4 mt-2 pt-2 border-t border-slate-700/50 text-xs">
        <div>
          <span className="text-gray-500">Total: </span>
          <span className="text-white font-medium">{player.total_points} pts</span>
        </div>
        <div>
          <span className="text-gray-500">Form: </span>
          <span className="text-white font-medium">{player.form}</span>
        </div>
        <div>
          <span className="text-gray-500">Own: </span>
          <span className="text-white font-medium">{player.selected_by_percent}%</span>
        </div>
      </div>
    </div>
  );
};

// Helper function for ordinal suffix (1st, 2nd, 3rd, etc.)
const getOrdinalSuffix = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

export default OverallLeaderboard;