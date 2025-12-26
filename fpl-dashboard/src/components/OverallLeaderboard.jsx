import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  Wallet, 
  Trophy, 
  TrendingDown, 
  Flame, 
  Users, 
  Armchair, 
  ArrowLeftRight 
} from 'lucide-react';

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
  const [managerHistory, setManagerHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' or 'team'
  const [gwStatus, setGwStatus] = useState(null);
  const [countdown, setCountdown] = useState('');
  const [managerValues, setManagerValues] = useState({}); // Store total values for all managers

  // Entry ID mapping (verified against FPL API)
  const entryIdMap = {
    'Andrew Vidal': 394273,
    'Garrett Kunkel': 373574,
    'John Matthew': 650881,
    'Brett Swikle': 6197529,
    'Joe Curran': 1094601,
    'Chris Munoz': 6256408,
    'John Sebastian': 62221,
    'Jared Alexander': 701623,
    'Evan Bagheri': 3405299,
    'Nate Cohen': 5438502,
    'Dean Maghsadi': 5423005,
    'Max Maier': 4807443,
    'Adrian McLoughlin': 581156,
    'Wes H': 4912819,
    'Kevin Tomek': 876871,
    'Brian Pleines': 4070923,
    'Kevin K': 5898648,
    'Patrick McCleary': 872442,
    'JP Fischer': 468791,
    'Tony Tharakan': 8592148,
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
          const playerCostIdx = headers.indexOf('player_cost');
          const isCaptainIdx = headers.indexOf('is_captain');
          const benchPointsIdx = headers.indexOf('bench_points');
          
          // Check if we found the required columns
          if (managerIdx === -1 || pointsIdx === -1 || playerIdx === -1) return;
          
          const managers = {};
          const managerTeamValues = {}; // Track team value per manager
          const captainChoices = {}; // Track captain popularity for this GW
          
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',');
            const managerName = cols[managerIdx];
            const playerName = cols[playerIdx];
            
            if (!managerName) continue;
            
            // Initialize manager if not exists
            if (!managers[managerName]) {
              managers[managerName] = {
                manager_name: managerName,
                team_name: cols[teamNameIdx] || '',
                total_points: 0,
                bench_points: 0,
                captain_player: '',
              };
            }
            
            // Sum player costs for team value (exclude TOTAL row)
            if (playerName !== 'TOTAL' && playerCostIdx !== -1) {
              const cost = parseFloat(cols[playerCostIdx]) || 0;
              managerTeamValues[managerName] = (managerTeamValues[managerName] || 0) + cost;
              
              // Track captain choices
              if (isCaptainIdx !== -1) {
                const isCaptain = cols[isCaptainIdx];
                if (isCaptain === 'True' || isCaptain === 'true' || isCaptain === '1') {
                  managers[managerName].captain_player = playerName;
                  captainChoices[playerName] = (captainChoices[playerName] || 0) + 1;
                }
              }
            }
            
            // Get manager totals from TOTAL row
            if (playerName === 'TOTAL') {
              managers[managerName].total_points = parseInt(cols[pointsIdx]) || 0;
              if (benchPointsIdx !== -1) {
                managers[managerName].bench_points = parseInt(cols[benchPointsIdx]) || 0;
              }
            }
          }
          
          // Find most popular captain this GW
          let mostPopularCaptain = '';
          let maxCaptainCount = 0;
          Object.entries(captainChoices).forEach(([player, count]) => {
            if (count > maxCaptainCount) {
              maxCaptainCount = count;
              mostPopularCaptain = player;
            }
          });
          
          // Add team values and chicken pick flag to managers
          Object.keys(managers).forEach(name => {
            managers[name].team_value = managerTeamValues[name] || 0;
            managers[name].picked_popular_captain = managers[name].captain_player === mostPopularCaptain;
          });
          
          gwData[gw] = Object.values(managers);
        }));

        // Build combined data
        const managerTotals = {};
        const latestGw = gameweeks[gameweeks.length - 1];
        
        gameweeks.forEach(gw => {
          (gwData[gw] || []).forEach(m => {
            if (!managerTotals[m.manager_name]) {
              managerTotals[m.manager_name] = {
                manager_name: m.manager_name,
                team_name: m.team_name,
                total_points: 0,
                team_value: 0,
                gws_won: 0,
                gws_last: 0,
                total_bench_points: 0,
                chicken_picks: 0,
                gw_points_history: [], // For calculating form
              };
            }
            managerTotals[m.manager_name].total_points += m.total_points;
            managerTotals[m.manager_name][`gw${gw}_points`] = m.total_points;
            managerTotals[m.manager_name].total_bench_points += m.bench_points || 0;
            managerTotals[m.manager_name].gw_points_history.push({ gw, points: m.total_points });
            
            // Count chicken picks (times they picked the most popular captain)
            if (m.picked_popular_captain) {
              managerTotals[m.manager_name].chicken_picks += 1;
            }
            
            // Keep team_value from the latest gameweek
            if (gw === latestGw && m.team_value) {
              managerTotals[m.manager_name].team_value = m.team_value;
            }
          });
        });
        
        // Calculate gameweeks won and last by each manager
        gameweeks.forEach(gw => {
          const gwManagers = gwData[gw] || [];
          if (gwManagers.length === 0) return;
          
          // Find the highest and lowest score in this gameweek
          const maxPoints = Math.max(...gwManagers.map(m => m.total_points || 0));
          const minPoints = Math.min(...gwManagers.map(m => m.total_points || Infinity));
          
          if (maxPoints <= 0) return;
          
          // Find all managers with the highest score (could be a tie)
          gwManagers.forEach(m => {
            if (m.total_points === maxPoints && managerTotals[m.manager_name]) {
              managerTotals[m.manager_name].gws_won += 1;
            }
            if (m.total_points === minPoints && managerTotals[m.manager_name]) {
              managerTotals[m.manager_name].gws_last += 1;
            }
          });
        });
        
        // Calculate form (average of last 4 GWs)
        Object.values(managerTotals).forEach(manager => {
          const history = manager.gw_points_history.sort((a, b) => b.gw - a.gw);
          const last4 = history.slice(0, 4);
          if (last4.length > 0) {
            manager.form = last4.reduce((sum, g) => sum + g.points, 0) / last4.length;
          } else {
            manager.form = 0;
          }
          // Clean up - we don't need the full history in state
          delete manager.gw_points_history;
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

  // Fetch total values for all managers (squad + bank)
  useEffect(() => {
    if (combinedData.length === 0) return;
    
    const fetchAllValues = async () => {
      const values = {};
      
      // Fetch all manager values in parallel
      const promises = combinedData.map(async (manager) => {
        const entryId = entryIdMap[manager.manager_name];
        if (!entryId) return null;
        
        try {
          const res = await fetch(`https://bpl-red-sun-894.fly.dev/api/squad/${entryId}`);
          if (res.ok) {
            const data = await res.json();
            return { 
              manager_name: manager.manager_name, 
              total_value: data.total_value,
              squad_value: data.squad_value,
              bank: data.bank
            };
          }
        } catch (err) {
          console.error(`Failed to fetch value for ${manager.manager_name}:`, err);
        }
        return null;
      });
      
      const results = await Promise.all(promises);
      results.forEach(result => {
        if (result) {
          values[result.manager_name] = result;
        }
      });
      
      setManagerValues(values);
    };
    
    fetchAllValues();
  }, [combinedData]);

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

  // Fetch squad and history when manager selected
  const handleManagerClick = useCallback(async (manager) => {
    if (!manager.entryId) {
      console.warn('No entry ID for manager:', manager.manager_name);
      return;
    }
    
    setSelectedManager(manager);
    setActiveTab('overview');
    setSquadLoading(true);
    setHistoryLoading(true);
    setSquadData(null);
    setManagerHistory(null);
    
    // Fetch both squad and history in parallel
    const [squadRes, historyRes] = await Promise.all([
      fetch(`https://bpl-red-sun-894.fly.dev/api/squad/${manager.entryId}`).catch(() => null),
      fetch(`https://bpl-red-sun-894.fly.dev/api/manager-history/${manager.entryId}`).catch(() => null),
    ]);
    
    if (squadRes?.ok) {
      const data = await squadRes.json();
      setSquadData(data);
    }
    setSquadLoading(false);
    
    if (historyRes?.ok) {
      const data = await historyRes.json();
      setManagerHistory(data);
    }
    setHistoryLoading(false);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedManager(null);
    setSquadData(null);
    setManagerHistory(null);
    setActiveTab('overview');
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
              <div className="flex items-center gap-1.5">
                <span className="text-sm text-white truncate">{manager.manager_name}</span>
                {managerValues[manager.manager_name]?.total_value > 0 && (
                  <span className="text-[10px] text-green-400">£{managerValues[manager.manager_name].total_value.toFixed(1)}m</span>
                )}
                {manager.gws_won > 0 && (
                  <span className="text-[10px] text-yellow-400">🏆{manager.gws_won}</span>
                )}
              </div>
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

      {/* Manager Overview Modal */}
      {selectedManager && (
        <ManagerOverviewModal
          manager={selectedManager}
          squadData={squadData}
          squadLoading={squadLoading}
          managerHistory={managerHistory}
          historyLoading={historyLoading}
          allManagers={combinedData}
          managerValues={managerValues}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onClose={closeModal}
        />
      )}
    </div>
  );
};


// ====== MANAGER OVERVIEW MODAL COMPONENT ======
const ManagerOverviewModal = ({ 
  manager, 
  squadData, 
  squadLoading, 
  managerHistory, 
  historyLoading, 
  allManagers, 
  managerValues,
  activeTab, 
  setActiveTab, 
  onClose 
}) => {
  // Calculate league ranks for a given stat
  const getRank = (managerName, stat, sortDesc = true) => {
    const sorted = [...allManagers].sort((a, b) => 
      sortDesc ? (b[stat] || 0) - (a[stat] || 0) : (a[stat] || 0) - (b[stat] || 0)
    );
    const idx = sorted.findIndex(m => m.manager_name === managerName);
    return idx >= 0 ? idx + 1 : '-';
  };

  // Get value rank
  const getValueRank = (managerName) => {
    const sorted = Object.entries(managerValues)
      .filter(([_, v]) => v?.total_value)
      .sort((a, b) => (b[1].total_value || 0) - (a[1].total_value || 0));
    const idx = sorted.findIndex(([name]) => name === managerName);
    return idx >= 0 ? idx + 1 : '-';
  };

  // Get transfer rank (fewer is better)
  const getTransferRank = () => {
    // We don't have all managers' transfer data, so skip ranking for now
    return '-';
  };

  const currentManager = allManagers.find(m => m.manager_name === manager.manager_name) || {};
  const avgGwScore = currentManager.total_points && allManagers.length > 0 
    ? (currentManager.total_points / Object.keys(currentManager).filter(k => k.startsWith('gw') && k.endsWith('_points')).length).toFixed(1)
    : '-';
  
  const gwsPlayed = Object.keys(currentManager).filter(k => k.startsWith('gw') && k.endsWith('_points')).length;
  const realAvg = gwsPlayed > 0 ? (currentManager.total_points / gwsPlayed).toFixed(1) : '-';

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

  // Stat row component
  const StatRow = ({ label, value, rank, icon: Icon, suffix = '' }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
          <Icon size={16} className="text-cyan-400" />
        </div>
        <span className="text-sm text-gray-300">{label}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-white">{value}{suffix}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full min-w-[36px] text-center ${
          rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
          rank <= 3 ? 'bg-green-500/20 text-green-400' :
          rank >= allManagers.length - 2 ? 'bg-red-500/20 text-red-400' :
          'bg-slate-700/50 text-gray-400'
        }`}>
          #{rank}
        </span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 pb-16 sm:pb-0" onClick={onClose}>
      <div 
        className="bg-slate-900 w-full sm:max-w-lg sm:rounded-lg max-h-[85vh] sm:max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-slate-800 px-4 py-3 flex justify-between items-center border-b border-slate-700">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white truncate">{manager.manager_name}</h2>
              {managerValues[manager.manager_name]?.total_value && (
                <span className="text-sm font-bold text-green-400">
                  £{managerValues[manager.manager_name].total_value.toFixed(1)}m
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{squadData?.team_name || manager.team_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-700 bg-slate-800/50">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'overview' 
                ? 'text-cyan-400 border-b-2 border-cyan-400' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'team' 
                ? 'text-cyan-400 border-b-2 border-cyan-400' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            Team Form
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(85vh-110px)] sm:max-h-[calc(90vh-110px)] pb-4">
          {activeTab === 'overview' ? (
            /* Overview Tab */
            <div className="p-4">
              {historyLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-500 text-sm animate-pulse">Loading stats...</div>
                </div>
              ) : (
                <div className="space-y-1">
                  {/* Overall Points */}
                  <StatRow 
                    icon={BarChart3} 
                    label="Overall Points" 
                    value={`${currentManager.total_points || 0} (${realAvg}/wk)`}
                    rank={getRank(manager.manager_name, 'total_points')}
                  />
                  
                  {/* Team Value */}
                  <StatRow 
                    icon={Wallet} 
                    label="Team Value" 
                    value={managerValues[manager.manager_name]?.total_value?.toFixed(1) || '-'}
                    suffix="m"
                    rank={getValueRank(manager.manager_name)}
                  />
                  
                  {/* GWs Won */}
                  <StatRow 
                    icon={Trophy} 
                    label="Gameweeks Won" 
                    value={currentManager.gws_won || 0}
                    rank={getRank(manager.manager_name, 'gws_won')}
                  />
                  
                  {/* GWs Last */}
                  <StatRow 
                    icon={TrendingDown} 
                    label="Gameweeks Last" 
                    value={currentManager.gws_last || 0}
                    rank={getRank(manager.manager_name, 'gws_last', false)}
                  />
                  
                  {/* Form */}
                  <StatRow 
                    icon={Flame} 
                    label="Form (Last 4 GWs)" 
                    value={currentManager.form?.toFixed(1) || '-'}
                    rank={getRank(manager.manager_name, 'form')}
                  />
                  
                  {/* Chicken Picks */}
                  <StatRow 
                    icon={Users} 
                    label="Chicken Picks" 
                    value={currentManager.chicken_picks || 0}
                    rank={getRank(manager.manager_name, 'chicken_picks')}
                  />
                  
                  {/* Bench Points */}
                  <StatRow 
                    icon={Armchair} 
                    label="Bench Points" 
                    value={currentManager.total_bench_points || 0}
                    rank={getRank(manager.manager_name, 'total_bench_points')}
                  />
                  
                  {/* Transfers */}
                  {managerHistory && (
                    <StatRow 
                      icon={ArrowLeftRight} 
                      label="Transfers" 
                      value={`${managerHistory.total_transfers || 0} (${managerHistory.total_transfer_cost > 0 ? `-${managerHistory.total_transfer_cost}pts` : 'free'})`}
                      rank={'-'}
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Team Form Tab */
            squadLoading ? (
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
            )
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
          <span className="text-[10px] text-gray-500">£{player.price?.toFixed(1) || '?'}m</span>
        </div>
        <div className="text-[10px] text-gray-500">
          {player.team} · <span className="text-cyan-400">{player.prev_gw_points || 0}pts</span> last GW · {player.form}f
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