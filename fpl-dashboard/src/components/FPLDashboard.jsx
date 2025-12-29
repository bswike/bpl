import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';

const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const SSE_URL = 'https://bpl-red-sun-894.fly.dev/sse/fpl-updates';
const FALLBACK_POLL_INTERVAL_MS = 300000;
const CACHE_VERSION = 'v4';

const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeStr = (s) => (s ?? '').toString().normalize('NFC').replace(/\u00A0/g, ' ').trim();

// --- Simple localStorage cache for historical gameweeks ---
const getDashboardCacheKey = (gw) => `fpl_dashboard_gw_${gw}_${CACHE_VERSION}`;

const getCachedDashboardGW = (gameweek) => {
  try {
    const cached = localStorage.getItem(getDashboardCacheKey(gameweek));
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.warn(`Cache read failed for GW${gameweek}:`, e);
  }
  return null;
};

const setCachedDashboardGW = (gameweek, data) => {
  try {
    localStorage.setItem(getDashboardCacheKey(gameweek), JSON.stringify(data));
  } catch (e) {
    console.warn(`Cache write failed for GW${gameweek}:`, e);
  }
};

// --- Chips Components (Moved Outside) ---

const ChipsManagerRow = React.memo(({ manager, rank, data, onManagerClick }) => {
  const managerFullData = data.find(m => m.manager_name === manager.manager_name);
  const totalChips = manager.chips.length;

  const wildcards = manager.chips.filter(c => c.name === 'wildcard');
  const freehits = manager.chips.filter(c => c.name === 'freehit');
  const bboosts = manager.chips.filter(c => c.name === 'bboost');
  const tripleCaps = manager.chips.filter(c => c.name === '3xc');

  const renderChipInfo = (chips, chipType) => {
    if (chips.length === 0) return <span className="text-gray-500">—</span>;

    return chips.map(chip => {
      const gwStats = managerFullData?.gameweeks?.[chip.event];
      let text;
      if (chipType === 'bboost') {
        text = `GW${chip.event} (+${gwStats?.bench_points || 0} pts)`;
      } else if (chipType === '3xc') {
        text = `GW${chip.event} (+${gwStats?.captain_points || 0} pts)`;
      } else {
        text = `GW${chip.event} (${gwStats?.points || 0} pts)`;
      }
      return <span key={chip.event} className="block">{text}</span>;
    });
  };

  return (
    <div className="bg-slate-800/30 rounded-md p-1.5 border border-slate-700">
      {/* Mobile View */}
      <div className="md:hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-slate-700 rounded-md text-xs font-bold flex items-center justify-center">{rank}</span>
            <div>
              <button onClick={() => onManagerClick(manager.manager_name)} className="text-left hover:text-cyan-400 transition-colors">
                <p className="text-white font-bold text-xs">{manager.manager_name}</p>
                <p className="text-gray-400 text-[10px]">"{managerFullData?.team_name || '...'}"</p>
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-base">{totalChips}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center text-[10px] mt-1">
          <div className="bg-slate-900/50 p-0.5 rounded">
            <p className="font-semibold text-purple-400 truncate">Wildcard</p>
            <div className="text-gray-200 font-medium">{renderChipInfo(wildcards, 'wildcard')}</div>
          </div>
          <div className="bg-slate-900/50 p-0.5 rounded">
            <p className="font-semibold text-cyan-400 truncate">Free Hit</p>
            <div className="text-gray-200 font-medium">{renderChipInfo(freehits, 'freehit')}</div>
          </div>
          <div className="bg-slate-900/50 p-0.5 rounded">
            <p className="font-semibold text-yellow-400 truncate">Bench Boost</p>
            <div className="text-gray-200 font-medium">{renderChipInfo(bboosts, 'bboost')}</div>
          </div>
          <div className="bg-slate-900/50 p-0.5 rounded">
            <p className="font-semibold text-orange-400 truncate">Triple Cap</p>
            <div className="text-gray-200 font-medium">{renderChipInfo(tripleCaps, '3xc')}</div>
          </div>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden md:grid md:grid-cols-7 gap-3 items-center text-sm px-3 py-1">
        <div className="md:col-span-2 flex items-center gap-3">
          <span className="flex-shrink-0 w-7 h-7 bg-slate-700 rounded-md text-sm font-bold flex items-center justify-center">{rank}</span>
          <button onClick={() => onManagerClick(manager.manager_name)} className="text-left hover:text-cyan-400 transition-colors">
            <p className="text-white font-medium truncate">{manager.manager_name}</p>
            <p className="text-gray-400 text-xs truncate">"{managerFullData?.team_name || '...'}"</p>
          </button>
        </div>
        <div className="text-cyan-400 font-bold text-center">{managerFullData?.total_points || 0}</div>
        <div className="text-white font-bold text-center">{totalChips}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(wildcards, 'wildcard')}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(freehits, 'freehit')}</div>
        <div className="text-center text-gray-300 text-xs">
          {renderChipInfo(bboosts, 'bboost')}
          {renderChipInfo(tripleCaps, '3xc')}
        </div>
      </div>
    </div>
  );
});

const ChipsLeaderboard = ({ chipsData, data, onManagerClick }) => {
  // Sort by total points (like Standings leaderboard) instead of chips count
  const sortedChipsData = useMemo(() => {
    return [...chipsData].sort((a, b) => {
      const aData = data.find(m => m.manager_name === a.manager_name);
      const bData = data.find(m => m.manager_name === b.manager_name);
      const aPoints = aData?.total_points || 0;
      const bPoints = bData?.total_points || 0;
      return bPoints - aPoints;
    });
  }, [chipsData, data]);

  return (
    <div className="space-y-1">
      {/* Desktop Header */}
      <div className="hidden md:grid md:grid-cols-7 gap-3 px-3 py-2 text-xs font-bold text-gray-400 uppercase">
        <div className="md:col-span-2">Manager</div>
        <div className="text-center">Points</div>
        <div className="text-center">Chips</div>
        <div className="text-center">Wildcard</div>
        <div className="text-center">Free Hit</div>
        <div className="text-center">BB / TC</div>
      </div>
      {/* Rows */}
      {sortedChipsData.map((manager, idx) => (
        <ChipsManagerRow
          key={manager.manager_name}
          manager={manager}
          rank={idx + 1}
          data={data}
          onManagerClick={onManagerClick}
        />
      ))}
    </div>
  );
};


const FPLMultiGameweekDashboard = () => {
  // Use shared data context instead of local fetching - INSTANT tab switch!
  const {
    gameweekData,
    availableGameweeks,
    chipsData,
    isInitialLoading: loading,
    error,
    connectionStatus,
    lastUpdate,
  } = useData();

  // Derive data for chips display from gameweekData
  const data = useMemo(() => {
    if (!gameweekData || Object.keys(gameweekData).length === 0) return [];
    
    // Build manager data with gameweek breakdown for chips display
    const managers = {};
    
    availableGameweeks.forEach(gw => {
      (gameweekData[gw] || []).forEach(m => {
        if (!managers[m.manager_name]) {
          managers[m.manager_name] = {
            manager_name: m.manager_name,
            team_name: m.team_name,
            total_points: 0,
            gameweeks: {},
          };
        }
        managers[m.manager_name].total_points += m.total_points || 0;
        managers[m.manager_name].gameweeks[gw] = {
          points: m.total_points || 0,
          bench_points: m.bench_points || 0,
          captain_points: m.captain_points || 0,
        };
      });
    });
    
    return Object.values(managers).sort((a, b) => b.total_points - a.total_points);
  }, [gameweekData, availableGameweeks]);

  const chipsLoading = loading;
  const [selectedManager, setSelectedManager] = useState(null);
  const [showChipModal, setShowChipModal] = useState(false);
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [selectedCaptainGW, setSelectedCaptainGW] = useState(null);

  // All data is now loaded from context - no fetch needed!
  // SSE is handled by context as well

  // Merge manager data with chips data
  const mergedData = useMemo(() => {
    if (data.length === 0 || loading) return [];

    const chipsMap = new Map((chipsData || []).map(c => [c.manager_name, c.chips]));

    return data.map((manager, index) => {
      const managerChips = chipsMap.get(manager.manager_name) || [];
      const totalManagers = data.length;
      let designation = 'Mid-table';
      if (index < 4) designation = 'Champions League';
      else if (index === 4) designation = 'Europa League';
      else if (index >= totalManagers - 3) designation = 'Relegation';

      const managerCopy = { 
        ...manager, 
        chips: managerChips,
        rank: index + 1,
        designation,
        displayName: manager.manager_name,
      };

      managerChips.forEach(chip => {
        if (managerCopy.gameweeks?.[chip.event]) {
          managerCopy.gameweeks[chip.event] = {
            ...managerCopy.gameweeks[chip.event],
            chip_used: chip.name
          };
        }
      });
      return managerCopy;
    });
  }, [data, chipsData, loading]);

  const handleManagerClick = (managerName) => {
    const manager = mergedData.find(m => m.manager_name === managerName);
    if (manager) {
      setSelectedManager(manager);
      setShowChipModal(true);
    }
  };

  const handleCaptainClick = (gameweek) => {
    setSelectedCaptainGW(gameweek);
    setShowCaptainModal(true);
  };

  const ChipModal = () => {
    if (!selectedManager) return null;

    const chipStats = selectedManager.chips?.map(chip => {
      const gwData = selectedManager.gameweeks[chip.event];
      const gwTotalPoints = gwData?.points || 0;

      let chipBenefit = 0;
      let benefitLabel = '';

      if (chip.name === '3xc') {
        chipBenefit = gwData?.captain_points || 0;
        const captainName = gwData?.captain || 'N/A';
        benefitLabel = (
          <span>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleCaptainClick(chip.event);
              }}
              className="text-cyan-400 hover:text-cyan-300 underline font-semibold"
            >
              {captainName}
            </button>
            {' '}scored {chipBenefit} raw pts (x3)
          </span>
        );
      } else if (chip.name === 'bboost') {
        chipBenefit = gwData?.bench_points || 0;
        benefitLabel = `Bench scored ${chipBenefit} pts`;
      } else if (chip.name === 'freehit') {
        chipBenefit = gwTotalPoints;
        benefitLabel = `Team scored ${chipBenefit} pts`;
      } else if (chip.name === 'wildcard') {
        chipBenefit = 0;
        benefitLabel = 'Squad restructure';
      }

      return {
        ...chip,
        gwPoints: gwTotalPoints,
        chipBenefit: chipBenefit,
        benefitLabel: benefitLabel
      };
    }) || [];

    const totalChipBenefit = chipStats.reduce((sum, chip) => sum + chip.chipBenefit, 0);

    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={() => setShowChipModal(false)}
      >
        <div
          className="bg-slate-800 rounded-lg border-2 border-cyan-500 max-w-md w-full max-h-[80vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-700/50">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">{selectedManager.manager_name}</h3>
                <p className="text-sm text-gray-400">"{selectedManager.team_name}"</p>
                <p className="text-xs text-cyan-400 mt-1">Rank #{selectedManager.rank} • {selectedManager.total_points} pts</p>
              </div>
              <button
                onClick={() => setShowChipModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-4">
            {chipStats.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No chips used yet</p>
            ) : (
              <>
                <div className="mb-4 p-3 bg-gray-700/30 rounded-lg border border-gray-600/30">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-300">Total Chips Used:</span>
                    <span className="text-lg font-bold text-cyan-400">{chipStats.length}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-gray-400">Total Chip Points Gain*:</span>
                    <span className="text-sm font-semibold text-green-400">{totalChipBenefit} pts</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {chipStats.map((chip, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white text-sm">{getChipLabel(chip.name)}</p>
                          <p className="text-xs text-gray-400">Gameweek {chip.event}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-cyan-300">{chip.gwPoints} pts</p>
                          {chip.chipBenefit > 0 && chip.name !== 'freehit' && chip.name !== 'wildcard' && (
                            <p className="text-[10px] text-green-400">+{chip.chipBenefit} pts gain</p>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {chip.benefitLabel}
                      </p>
                    </div>
                  ))}
                </div>

                <p className="text-[10px] text-gray-500 text-center mt-4 italic">
                  * Chip points gain shows additional points from BB/TC. FH/WC gain is subjective.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const getChipLabel = (chipName) => {
    const labels = { 'wildcard': 'Wildcard', 'freehit': 'Free Hit', 'bboost': 'Bench Boost', '3xc': 'Triple Captain' };
    return labels[chipName] || chipName;
  };

  const CaptainStatsModal = () => {
    if (!selectedCaptainGW || !window.captainStatsData) return null;

    const captainData = window.captainStatsData[selectedCaptainGW] || {};
    const totalManagers = Object.values(captainData).reduce((sum, count) => sum + count, 0);
    
    // Sort by count descending
    const sortedCaptains = Object.entries(captainData)
      .map(([player, count]) => ({
        player,
        count,
        percentage: totalManagers > 0 ? ((count / totalManagers) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return (
      <div
        className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
        onClick={() => setShowCaptainModal(false)}
      >
        <div
          className="bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-700/50 max-w-md w-full max-h-[80vh] overflow-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-700/50">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Captain Choices</h3>
                <p className="text-sm text-gray-400">Gameweek {selectedCaptainGW}</p>
                <p className="text-xs text-gray-400 mt-1">{totalManagers} managers</p>
              </div>
              <button
                onClick={() => setShowCaptainModal(false)}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          <div className="p-4">
            {sortedCaptains.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No captain data available</p>
            ) : (
              <div className="space-y-2">
                {sortedCaptains.map((captain, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-700/50 rounded-lg p-3 border border-slate-600"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">{captain.player}</span>
                          {idx === 0 && (
                            <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded">Most Popular</span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-gray-400">
                          {captain.count} {captain.count === 1 ? 'manager' : 'managers'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400">{captain.percentage}%</div>
                      </div>
                    </div>
                    {/* Visual percentage bar */}
                    <div className="mt-2 w-full bg-slate-600 rounded-full h-2">
                      <div 
                        className="bg-cyan-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${captain.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading && data.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-cyan-400 text-xl animate-pulse">
        Loading Chart Data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
        <div className="text-red-400 text-xl mb-4 text-center">{error}</div>
        <button 
          onClick={() => {
            setError(null);
            setLoading(true);
            fetchData();
          }}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  const gameweekRangeText = availableGameweeks.length > 0 ? `GW${availableGameweeks[0]}-${availableGameweeks[availableGameweeks.length - 1]}` : '';
  const statusColor = connectionStatus === 'connected' ? 'bg-green-500' :
                     connectionStatus === 'disconnected' ? 'bg-yellow-500' : 'bg-gray-500';
  const statusText = connectionStatus === 'connected' ? 'Live' :
                    connectionStatus === 'disconnected' ? 'Polling' : 'Connecting';

  // CRITICAL FIX: Only show chips section when mergedData is actually populated
  const showChipsSection = mergedData.length > 0 && !chipsLoading && chipsData.length > 0;

  return (
    <div className="min-h-screen bg-slate-900 p-2 sm:p-4 font-sans text-gray-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold text-white">Chip Usage</h1>
              <p className="text-sm text-gray-400 mt-0.5">{gameweekRangeText}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
                <span className="text-xs text-gray-400">{statusText}</span>
              </div>
              {lastUpdate && (
                <span className="text-xs text-gray-500 hidden sm:inline">
                  {lastUpdate.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </header>

        <main>
          {showChipsSection && (
            <ChipsLeaderboard
              chipsData={chipsData}
              data={mergedData}
              onManagerClick={handleManagerClick}
            />
          )}

          {chipsLoading && (
            <div className="p-8 text-center">
              <p className="text-gray-400 animate-pulse">Loading chips data...</p>
            </div>
          )}
        </main>

        {showChipModal && <ChipModal />}
        {showCaptainModal && <CaptainStatsModal />}
      </div>
    </div>
  );
};

export default FPLMultiGameweekDashboard;