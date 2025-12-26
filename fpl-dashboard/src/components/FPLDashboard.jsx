import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Papa from 'papaparse';

const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const SSE_URL = 'https://bpl-red-sun-894.fly.dev/sse/fpl-updates';
const FALLBACK_POLL_INTERVAL_MS = 300000;

const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const normalizeStr = (s) => (s ?? '').toString().normalize('NFC').replace(/\u00A0/g, ' ').trim();

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
      <div className="hidden md:grid md:grid-cols-6 gap-3 items-center text-sm px-3 py-1">
        <div className="md:col-span-2 flex items-center gap-3">
          <span className="flex-shrink-0 w-7 h-7 bg-slate-700 rounded-md text-sm font-bold flex items-center justify-center">{rank}</span>
          <button onClick={() => onManagerClick(manager.manager_name)} className="text-left hover:text-cyan-400 transition-colors">
            <p className="text-white font-medium truncate">{manager.manager_name}</p>
            <p className="text-gray-400 text-xs truncate">"{managerFullData?.team_name || '...'}"</p>
          </button>
        </div>
        <div className="text-white font-bold text-lg text-center">{totalChips}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(wildcards, 'wildcard')}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(freehits, 'freehit')}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(bboosts, 'bboost')}</div>
        <div className="text-center text-gray-300 text-xs">{renderChipInfo(tripleCaps, '3xc')}</div>
      </div>
    </div>
  );
});

const ChipsLeaderboard = ({ chipsData, data, onManagerClick }) => {
  const sortedChipsData = useMemo(() => {
    return [...chipsData].sort((a, b) => b.chips.length - a.chips.length);
  }, [chipsData]);

  return (
    <div className="space-y-1">
      {/* Desktop Header */}
      <div className="hidden md:grid md:grid-cols-6 gap-3 px-3 py-2 text-xs font-bold text-gray-400 uppercase">
        <div className="md:col-span-2">Manager</div>
        <div className="text-center">Total</div>
        <div className="text-center">Wildcard</div>
        <div className="text-center">Free Hit</div>
        <div className="text-center">Bench Boost</div>
        <div className="text-center">Triple Captain</div>
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
  const [data, setData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [chipsData, setChipsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chipsLoading, setChipsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [selectedManager, setSelectedManager] = useState(null);
  const [showChipModal, setShowChipModal] = useState(false);
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [selectedCaptainGW, setSelectedCaptainGW] = useState(null);

  const cycleAbortRef = useRef(null);
  const fetchCycleIdRef = useRef(0);
  const eventSourceRef = useRef(null);
  const manifestVersionRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const initialLoadDoneRef = useRef(false);

  // Load chips data independently with better error handling
  useEffect(() => {
    const fetchChips = async () => {
      setChipsLoading(true);
      try {
        console.log('Fetching chips data...');
        const response = await fetch('https://bpl-red-sun-894.fly.dev/api/chips');
        if (!response.ok) {
          console.warn(`Chips API returned ${response.status}, continuing without chips data`);
          setChipsData([]);
          setChipsLoading(false);
          return;
        }
        const data = await response.json();
        console.log('Chips data loaded:', data.chips?.length || 0, 'managers');
        setChipsData(data.chips || []);
      } catch (err) {
        console.warn('Failed to fetch chips (non-critical):', err);
        setChipsData([]);
      } finally {
        setChipsLoading(false);
      }
    };
    
    fetchChips();
  }, []);

  const processGameweekData = useCallback(async (gameweek, manifest, signal) => {
    try {
      const gwInfo = manifest?.gameweeks?.[String(gameweek)];
      if (!gwInfo) {
        console.warn(`No data for GW${gameweek} in manifest`);
        return [];
      }

      const proxyUrl = `https://bpl-red-sun-894.fly.dev/api/data/${gameweek}`;
      const csvRes = await fetch(proxyUrl, { cache: 'no-store', signal });
      if (!csvRes.ok) {
        console.warn(`HTTP ${csvRes.status} for GW${gameweek}`);
        return [];
      }
      const csvText = await csvRes.text();

      if (csvText.trim() === "The game is being updated.") {
        console.log(`GW${gameweek} is being updated`);
        return [];
      }

      const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
      if (parsed.errors?.length) {
        console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);
      }

      parsed.data.forEach(row => {
        if (row.player === 'João Pedro Junqueira de Jesus') row.player = 'João Pedro';
      });

      return parsed.data;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(`GW${gameweek} fetch failed:`, err);
      }
      return [];
    }
  }, []);

  const fetchData = useCallback(async () => {
    if (cycleAbortRef.current) cycleAbortRef.current.abort();
    const abort = new AbortController();
    cycleAbortRef.current = abort;
    const myId = ++fetchCycleIdRef.current;

    setLoading(true);
    setError(null);

    try {
      console.log('Starting data fetch...');
      const manifestRes = await fetch(
        'https://bpl-red-sun-894.fly.dev/api/manifest',
        { cache: 'no-store', signal: abort.signal }
      );

      if (!manifestRes.ok) {
        throw new Error(`Could not load league manifest (${manifestRes.status})`);
      }

      const manifest = await manifestRes.json();
      manifestVersionRef.current = manifest.version;
      console.log('Manifest loaded, version:', manifest.version);

      const remoteGameweeks = Object.keys(manifest?.gameweeks || {}).map(Number);
      const available = [...new Set([1, ...remoteGameweeks])].sort((a, b) => a - b);

      if (available.length === 0) {
        throw new Error("No gameweek data found in manifest.");
      }

      if (fetchCycleIdRef.current !== myId || abort.signal.aborted) {
        console.log('Fetch cycle aborted or superseded');
        return;
      }
      
      setAvailableGameweeks(available);
      console.log('Available gameweeks:', available);

      const gameweekPromises = available.map(async (gw) => {
        if (gw === 1) {
          return [
            { manager_name: "Garrett Kunkel", entry_team_name: "kunkel_fpl", player: "TOTAL", points_applied: 78, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Andrew Vidal", entry_team_name: "Las Cucarachas", player: "TOTAL", points_applied: 76, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Brett Swikle", entry_team_name: "swikle_time", player: "TOTAL", points_applied: 74, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "John Matthew", entry_team_name: "matthewfpl", player: "TOTAL", points_applied: 73, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Jared Alexander", entry_team_name: "Jared's Jinxes", player: "TOTAL", points_applied: 67, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Joe Curran", entry_team_name: "Curran's Crew", player: "TOTAL", points_applied: 64, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "John Sebastian", entry_team_name: "Sebastian Squad", player: "TOTAL", points_applied: 62, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Nate Cohen", entry_team_name: "Cohen's Corner", player: "TOTAL", points_applied: 60, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Chris Munoz", entry_team_name: "Munoz Magic", player: "TOTAL", points_applied: 60, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Evan Bagheri", entry_team_name: "Bagheri's Best", player: "TOTAL", points_applied: 57, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Dean Maghsadi", entry_team_name: "Dean's Dream", player: "TOTAL", points_applied: 55, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Brian Pleines", entry_team_name: "Pleines Power", player: "TOTAL", points_applied: 53, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Max Maier", entry_team_name: "Maier's Marvels", player: "TOTAL", points_applied: 53, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Adrian McLoughlin", entry_team_name: "McLoughlin FC", player: "TOTAL", points_applied: 52, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Wes H", entry_team_name: "Wes Warriors", player: "TOTAL", points_applied: 50, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Kevin Tomek", entry_team_name: "Tomek's Team", player: "TOTAL", points_applied: 48, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Kevin K", entry_team_name: "Kevin's Kicks", player: "TOTAL", points_applied: 41, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Tony Tharakan", entry_team_name: "Tharakan's Threat", player: "TOTAL", points_applied: 39, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "JP Fischer", entry_team_name: "Fischer's Force", player: "TOTAL", points_applied: 35, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 },
            { manager_name: "Patrick McCleary", entry_team_name: "McCleary's Might", player: "TOTAL", points_applied: 34, bench_points: 0, is_captain: 'False', multiplier: 1, points_gw: 0 }
          ];
        }
        return await processGameweekData(gw, manifest, abort.signal);
      });

      const results = await Promise.all(gameweekPromises);
      console.log('All gameweek data fetched');
      
      const managerData = {};
      const captainStats = {}; // Track captain choices per gameweek

      results.forEach((gwData, gwIndex) => {
        const gameweek = available[gwIndex];
        const managerStatsThisGw = {};
        
        // Initialize captain tracking for this gameweek
        if (!captainStats[gameweek]) {
          captainStats[gameweek] = {};
        }

        gwData.forEach(row => {
          if (!row.manager_name) return;

          const managerName = normalizeStr(row.manager_name);
          const currentTeamName = normalizeStr(row.entry_team_name);

          if (!managerStatsThisGw[managerName]) {
            managerStatsThisGw[managerName] = {
              total_points: 0,
              bench_points: 0,
              captain_player: 'N/A',
              captain_points: 0,
              team_name: currentTeamName
            };
          }

          managerStatsThisGw[managerName].team_name = currentTeamName;

          if (row.player === 'TOTAL') {
            managerStatsThisGw[managerName].total_points = parseFloat(row.points_applied) || 0;
            managerStatsThisGw[managerName].bench_points = parseFloat(row.bench_points) || 0;
          } else {
            const isCaptain = row.is_captain === true || ['True', 'true', 1, '1'].includes(row.is_captain);
            if (isCaptain) {
              const playerName = row.player;
              managerStatsThisGw[managerName].captain_player = playerName;
              managerStatsThisGw[managerName].captain_points = parseFloat(row.points_gw) || 0;
              
              // Track captain choice
              if (!captainStats[gameweek][playerName]) {
                captainStats[gameweek][playerName] = 0;
              }
              captainStats[gameweek][playerName]++;
            }
          }
        });

        Object.entries(managerStatsThisGw).forEach(([name, stats]) => {
          if (!managerData[name]) {
            managerData[name] = {
              manager_name: name,
              team_name: stats.team_name,
              total_points: 0,
              gameweeks: {}
            };
          }

          managerData[name].total_points += stats.total_points;
          managerData[name].team_name = stats.team_name;

          managerData[name].gameweeks[gameweek] = {
            points: stats.total_points,
            captain: stats.captain_player,
            captain_points: stats.captain_points,
            bench_points: stats.bench_points,
            chip_used: null
          };
        });
      });

      // Store captain stats in a ref so we can access it later
      window.captainStatsData = captainStats;

      const combinedDataArray = Object.values(managerData);

      const sortedData = combinedDataArray
        .sort((a, b) => {
          if (b.total_points !== a.total_points) {
            return b.total_points - a.total_points;
          }
          return a.manager_name.localeCompare(b.manager_name);
        })
        .map((item, index) => {
          const totalManagers = combinedDataArray.length;
          let designation = 'Mid-table';
          if (index < 4) designation = 'Champions League';
          else if (index === 4) designation = 'Europa League';
          else if (index >= totalManagers - 3) designation = 'Relegation';

          return {
            ...item,
            rank: index + 1,
            designation,
            displayName: item.manager_name,
            chips: []
          };
        });

      if (fetchCycleIdRef.current === myId && !abort.signal.aborted) {
        console.log('Setting data with', sortedData.length, 'managers');
        setData(sortedData);
        setError(null);
        setLastUpdate(new Date());
        initialLoadDoneRef.current = true;
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error('Error loading data:', err);
        if (fetchCycleIdRef.current === myId) {
          setError(`Failed to load data: ${err.message}`);
        }
      }
    } finally {
      if (fetchCycleIdRef.current === myId && !abort.signal.aborted) {
        setLoading(false);
      }
    }
  }, [processGameweekData]);

  const mergedData = useMemo(() => {
    // CRITICAL FIX: Only merge if BOTH data sources are ready and non-empty
    if (data.length === 0 || chipsLoading) {
      console.log('Skipping merge: data empty or chips still loading', { dataLength: data.length, chipsLoading });
      return [];
    }

    console.log('Merging data:', { managers: data.length, chips: chipsData.length });
    const chipsMap = new Map(chipsData.map(c => [c.manager_name, c.chips]));

    return data.map(manager => {
      const managerChips = chipsMap.get(manager.manager_name) || [];
      const managerCopy = { ...manager, chips: managerChips };

      managerChips.forEach(chip => {
        if (managerCopy.gameweeks[chip.event]) {
          managerCopy.gameweeks[chip.event] = {
            ...managerCopy.gameweeks[chip.event],
            chip_used: chip.name
          };
        }
      });
      return managerCopy;
    });
  }, [data, chipsData, chipsLoading]);

  const setupSSE = useCallback(() => {
    // Only setup SSE after initial data load
    if (!initialLoadDoneRef.current) {
      console.log('Skipping SSE setup until initial load is done');
      return null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Setting up SSE connection...');
    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;
    const maxReconnectAttempts = 5;

    eventSource.onopen = () => {
      console.log('SSE connected');
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
    };

    eventSource.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('SSE message received:', message);
        if (message.type === 'gameweek_updated' && message.data.manifest_version !== manifestVersionRef.current) {
          console.log('Manifest version changed, fetching new data');
          fetchData();
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn('SSE error:', err);
      setConnectionStatus('disconnected');
      eventSource.close();
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        reconnectAttemptsRef.current++;
        console.log(`Reconnecting SSE in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        setTimeout(() => {
          if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
            setupSSE();
          }
        }, delay);
      } else {
        console.log('Max reconnect attempts reached, falling back to polling');
        if (!fallbackIntervalRef.current) {
          fallbackIntervalRef.current = setInterval(() => fetchData(), FALLBACK_POLL_INTERVAL_MS);
        }
      }
    };

    return eventSource;
  }, [fetchData]);

  // Create stable reference to setupSSE that won't change
  const setupSSERef = useRef(setupSSE);
  useEffect(() => {
    setupSSERef.current = setupSSE;
  }, [setupSSE]);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Separate effect for SSE setup after initial load
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      return;
    }

    console.log('Initial load complete, setting up SSE');
    const eventSource = setupSSERef.current();

    return () => {
      if (eventSource) {
        console.log('Cleaning up SSE connection');
        eventSource.close();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (cycleAbortRef.current) {
        cycleAbortRef.current.abort();
      }
    };
  }, [data.length]); // Trigger when data loads

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const tooltipData = payload[0].payload;
      const gwBreakdown = availableGameweeks.map(gw => `GW${gw}: ${tooltipData.gameweeks[gw]?.points || 0}`).join(' | ');
      return (
        <div className="bg-slate-800 text-white p-2 rounded-md shadow-lg border border-slate-600">
          <p className="font-bold text-sm">{tooltipData.manager_name}</p>
          <p className="text-gray-400 text-xs mb-1">"{tooltipData.team_name}"</p>
          <p className="font-semibold text-cyan-300 text-xs">Total: {tooltipData.total_points} pts</p>
          <p className="text-gray-300 text-[10px] mt-1">{gwBreakdown}</p>
        </div>
      );
    }
    return null;
  };

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
              className="text-purple-400 hover:text-purple-300 underline font-semibold"
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
          <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-cyan-900/30 to-purple-900/30">
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
                <div className="mb-4 p-3 bg-purple-900/20 rounded border border-purple-600/30">
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
          className="bg-slate-800 rounded-lg border-2 border-purple-500 max-w-md w-full max-h-[80vh] overflow-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-slate-700 bg-gradient-to-r from-purple-900/30 to-pink-900/30">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Captain Choices</h3>
                <p className="text-sm text-gray-400">Gameweek {selectedCaptainGW}</p>
                <p className="text-xs text-purple-400 mt-1">{totalManagers} managers</p>
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
                        <div className="text-2xl font-bold text-purple-400">{captain.percentage}%</div>
                      </div>
                    </div>
                    {/* Visual percentage bar */}
                    <div className="mt-2 w-full bg-slate-600 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
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
        <header className="text-center mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-xl sm:text-3xl font-light text-white">BPL Season Chart</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
              <span className="text-xs text-gray-400">{statusText}</span>
            </div>
          </div>
          <p className="text-sm text-gray-400">{gameweekRangeText}</p>
          {lastUpdate && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </header>

        <main className="space-y-6">
          <div className="bg-slate-800/50 rounded-lg p-2 sm:p-4 shadow-lg border border-slate-700">
            <div className="flex justify-center flex-wrap gap-x-3 gap-y-1 text-xs mb-3">
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-blue-600 mr-1.5"></span>Champions League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-orange-500 mr-1.5"></span>Europa League</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-gray-500 mr-1.5"></span>Mid-table</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded-full bg-red-600 mr-1.5"></span>Relegation</div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mergedData} margin={{ top: 5, right: 5, left: -20, bottom: 45 }}>
                <CartesianGrid strokeDasharray="2 2" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="displayName" stroke="#94A3B8" angle={-60} textAnchor="end" height={60} fontSize={10} interval={0} />
                <YAxis stroke="#94A3B8" fontSize={10} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}/>
                <Bar dataKey="total_points" radius={[2, 2, 0, 0]}>
                  {mergedData.map((entry, index) => {
                    let color = '#6B7280';
                    if (entry.designation === 'Champions League') color = '#2563EB';
                    if (entry.designation === 'Europa League') color = '#EA580C';
                    if (entry.designation === 'Relegation') color = '#DC2626';
                    return <Cell key={`cell-${index}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {showChipsSection && (
            <div className="bg-slate-800/50 rounded-lg shadow-lg border border-purple-700/50 overflow-hidden">
              <div className="p-3 sm:p-4 border-b border-purple-700/50 bg-gradient-to-r from-purple-900/20 to-purple-800/20">
                <h2 className="text-base sm:text-lg font-semibold text-gray-100">Chips Used</h2>
              </div>
              <div className="p-0 sm:p-1">
                <ChipsLeaderboard
                  chipsData={chipsData}
                  data={mergedData}
                  onManagerClick={handleManagerClick}
                />
              </div>
            </div>
          )}

          {chipsLoading && (
            <div className="bg-slate-800/50 rounded-lg shadow-lg border border-purple-700/50 p-8 text-center">
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