import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';

const DataContext = createContext(null);

const API_BASE = 'https://bpl-red-sun-894.fly.dev';
const SSE_URL = `${API_BASE}/sse/fpl-updates`;
const FALLBACK_POLL_INTERVAL = 300000; // 5 minutes

// Helper functions
const normalizeStr = (v) => (typeof v === 'string' ? v.trim() : v ?? '');
const toNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};
const truthy = (v) => v === true || v === 'True' || v === 'true' || v === 1 || v === '1';

export const DataProvider = ({ children }) => {
  // Core data state
  const [gameweekData, setGameweekData] = useState({}); // { gw: [managers...] }
  const [captainStats, setCaptainStats] = useState({}); // { gw: { player: count } }
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [latestGameweek, setLatestGameweek] = useState(null);
  const [gwStatus, setGwStatus] = useState(null);
  const [fixtureData, setFixtureData] = useState(null);
  const [chipsData, setChipsData] = useState([]);
  
  // Loading states
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Refs for SSE and polling
  const eventSourceRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const abortRef = useRef(null);

  // Parse CSV to managers (same logic as existing components)
  const parseCsvToManagers = useCallback((csvText, gameweek) => {
    if (!csvText || csvText.trim() === "The game is being updated.") {
      return { managers: [], captainChoices: {} };
    }

    const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
    if (parsed.errors?.length) console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);
    
    const rows = parsed.data;
    const managerStats = {};
    const captainChoices = {};

    for (const raw of rows) {
      const manager = normalizeStr(raw.manager_name);
      if (!manager) continue;

      if (!managerStats[manager]) {
        managerStats[manager] = {
          manager_name: manager,
          team_name: normalizeStr(raw.entry_team_name),
          entry_id: toNum(raw.entry_id),
          total_points: 0,
          total_points_applied: 0,
          captain_points: 0,
          captain_player: '',
          captain_fixture_started: false,
          captain_fixture_finished: false,
          players_live: 0,
          players_upcoming: 0,
          bench_points: 0,
          transfer_cost: 0,
          event_transfers: 0,
          chip_used: null,
          team_value: 0,
          players: [],
        };
      }

      const player = normalizeStr(raw.player);
      if (player !== "TOTAL") {
        const playerCost = toNum(raw.player_cost) || 0;
        const playerData = {
          name: player,
          element_id: toNum(raw.element_id),
          position: normalizeStr(raw.position),
          team: normalizeStr(raw.team),
          points_gw: toNum(raw.points_gw),
          points_applied: toNum(raw.points_applied),
          multiplier: toNum(raw.multiplier),
          is_captain: truthy(raw.is_captain),
          is_vice_captain: truthy(raw.is_vice_captain),
          fixture_started: truthy(raw.fixture_started),
          fixture_finished: truthy(raw.fixture_finished),
          status: normalizeStr(raw.status),
          player_cost: playerCost,
        };
        managerStats[manager].players.push(playerData);
        managerStats[manager].team_value += playerCost;

        if (truthy(raw.is_captain) && !managerStats[manager].captain_player) {
          managerStats[manager].captain_player = player;
          managerStats[manager].captain_points = toNum(raw.points_gw);
          managerStats[manager].captain_fixture_started = truthy(raw.fixture_started);
          managerStats[manager].captain_fixture_finished = truthy(raw.fixture_finished);
          captainChoices[player] = (captainChoices[player] || 0) + 1;
        }

        if (truthy(raw.fixture_started)) {
          if (truthy(raw.fixture_finished)) {
            managerStats[manager].players_live += 1;
          } else {
            managerStats[manager].players_live += 1;
          }
        } else {
          managerStats[manager].players_upcoming += 1;
        }
      } else {
        // TOTAL row
        managerStats[manager].total_points = toNum(raw.gross_points);
        managerStats[manager].total_points_applied = toNum(raw.points_applied);
        managerStats[manager].bench_points = toNum(raw.bench_points);
        managerStats[manager].transfer_cost = toNum(raw.transfer_cost);
        managerStats[manager].event_transfers = toNum(raw.event_transfers);
        
        // Total value = squad + bank (in tenths from API, e.g., 1037 = £103.7m)
        const totalValueRaw = toNum(raw.total_value);
        if (totalValueRaw > 0) {
          managerStats[manager].total_value = totalValueRaw / 10; // Convert to millions
        }
        // Bank value (in tenths)
        const bankRaw = toNum(raw.bank);
        if (bankRaw > 0) {
          managerStats[manager].bank = bankRaw / 10; // Convert to millions
        }
        
        const chip = normalizeStr(raw.active_chip);
        if (chip && chip !== 'None' && chip !== 'none') {
          managerStats[manager].chip_used = chip;
        }
      }
    }

    // Sort and assign positions
    const managersArray = Object.values(managerStats)
      .sort((a, b) => b.total_points_applied - a.total_points_applied)
      .map((m, idx) => ({ ...m, position: idx + 1, gameweek }));

    // Find most popular captain
    let mostPopularCaptain = '';
    let maxCount = 0;
    Object.entries(captainChoices).forEach(([player, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostPopularCaptain = player;
      }
    });

    // Mark who picked popular captain
    managersArray.forEach(m => {
      m.picked_popular_captain = m.captain_player === mostPopularCaptain;
    });

    return { managers: managersArray, captainChoices };
  }, []);

  // Fetch all initial data
  const fetchAllData = useCallback(async (isBackgroundRefresh = false) => {
    if (abortRef.current) abortRef.current.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    if (!isBackgroundRefresh) {
      setIsInitialLoading(true);
    }

    try {
      console.log('📡 [DataContext] Fetching all data...');

      // Step 1: Fetch manifest and GW status in parallel
      const [manifestRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/manifest`, { cache: 'no-store', signal: abort.signal }),
        fetch(`${API_BASE}/api/gameweek-status`, { cache: 'no-store', signal: abort.signal }),
      ]);

      if (!manifestRes.ok) throw new Error('Failed to load manifest');
      const manifest = await manifestRes.json();

      let status = null;
      if (statusRes.ok) {
        status = await statusRes.json();
        setGwStatus(status);
      }

      const gameweeks = Object.keys(manifest.gameweeks || {}).map(Number).sort((a, b) => a - b);
      if (gameweeks.length === 0) throw new Error('No gameweek data');
      const latestGw = gameweeks[gameweeks.length - 1];
      setLatestGameweek(latestGw);

      // Step 2: Fetch latest GW data (always fresh)
      console.log(`🔴 [DataContext] Fetching live GW${latestGw}...`);
      const latestRes = await fetch(`${API_BASE}/api/data/${latestGw}`, { 
        cache: 'no-store', 
        signal: abort.signal 
      });
      if (!latestRes.ok) throw new Error(`Failed to load GW${latestGw}`);
      const latestCsv = await latestRes.text();
      const latestParsed = parseCsvToManagers(latestCsv, latestGw);

      // Step 3: Fetch historical, fixtures, and chips in parallel
      const [historicalRes, fixturesRes, chipsRes] = await Promise.all([
        fetch(`${API_BASE}/api/historical`, { cache: 'no-store', signal: abort.signal }),
        fetch(`${API_BASE}/api/fixtures`, { cache: 'no-store', signal: abort.signal }),
        fetch(`${API_BASE}/api/chips`, { cache: 'no-store', signal: abort.signal }),
      ]);

      // Process historical data
      const newGameweekData = { [latestGw]: latestParsed.managers };
      const newCaptainStats = { [latestGw]: latestParsed.captainChoices };

      if (historicalRes.ok) {
        const historicalData = await historicalRes.json();
        Object.keys(historicalData.gameweeks || {}).forEach(gwStr => {
          const gw = parseInt(gwStr, 10);
          const managers = historicalData.gameweeks[gwStr];
          // Historical data is pre-aggregated from backend
          newGameweekData[gw] = managers.map((m, idx) => ({
            ...m,
            manager_name: m.manager_name,
            team_name: m.team_name || '',
            total_points: m.total_points || 0,
            bench_points: m.bench_points || 0,
            position: idx + 1,
            gameweek: gw,
          }));
        });
      }

      // Process fixtures
      if (fixturesRes.ok) {
        const fixtures = await fixturesRes.json();
        setFixtureData(fixtures);
      }

      // Process chips - API returns { chips: [...] }
      if (chipsRes.ok) {
        const chipsResponse = await chipsRes.json();
        setChipsData(chipsResponse.chips || []);
      }

      // Update state
      const allGws = Object.keys(newGameweekData).map(Number).sort((a, b) => a - b);
      setGameweekData(newGameweekData);
      setCaptainStats(newCaptainStats);
      setAvailableGameweeks(allGws);
      setLastUpdate(new Date());
      setError(null);

      console.log(`✅ [DataContext] Loaded ${allGws.length} gameweeks, fixtures, and chips`);

    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('[DataContext] Error fetching data:', err);
        setError(err.message);
      }
    } finally {
      setIsInitialLoading(false);
    }
  }, [parseCsvToManagers]);

  // Refresh only the latest gameweek (for live updates)
  const refreshLatestGameweek = useCallback(async () => {
    if (!latestGameweek) return;

    try {
      console.log(`🔄 [DataContext] Refreshing GW${latestGameweek}...`);
      
      const [latestRes, statusRes] = await Promise.all([
        fetch(`${API_BASE}/api/data/${latestGameweek}`, { cache: 'no-store' }),
        fetch(`${API_BASE}/api/gameweek-status`, { cache: 'no-store' }),
      ]);

      if (latestRes.ok) {
        const latestCsv = await latestRes.text();
        const latestParsed = parseCsvToManagers(latestCsv, latestGameweek);
        
        setGameweekData(prev => ({
          ...prev,
          [latestGameweek]: latestParsed.managers,
        }));
        setCaptainStats(prev => ({
          ...prev,
          [latestGameweek]: latestParsed.captainChoices,
        }));
      }

      if (statusRes.ok) {
        const status = await statusRes.json();
        setGwStatus(status);
      }

      setLastUpdate(new Date());
      console.log(`✅ [DataContext] GW${latestGameweek} refreshed`);

    } catch (err) {
      console.error('[DataContext] Error refreshing latest GW:', err);
    }
  }, [latestGameweek, parseCsvToManagers]);

  // Set up SSE for live updates
  const setupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      console.log('[DataContext] Connecting to SSE...');
      const eventSource = new EventSource(SSE_URL);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[DataContext] SSE connected');
        setConnectionStatus('connected');
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'gameweek_updated') {
            console.log('[DataContext] SSE: Gameweek updated, refreshing...');
            refreshLatestGameweek();
          }
        } catch (e) {
          // Ignore parse errors (heartbeats, etc.)
        }
      };

      eventSource.onerror = () => {
        console.log('[DataContext] SSE disconnected, falling back to polling');
        setConnectionStatus('disconnected');
        eventSource.close();
        
        // Start fallback polling
        if (!fallbackIntervalRef.current) {
          fallbackIntervalRef.current = setInterval(refreshLatestGameweek, FALLBACK_POLL_INTERVAL);
        }
      };

    } catch (err) {
      console.error('[DataContext] SSE setup failed:', err);
      setConnectionStatus('disconnected');
    }
  }, [refreshLatestGameweek]);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
    
    return () => {
      if (abortRef.current) abortRef.current.abort();
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  }, [fetchAllData]);

  // Set up SSE after initial load
  useEffect(() => {
    if (!isInitialLoading && latestGameweek) {
      setupSSE();
    }
  }, [isInitialLoading, latestGameweek, setupSSE]);

  // Context value
  const value = {
    // Data
    gameweekData,
    captainStats,
    availableGameweeks,
    latestGameweek,
    gwStatus,
    fixtureData,
    chipsData,
    
    // Status
    isInitialLoading,
    error,
    lastUpdate,
    connectionStatus,
    
    // Actions
    refreshLatestGameweek,
    refetchAll: () => fetchAllData(true),
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

// Custom hook for using the context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

export default DataContext;

