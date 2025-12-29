import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { useData } from '../context/DataContext';

// --- Constants ---

const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const SSE_URL = 'https://bpl-red-sun-894.fly.dev/sse/fpl-updates';
const FALLBACK_POLL_INTERVAL_MS = 300000;
const CACHE_VERSION = 'v6'; // Increment this to invalidate all caches

const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const truthy = (v) => v === true || v === 'True' || v === 'true' || v === 1 || v === '1';
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const normalizeStr = (s) => (s ?? '').toString().normalize('NFC').replace(/\u00A0/g, ' ').trim();

// Chip emoji mapping
const CHIP_EMOJIS = {
  'freehit': '🆓',
  'wildcard': '🃏',
  '3xc': '🧑‍✈️',
  'bboost': '🚀'
};

const CHIP_NAMES = {
  'freehit': 'Free Hit',
  'wildcard': 'Wildcard',
  '3xc': 'Triple Captain',
  'bboost': 'Bench Boost'
};

const fetchWithNoCaching = async (url, signal) => {
  return fetch(url, { method: 'GET', cache: 'no-store', signal });
};

// --- LocalStorage Cache Utilities ---

const getCacheKey = (gameweek) => `fpl_gw_${gameweek}_${CACHE_VERSION}`;

const getCachedGameweek = (gameweek, expectedHash = null) => {
  try {
    const cached = localStorage.getItem(getCacheKey(gameweek));
    if (cached) {
      const data = JSON.parse(cached);
      
      // If we have an expected hash, validate against it
      if (expectedHash && data.hash !== expectedHash) {
        console.log(`🔄 Cache invalidated for GW${gameweek} - hash mismatch (cached: ${data.hash?.slice(0,8)}, expected: ${expectedHash?.slice(0,8)})`);
        localStorage.removeItem(getCacheKey(gameweek));
        return null;
      }
      
      console.log(`✅ Cache hit for GW${gameweek}`);
      return data;
    }
  } catch (e) {
    console.warn(`Failed to read cache for GW${gameweek}:`, e);
  }
  return null;
};

const setCachedGameweek = (gameweek, data, hash = null) => {
  try {
    // Store hash alongside data for future validation
    const cacheData = { ...data, hash };
    localStorage.setItem(getCacheKey(gameweek), JSON.stringify(cacheData));
    console.log(`💾 Cached GW${gameweek} (${data.managers?.length || data.length} managers, hash: ${hash?.slice(0,8) || 'none'})`);
  } catch (e) {
    console.warn(`Failed to cache GW${gameweek}:`, e);
    // If storage is full, clear old caches
    if (e.name === 'QuotaExceededError') {
      clearOldCaches();
    }
  }
};

const clearOldCaches = () => {
  console.log('Clearing old caches...');
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('fpl_gw_')) {
      // Clear all old caches that don't match current version
      if (!key.includes(CACHE_VERSION)) {
        localStorage.removeItem(key);
      } else {
        // Also check if cache has old format (array instead of object)
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const data = JSON.parse(cached);
            if (Array.isArray(data)) {
              // Old format, remove it
              console.log(`Removing old format cache: ${key}`);
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
          // Invalid cache, remove it
          localStorage.removeItem(key);
        }
      }
    }
  });
};

// --- Fixture Data Functions ---
const fetchFixtureData = async () => {
  try {
    console.log('Fetching fixture data from backend...');
    const response = await fetch('https://bpl-red-sun-894.fly.dev/api/fixtures');
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('Fixture data loaded successfully:', { 
      fixturesCount: data.fixtures?.length || 0,
      teamsCount: Object.keys(data.teamMap || {}).length,
      playersCount: Object.keys(data.playerTeamMap || {}).length
    });
    
    return { 
      fixtures: data.fixtures || [], 
      teamMap: data.teamMap || {},
      playerTeamMap: data.playerTeamMap || {}
    };
  } catch (error) {
    console.error('Failed to fetch fixture data:', error);
    return { fixtures: [], teamMap: {}, playerTeamMap: {} };
  }
};

// --- Chips Data Function ---
const fetchChipsData = async () => {
  try {
    console.log('Fetching chips data from backend...');
    const response = await fetch('https://bpl-red-sun-894.fly.dev/api/chips');
    
    if (!response.ok) {
      console.warn(`Chips API returned ${response.status}, continuing without chips data`);
      return [];
    }
    
    const data = await response.json();
    console.log('Chips data loaded successfully:', data.chips?.length || 0, 'managers');
    return data.chips || [];
  } catch (error) {
    console.warn('Failed to fetch chips data (non-critical):', error);
    return [];
  }
};

// Add this function near the top with other fetch functions (after fetchChipsData)
const fetchPlayerStats = async (elementId) => {
  try {
    console.log(`Fetching stats for player ${elementId}...`);
    const response = await fetch(`https://bpl-red-sun-894.fly.dev/api/player/${elementId}`);
    
    if (!response.ok) {
      console.warn(`Player API returned ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    console.log('Player stats loaded:', data);
    return data;
  } catch (error) {
    console.error('Failed to fetch player stats:', error);
    return null;
  }
};

const useFplData = () => {
  const [gameweekData, setGameweekData] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [latestGameweek, setLatestGameweek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [fixtureData, setFixtureData] = useState({ fixtures: [], teamMap: {}, playerTeamMap: {} });
  const [loadingProgress, setLoadingProgress] = useState({ current: 0, total: 0, gameweeks: [] });
  const [captainStats, setCaptainStats] = useState({}); // Store captain statistics
  const [chipsData, setChipsData] = useState([]); // NEW: Store chips data

  
  const cycleAbortRef = useRef(null);
  const fetchCycleIdRef = useRef(0);
  const eventSourceRef = useRef(null);
  const manifestVersionRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const sseSetupDoneRef = useRef(false);
  const scrollPositionRef = useRef(0); // Track scroll position to prevent jump

  // Clear old caches on first load
  useEffect(() => {
    clearOldCaches();
  }, []);

  // Load fixtures
  useEffect(() => {
    const loadFixtures = async () => {
      console.log('Loading fixtures...');
      const data = await fetchFixtureData();
      console.log('Fixtures loaded:', {
        fixturesCount: data.fixtures.length,
        teamsCount: Object.keys(data.teamMap).length
      });
      setFixtureData(data);
    };
    
    loadFixtures();
    const interval = setInterval(loadFixtures, 300000);
    return () => clearInterval(interval);
  }, []);

  // NEW: Load chips data
  useEffect(() => {
    const loadChips = async () => {
      console.log('Loading chips...');
      const data = await fetchChipsData();
      console.log('Chips data received:', data);
      if (data.length > 0) {
        console.log('Sample chip entry:', data[0]);
        console.log('Total managers with chips:', data.length);
        // Log chips for GW11 specifically
        data.forEach(mgr => {
          const gw11Chips = mgr.chips.filter(c => c.event === 11);
          if (gw11Chips.length > 0) {
            console.log(`${mgr.manager_name} has chips in GW11:`, gw11Chips);
          }
        });
      }
      setChipsData(data);
    };
    
    loadChips();
    const interval = setInterval(loadChips, 300000);
    return () => clearInterval(interval);
  }, []);

  const parseCsvToManagers = useCallback((csvText, gameweek, preParseRows = null) => {
    // Support both CSV text and pre-parsed rows from /api/historical
    let rows;
    if (preParseRows) {
      rows = preParseRows;
    } else if (csvText && csvText.trim() !== "The game is being updated.") {
      const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
      if (parsed.errors?.length) console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);
      rows = parsed.data;
    } else {
      return { managers: [], captainChoices: {} };
    }
    
    const managerStats = Object.create(null);
    const captainChoices = {}; // Track captain choices for this gameweek
    
    for (const raw of rows) {
      const manager = normalizeStr(raw.manager_name);
      if (!manager) continue;
      if (!managerStats[manager]) {
        managerStats[manager] = {
          manager_name: manager,
          team_name: normalizeStr(raw.entry_team_name),
          total_points: 0, total_points_applied: 0, captain_points: 0, captain_player: '',
          captain_fixture_started: false, captain_fixture_finished: false,
          players_live: 0, players_upcoming: 0, bench_points: 0,
          players: []
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
  fixture_started: truthy(raw.fixture_started),
  fixture_finished: truthy(raw.fixture_finished),
  status: normalizeStr(raw.status),
  cost: playerCost
};
        managerStats[manager].players.push(playerData);
        // Add player cost to team value
        managerStats[manager].team_value = (managerStats[manager].team_value || 0) + playerCost;
        
        if (truthy(raw.is_captain) && !managerStats[manager].captain_player) {
  managerStats[manager].captain_player = player;
  managerStats[manager].captain_points = toNum(raw.points_gw); // <-- This is the correct value
  managerStats[manager].captain_fixture_started = truthy(raw.fixture_started);
  managerStats[manager].captain_fixture_finished = truthy(raw.fixture_finished);
          
          // Track captain choice
          if (!captainChoices[player]) {
            captainChoices[player] = 0;
          }
          captainChoices[player]++;
        }
        const mult = toNum(raw.multiplier);
        if (mult >= 1 && raw.status !== "dnp") {
          if (truthy(raw.fixture_started) && !truthy(raw.fixture_finished)) managerStats[manager].players_live++;
          else if (!truthy(raw.fixture_started)) managerStats[manager].players_upcoming++;
        }
        if (mult === 0) managerStats[manager].bench_points += toNum(raw.points_gw);
      } else { // This block handles the player === "TOTAL" row
        managerStats[manager].total_points = toNum(raw.gross_points); // Weekly display (no transfer cost)
        managerStats[manager].total_points_applied = toNum(raw.points_gw); // For cumulative (with transfer cost)
        managerStats[manager].bench_points = toNum(raw.bench_points);
      }
    }
    
    // Return both managers and captain stats
    return { 
      managers: Object.values(managerStats)
        .filter(m => toNum(m.total_points) >= 0)
        .sort((a, b) => b.total_points - a.total_points)
        .map((m, i) => ({ ...m, position: i + 1, gameweek })),
      captainChoices
    };
  }, []);

  const processGameweekData = useCallback(async (gameweek, manifest, signal, isLatestGw, gwIndex, totalGws) => {
    // Update progress
    setLoadingProgress(prev => ({
      current: gwIndex + 1,
      total: totalGws,
      gameweeks: [...prev.gameweeks, gameweek]
    }));

    const gwInfo = manifest?.gameweeks?.[String(gameweek)];
    const expectedHash = gwInfo?.hash || null;

    // OPTIMIZATION: Historical gameweeks never change - use cache without network validation
    if (!isLatestGw) {
      const cached = getCachedGameweek(gameweek, null); // Don't validate hash for old GWs
      if (cached) {
        if (cached.managers && cached.captainChoices) {
          console.log(`⚡ GW${gameweek} from cache (historical)`);
          return cached;
        } else if (Array.isArray(cached)) {
          console.log(`⚡ GW${gameweek} from cache (historical, old format)`);
          return { managers: cached, captainChoices: {} };
        }
      }
    }

    // For latest GW (or cache miss on historical), fetch fresh
    try {
      if (!gwInfo) {
        console.warn(`No data for GW${gameweek} in manifest`);
        return { managers: [], captainChoices: {} };
      }
      
      const proxyUrl = `https://bpl-red-sun-894.fly.dev/api/data/${gameweek}`;
      console.log(`${isLatestGw ? '🔴 LIVE' : '📥'} Fetching GW${gameweek}...`);
      const csvRes = await fetchWithNoCaching(proxyUrl, signal);
      if (!csvRes.ok) throw new Error(`HTTP ${csvRes.status} for GW${gameweek}`);
      const csvText = await csvRes.text();
      const result = parseCsvToManagers(csvText, gameweek);
      
      // Cache the result
      if (result.managers.length > 0) {
        setCachedGameweek(gameweek, result, expectedHash);
      }
      
      return result;
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(`GW${gameweek} fetch failed:`, err);
      }
      return { managers: [], captainChoices: {} };
    }
  }, [parseCsvToManagers]);

  const fetchData = useCallback(async (isBackgroundRefresh = false) => {
    if (cycleAbortRef.current) cycleAbortRef.current.abort();
    const abort = new AbortController();
    cycleAbortRef.current = abort;
    const myId = ++fetchCycleIdRef.current;
    
    // Only show loading skeleton on initial load, not background refreshes
    // This prevents scroll position from resetting
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    
    try {
      console.log('📡 Starting optimized data fetch...');
      
      // Step 1: Fetch manifest first to know the latest GW
      const manifestRes = await fetch(
        'https://bpl-red-sun-894.fly.dev/api/manifest',
        { cache: 'no-store', signal: abort.signal }
      );
      if (!manifestRes.ok) throw new Error('Failed to load manifest');
      const manifest = await manifestRes.json();
      
      const allGws = Object.keys(manifest.gameweeks || {}).map(Number).sort((a, b) => a - b);
      if (allGws.length === 0) throw new Error('No gameweek data');
      const latestGw = allGws[allGws.length - 1];
      
      console.log(`🎯 Latest gameweek: GW${latestGw}`);
      
      // Step 2: IMMEDIATELY fetch latest GW and show it (fast - single CSV ~1-2s)
      console.log(`🔴 LIVE Fetching GW${latestGw}...`);
      const latestRes = await fetch(
        `https://bpl-red-sun-894.fly.dev/api/data/${latestGw}`,
        { cache: 'no-store', signal: abort.signal }
      );
      if (!latestRes.ok) throw new Error(`Could not load latest GW${latestGw} (${latestRes.status})`);
      const latestCsvText = await latestRes.text();
      const latestData = parseCsvToManagers(latestCsvText, latestGw);
      
      if (fetchCycleIdRef.current !== myId || abort.signal.aborted) return;
      
      // Step 3: Check localStorage for cached historical data
      const HISTORICAL_CACHE_KEY = 'bpl_historical_v3';
      let cachedHistorical = null;
      try {
        const cached = localStorage.getItem(HISTORICAL_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          // Valid if we have data for all GWs except latest
          const cachedGws = Object.keys(parsed.gameweeks || {}).map(Number);
          const expectedGws = allGws.filter(gw => gw < latestGw);
          if (expectedGws.every(gw => cachedGws.includes(gw))) {
            cachedHistorical = parsed;
            console.log(`📦 Using localStorage cache for GWs 1-${latestGw - 1}`);
          }
        }
      } catch (e) {
        console.log('localStorage cache miss or invalid');
      }
      
      // Step 4: Show data IMMEDIATELY with what we have
      const tempGameweekData = { [latestGw]: latestData.managers || [] };
      const tempCaptainStats = { [latestGw]: latestData.captainChoices || {} };
      
      // If we have cached historical, merge it in immediately
      if (cachedHistorical) {
        for (const gwStr of Object.keys(cachedHistorical.gameweeks || {})) {
          const gw = parseInt(gwStr, 10);
          const managers = cachedHistorical.gameweeks[gwStr];
          
          // Pre-aggregated format - just add position and gameweek
          const processedManagers = managers
            .map(m => ({
              ...m,
              manager_name: m.manager_name,
              team_name: m.team_name || '',
              total_points: m.total_points || 0,
              bench_points: m.bench_points || 0,
              gameweek: gw,
            }))
            .sort((a, b) => b.total_points - a.total_points)
            .map((m, i) => ({ ...m, position: i + 1 }));
          
          tempGameweekData[gw] = processedManagers;
          
          // Build captain stats
          const captainChoices = {};
          managers.forEach(m => {
            if (m.captain_player) {
              captainChoices[m.captain_player] = (captainChoices[m.captain_player] || 0) + 1;
            }
          });
          tempCaptainStats[gw] = captainChoices;
        }
      }
      
      const tempAvailable = Object.keys(tempGameweekData).map(Number).sort((a, b) => a - b);
      
      // Update UI immediately with available data
      setGameweekData(tempGameweekData);
      setCaptainStats(tempCaptainStats);
      setAvailableGameweeks(tempAvailable);
      setLatestGameweek(latestGw);
      setLoading(false); // Show UI now!
      console.log(`⚡ Quick load: showing ${tempAvailable.length} GW(s) immediately`);
      
      // Step 5: Fetch fresh historical in background (if not fully cached or for updates)
      if (!cachedHistorical || Object.keys(cachedHistorical.gameweeks || {}).length < latestGw - 1) {
        console.log('📡 Fetching fresh historical data in background...');
        
        fetch('https://bpl-red-sun-894.fly.dev/api/historical', { cache: 'no-store' })
          .then(res => res.ok ? res.json() : null)
          .then(historicalData => {
            if (!historicalData || fetchCycleIdRef.current !== myId) return;
            
            const newGameweekData = { ...tempGameweekData };
            const newCaptainStats = { ...tempCaptainStats };
            
            for (const gwStr of Object.keys(historicalData.gameweeks || {})) {
              const gw = parseInt(gwStr, 10);
              const managers = historicalData.gameweeks[gwStr];
              
              // Backend now returns pre-aggregated manager objects
              // Just need to add position and gameweek
              const processedManagers = managers
                .map((m, i) => ({
                  ...m,
                  manager_name: m.manager_name,
                  team_name: m.team_name || '',
                  total_points: m.total_points || 0,
                  bench_points: m.bench_points || 0,
                  position: i + 1,
                  gameweek: gw,
                }))
                .sort((a, b) => b.total_points - a.total_points)
                .map((m, i) => ({ ...m, position: i + 1 }));
              
              newGameweekData[gw] = processedManagers;
              
              // Build captain stats from pre-aggregated data
              const captainChoices = {};
              managers.forEach(m => {
                if (m.captain_player) {
                  captainChoices[m.captain_player] = (captainChoices[m.captain_player] || 0) + 1;
                }
              });
              newCaptainStats[gw] = captainChoices;
            }
            
            // Save to localStorage for next visit
            try {
              localStorage.setItem(HISTORICAL_CACHE_KEY, JSON.stringify({
                gameweeks: historicalData.gameweeks,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.log('Could not cache to localStorage:', e);
            }
            
            const available = Object.keys(newGameweekData).map(Number).sort((a, b) => a - b);
            setGameweekData(newGameweekData);
            setCaptainStats(newCaptainStats);
            setAvailableGameweeks(available);
            console.log(`✅ Background load complete: ${available.length} GWs`);
            
            // Recalculate combined data
            if (newGameweekData[available[0]]?.length) {
              const managerNames = newGameweekData[available[0]].map(m => m.manager_name);
              const newCombinedData = managerNames.map(name => {
                let cumulativePoints = 0;
                const managerEntry = { manager_name: name };
                available.forEach(gw => {
                  const gwStats = newGameweekData[gw]?.find(m => m.manager_name === name);
                  const pts = gwStats?.total_points_applied || gwStats?.total_points || 0;
                  cumulativePoints += pts;
                  managerEntry.team_name = gwStats?.team_name || managerEntry.team_name;
                  managerEntry[`gw${gw}_points`] = gwStats?.total_points || 0;
                });
                managerEntry.total_points = cumulativePoints;
                return managerEntry;
              })
                .sort((a, b) => b.total_points - a.total_points)
                .map((manager, index) => ({
                  ...manager,
                  current_position: index + 1,
                  overall_position_change: (newGameweekData[available[0]]?.find(m => m.manager_name === manager.manager_name)?.position || 0) - (index + 1),
                }));
              setCombinedData(newCombinedData);
            }
          })
          .catch(err => console.log('Background historical fetch failed:', err));
      }
      
      // Build combined data from what we have now
      if (tempGameweekData[tempAvailable[0]]?.length) {
        const managerNames = tempGameweekData[tempAvailable[0]].map(m => m.manager_name);
        const newCombinedData = managerNames.map(name => {
          let cumulativePoints = 0;
          const managerEntry = { manager_name: name };
          tempAvailable.forEach(gw => {
            const gwStats = tempGameweekData[gw]?.find(m => m.manager_name === name);
            const pts = gwStats?.total_points_applied || gwStats?.total_points || 0;
            cumulativePoints += pts;
            managerEntry.team_name = gwStats?.team_name || managerEntry.team_name;
            managerEntry[`gw${gw}_points`] = gwStats?.total_points || 0;
          });
          managerEntry.total_points = cumulativePoints;
          return managerEntry;
        })
          .sort((a, b) => b.total_points - a.total_points)
          .map((manager, index) => ({
            ...manager,
            current_position: index + 1,
            overall_position_change: (tempGameweekData[tempAvailable[0]]?.find(m => m.manager_name === manager.manager_name)?.position || 0) - (index + 1),
          }));
        setCombinedData(newCombinedData);
      }
      
      setError(null);
      setLastUpdate(new Date());
      console.log('✅ Data fetch complete');
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error("Failed to load FPL data:", err);
        setError(err.message);
      }
    } finally {
      if (fetchCycleIdRef.current === myId) setLoading(false);
    }
  }, [processGameweekData]);

  // Initial data load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Setup SSE ONLY after we have data
  useEffect(() => {
    // Wait until we have data
    if (Object.keys(gameweekData).length === 0) {
      console.log('No gameweek data yet, waiting to setup SSE');
      return;
    }

    // Only setup SSE once
    if (sseSetupDoneRef.current) {
      console.log('SSE already setup, skipping');
      return;
    }

    console.log('Data loaded, setting up SSE connection');
    sseSetupDoneRef.current = true;
    setConnectionStatus('connecting');

    const eventSource = new EventSource(SSE_URL);
    eventSourceRef.current = eventSource;
    const maxReconnectAttempts = 5;

    eventSource.onopen = () => {
      console.log('SSE connection established');
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
        
        switch (message.type) {
          case 'connected':
            console.log('SSE connected at', message.timestamp);
            break;
          case 'heartbeat':
            break;
          case 'gameweek_updated':
            console.log('Gameweek update detected:', message.data);
            if (message.data.manifest_version !== manifestVersionRef.current) {
              console.log('New data version detected, refreshing silently...');
              fetchData(true); // Background refresh - won't reset scroll
            }
            break;
          case 'error':
            console.error('SSE error message:', message.message);
            break;
          default:
            console.log('Unknown SSE message type:', message.type);
        }
      } catch (err) {
        console.error('Error parsing SSE message:', err);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      setConnectionStatus('disconnected');
      eventSource.close();
      
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`SSE reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
        reconnectAttemptsRef.current++;
        
        setTimeout(() => {
          if (eventSourceRef.current && eventSourceRef.current.readyState !== EventSource.OPEN) {
            sseSetupDoneRef.current = false; // Allow re-setup
            // Trigger re-setup by updating a dependency (we'll use a hack here)
            setConnectionStatus('connecting');
          }
        }, delay);
      } else {
        console.log('Max SSE reconnection attempts reached, falling back to polling');
        if (!fallbackIntervalRef.current) {
          fallbackIntervalRef.current = setInterval(() => {
            fetchData(true); // Background refresh - won't reset scroll
          }, FALLBACK_POLL_INTERVAL_MS);
        }
      }
    };

    return () => {
      console.log('Cleaning up SSE connection');
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
  }, [gameweekData, fetchData]); // Run when data first loads

  return { 
    loading, 
    error, 
    gameweekData, 
    combinedData, 
    availableGameweeks, 
    latestGameweek, 
    fetchData, 
    connectionStatus, 
    lastUpdate,
    fixtureData,
    captainStats,
    chipsData // NEW: Return chips data
  };
};

const getCaptainStatusIcon = (manager) => {
  if (!manager.captain_fixture_started) return '⏳';
  if (manager.captain_fixture_started && !manager.captain_fixture_finished) return '🟡';
  return '✅';
};

const getPositionChangeIcon = (change) => {
  if (change > 0) return <span className="text-green-400">↗️ +{change}</span>;
  if (change < 0) return <span className="text-red-400">↘️ {change}</span>;
  return <span className="text-gray-400">➡️ 0</span>
};

// NEW: Chip Popup Component
const ChipPopup = ({ chipData, managerName, gameweekData, onClose, position }) => {
  console.log('ChipPopup rendering!', { chipData, managerName, position });
  
  if (!chipData) {
    console.log('ChipPopup: no chipData, returning null');
    return null;
  }

  const chipName = CHIP_NAMES[chipData.name] || chipData.name;
  const chipEmoji = CHIP_EMOJIS[chipData.name] || '🎯';
  
  // Get gameweek data for this chip from the gameweekData state
  const gwNumber = chipData.event;
  const managerGwData = gameweekData[gwNumber]?.find(m => m.manager_name === managerName);
  const gwPoints = managerGwData?.total_points || 0;
  
  let chipBenefit = 0;
  let benefitLabel = '';
  
  if (chipData.name === '3xc') {
    // Triple Captain: extra captain points (captain gets 3x instead of 2x)
    const captainRawPoints = managerGwData?.captain_points || 0;
    chipBenefit = captainRawPoints; // The benefit is the extra 1x multiplier
    benefitLabel = `Captain scored ${captainRawPoints} raw pts (×3 = ${captainRawPoints * 3})`;
  } else if (chipData.name === 'bboost') {
    // Bench Boost: bench_points is already calculated as sum of all bench players' points_gw
    chipBenefit = Math.round(managerGwData?.bench_points || 0);
    benefitLabel = `Bench contributed ${chipBenefit} extra pts`;
  } else if (chipData.name === 'freehit') {
    benefitLabel = `Team scored ${gwPoints} pts this week`;
  } else if (chipData.name === 'wildcard') {
    benefitLabel = 'Squad restructured';
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Popup */}
      <div
        className="fixed z-50 bg-slate-800 rounded-lg border-2 border-purple-500 shadow-2xl p-3 w-[90vw] max-w-[280px]"
        style={{
          left: position.x > 0 ? `${position.x}px` : '50%',
          top: position.y > 0 ? `${position.y}px` : '20vh',
          transform: position.x > 0 ? 'translate(-50%, calc(-100% - 12px))' : 'translate(-50%, 0)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{chipEmoji}</span>
          <div>
            <h4 className="text-white font-bold text-sm">{chipName}</h4>
            <p className="text-xs text-gray-400">Gameweek {chipData.event}</p>
          </div>
        </div>
        
        <div className="space-y-1 text-xs">
          <div className="flex justify-between items-center py-1 border-t border-slate-700">
            <span className="text-gray-400">GW Points:</span>
            <span className="text-white font-bold">{gwPoints}</span>
          </div>
          
          {chipBenefit > 0 && chipData.name !== 'freehit' && chipData.name !== 'wildcard' && (
            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">Chip Gain:</span>
              <span className="text-green-400 font-bold">+{chipBenefit}</span>
            </div>
          )}
          
          <p className="text-gray-300 text-[10px] pt-1 border-t border-slate-700/50">
            {benefitLabel}
          </p>
        </div>
      </div>
    </>
  );
};

// Captain Statistics Modal Component
const CaptainStatsModal = ({ gameweek, captainStats, onClose, gameweekData, fixtureData }) => {
  if (!gameweek || !captainStats || !captainStats[gameweek]) return null;

  const captainData = captainStats[gameweek] || {};
  const currentGwData = gameweekData[gameweek] || [];
  const totalManagers = Object.values(captainData).reduce((sum, count) => sum + count, 0);
  
  // Get managers for each captain
  const getCaptainManagers = (playerName) => {
    return currentGwData
      .filter(mgr => mgr.captain_player === playerName)
      .map(mgr => mgr.manager_name);
  };

  // Get captain's fixture and points info
  const getCaptainInfo = (playerName) => {
    const manager = currentGwData.find(mgr => mgr.captain_player === playerName);
    if (!manager) return { points: '-', fixtureText: null, fixtureStarted: false };

    const captainPlayerData = manager.players?.find(p => p.name === playerName);
    if (!captainPlayerData) return { points: '-', fixtureText: null, fixtureStarted: false };

    const points = captainPlayerData.fixture_started ? captainPlayerData.points_gw : '-';
    const fixtureStarted = captainPlayerData.fixture_started;

    // Get fixture info
    let fixtureText = null;
    if (fixtureData.fixtures.length && fixtureData.playerTeamMap) {
      let playerTeam = fixtureData.playerTeamMap[playerName];
      if (!playerTeam && playerName.includes(' ')) {
        playerTeam = fixtureData.playerTeamMap[playerName.split(' ').pop()];
      }

      if (playerTeam) {
        const fixture = fixtureData.fixtures.find(f => {
          const homeTeam = fixtureData.teamMap[f.team_h];
          const awayTeam = fixtureData.teamMap[f.team_a];
          return (homeTeam === playerTeam || awayTeam === playerTeam) && f.event === gameweek;
        });

        if (fixture && fixture.kickoff_time) {
          const kickoffTime = new Date(fixture.kickoff_time);
          const now = new Date();
          const homeTeam = fixtureData.teamMap[fixture.team_h];
          const awayTeam = fixtureData.teamMap[fixture.team_a];
          const isHome = playerTeam === homeTeam;

          if (now < kickoffTime) {
            // Future fixture
            const dateStr = kickoffTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
            const timeStr = kickoffTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            fixtureText = (
              <div className="text-[10px] text-gray-400">
                <div className="font-semibold">
                  <span className={isHome ? "text-gray-200" : ""}>{homeTeam}</span>
                  <span className="mx-1">v</span>
                  <span className={!isHome ? "text-gray-200" : ""}>{awayTeam}</span>
                </div>
                <div>{dateStr} • {timeStr}</div>
              </div>
            );
          } else if (!fixture.finished && !fixture.finished_provisional) {
            // Live fixture
            const homeScore = fixture.team_h_score ?? 0;
            const awayScore = fixture.team_a_score ?? 0;
            fixtureText = (
              <div className="text-[10px] text-yellow-400">
                <div className="font-semibold">
                  <span className={isHome ? "text-yellow-300" : ""}>{homeTeam}</span>
                  <span className="mx-1">{homeScore}-{awayScore}</span>
                  <span className={!isHome ? "text-yellow-300" : ""}>{awayTeam}</span>
                </div>
                <div className="animate-pulse">{fixture.minutes ?? 0}' LIVE</div>
              </div>
            );
          } else {
            // Finished fixture
            const homeScore = fixture.team_h_score ?? 0;
            const awayScore = fixture.team_a_score ?? 0;
            fixtureText = (
              <div className="text-[10px] text-gray-500">
                <div className="font-semibold">
                  <span className={isHome ? "text-gray-300" : ""}>{homeTeam}</span>
                  <span className="mx-1">{homeScore}-{awayScore}</span>
                  <span className={!isHome ? "text-gray-300" : ""}>{awayTeam}</span>
                </div>
                <div>FT</div>
              </div>
            );
          }
        }
      }
    }

    return { points, fixtureText, fixtureStarted };
  };
  
  // Sort by count descending
  const sortedCaptains = Object.entries(captainData)
    .map(([player, count]) => {
      const managers = getCaptainManagers(player);
      const info = getCaptainInfo(player);
      return {
        player,
        count,
        percentage: totalManagers > 0 ? ((count / totalManagers) * 100).toFixed(1) : 0,
        managers,
        points: info.points,
        fixtureText: info.fixtureText,
        fixtureStarted: info.fixtureStarted
      };
    })
    .sort((a, b) => b.count - a.count);

  const ManagersList = ({ managers, expanded, onToggle }) => {
    if (managers.length <= 2) {
      return (
        <div className="text-[9px] md:text-[10px] text-gray-400 mt-0.5 md:mt-1">
          {managers.join(', ')}
        </div>
      );
    }

    return (
      <div className="mt-0.5 md:mt-1">
        {!expanded ? (
          <button
            onClick={onToggle}
            className="text-[9px] md:text-[10px] text-cyan-400 hover:text-cyan-300 underline"
          >
            Show {managers.length} managers →
          </button>
        ) : (
          <div>
            <button
              onClick={onToggle}
              className="text-[9px] md:text-[10px] text-cyan-400 hover:text-cyan-300 underline mb-0.5 md:mb-1"
            >
              Hide managers ↑
            </button>
            <div className="text-[9px] md:text-[10px] text-gray-400 max-h-20 md:max-h-24 overflow-y-auto leading-tight">
              {managers.map((mgr, idx) => (
                <div key={idx} className="py-0.5">{mgr}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const [expandedCaptains, setExpandedCaptains] = React.useState({});

  const toggleExpanded = (playerName) => {
    setExpandedCaptains(prev => ({
      ...prev,
      [playerName]: !prev[playerName]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2 md:p-6" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] md:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 p-2 md:p-4 flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-sm md:text-xl font-bold text-white">Captain Choices</h2>
            <p className="text-[10px] md:text-sm text-gray-400">Gameweek {gameweek} • {totalManagers} managers</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-4 h-4 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-2 md:p-4">
          {sortedCaptains.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-xs md:text-base">No captain data available</p>
            </div>
          ) : (
            <div className="space-y-1.5 md:space-y-2">
              {sortedCaptains.map((captain, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/30 rounded-md md:rounded-lg border border-slate-700 overflow-hidden"
                >
                  {/* Captain Header */}
                  <div className="bg-slate-900/80 px-2 py-1.5 md:px-3 md:py-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 md:gap-2 flex-1 min-w-0">
                      <span className="text-xs md:text-base font-bold text-white truncate">{captain.player}</span>
                      {idx === 0 && (
                        <span className="text-[9px] md:text-xs bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded flex-shrink-0">🐓Most Popular🐓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-base md:text-2xl font-bold text-cyan-400">{captain.percentage}%</div>
                        <div className="text-[8px] md:text-[10px] text-gray-400 leading-tight">{captain.count} {captain.count === 1 ? 'mgr' : 'mgrs'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Captain Details */}
                  <div className="p-2 md:p-3 space-y-1.5 md:space-y-2">
                    {/* Fixture and Points Row */}
                    <div className="flex items-center justify-between gap-2 md:gap-3 pb-1.5 md:pb-2 border-b border-slate-700/50">
                      <div className="flex-1 min-w-0">
                        {captain.fixtureText || <span className="text-[9px] md:text-xs text-gray-500">No fixture info</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-[8px] md:text-[10px] text-gray-400 mb-0.5">Pts</div>
                        <div className={`text-base md:text-2xl font-bold ${captain.points === '-' ? 'text-gray-500' : 'text-white'}`}>
                          {captain.points}
                        </div>
                      </div>
                    </div>

                    {/* Visual percentage bar */}
                    <div className="w-full bg-slate-700 rounded-full h-1.5 md:h-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 md:h-2 rounded-full transition-all duration-300"
                        style={{ width: `${captain.percentage}%` }}
                      ></div>
                    </div>

                    {/* Managers list */}
                    <ManagersList 
                      managers={captain.managers}
                      expanded={expandedCaptains[captain.player]}
                      onToggle={() => toggleExpanded(captain.player)}
                    />
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

// ====== UPDATED PlayerStatsModal with Points Breakdown ======
// Replace your existing PlayerStatsModal with this version

const PlayerStatsModal = ({ elementId, playerName, currentGameweek, onClose }) => {
  const [stats, setStats] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [selectedGW, setSelectedGW] = React.useState(null);

  React.useEffect(() => {
    const loadStats = async () => {
      setLoading(true);
      setError(null);
      const data = await fetchPlayerStats(elementId);
      if (data) {
        setStats(data);
        // Default to most recent gameweek
        // Default to current gameweek being viewed, or most recent if not available
if (data.history && data.history.length > 0) {
  const targetGW = currentGameweek || data.history[data.history.length - 1].round;
  const gwExists = data.history.some(gw => gw.round === targetGW);
  setSelectedGW(gwExists ? targetGW : data.history[data.history.length - 1].round);
}
      } else {
        setError('Failed to load player stats');
      }
      setLoading(false);
    };
    
    if (elementId) {
      loadStats();
    }
  }, [elementId]);

  if (!elementId) return null;

  const getPositionColor = (pos) => {
    const colors = { 'GK': 'text-yellow-400', 'DEF': 'text-green-400', 'MID': 'text-blue-400', 'FWD': 'text-red-400' };
    return colors[pos] || 'text-gray-400';
  };

  const StatBox = ({ label, value, highlight = false }) => (
    <div className={`text-center p-2 rounded ${highlight ? 'bg-cyan-900/30 border border-cyan-700/50' : 'bg-slate-700/30'}`}>
      <div className={`text-lg md:text-xl font-bold ${highlight ? 'text-cyan-400' : 'text-white'}`}>{value}</div>
      <div className="text-[10px] md:text-xs text-gray-400">{label}</div>
    </div>
  );

  // Calculate points breakdown for a gameweek
  const getPointsBreakdown = (gwData, position) => {
    if (!gwData) return [];
    
    const breakdown = [];
    const pos = position || 'MID';
    
    // Minutes
    if (gwData.minutes >= 60) {
      breakdown.push({ stat: 'Minutes', value: gwData.minutes, points: 2, desc: '60+ mins played' });
    } else if (gwData.minutes > 0) {
      breakdown.push({ stat: 'Minutes', value: gwData.minutes, points: 1, desc: '1-59 mins played' });
    }
    
    // Goals
    if (gwData.goals_scored > 0) {
      const goalPts = pos === 'FWD' ? 4 : pos === 'MID' ? 5 : 6;
      breakdown.push({ 
        stat: 'Goals', 
        value: gwData.goals_scored, 
        points: gwData.goals_scored * goalPts, 
        desc: `${gwData.goals_scored} × ${goalPts} pts` 
      });
    }
    
    // Assists
    if (gwData.assists > 0) {
      breakdown.push({ 
        stat: 'Assists', 
        value: gwData.assists, 
        points: gwData.assists * 3, 
        desc: `${gwData.assists} × 3 pts` 
      });
    }
    
    // Clean sheets
    if (gwData.clean_sheets > 0) {
      const csPts = (pos === 'GK' || pos === 'DEF') ? 4 : pos === 'MID' ? 1 : 0;
      if (csPts > 0) {
        breakdown.push({ stat: 'Clean Sheet', value: '✓', points: csPts, desc: `${pos} clean sheet` });
      }
    }
    
    // Saves (GK only, 1 pt per 3 saves)
    if (gwData.saves > 0) {
      const savePts = Math.floor(gwData.saves / 3);
      if (savePts > 0) {
        breakdown.push({ stat: 'Saves', value: gwData.saves, points: savePts, desc: `${gwData.saves} saves (1pt per 3)` });
      }
    }
    
    // Penalty saves
    if (gwData.penalties_saved > 0) {
      breakdown.push({ 
        stat: 'Pen Saved', 
        value: gwData.penalties_saved, 
        points: gwData.penalties_saved * 5, 
        desc: `${gwData.penalties_saved} × 5 pts` 
      });
    }
    
    // Bonus
    if (gwData.bonus > 0) {
      breakdown.push({ stat: 'Bonus', value: gwData.bonus, points: gwData.bonus, desc: `${gwData.bonus} bonus pts` });
    }

    // Defensive contributions (2 pts if threshold met)
// Defensive contributions (2 pts if threshold met)
if (gwData.defensive_contribution > 0) {
  const cbit = (gwData.clearances_blocks_interceptions || 0) + (gwData.tackles || 0);
  const cbirt = cbit + (gwData.recoveries || 0);
  const threshold = (pos === 'DEF' || pos === 'GK') ? 10 : 12;
  const statUsed = (pos === 'DEF' || pos === 'GK') ? cbit : cbirt;
  
  if (statUsed >= threshold) {
    breakdown.push({ 
      stat: 'Defensive Contrib', 
      value: statUsed, 
      points: 2, 
      desc: `${statUsed} CBIT${pos !== 'DEF' && pos !== 'GK' ? 'R' : ''} (≥${threshold} = 2pts)` 
    });
  }
}
    
    // Penalties missed
    if (gwData.penalties_missed > 0) {
      breakdown.push({ 
        stat: 'Pen Missed', 
        value: gwData.penalties_missed, 
        points: gwData.penalties_missed * -2, 
        desc: `${gwData.penalties_missed} × -2 pts`,
        negative: true 
      });
    }
    
    // Yellow cards
    if (gwData.yellow_cards > 0) {
      breakdown.push({ 
        stat: 'Yellow Card', 
        value: gwData.yellow_cards, 
        points: gwData.yellow_cards * -1, 
        desc: `${gwData.yellow_cards} × -1 pt`,
        negative: true 
      });
    }
    
    // Red cards
    if (gwData.red_cards > 0) {
      breakdown.push({ 
        stat: 'Red Card', 
        value: gwData.red_cards, 
        points: gwData.red_cards * -3, 
        desc: `${gwData.red_cards} × -3 pts`,
        negative: true 
      });
    }
    
    // Own goals
    if (gwData.own_goals > 0) {
      breakdown.push({ 
        stat: 'Own Goal', 
        value: gwData.own_goals, 
        points: gwData.own_goals * -2, 
        desc: `${gwData.own_goals} × -2 pts`,
        negative: true 
      });
    }
    
    // Goals conceded (DEF/GK only, -1 per 2 goals)
    if (gwData.goals_conceded >= 2 && (pos === 'GK' || pos === 'DEF')) {
      const gcPts = -Math.floor(gwData.goals_conceded / 2);
      breakdown.push({ 
        stat: 'Goals Conceded', 
        value: gwData.goals_conceded, 
        points: gcPts, 
        desc: `${gwData.goals_conceded} conceded (-1 per 2)`,
        negative: true 
      });
    }
    
    return breakdown;
  };

  const selectedGWData = stats?.history?.find(gw => gw.round === selectedGW);
  const pointsBreakdown = getPointsBreakdown(selectedGWData, stats?.player_info?.position);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-2 md:p-4" onClick={onClose}>
      <div 
        className="bg-slate-800 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-slate-900 border-b border-slate-700 p-3 md:p-4 flex justify-between items-center">
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="animate-pulse">
                <div className="h-6 bg-slate-700 rounded w-32 mb-1"></div>
                <div className="h-4 bg-slate-700 rounded w-24"></div>
              </div>
            ) : stats?.player_info ? (
              <>
                <h2 className="text-lg md:text-xl font-bold text-white truncate">
                  {stats.player_info.first_name} {stats.player_info.second_name}
                </h2>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`font-bold ${getPositionColor(stats.player_info.position)}`}>
                    {stats.player_info.position}
                  </span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{stats.player_info.team}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-green-400">£{stats.player_info.now_cost}m</span>
                </div>
              </>
            ) : (
              <h2 className="text-lg md:text-xl font-bold text-white">{playerName}</h2>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0 ml-2">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-cyan-400 animate-pulse">Loading player stats...</div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400">{error}</div>
            </div>
          ) : stats ? (
            <div className="space-y-4">
              {/* Season Overview */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Season Overview</h3>
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="Total Pts" value={stats.player_info.total_points} highlight />
                  <StatBox label="Form" value={stats.player_info.form} />
                  <StatBox label="Pts/Game" value={stats.player_info.points_per_game} />
                  <StatBox label="Ownership" value={`${stats.player_info.selected_by_percent}%`} />
                </div>
              </div>

              {/* Gameweek Points Breakdown - NEW SECTION */}
              {stats.history && stats.history.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Points Breakdown</h3>
                  
                  {/* GW Selector */}
                  <div className="flex gap-1 mb-3 overflow-x-auto pb-2">
                    {stats.history.slice(-8).map((gw) => (
                      <button
                        key={gw.round}
                        onClick={() => setSelectedGW(gw.round)}
                        className={`px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap transition-colors ${
                          selectedGW === gw.round 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                        }`}
                      >
                        GW{gw.round}
                        <span className={`ml-1 ${gw.total_points >= 10 ? 'text-green-300' : ''}`}>
                          ({gw.total_points})
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Points Breakdown Card */}
                  {selectedGWData && (
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                      <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                        <span className="text-gray-400 text-sm">Gameweek {selectedGW}</span>
                        <span className="text-2xl font-bold text-cyan-400">{selectedGWData.total_points} pts</span>
                      </div>
                      
                      {pointsBreakdown.length > 0 ? (
                        <div className="space-y-2">
                          {pointsBreakdown.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center py-1">
                              <div className="flex items-center gap-2">
                                <span className="text-white font-medium text-sm">{item.stat}</span>
                                <span className="text-gray-500 text-xs">({item.desc})</span>
                              </div>
                              <span className={`font-bold text-sm ${
                                item.negative ? 'text-red-400' : 'text-green-400'
                              }`}>
                                {item.points > 0 ? '+' : ''}{item.points}
                              </span>
                            </div>
                          ))}
                          <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-700">
                            <span className="text-gray-400 font-bold">Total</span>
                            <span className="text-cyan-400 font-bold text-lg">{selectedGWData.total_points}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-gray-500 py-4">
                          No points data (did not play)
                        </div>
                      )}
                      
                      {/* Extra stats row */}
                      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-700/50">
                        <div className="text-center">
                          <div className="text-xs text-gray-500">Minutes</div>
                          <div className="text-white font-bold">{selectedGWData.minutes}'</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">BPS</div>
                          <div className="text-white font-bold">{selectedGWData.bps}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs text-gray-500">xG/xA</div>
                          <div className="text-white font-bold text-xs">
                            {selectedGWData.expected_goals || '0.00'}/{selectedGWData.expected_assists || '0.00'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Season Stats */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Season Stats</h3>
                <div className="grid grid-cols-4 md:grid-cols-6 gap-2">
                  <StatBox label="Minutes" value={stats.season_stats.minutes} />
                  <StatBox label="Goals" value={stats.season_stats.goals_scored} highlight={stats.season_stats.goals_scored > 0} />
                  <StatBox label="Assists" value={stats.season_stats.assists} highlight={stats.season_stats.assists > 0} />
                  <StatBox label="Clean Sheets" value={stats.season_stats.clean_sheets} />
                  <StatBox label="Bonus" value={stats.season_stats.bonus} />
                  <StatBox label="Yellow Cards" value={stats.season_stats.yellow_cards} />
                </div>
              </div>

              {/* ICT Index */}
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">ICT Index</h3>
                <div className="grid grid-cols-4 gap-2">
                  <StatBox label="ICT Index" value={stats.player_info.ict_index} highlight />
                  <StatBox label="Influence" value={stats.player_info.influence} />
                  <StatBox label="Creativity" value={stats.player_info.creativity} />
                  <StatBox label="Threat" value={stats.player_info.threat} />
                </div>
              </div>

              {/* Upcoming Fixtures */}
              {stats.fixtures && stats.fixtures.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Upcoming Fixtures</h3>
                  <div className="flex flex-wrap gap-2">
                    {stats.fixtures.slice(0, 5).map((fixture, idx) => (
                      <div 
                        key={idx}
                        className={`px-2 py-1 rounded text-xs ${
                          fixture.difficulty <= 2 ? 'bg-green-900/50 text-green-400 border border-green-700/50' :
                          fixture.difficulty === 3 ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50' :
                          fixture.difficulty === 4 ? 'bg-orange-900/50 text-orange-400 border border-orange-700/50' :
                          'bg-red-900/50 text-red-400 border border-red-700/50'
                        }`}
                      >
                        <span className="font-bold">{fixture.is_home ? 'H' : 'A'}</span>
                        <span className="mx-1">GW{fixture.event}</span>
                        <span className="opacity-70">({fixture.difficulty})</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const PlayerDetailsModal = ({ manager, onClose, filterType = 'all', fixtureData, gameweekData, onPlayerClick }) => {
  if (!manager) return null;
  
  // Calculate team value from players in this gameweek's squad
  const teamValue = manager.team_value ? (manager.team_value).toFixed(1) : null;

  const calculateLeagueOwnership = (playerName) => {
    if (!manager || !manager.gameweek) return null;
    
    const currentGwData = gameweekData[manager.gameweek];
    if (!currentGwData || currentGwData.length === 0) return null;
    
    let ownersCount = 0;
    const totalManagers = currentGwData.length;
    
    currentGwData.forEach(mgr => {
      if (mgr.players && mgr.players.length > 0) {
        const ownsPlayer = mgr.players.some(p => p.name === playerName);
        if (ownsPlayer) ownersCount++;
      }
    });
    
    if (totalManagers === 0) return null;
    
    const ownershipPct = ((ownersCount / totalManagers) * 100).toFixed(1);
    return ownershipPct;
  };

  const getPositionColor = (pos) => {
    const colors = { GK: 'text-yellow-400', DEF: 'text-blue-400', MID: 'text-green-400', FWD: 'text-red-400' };
    return colors[pos] || 'text-gray-400';
  };

const getFixtureTimingText = (player, currentGameweek) => {
    if (!fixtureData.fixtures.length || !fixtureData.playerTeamMap) return null;
    
    let playerTeam = fixtureData.playerTeamMap[player.name];
    if (!playerTeam && player.name.includes(' ')) {
      playerTeam = fixtureData.playerTeamMap[player.name.split(' ').pop()];
    }
    if (!playerTeam) return null;
    
    const fixture = fixtureData.fixtures.find(f => {
      const homeTeam = fixtureData.teamMap[f.team_h];
      const awayTeam = fixtureData.teamMap[f.team_a];
      return (homeTeam === playerTeam || awayTeam === playerTeam) && f.event === currentGameweek;
    });
    
    if (!fixture || !fixture.kickoff_time) return null;
    
    const kickoffTime = new Date(fixture.kickoff_time);
    const now = new Date();
    const homeTeam = fixtureData.teamMap[fixture.team_h];
    const awayTeam = fixtureData.teamMap[fixture.team_a];
    const isHome = playerTeam === homeTeam;
    
    // Future fixtures
    if (now < kickoffTime) {
      // Create separate strings for date and time, just like in the captain modal
      const dateStr = kickoffTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = kickoffTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      return (
        <span className="text-[9px] text-gray-400 flex items-center gap-1.5">
          <span className="truncate">
            <span className={isHome ? "font-bold text-gray-300" : "text-gray-500"}>{homeTeam}</span>
            <span className="mx-0.5 opacity-50">v</span>
            <span className={!isHome ? "font-bold text-gray-300" : "text-gray-500"}>{awayTeam}</span>
          </span>
          <span className="opacity-50">•</span>
          {/* Combine the date and time strings here */}
          <span>{dateStr} • {timeStr}</span>
        </span>
      );
    } 
    
    const homeScore = fixture.team_h_score ?? 0;
    const awayScore = fixture.team_a_score ?? 0;

    // Scoreboard Pill Component
    const ScorePill = ({ live }) => (
      <span className={`inline-flex items-center px-1.5 rounded-sm ml-0.5 ${live ? 'bg-yellow-400/10 border border-yellow-400/20' : 'bg-slate-700/50 border border-slate-600/30'}`}>
        <span className={isHome ? (live ? "font-extrabold text-yellow-300" : "font-bold text-gray-200") : "opacity-60"}>{homeScore}</span>
        <span className="mx-0.5 opacity-40">:</span>
        <span className={!isHome ? (live ? "font-extrabold text-yellow-300" : "font-bold text-gray-200") : "opacity-60"}>{awayScore}</span>
      </span>
    );

    // Live fixtures
    if (!fixture.finished && !fixture.finished_provisional) {
      return (
        <span className="text-[9px] text-yellow-400 font-medium flex items-center gap-1.5">
          <span className="font-bold animate-pulse">{fixture.minutes ?? 0}'</span>
          <span className="truncate">
            <span className={isHome ? "font-bold text-yellow-300" : "text-yellow-400/60"}>{homeTeam}</span>
            <span className="mx-0.5 opacity-50">v</span>
            <span className={!isHome ? "font-bold text-yellow-300" : "text-yellow-400/60"}>{awayTeam}</span>
          </span>
          <ScorePill live={true} />
        </span>
      );
    } 
    
    // Finished fixtures
    return (
      <span className="text-[9px] text-gray-500 flex items-center gap-1.5">
        <span>FT</span>
        <span className="truncate">
          <span className={isHome ? "font-bold text-gray-300" : "text-gray-500"}>{homeTeam}</span>
          <span className="mx-0.5 opacity-50">v</span>
          <span className={!isHome ? "font-bold text-gray-300" : "text-gray-500"}>{awayTeam}</span>
        </span>
        <ScorePill live={false} />
      </span>
    );
  };

  const allPlayers = manager.players || [];
  const starters = allPlayers.filter(p => p.multiplier >= 1);
  const bench = allPlayers.filter(p => p.multiplier === 0);
  
  let filteredStarters = starters;
  let filteredBench = bench;
  let modalTitle = 'All Players';
  let modalSubtitle = null;
  
  if (filterType === 'live') {
    filteredStarters = starters.filter(p => p.fixture_started && !p.fixture_finished);
    filteredBench = [];
    modalTitle = 'Live Players';
    modalSubtitle = `${filteredStarters.length} player${filteredStarters.length !== 1 ? 's' : ''} currently playing`;
  } else if (filterType === 'upcoming') {
    filteredStarters = starters.filter(p => !p.fixture_started);
    filteredBench = [];
    modalTitle = 'Upcoming Players';
    modalSubtitle = `${filteredStarters.length} player${filteredStarters.length !== 1 ? 's' : ''} yet to play`;
  } else if (filterType === 'bench') {
    filteredStarters = [];
    modalTitle = 'Bench Players';
    modalSubtitle = `${filteredBench.length} player${filteredBench.length !== 1 ? 's' : ''} on the bench`;
  }

  const renderPlayerRow = (player, idx) => {
    const leagueOwnership = calculateLeagueOwnership(player.name);

    return (
      <div 
        key={idx} 
        className="flex items-center justify-between py-2 md:py-2.5 hover:bg-slate-700/30 transition-colors px-2 md:px-3 cursor-pointer"
        onClick={() => {
  console.log('Player clicked:', player);
  console.log('Element ID:', player.element_id);
  console.log('Raw CSV columns available:', Object.keys(player));
  onPlayerClick && onPlayerClick(player);
}}
        >
        <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
          <span className={`font-bold text-xs md:text-sm ${getPositionColor(player.position)} w-8 md:w-10 flex-shrink-0`}>{player.position}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-white font-medium text-xs md:text-base truncate">{player.name}</p>
              {leagueOwnership && (
                <span className="text-[9px] text-gray-400 bg-gray-800 px-1.5 py-0.5 rounded">
                  {leagueOwnership}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] md:text-xs text-gray-300 font-bold truncate">{player.team}</p>
              {getFixtureTimingText(player, manager.gameweek)}
            </div>
          </div>
          {player.is_captain && (
            <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 bg-cyan-600 text-white rounded font-bold flex-shrink-0">C</span>
          )}
        </div>
        <div className="text-right ml-2 md:ml-3 flex-shrink-0">
          <p className="text-base md:text-xl font-bold text-white">
            {!player.fixture_started ? '-' : (player.multiplier === 0 ? player.points_gw : player.points_applied)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 pb-24 md:p-6 md:pb-6" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[75vh] md:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 p-2.5 md:p-4 flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-xl font-bold text-white truncate">{manager.manager_name}</h2>
              {teamValue && (
                <span className="text-xs text-green-400">£{teamValue}m</span>
              )}
            </div>
            <p className="text-xs md:text-sm text-gray-400 truncate">"{manager.team_name}" • GW{manager.gameweek}</p>
            {modalSubtitle && (
              <p className="text-xs md:text-sm text-cyan-400 mt-0.5">{modalSubtitle}</p>
            )}
          </div>
          <div className="text-right mx-2 flex-shrink-0">
            <p className="text-xl md:text-2xl font-bold text-cyan-400">{manager.total_points}</p>
            <p className="text-[10px] md:text-xs text-gray-400 whitespace-nowrap">Total Pts</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors flex-shrink-0">
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filterType === 'all' ? (
            <div className="grid md:grid-cols-2 gap-4 p-3 md:p-4">
              <div className="bg-slate-900/30 rounded-lg overflow-hidden">
                <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-700">
                  <h3 className="text-sm md:text-base font-bold text-white">Starters</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {filteredStarters.map((player, idx) => renderPlayerRow(player, idx))}
                </div>
              </div>

              <div className="bg-slate-900/30 rounded-lg overflow-hidden">
                <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-700">
                  <h3 className="text-sm md:text-base font-bold text-white">Bench</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {filteredBench.map((player, idx) => renderPlayerRow(player, idx))}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 md:p-4">
              <div className="bg-slate-900/30 rounded-lg overflow-hidden">
                <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-700">
                  <h3 className="text-sm md:text-base font-bold text-white">{modalTitle}</h3>
                </div>
                {filteredStarters.length === 0 && filteredBench.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm md:text-base">No {modalTitle.toLowerCase()} at this time</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-700/50">
                    {[...filteredStarters, ...filteredBench].map((player, idx) => renderPlayerRow(player, idx))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = React.memo(({ title, value, unit, icon, onClick, isClickable }) => (
  <div className="bg-slate-800/50 rounded-lg p-2 shadow-lg border border-slate-700 text-center">
    <h3 className="text-xs font-bold text-cyan-300">{icon} {title}</h3>
    {isClickable ? (
      <button onClick={onClick} className="text-lg sm:text-xl font-bold text-white break-words hover:text-cyan-400 transition-colors">
        {value}
      </button>
    ) : (
      <p className="text-lg sm:text-xl font-bold text-white break-words">{value}</p>
    )}
    <p className="text-xs text-gray-400">{unit}</p>
  </div>
));

const ViewToggleButtons = React.memo(({ availableGameweeks, selectedView, onSelectView }) => {
  const colorMap = {
    selected: {
      gw1: 'bg-blue-600 text-white', gw2: 'bg-green-600 text-white', gw3: 'bg-orange-600 text-white',
      gw4: 'bg-purple-600 text-white', gw5: 'bg-pink-600 text-white', gw6: 'bg-indigo-600 text-white',
      combined: 'bg-teal-600 text-white'
    },
    default: 'bg-slate-700 text-gray-300 hover:bg-slate-600'
  };
  const getButtonClass = (viewKey, isSelected) => {
    const base = 'px-2 py-1 rounded-md font-semibold transition-colors duration-200 text-xs';
    return isSelected ? `${base} ${colorMap.selected[viewKey] || colorMap.selected.combined}` : `${base} ${colorMap.default}`;
  };
  return (
    <div className="flex justify-center flex-wrap gap-1.5 mb-3">
      {availableGameweeks.map(gw => (
        <button key={`gw${gw}`} onClick={() => onSelectView(`gw${gw}`)} className={getButtonClass(`gw${gw}`, selectedView === `gw${gw}`)}>
          GW{gw}
        </button>
      ))}
      <button onClick={() => onSelectView('combined')} className={getButtonClass('combined', selectedView === 'combined')}>
        Combined
      </button>
    </div>
  );
});

const ManagerRow = React.memo(({ manager, view, availableGameweeks, onManagerClick, onFilteredClick, onCaptainClick, chipsData, gameweekData }) => {
  const isCombined = view === 'combined';
  const position = isCombined ? manager.current_position : manager.position;
  const totalPoints = manager.total_points;
  const [chipPopup, setChipPopup] = useState(null);
  const chipButtonRef = useRef(null);

  // NEW: Find chip for current gameweek
  const currentGameweek = isCombined ? null : manager.gameweek;
  const managerChips = chipsData.find(c => c.manager_name === manager.manager_name);
  const currentChip = currentGameweek && managerChips 
    ? managerChips.chips.find(chip => chip.event === currentGameweek)
    : null;

  // Debug logging
  if (currentGameweek === 11) {
    console.log('GW11 Manager:', manager.manager_name);
    console.log('Manager chips object:', managerChips);
    console.log('Current chip:', currentChip);
    console.log('Chips data length:', chipsData.length);
    console.log('chipPopup state:', chipPopup);
  }

  // Log when chipPopup changes
  useEffect(() => {
    if (chipPopup) {
      console.log('Chip popup is now open:', chipPopup);
    }
  }, [chipPopup]);

  const handleChipClick = (e) => {
    console.log('handleChipClick called!', e.type);
    e.stopPropagation();
    
    // Use the event target directly for more reliable positioning
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    console.log('Button rect:', rect);
    
    const newPopup = {
      x: rect.left + rect.width / 2,
      y: rect.top
    };
    console.log('About to set chipPopup state to:', newPopup);
    setChipPopup(newPopup);
  };

  const gridColsMap = { 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
  const combinedCols = 3 + availableGameweeks.length + 1;
  const desktopGridClass = isCombined ? (gridColsMap[combinedCols] || `md:grid-cols-12`) : 'md:grid-cols-7';

  return (
    <>
      <div className="bg-slate-800/30 rounded-md p-1.5 border border-slate-700">
        <div className="md:hidden">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 bg-slate-700 rounded-md text-xs font-bold flex items-center justify-center">{position}</span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => onManagerClick(manager)} className="text-left hover:text-cyan-400 transition-colors">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-bold text-xs">{manager.manager_name}</p>
                    {manager.team_value > 0 && (
                      <span className="text-[9px] text-green-400">£{manager.team_value.toFixed(1)}m</span>
                    )}
                  </div>
                  <p className="text-gray-400 text-[10px]">"{manager.team_name}"</p>
                </button>
                {currentChip && (
                  <button
                    ref={chipButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Mobile chip CLICKED!');
                      handleChipClick(e);
                    }}
                    className="text-sm transition-transform active:scale-110 p-1 -ml-1 touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    title={CHIP_NAMES[currentChip.name]}
                  >
                    {CHIP_EMOJIS[currentChip.name]}
                  </button>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold text-base">{totalPoints}</p>
            </div>
          </div>
          {isCombined ? (
            <div className="mt-2">
              {/* Scrollable gameweek scores */}
              <div className="relative">
                <div 
                  className="flex gap-1.5 overflow-x-auto pb-2 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {availableGameweeks.map((gw, idx) => {
                    const points = manager[`gw${gw}_points`];
                    const isHighest = points === Math.max(...availableGameweeks.map(g => manager[`gw${g}_points`] || 0));
                    const isLowest = points === Math.min(...availableGameweeks.map(g => manager[`gw${g}_points`] || 0));
                    
                    return (
                      <div 
                        key={gw} 
                        className={`flex-shrink-0 snap-start bg-slate-900/50 p-1.5 rounded min-w-[60px] text-center border ${
                          isHighest && points > 0 ? 'border-green-500/30 bg-green-900/10' : 
                          isLowest ? 'border-red-500/30 bg-red-900/10' : 
                          'border-slate-700/30'
                        }`}
                      >
                        <p className="font-semibold text-gray-400 text-[9px] uppercase tracking-wide">GW{gw}</p>
                        <p className={`font-bold text-sm ${
                          isHighest && points > 0 ? 'text-green-400' : 
                          isLowest ? 'text-red-400' : 
                          'text-gray-200'
                        }`}>
                          {points}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {/* Scroll indicator */}
                {availableGameweeks.length > 4 && (
                  <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-slate-800/90 to-transparent pointer-events-none flex items-center justify-end pr-1">
                    <span className="text-gray-400 text-xs">→</span>
                  </div>
                )}
              </div>
              {/* Position change indicator */}
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[9px] text-gray-500">Overall Movement</span>
                <div className="text-[10px]">{getPositionChangeIcon(manager.overall_position_change)}</div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1 text-center text-[10px] mt-1">
              <button 
                onClick={() => onCaptainClick(manager.gameweek)}
                className="bg-slate-900/50 p-0.5 rounded hover:bg-slate-800 transition-colors"
              >
                <p className="font-semibold text-cyan-400 flex items-center justify-center gap-1">
                  Captain {getCaptainStatusIcon(manager)}
                </p>
                <p className="text-purple-300 underline truncate">{manager.captain_player?.split(' ').pop() || 'N/A'}</p>
              </button>
              <button onClick={() => onFilteredClick(manager, 'live')} className="bg-slate-900/50 p-0.5 rounded hover:bg-slate-800 transition-colors">
                <p className="font-semibold text-green-400 flex items-center justify-center gap-1">
                  Live
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                </p>
                <p className="text-gray-200 font-bold text-xs">{manager.players_live || 0}</p>
                <p className="text-gray-500 text-[9px] -mt-1">players</p>
              </button>
              <button onClick={() => onFilteredClick(manager, 'upcoming')} className="bg-slate-900/50 p-0.5 rounded hover:bg-slate-800 transition-colors">
                <p className="font-semibold text-yellow-400">Upcoming</p>
                <p className="text-gray-200 font-bold text-xs">{manager.players_upcoming || 0}</p>
                <p className="text-gray-500 text-[9px] -mt-1">players</p>
              </button>
              <button onClick={() => onFilteredClick(manager, 'bench')} className="bg-slate-900/50 p-0.5 rounded hover:bg-slate-800 transition-colors">
                <p className="font-semibold text-orange-400">Bench</p>
                <p className="text-gray-200 font-bold text-xs">{Math.round(manager.bench_points) || 0}</p>
                <p className="text-gray-500 text-[9px] -mt-1">pts</p>
              </button>
            </div>
          )}
        </div>
        <div className={`hidden md:grid ${desktopGridClass} gap-3 items-center text-sm px-3 py-1`}>
          <div className="md:col-span-2 flex items-center gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-slate-700 rounded-md text-sm font-bold flex items-center justify-center">{position}</span>
            <button onClick={() => onManagerClick(manager)} className="text-left hover:text-cyan-400 transition-colors">
              <div className="flex items-center gap-2">
                <p className="text-white font-medium truncate">{manager.manager_name}</p>
                {manager.team_value > 0 && (
                  <span className="text-xs text-green-400">£{manager.team_value.toFixed(1)}m</span>
                )}
                {currentChip && (
                  <button
                    ref={chipButtonRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('Desktop chip CLICKED!');
                      handleChipClick(e);
                    }}
                    className="text-lg transition-transform active:scale-110 touch-manipulation"
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    title={CHIP_NAMES[currentChip.name]}
                  >
                    {CHIP_EMOJIS[currentChip.name]}
                  </button>
                )}
              </div>
              <p className="text-gray-400 text-xs truncate">"{manager.team_name}"</p>
            </button>
          </div>
          <div className="text-white font-bold text-lg text-center">{totalPoints}</div>
          {isCombined ? (
            <>
              {availableGameweeks.map(gw => <div key={gw} className="text-center text-gray-300">{manager[`gw${gw}_points`]}</div>)}
              <div className="text-xs text-center">{getPositionChangeIcon(manager.overall_position_change)}</div>
            </>
          ) : (
            <>
              <div className="text-center col-span-2">
                <button 
                  onClick={() => onCaptainClick(manager.gameweek)}
                  className="hover:text-purple-300 transition-colors"
                >
                  <p className="text-white font-medium truncate underline decoration-purple-400">{manager.captain_player || 'N/A'}</p>
                  <p className="text-cyan-400 text-xs">{manager.captain_points || 0} pts {getCaptainStatusIcon(manager)}</p>
                </button>
              </div>
              <button onClick={() => onFilteredClick(manager, 'live')} className="text-center hover:bg-slate-700/50 rounded p-1 transition-colors">
                <p className="text-green-400 font-bold text-lg">{manager.players_live || 0}</p>
                <p className="text-gray-400 text-xs -mt-1">players</p>
              </button>
              <button onClick={() => onFilteredClick(manager, 'upcoming')} className="text-center hover:bg-slate-700/50 rounded p-1 transition-colors">
                <p className="text-yellow-400 font-bold text-lg">{manager.players_upcoming || 0}</p>
                <p className="text-gray-400 text-xs -mt-1">players</p>
              </button>
              <button onClick={() => onFilteredClick(manager, 'bench')} className="text-center hover:bg-slate-700/50 rounded p-1 transition-colors">
                <p className="text-orange-400 font-bold text-lg">{Math.round(manager.bench_points) || 0}</p>
                <p className="text-gray-400 text-xs -mt-1">pts</p>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Chip Popup */}
      {(() => {
        console.log('Rendering chip popup section:', { chipPopup, currentChip });
        return chipPopup && currentChip ? (
          <ChipPopup
            chipData={currentChip}
            managerName={manager.manager_name}
            gameweekData={gameweekData}
            onClose={() => setChipPopup(null)}
            position={chipPopup}
          />
        ) : null;
      })()}
    </>
  );
});

const Leaderboard = ({ data, view, availableGameweeks, onManagerClick, onFilteredClick, onCaptainClick, chipsData, gameweekData }) => {
  const isCombined = view === 'combined';
  const gridColsMap = { 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
  const combinedCols = 3 + availableGameweeks.length + 1;
  const desktopGridClass = isCombined ? (gridColsMap[combinedCols] || `md:grid-cols-12`) : 'md:grid-cols-7';

  return (
    <div className="space-y-1">
      <div className={`hidden md:grid ${desktopGridClass} gap-3 px-3 py-2 text-xs font-bold text-gray-400 uppercase`}>
        <div className="md:col-span-2">Manager</div>
        <div className="text-center">{isCombined ? 'Total' : 'Points'}</div>
        {isCombined ? (
          <>
            {availableGameweeks.map(gw => <div key={gw} className="text-center">GW{gw}</div>)}
            <div className="text-center">+/-</div>
          </>
        ) : (
          <>
            <div className="text-center col-span-2">Captain</div>
            <div className="text-center">Live</div>
            <div className="text-center">Upcoming</div>
            <div className="text-center">Bench</div>
          </>
        )}
      </div>
      {data.map((manager) => (
        <ManagerRow 
          key={manager.manager_name} 
          manager={manager} 
          view={view} 
          availableGameweeks={availableGameweeks} 
          onManagerClick={onManagerClick} 
          onFilteredClick={onFilteredClick}
          onCaptainClick={onCaptainClick}
          chipsData={chipsData}
          gameweekData={gameweekData}
        />
      ))}
    </div>
  );
};

const FPLMultiGameweekDashboard = () => {
  // Use shared data context instead of local fetching - INSTANT tab switch!
  const { 
    gameweekData, 
    captainStats,
    availableGameweeks, 
    latestGameweek, 
    fixtureData, 
    chipsData,
    isInitialLoading: loading,
    error,
    connectionStatus,
    lastUpdate,
    refreshLatestGameweek: fetchData,
  } = useData();

  // Build combinedData from context (derived, not fetched)
  const combinedData = useMemo(() => {
    if (!gameweekData || Object.keys(gameweekData).length === 0) return [];
    
    const managerNames = gameweekData[availableGameweeks[0]]?.map(m => m.manager_name) || [];
    
    return managerNames.map(name => {
      let cumulativePoints = 0;
      const managerEntry = { manager_name: name };
      
      availableGameweeks.forEach(gw => {
        const gwStats = gameweekData[gw]?.find(m => m.manager_name === name);
        const pts = gwStats?.total_points_applied || gwStats?.total_points || 0;
        cumulativePoints += pts;
        managerEntry.team_name = gwStats?.team_name || managerEntry.team_name;
        managerEntry[`gw${gw}_points`] = gwStats?.total_points || 0;
        if (gwStats?.team_value) {
          managerEntry[`gw${gw}_team_value`] = gwStats.team_value;
        }
      });
      managerEntry.total_points = cumulativePoints;
      return managerEntry;
    })
      .sort((a, b) => b.total_points - a.total_points)
      .map((manager, index) => {
        const gw1Position = gameweekData[availableGameweeks[0]]?.find(m => m.manager_name === manager.manager_name)?.position || 0;
        return {
          ...manager,
          current_position: index + 1,
          overall_position_change: gw1Position ? gw1Position - (index + 1) : 0,
        };
      });
  }, [gameweekData, availableGameweeks]);

  const [selectedView, setSelectedView] = useState('combined');
  const [selectedManager, setSelectedManager] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [selectedCaptainGW, setSelectedCaptainGW] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  useEffect(() => {
    if (!loading && availableGameweeks.length > 0) {
      setSelectedView(`gw${latestGameweek}`);
    } else if (loading) {
      setSelectedView('combined');
    }
  }, [loading, availableGameweeks, latestGameweek]);

  useEffect(() => {
    if (selectedManager || showCaptainModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedManager, showCaptainModal]);

  const currentData = useMemo(() => {
    if (selectedView === 'combined') return combinedData;
    const gwNumber = parseInt(selectedView.replace('gw', ''), 10);
    return gameweekData[gwNumber] || [];
  }, [selectedView, combinedData, gameweekData]);

  const handleManagerClick = useCallback((manager) => {
    setSelectedManager(manager);
    setFilterType('all');
  }, []);

  const handleFilteredClick = useCallback((manager, type) => {
    setSelectedManager(manager);
    setFilterType(type);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedManager(null);
    setFilterType('all');
  }, []);

  const handleCaptainClick = useCallback((gameweek) => {
    // Don't open modal if captain stats aren't loaded for this gameweek
    if (!captainStats || !captainStats[gameweek]) {
      console.warn(`Captain stats not available for GW${gameweek}`);
      return;
    }
    setSelectedCaptainGW(gameweek);
    setShowCaptainModal(true);
  }, [captainStats]);

  const handleCloseCaptainModal = useCallback(() => {
    setShowCaptainModal(false);
    setSelectedCaptainGW(null);
  }, []);

  if (loading && Object.keys(gameweekData).length === 0) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-cyan-400 text-xl animate-pulse">Loading FPL Dashboard...</div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 p-4">
        <div className="text-red-400 text-xl mb-4 text-center">{error}</div>
        <button 
          onClick={fetchData}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  const leader = currentData[0];
  const averageScore = currentData.length > 0 ? Math.round(currentData.reduce((sum, m) => sum + (m.total_points || 0), 0) / currentData.length) : 0;

  const statusColor = connectionStatus === 'connected' ? 'bg-green-500' : 
                     connectionStatus === 'disconnected' ? 'bg-yellow-500' : 
                     connectionStatus === 'connecting' ? 'bg-blue-500' : 'bg-gray-500';
  const statusText = connectionStatus === 'connected' ? 'Live' : 
                    connectionStatus === 'disconnected' ? 'Polling' : 
                    connectionStatus === 'connecting' ? 'Connecting...' : 'Unknown';

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-gray-100">
     {selectedManager && <PlayerDetailsModal manager={selectedManager} onClose={handleCloseModal} filterType={filterType} fixtureData={fixtureData} gameweekData={gameweekData} onPlayerClick={(player) => setSelectedPlayer(player)} />}
{selectedPlayer && <PlayerStatsModal elementId={selectedPlayer.element_id} playerName={selectedPlayer.name} currentGameweek={selectedManager?.gameweek} onClose={() => setSelectedPlayer(null)} />}
      {showCaptainModal && <CaptainStatsModal gameweek={selectedCaptainGW} captainStats={captainStats} onClose={handleCloseCaptainModal} gameweekData={gameweekData} fixtureData={fixtureData} />}
      <div className="max-w-7xl mx-auto p-2 sm:p-6">
        <header className="text-center mb-4 sm:mb-8">
          <div className="relative flex justify-center items-center max-w-md mx-auto mb-3">
            <h1 className="text-xl sm:text-3xl font-light text-white tracking-wide">FPL Multi-GW Dashboard</h1>
            <button
              onClick={fetchData}
              disabled={loading}
              className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 bg-slate-200 text-slate-800 rounded-full shadow-md border border-slate-400 hover:bg-slate-300 active:shadow-inner active:bg-slate-400 disabled:shadow-none disabled:bg-slate-400 disabled:text-slate-600 disabled:cursor-not-allowed transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 110 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connected' ? 'animate-pulse' : connectionStatus === 'connecting' ? 'animate-pulse' : ''}`}></div>
              <span className="text-xs text-gray-400">{statusText}</span>
            </div>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                • Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          <ViewToggleButtons
            availableGameweeks={availableGameweeks}
            selectedView={selectedView}
            onSelectView={setSelectedView}
          />
        </header>
        <section className="grid grid-cols-2 gap-2 sm:gap-6 mb-4 sm:mb-8">
          <StatCard 
            icon="👑" 
            title="Leader" 
            value={leader?.manager_name || 'NA'} 
            unit={`${leader?.total_points || 0} pts`} 
            onClick={() => leader && handleManagerClick(leader)}
            isClickable={!!leader}
          />
          <StatCard icon="📊" title="Average" value={averageScore} unit="Points" />
        </section>
        <main>
          <Leaderboard 
            data={currentData} 
            view={selectedView} 
            availableGameweeks={availableGameweeks} 
            onManagerClick={handleManagerClick} 
            onFilteredClick={handleFilteredClick}
            onCaptainClick={handleCaptainClick}
            chipsData={chipsData}
            gameweekData={gameweekData}
          />
        </main>
      </div>
    </div>
  );
};

export default FPLMultiGameweekDashboard;