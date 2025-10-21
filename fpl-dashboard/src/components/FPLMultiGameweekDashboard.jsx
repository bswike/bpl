import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// --- Constants ---
const PUBLIC_BASE = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/';
const SSE_URL = 'https://bpl-red-sun-894.fly.dev/sse/fpl-updates';
const FALLBACK_POLL_INTERVAL_MS = 300000;

// --- Hardcoded GW1 Data ---
const HARDCODED_GW1_DATA = [
  { manager_name: "Garrett Kunkel", team_name: "kunkel_fpl", total_points: 78, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 8, position: 1, gameweek: 1, players: [] },
  { manager_name: "Andrew Vidal", team_name: "Las Cucarachas", total_points: 76, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 7, position: 2, gameweek: 1, players: [] },
  { manager_name: "Brett Swikle", team_name: "swikle_time", total_points: 74, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 8, position: 3, gameweek: 1, players: [] },
  { manager_name: "John Matthew", team_name: "matthewfpl", total_points: 73, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 9, position: 4, gameweek: 1, players: [] },
  { manager_name: "Jared Alexander", team_name: "Jared's Jinxes", total_points: 67, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 7, position: 5, gameweek: 1, players: [] },
  { manager_name: "Joe Curran", team_name: "Curran's Crew", total_points: 64, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 11, position: 6, gameweek: 1, players: [] },
  { manager_name: "John Sebastian", team_name: "Sebastian Squad", total_points: 62, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 11, position: 7, gameweek: 1, players: [] },
  { manager_name: "Nate Cohen", team_name: "Cohen's Corner", total_points: 60, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 7, position: 8, gameweek: 1, players: [] },
  { manager_name: "Chris Munoz", team_name: "Munoz Magic", total_points: 60, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 8, position: 9, gameweek: 1, players: [] },
  { manager_name: "Evan Bagheri", team_name: "Bagheri's Best", total_points: 57, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 13, position: 10, gameweek: 1, players: [] },
  { manager_name: "Dean Maghsadi", team_name: "Dean's Dream", total_points: 55, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 9, position: 11, gameweek: 1, players: [] },
  { manager_name: "Brian Pleines", team_name: "Pleines Power", total_points: 53, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 10, position: 12, gameweek: 1, players: [] },
  { manager_name: "Max Maier", team_name: "Maier's Marvels", total_points: 53, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 19, position: 13, gameweek: 1, players: [] },
  { manager_name: "Adrian McLoughlin", team_name: "McLoughlin FC", total_points: 52, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 9, position: 14, gameweek: 1, players: [] },
  { manager_name: "Wes H", team_name: "Wes Warriors", total_points: 50, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 9, position: 15, gameweek: 1, players: [] },
  { manager_name: "Kevin Tomek", team_name: "Tomek's Team", total_points: 48, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 22, position: 16, gameweek: 1, players: [] },
  { manager_name: "Kevin K", team_name: "Kevin's Kicks", total_points: 41, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 10, position: 17, gameweek: 1, players: [] },
  { manager_name: "Tony Tharakan", team_name: "Tharakan's Threat", total_points: 39, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 4, position: 18, gameweek: 1, players: [] },
  { manager_name: "JP Fischer", team_name: "Fischer's Force", total_points: 35, captain_points: 0, captain_player: "Haaland", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 13, position: 19, gameweek: 1, players: [] },
  { manager_name: "Patrick McCleary", team_name: "McCleary's Might", total_points: 34, captain_points: 0, captain_player: "Salah", captain_fixture_started: true, captain_fixture_finished: true, players_live: 0, players_upcoming: 0, bench_points: 6, position: 20, gameweek: 1, players: [] }
];

const superBust = () => {
  const now = Date.now();
  const random = Math.random().toString(36).slice(2);
  const micro = Math.floor(performance.now() * 1000) % 1000000;
  return `v=${now}&r=${random}&t=${micro}&cb=${Math.abs(now.toString().split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) % 999999}`;
};

const bust = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const truthy = (v) => v === true || v === 'True' || v === 'true' || v === 1 || v === '1';
const toNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const normalizeStr = (s) => (s ?? '').toString().normalize('NFC').replace(/\u00A0/g, ' ').trim();

const fetchWithNoCaching = async (url, signal) => {
  return fetch(url, { method: 'GET', cache: 'no-store', signal });
};

const fetchWithVersionCheck = async (url, signal) => {
  try {
    const versionUrl = `${PUBLIC_BASE}fpl-data-version.txt?${superBust()}`;
    const versionRes = await fetchWithNoCaching(versionUrl, signal);
    if (versionRes.ok) {
      const versionData = await versionRes.text();
      const currentVersion = versionData.trim().split('\n')[0];
      console.log(`Current data version: ${currentVersion}`);
    }
  } catch (e) {
    console.warn('Version check failed, proceeding with normal fetch', e);
  }
  return fetchWithNoCaching(`${url}?${superBust()}`, signal);
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

const getFixtureInfo = (playerTeam, fixtures, teamMap) => {
  // Look for any fixture for this team (upcoming, live, or finished)
  const fixture = fixtures.find(f => {
    const homeTeam = teamMap[f.team_h];
    const awayTeam = teamMap[f.team_a];
    return homeTeam === playerTeam || awayTeam === playerTeam;
  });
  
  if (!fixture || !fixture.kickoff_time) return null;
  
  const kickoffTime = new Date(fixture.kickoff_time);
  const now = new Date();
  
  const etTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(kickoffTime);
  
  const minutesElapsed = Math.floor((now - kickoffTime) / (1000 * 60));
  
  if (minutesElapsed < 0) {
    return {
      status: 'upcoming',
      kickoff: etTime,
      minutesLeft: 90
    };
  } else if (minutesElapsed <= 90 && !fixture.finished && !fixture.finished_provisional) {
    return {
      status: 'live',
      kickoff: etTime,
      minutesLeft: Math.max(0, 90 - minutesElapsed)
    };
  } else {
    return {
      status: 'finished',
      kickoff: etTime,
      minutesLeft: 0
    };
  }
};
const useFplData = () => {
  const [gameweekData, setGameweekData] = useState({});
  const [combinedData, setCombinedData] = useState([]);
  const [availableGameweeks, setAvailableGameweeks] = useState([]);
  const [latestGameweek, setLatestGameweek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [papaReady, setPapaReady] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [fixtureData, setFixtureData] = useState({ fixtures: [], teamMap: {}, playerTeamMap: {} });
  
  const cycleAbortRef = useRef(null);
  const fetchCycleIdRef = useRef(0);
  const eventSourceRef = useRef(null);
  const manifestVersionRef = useRef(null);
  const fallbackIntervalRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  useEffect(() => {
    if (window.Papa) {
      setPapaReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'papaparse-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
    script.async = true;
    script.onload = () => setPapaReady(true);
    script.onerror = () => { setError("Error: Failed to load data parsing library."); setLoading(false); };
    document.body.appendChild(script);
  }, []);

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
  
  // Load immediately
  loadFixtures();
  
  // Refresh every 5 minutes
  const interval = setInterval(loadFixtures, 300000);
  return () => clearInterval(interval);
}, []);

  const parseCsvToManagers = useCallback((csvText, gameweek) => {
    if (!csvText || csvText.trim() === "The game is being updated.") return [];
    const parsed = window.Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
    if (parsed.errors?.length) console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);
    const managerStats = Object.create(null);
    for (const raw of parsed.data) {
      const manager = normalizeStr(raw.manager_name);
      if (!manager) continue;
      if (!managerStats[manager]) {
        managerStats[manager] = {
          manager_name: manager,
          team_name: normalizeStr(raw.entry_team_name),
          total_points: 0, captain_points: 0, captain_player: '',
          captain_fixture_started: false, captain_fixture_finished: false,
          players_live: 0, players_upcoming: 0, bench_points: 0,
          players: []
        };
      }
      const player = normalizeStr(raw.player);
      if (player !== "TOTAL") {
        const playerData = {
          name: player,
          position: normalizeStr(raw.position),
          team: normalizeStr(raw.team),
          points_gw: toNum(raw.points_gw),
          points_applied: toNum(raw.points_applied),
          multiplier: toNum(raw.multiplier),
          is_captain: truthy(raw.is_captain),
          fixture_started: truthy(raw.fixture_started),
          fixture_finished: truthy(raw.fixture_finished),
          status: normalizeStr(raw.status)
        };
        managerStats[manager].players.push(playerData);
        
        if (truthy(raw.is_captain) && !managerStats[manager].captain_player) {
          managerStats[manager].captain_player = player;
          managerStats[manager].captain_points = toNum(raw.points_applied);
          managerStats[manager].captain_fixture_started = truthy(raw.fixture_started);
          managerStats[manager].captain_fixture_finished = truthy(raw.fixture_finished);
        }
        const mult = toNum(raw.multiplier);
        if (mult >= 1 && raw.status !== "dnp") {
          if (truthy(raw.fixture_started) && !truthy(raw.fixture_finished)) managerStats[manager].players_live++;
          else if (!truthy(raw.fixture_started)) managerStats[manager].players_upcoming++;
        }
        if (mult === 0) managerStats[manager].bench_points += toNum(raw.points_gw);
      } else {
        managerStats[manager].total_points = toNum(raw.points_applied);
      }
    }
    return Object.values(managerStats)
      .filter(m => toNum(m.total_points) >= 0)
      .sort((a, b) => b.total_points - a.total_points)
      .map((m, i) => ({ ...m, position: i + 1, gameweek }));
  }, []);

const processGameweekData = useCallback(async (gameweek, manifest, signal) => {
    if (gameweek === 1) return HARDCODED_GW1_DATA;
    try {
      // Get gameweek info directly from manifest (no more pointer files!)
      const gwInfo = manifest?.gameweeks?.[String(gameweek)];
      if (!gwInfo) throw new Error(`No data for GW${gameweek} in manifest`);
      
      const gwTimestamp = gwInfo?.timestamp;
      if (gwTimestamp && Date.now() - (gwTimestamp * 1000) > 3600000) {
        console.warn(`Data for GW${gameweek} is over 1 hour old`);
      }
      
      // Fetch CSV through backend proxy to bypass CDN caching
      const proxyUrl = `https://bpl-red-sun-894.fly.dev/api/data/${gameweek}`;
      const csvRes = await fetchWithNoCaching(proxyUrl, signal);
      if (!csvRes.ok) throw new Error(`HTTP ${csvRes.status} for GW${gameweek}`);
      const csvText = await csvRes.text();
      return parseCsvToManagers(csvText, gameweek);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(`GW${gameweek} fetch failed:`, err);
      }
      return [];
    }
  }, [parseCsvToManagers]);

  const fetchData = useCallback(async () => {
    if (cycleAbortRef.current) cycleAbortRef.current.abort();
    const abort = new AbortController();
    cycleAbortRef.current = abort;
    const myId = ++fetchCycleIdRef.current;
    setLoading(true);
    try {
      const manifestRes = await fetch(
  'https://bpl-red-sun-894.fly.dev/api/manifest',
  { cache: 'no-store', signal: abort.signal }
);
      if (!manifestRes.ok) throw new Error(`Could not load league manifest (${manifestRes.status})`);
      const manifest = await manifestRes.json();
      
      manifestVersionRef.current = manifest.version;
      
      const manifestTimestamp = manifest?.timestamp;
      if (manifestTimestamp && Date.now() - (manifestTimestamp * 1000) > 3600000) {
        console.warn('Manifest is over 1 hour old, may contain stale data');
      }
      if (manifest?.version) {
        console.log(`Loaded manifest version: ${manifest.version}`);
      }
      const remoteGameweeks = Object.keys(manifest?.gameweeks || {}).map(Number);
      const available = [...new Set([1, ...remoteGameweeks])].sort((a, b) => a - b);
      if (available.length === 0) throw new Error("No gameweek data found in manifest.");
      const currentLatestGw = available[available.length - 1];
      const results = await Promise.all(
        available.map(async (gw) => {
          const data = await processGameweekData(gw, manifest, abort.signal);
          return { gameweek: gw, data };
        })
      );
      if (fetchCycleIdRef.current !== myId || abort.signal.aborted) return;
      const newGameweekData = Object.fromEntries(results.map(({ gameweek, data }) => [gameweek, data]));
      setGameweekData(newGameweekData);
      setAvailableGameweeks(available);
      setLatestGameweek(currentLatestGw);
      if (newGameweekData[1]?.length) {
        const managerNames = newGameweekData[1].map(m => m.manager_name);
        const newCombinedData = managerNames.map(name => {
          let cumulativePoints = 0;
          const managerEntry = { manager_name: name };
          available.forEach(gw => {
            const gwStats = newGameweekData[gw]?.find(m => m.manager_name === name);
            const pts = gwStats?.total_points || 0;
            cumulativePoints += pts;
            managerEntry.team_name = gwStats?.team_name || managerEntry.team_name;
            managerEntry[`gw${gw}_points`] = pts;
          });
          managerEntry.total_points = cumulativePoints;
          return managerEntry;
        })
          .sort((a, b) => b.total_points - a.total_points)
          .map((manager, index) => {
            const gw1Position = newGameweekData[1]?.find(m => m.manager_name === manager.manager_name)?.position || 0;
            return {
              ...manager,
              current_position: index + 1,
              overall_position_change: gw1Position ? gw1Position - (index + 1) : 0,
            };
          });
        setCombinedData(newCombinedData);
      }
      setError(null);
      setLastUpdate(new Date());
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error("Failed to load FPL data:", err);
        setError(err.message);
      }
    } finally {
      if (fetchCycleIdRef.current === myId) setLoading(false);
    }
  }, [processGameweekData]);

  const setupSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    console.log('Attempting SSE connection to:', SSE_URL);
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
              console.log('New data version detected, refreshing...');
              fetchData();
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
          if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
            setupSSE();
          }
        }, delay);
      } else {
        console.log('Max SSE reconnection attempts reached, falling back to polling');
        if (!fallbackIntervalRef.current) {
          fallbackIntervalRef.current = setInterval(fetchData, FALLBACK_POLL_INTERVAL_MS);
        }
      }
    };

    return eventSource;
  }, [fetchData]);

  useEffect(() => {
    if (!papaReady) return;
    
    fetchData();
    const eventSource = setupSSE();

    return () => {
      console.log('Cleaning up SSE connection');
      if (eventSource) {
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
  }, [papaReady, setupSSE, fetchData]);

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
    fixtureData 
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
  return <span className="text-gray-400">➡️ 0</span>;
};

const PlayerDetailsModal = ({ manager, onClose, filterType = 'all', fixtureData, gameweekData }) => {
  if (!manager) return null;

  const calculateLeagueOwnership = (playerName) => {
  if (!manager || !manager.gameweek) return null;
  
  // Get all managers' data for this gameweek from the parent component
  // We need to pass gameweekData as a prop to the modal
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
  if (!fixtureData.fixtures.length || !fixtureData.playerTeamMap) {
    return null;
  }
  
  // Try to find team using different name formats
  let playerTeam = fixtureData.playerTeamMap[player.name];
  
  // If not found, try last name only
  if (!playerTeam && player.name.includes(' ')) {
    const lastName = player.name.split(' ').pop();
    playerTeam = fixtureData.playerTeamMap[lastName];
  }
  
  if (!playerTeam) {
    return null;
  }
  
  // Find fixture for THIS specific gameweek
  const fixture = fixtureData.fixtures.find(f => {
    const homeTeam = fixtureData.teamMap[f.team_h];
    const awayTeam = fixtureData.teamMap[f.team_a];
    const isTeamMatch = homeTeam === playerTeam || awayTeam === playerTeam;
    const isCorrectGameweek = f.event === currentGameweek;
    
    return isTeamMatch && isCorrectGameweek;
  });
  
  if (!fixture || !fixture.kickoff_time) return null;
  
  const kickoffTime = new Date(fixture.kickoff_time);
  const now = new Date();
  
  const homeTeam = fixtureData.teamMap[fixture.team_h];
  const awayTeam = fixtureData.teamMap[fixture.team_a];
  const opponent = playerTeam === homeTeam ? awayTeam : homeTeam;
  const isHome = playerTeam === homeTeam;
  
  // Format date as MM/DD/YY
  const dateStr = kickoffTime.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit'
  });
  
  const etTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(kickoffTime);
  
  const minutesElapsed = Math.floor((now - kickoffTime) / (1000 * 60));
  
  if (minutesElapsed < 0) {
    // Upcoming
    return (
      <span className="text-[9px] text-gray-400">
        {dateStr} • {isHome ? 'vs' : '@'} {opponent} • {etTime}
      </span>
    );
  } else if (minutesElapsed <= 105 && !fixture.finished && !fixture.finished_provisional) {
    // Live - use actual match minute from API
    const matchMinute = fixture.minutes || 0;
    
    const homeScore = fixture.team_h_score || 0;
    const awayScore = fixture.team_a_score || 0;
    
    return (
      <span className="text-[9px] text-yellow-400 font-semibold">
        {matchMinute}' • {isHome ? 'vs' : '@'} {opponent} • {homeScore}-{awayScore}
      </span>
    );
  } else if (fixture.finished || fixture.finished_provisional) {
    // Finished
    const homeScore = fixture.team_h_score || 0;
    const awayScore = fixture.team_a_score || 0;
    
    return (
      <span className="text-[9px] text-gray-500">
        {isHome ? 'vs' : '@'} {opponent} • {homeScore}-{awayScore}
      </span>
    );
  }
  
  return null;
};
  const allPlayers = manager.players || [];
  const starters = allPlayers.filter(p => p.multiplier >= 1);
  const bench = allPlayers.filter(p => p.multiplier === 0);
  
  // Apply filtering based on filterType
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
    <div key={idx} className="flex items-center justify-between py-2 md:py-2.5 hover:bg-slate-700/30 transition-colors px-2 md:px-3">
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
            <p className="text-[10px] md:text-xs text-gray-400 truncate">{player.team}</p>
            {getFixtureTimingText(player, manager.gameweek)}
          </div>
        </div>
        {player.is_captain && (
          <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 bg-cyan-600 text-white rounded font-bold flex-shrink-0">C</span>
        )}
      </div>
      <div className="text-right ml-2 md:ml-3 flex-shrink-0">
        <p className="text-base md:text-xl font-bold text-white">{player.multiplier === 0 ? player.points_gw : player.points_applied}</p>
      </div>
    </div>
  );
};

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 pb-24 md:p-6 md:pb-6" onClick={onClose}>
      <div className="bg-slate-800 rounded-lg max-w-5xl w-full max-h-[75vh] md:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Fixed header */}
        <div className="flex-shrink-0 bg-slate-900/95 backdrop-blur-sm border-b border-slate-700 p-2.5 md:p-4 flex justify-between items-center">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-base md:text-xl font-bold text-white truncate">{manager.manager_name}</h2>
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

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {filterType === 'all' ? (
            <div className="grid md:grid-cols-2 gap-4 p-3 md:p-4">
              {/* Starters */}
              <div className="bg-slate-900/30 rounded-lg overflow-hidden">
                <div className="bg-slate-900/80 px-3 py-2 border-b border-slate-700">
                  <h3 className="text-sm md:text-base font-bold text-white">Starters</h3>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {filteredStarters.map((player, idx) => renderPlayerRow(player, idx))}
                </div>
              </div>

              {/* Bench */}
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
              {/* Single column for filtered views */}
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

const ManagerRow = React.memo(({ manager, view, availableGameweeks, onManagerClick, onFilteredClick }) => {
  const isCombined = view === 'combined';
  const position = isCombined ? manager.current_position : manager.position;
  const totalPoints = manager.total_points;

  const gridColsMap = { 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
  const combinedCols = 3 + availableGameweeks.length + 1;
  const desktopGridClass = isCombined ? (gridColsMap[combinedCols] || `md:grid-cols-12`) : 'md:grid-cols-7';

  return (
    <div className="bg-slate-800/30 rounded-md p-1.5 border border-slate-700">
      <div className="md:hidden">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-6 h-6 bg-slate-700 rounded-md text-xs font-bold flex items-center justify-center">{position}</span>
            <div>
              <button onClick={() => onManagerClick(manager)} className="text-left hover:text-cyan-400 transition-colors">
                <p className="text-white font-bold text-xs">{manager.manager_name}</p>
                <p className="text-gray-400 text-[10px]">"{manager.team_name}"</p>
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-white font-bold text-base">{totalPoints}</p>
            {isCombined && <div className="text-[10px]">{getPositionChangeIcon(manager.overall_position_change)}</div>}
          </div>
        </div>
        {isCombined ? (
          <div className="grid grid-cols-4 gap-1 text-center text-[10px] mt-1">
            {availableGameweeks.slice(0, 4).map(gw => (
              <div key={gw} className="bg-slate-900/50 p-0.5 rounded">
                <p className="font-semibold text-gray-400">GW{gw}</p>
                <p className="text-gray-200 font-medium">{manager[`gw${gw}_points`]}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1 text-center text-[10px] mt-1">
            <div className="bg-slate-900/50 p-0.5 rounded">
              <p className="font-semibold text-cyan-400 flex items-center justify-center gap-1">
                Captain {getCaptainStatusIcon(manager)}
              </p>
              <p className="text-gray-200 truncate">{manager.captain_player?.split(' ').pop() || 'N/A'}</p>
            </div>
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
            <p className="text-white font-medium truncate">{manager.manager_name}</p>
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
              <p className="text-white font-medium truncate">{manager.captain_player || 'N/A'}</p>
              <p className="text-cyan-400 text-xs">{manager.captain_points || 0} pts {getCaptainStatusIcon(manager)}</p>
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
  );
});

const Leaderboard = ({ data, view, availableGameweeks, onManagerClick, onFilteredClick }) => {
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
        <ManagerRow key={manager.manager_name} manager={manager} view={view} availableGameweeks={availableGameweeks} onManagerClick={onManagerClick} onFilteredClick={onFilteredClick} />
      ))}
    </div>
  );
};

const FPLMultiGameweekDashboard = () => {
  const { loading, error, gameweekData, combinedData, availableGameweeks, latestGameweek, fetchData, connectionStatus, lastUpdate, fixtureData } = useFplData();
  const [selectedView, setSelectedView] = useState('combined');
  const [selectedManager, setSelectedManager] = useState(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    if (!loading && availableGameweeks.length > 0) {
      setSelectedView(`gw${latestGameweek}`);
    } else if (loading) {
      setSelectedView('combined');
    }
  }, [loading, availableGameweeks, latestGameweek]);

  useEffect(() => {
    if (selectedManager) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedManager]);

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

  if (loading && Object.keys(gameweekData).length === 0) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-cyan-400 text-xl animate-pulse">Loading FPL Dashboard...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-red-400 text-xl p-4 text-center">{error}</div>;
  }

  const leader = currentData[0];
  const averageScore = currentData.length > 0 ? Math.round(currentData.reduce((sum, m) => sum + (m.total_points || 0), 0) / currentData.length) : 0;

  const statusColor = connectionStatus === 'connected' ? 'bg-green-500' : 
                     connectionStatus === 'disconnected' ? 'bg-yellow-500' : 'bg-gray-500';
  const statusText = connectionStatus === 'connected' ? 'Live' : 
                    connectionStatus === 'disconnected' ? 'Polling' : 'Connecting';

  return (
    <div className="min-h-screen bg-slate-900 font-sans text-gray-100">
      {selectedManager && <PlayerDetailsModal manager={selectedManager} onClose={handleCloseModal} filterType={filterType} fixtureData={fixtureData} gameweekData={gameweekData} />}
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
              <div className={`w-2 h-2 rounded-full ${statusColor} ${connectionStatus === 'connected' ? 'animate-pulse' : ''}`}></div>
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
          <Leaderboard data={currentData} view={selectedView} availableGameweeks={availableGameweeks} onManagerClick={handleManagerClick} onFilteredClick={handleFilteredClick} />
        </main>
      </div>
    </div>
  );
};

export default FPLMultiGameweekDashboard;