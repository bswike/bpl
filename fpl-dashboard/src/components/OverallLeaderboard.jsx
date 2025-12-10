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
        <div className="text-gray-400 text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-red-400 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-semibold text-white">Standings</h1>
          <p className="text-xs text-gray-500">GW {latestGW}</p>
        </div>
        
        {/* Compact Countdown */}
        {gwStatus?.next_gameweek && (
          <div className="text-right">
            <div className="text-xs text-gray-500">{gwStatus.next_gameweek.name}</div>
            <div className="text-sm font-mono text-cyan-400">{countdown}</div>
          </div>
        )}
      </div>

      {/* Table Header */}
      <div className="flex items-center px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-slate-700/50">
        <div className="w-8 text-center">#</div>
        <div className="flex-1">Manager</div>
        <div className="w-10 text-center">+/-</div>
        <div className="w-14 text-right">Pts</div>
      </div>

      {/* Leaderboard Rows */}
      <div className="divide-y divide-slate-800/50">
        {leaderboardData.map((manager, idx) => (
          <div
            key={manager.manager_name}
            onClick={() => handleManagerClick(manager)}
            className={`flex items-center px-3 py-2.5 cursor-pointer transition-colors hover:bg-slate-800/50 ${
              idx === 0 ? 'bg-yellow-900/10' : idx === 1 ? 'bg-slate-700/10' : idx === 2 ? 'bg-amber-900/10' : ''
            }`}
          >
            {/* Position */}
            <div className="w-8 text-center">
              {idx === 0 ? (
                <span className="text-yellow-500 text-sm">①</span>
              ) : idx === 1 ? (
                <span className="text-gray-400 text-sm">②</span>
              ) : idx === 2 ? (
                <span className="text-amber-600 text-sm">③</span>
              ) : (
                <span className="text-gray-500 text-xs">{manager.position}</span>
              )}
            </div>

            {/* Manager Info */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{manager.manager_name}</div>
              <div className="text-[10px] text-gray-600 truncate">{manager.team_name}</div>
            </div>

            {/* Position Change */}
            <div className="w-10 text-center text-xs">
              {manager.positionChange > 0 ? (
                <span className="text-green-500">+{manager.positionChange}</span>
              ) : manager.positionChange < 0 ? (
                <span className="text-red-500">{manager.positionChange}</span>
              ) : (
                <span className="text-gray-600">-</span>
              )}
            </div>

            {/* Points */}
            <div className="w-14 text-right">
              <span className={`text-sm font-semibold ${idx < 3 ? 'text-white' : 'text-gray-300'}`}>
                {manager.total_points}
              </span>
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
      'GK': 'text-yellow-400', 
      'DEF': 'text-green-400', 
      'MID': 'text-blue-400', 
      'FWD': 'text-red-400' 
    };
    return colors[pos] || 'text-gray-400';
  };

  const getDifficultyColor = (difficulty) => {
    if (difficulty <= 2) return 'text-green-400';
    if (difficulty === 3) return 'text-gray-400';
    if (difficulty === 4) return 'text-orange-400';
    return 'text-red-400';
  };

  const formatKickoff = (isoString) => {
    if (!isoString) return 'TBD';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const starters = squadData?.squad?.filter(p => p.slot <= 11) || [];
  const bench = squadData?.squad?.filter(p => p.slot > 11) || [];

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-slate-900 w-full sm:max-w-md sm:rounded-lg max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
          <div>
            <h2 className="text-sm font-semibold text-white">{manager.manager_name}</h2>
            <p className="text-xs text-gray-500">{squadData?.team_name || manager.team_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-52px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-gray-500 text-sm animate-pulse">Loading...</div>
            </div>
          ) : squadData ? (
            <div>
              {/* Table Header */}
              <div className="flex items-center px-4 py-2 text-[10px] text-gray-500 uppercase tracking-wider bg-slate-800/50 border-b border-slate-700/50">
                <div className="w-8">Pos</div>
                <div className="flex-1">Player</div>
                <div className="w-20 text-right">Fixture</div>
              </div>

              {/* Starters */}
              {starters.map((player) => (
                <PlayerRowCompact 
                  key={player.element_id} 
                  player={player} 
                  getPositionColor={getPositionColor}
                  getDifficultyColor={getDifficultyColor}
                  formatKickoff={formatKickoff}
                />
              ))}

              {/* Bench Divider */}
              <div className="px-4 py-1.5 bg-slate-800/80 text-[10px] text-gray-500 uppercase tracking-wider">
                Bench
              </div>

              {/* Bench */}
              {bench.map((player) => (
                <PlayerRowCompact 
                  key={player.element_id} 
                  player={player}
                  getPositionColor={getPositionColor}
                  getDifficultyColor={getDifficultyColor}
                  formatKickoff={formatKickoff}
                  isBench
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400 text-sm">Failed to load</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ====== COMPACT PLAYER ROW ======
const PlayerRowCompact = ({ player, getPositionColor, getDifficultyColor, formatKickoff, isBench }) => {
  const fixture = player.next_fixture;
  
  return (
    <div className={`flex items-center px-4 py-2 border-b border-slate-800/50 ${isBench ? 'opacity-60' : ''}`}>
      {/* Position */}
      <div className={`w-8 text-xs font-medium ${getPositionColor(player.position)}`}>
        {player.position}
      </div>

      {/* Player Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-white truncate">{player.name}</span>
          {player.is_captain && <span className="text-[9px] bg-cyan-600 text-white px-1 rounded">C</span>}
          {player.is_vice_captain && <span className="text-[9px] bg-gray-600 text-white px-1 rounded">V</span>}
        </div>
        <div className="text-[10px] text-gray-600">
          {player.team_name} · {player.total_points}pts · {player.form}f
        </div>
      </div>

      {/* Fixture */}
      <div className="w-20 text-right">
        {fixture ? (
          <div>
            <div className={`text-xs ${getDifficultyColor(fixture.difficulty)}`}>
              {fixture.is_home ? '' : '@'}{fixture.opponent_name}
              {fixture.opponent_position > 0 && (
                <span className="text-gray-600 ml-1">({fixture.opponent_position})</span>
              )}
            </div>
            <div className="text-[10px] text-gray-600">{formatKickoff(fixture.kickoff_time)}</div>
          </div>
        ) : (
          <span className="text-[10px] text-gray-600">-</span>
        )}
      </div>
    </div>
  );
};

export default OverallLeaderboard;