import React, { useState, useEffect, useMemo, useCallback } from 'react';

// --- Constants ---
const CSV_BASE_URL = 'https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_rosters_points_gw';
const REFRESH_INTERVAL_MS = 300000; // 5 minutes
const MAX_GAMEWEEK_TO_CHECK = 38;

// --- Custom Hook for Data Fetching and Processing ---

/**
 * Custom hook to fetch, process, and manage all FPL gameweek data.
 */
const useFplData = () => {
    const [gameweekData, setGameweekData] = useState({});
    const [combinedData, setCombinedData] = useState([]);
    const [availableGameweeks, setAvailableGameweeks] = useState([]);
    const [latestGameweek, setLatestGameweek] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [papaReady, setPapaReady] = useState(false);

    // Load PapaParse script from a CDN to resolve potential build issues
    useEffect(() => {
        const scriptId = 'papaparse-script';
        if (document.getElementById(scriptId) || window.Papa) {
            setPapaReady(true);
            return;
        }
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js';
        script.async = true;
        script.onload = () => setPapaReady(true);
        script.onerror = () => {
            setError("Error: Failed to load the data parsing library.");
            setLoading(false);
        };
        document.body.appendChild(script);

        return () => {
            const el = document.getElementById(scriptId);
            if (el) {
                document.body.removeChild(el);
            }
        };
    }, []);


    const processGameweekData = useCallback(async (gameweek) => {
        try {
            const url = `${CSV_BASE_URL}${gameweek}.csv?t=${Math.floor(Date.now() / REFRESH_INTERVAL_MS)}`;
            const response = await fetch(url, { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

            const csvText = await response.text();
            if (csvText.trim() === "The game is being updated.") return [];

            const parsed = window.Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true });
            if (parsed.errors.length) console.warn(`Parsing errors in GW${gameweek}:`, parsed.errors);
            
            const managerStats = {};

            parsed.data.forEach(row => {
                if (row.player === 'JoÃ£o Pedro Junqueira de Jesus') row.player = 'JoÃ£o Pedro';
                
                const manager = row.manager_name;
                if (!manager) return;

                if (row.player !== "TOTAL") {
                    if (!managerStats[manager]) {
                        managerStats[manager] = {
                            manager_name: manager, team_name: row.entry_team_name, total_points: 0, captain_points: 0,
                            captain_player: '', remaining_players: 0, bench_points: 0,
                        };
                    }
                    if (row.is_captain === "True") {
                        managerStats[manager].captain_player = row.player;
                        managerStats[manager].captain_points = row.points_applied;
                    }
                    if (row.multiplier >= 1 && row.fixture_finished !== "True" && row.status !== "dnp") {
                        managerStats[manager].remaining_players++;
                    }
                    if (row.multiplier === 0) {
                        managerStats[manager].bench_points += parseFloat(row.points_gw) || 0;
                    }
                } else if (managerStats[manager]) {
                    managerStats[manager].total_points = row.points_applied;
                }
            });

            return Object.values(managerStats)
                .sort((a, b) => b.total_points - a.total_points)
                .map((manager, index) => ({ ...manager, position: index + 1, gameweek }));

        } catch (err) {
            console.error(`Error processing GW${gameweek}:`, err);
            return [];
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const gwChecks = Array.from({ length: MAX_GAMEWEEK_TO_CHECK }, (_, i) => i + 1);
            const available = [];
            for (const gw of gwChecks) {
                const res = await fetch(`${CSV_BASE_URL}${gw}.csv`, { method: 'HEAD', cache: 'no-store' });
                if (res.ok) available.push(gw);
                else break;
            }

            if (available.length === 0) throw new Error("No gameweek data found.");
            setAvailableGameweeks(available);
            const currentLatestGw = available[available.length - 1];
            setLatestGameweek(currentLatestGw);
            
            const results = await Promise.all(
                available.map(gw => processGameweekData(gw).then(data => ({ gameweek: gw, data })))
            );

            const newGameweekData = Object.fromEntries(results.map(({ gameweek, data }) => [gameweek, data]));
            setGameweekData(newGameweekData);

            if (results.length > 0 && newGameweekData[1] && newGameweekData[1].length > 0) {
                const managerNames = newGameweekData[1].map(m => m.manager_name);
                const newCombinedData = managerNames.map(name => {
                    let cumulativePoints = 0;
                    const managerEntry = { manager_name: name };

                    available.forEach(gw => {
                        const gwStats = newGameweekData[gw]?.find(m => m.manager_name === name);
                        const points = gwStats?.total_points || 0;
                        cumulativePoints += points;
                        managerEntry.team_name = gwStats?.team_name || managerEntry.team_name;
                        managerEntry[`gw${gw}_points`] = points;
                        managerEntry[`gw${gw}_position`] = gwStats?.position;
                    });
                    
                    managerEntry.total_points = cumulativePoints;
                    const posChange = managerEntry.gw1_position - (managerNames.indexOf(name) + 1);
                    managerEntry.overall_position_change = managerEntry.gw1_position ? (newGameweekData[currentLatestGw]?.find(m => m.manager_name === name)?.position ? managerEntry.gw1_position - newGameweekData[currentLatestGw]?.find(m => m.manager_name === name)?.position : 0) : 0;

                    return managerEntry;
                }).sort((a, b) => b.total_points - a.total_points)
                  .map((manager, index) => ({ ...manager, current_position: index + 1, overall_position_change: manager.gw1_position - (index + 1) }));

                setCombinedData(newCombinedData);
            }
            setError(null);
        } catch (err) {
            console.error("Failed to load FPL data:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [processGameweekData]);
    
    useEffect(() => {
        if (!papaReady) return; // Don't fetch until the parsing library is loaded
        fetchData();
        const intervalId = setInterval(fetchData, REFRESH_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [fetchData, papaReady]);

    return { loading, error, gameweekData, combinedData, availableGameweeks, latestGameweek };
};

// --- Helper Components ---

const getPositionChangeIcon = (change) => {
    if (change > 0) return <span className="text-green-400">↗️ +{change}</span>;
    if (change < 0) return <span className="text-red-400">↘️ {change}</span>;
    return <span className="text-gray-400">➡️ 0</span>;
};

const StatCard = React.memo(({ title, value, unit, icon }) => (
    <div className="bg-slate-800/50 rounded-lg p-2 shadow-lg border border-slate-700 text-center">
        <h3 className="text-xs font-bold text-cyan-300">{icon} {title}</h3>
        <p className="text-lg sm:text-xl font-bold text-white break-words">{value}</p>
        <p className="text-xs text-gray-400">{unit}</p>
    </div>
));

const ViewToggleButtons = React.memo(({ availableGameweeks, selectedView, onSelectView }) => {
    // Tailwind CSS classes need to be listed in full to be included in production builds.
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
        if (isSelected) {
            return `${base} ${colorMap.selected[viewKey] || colorMap.selected.combined}`;
        }
        return `${base} ${colorMap.default}`;
    };

    return (
        <div className="flex justify-center flex-wrap gap-1.5 mb-3">
            {availableGameweeks.map(gw => (
                <button key={`gw${gw}`} onClick={() => onSelectView(`gw${gw}`)}
                    className={getButtonClass(`gw${gw}`, selectedView === `gw${gw}`)}>
                    GW{gw}
                </button>
            ))}
            <button onClick={() => onSelectView('combined')}
                className={getButtonClass('combined', selectedView === 'combined')}>
                Combined
            </button>
        </div>
    );
});

const ManagerRow = React.memo(({ manager, view, availableGameweeks }) => {
    const isCombined = view === 'combined';
    const position = isCombined ? manager.current_position : manager.position;
    const totalPoints = isCombined ? manager.total_points : manager.total_points;
    
    // Tailwind classes map to prevent purging
    const gridColsMap = { 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
    const desktopGridClass = isCombined ? (gridColsMap[4 + availableGameweeks.length] || 'md:grid-cols-12') : 'md:grid-cols-7';

    return (
        <div className="bg-slate-800/30 rounded-md p-1.5 border border-slate-700">
            {/* --- Mobile View Card --- */}
            <div className="md:hidden">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 w-6 h-6 bg-slate-700 rounded-md text-xs font-bold flex items-center justify-center">{position}</span>
                        <div>
                            <p className="text-white font-bold text-xs">{manager.manager_name}</p>
                            <p className="text-gray-400 text-[10px]">"{manager.team_name}"</p>
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
                    <div className="grid grid-cols-3 gap-1 text-center text-[10px] mt-1">
                        <div className="bg-slate-900/50 p-0.5 rounded">
                            <p className="font-semibold text-cyan-400">Captain</p>
                            <p className="text-gray-200 truncate">{manager.captain_player?.split(' ').pop() || 'N/A'}</p>
                        </div>
                        <div className="bg-slate-900/50 p-0.5 rounded">
                            <p className="font-semibold text-yellow-400">Playing</p>
                            <p className="text-gray-200 font-bold text-xs">{manager.remaining_players}</p>
                        </div>
                        <div className="bg-slate-900/50 p-0.5 rounded">
                            <p className="font-semibold text-orange-400">Bench</p>
                            <p className="text-gray-200 font-bold text-xs">{Math.round(manager.bench_points)}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* --- Desktop View Row --- */}
            <div className={`hidden md:grid ${desktopGridClass} gap-3 items-center text-sm`}>
                <div className="md:col-span-2 flex items-center gap-3">
                    <span className="flex-shrink-0 w-7 h-7 bg-slate-700 rounded-md text-sm font-bold flex items-center justify-center">{position}</span>
                    <div>
                        <p className="text-white font-medium truncate">{manager.manager_name}</p>
                        <p className="text-gray-400 text-xs truncate">"{manager.team_name}"</p>
                    </div>
                </div>
                <div className="text-white font-bold text-lg text-center">{totalPoints}</div>
                {isCombined ? (
                    <>
                        {availableGameweeks.map(gw => <div key={gw} className="text-center text-gray-300">{manager[`gw${gw}_points`]}</div>)}
                        <div className="text-xs text-center">{getPositionChangeIcon(manager.overall_position_change)}</div>
                    </>
                ) : (
                    <>
                        <div className="text-center md:col-span-2">
                            <p className="text-white font-medium">{manager.captain_player || 'N/A'}</p>
                            <p className="text-cyan-400 text-xs">{manager.captain_points} pts</p>
                        </div>
                        <div className="text-center"><p className="text-yellow-400 font-bold text-lg">{manager.remaining_players}</p></div>
                        <div className="text-center"><p className="text-orange-400 font-medium">{Math.round(manager.bench_points)}</p></div>
                    </>
                )}
            </div>
        </div>
    );
});

const Leaderboard = ({ data, view, availableGameweeks }) => {
    const isCombined = view === 'combined';
    // Tailwind classes map to prevent purging
    const gridColsMap = { 4: 'md:grid-cols-4', 5: 'md:grid-cols-5', 6: 'md:grid-cols-6', 7: 'md:grid-cols-7', 8: 'md:grid-cols-8', 9: 'md:grid-cols-9', 10: 'md:grid-cols-10', 11: 'md:grid-cols-11', 12: 'md:grid-cols-12' };
    const desktopGridClass = isCombined ? (gridColsMap[4 + availableGameweeks.length] || 'md:grid-cols-12') : 'md:grid-cols-7';

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
                        <div className="text-center md:col-span-2">Captain</div>
                        <div className="text-center">Playing</div>
                        <div className="text-center">Bench</div>
                    </>
                )}
            </div>
            {data.map((manager) => (
                <ManagerRow key={manager.manager_name} {...{ manager, view, availableGameweeks }} />
            ))}
        </div>
    );
};

// --- Main Dashboard Component ---

const FPLMultiGameweekDashboard = () => {
    const { loading, error, gameweekData, combinedData, availableGameweeks, latestGameweek } = useFplData();
    const [selectedView, setSelectedView] = useState('combined');

    useEffect(() => {
        if (!loading && availableGameweeks.length > 0) {
            setSelectedView(`gw${latestGameweek}`);
        }
    }, [loading, availableGameweeks, latestGameweek]);

    const currentData = useMemo(() => {
        if (selectedView === 'combined') return combinedData;
        const gwNumber = parseInt(selectedView.replace('gw', ''), 10);
        return gameweekData[gwNumber] || [];
    }, [selectedView, combinedData, gameweekData]);

    if (loading && !error) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-cyan-400 text-xl animate-pulse">Loading FPL Dashboard...</div>;
    }
    if (error) {
        return <div className="flex items-center justify-center min-h-screen bg-slate-900 text-red-400 text-xl p-4 text-center">{error}</div>;
    }

    const leader = currentData[0];
    const averageScore = currentData.length > 0 ? Math.round(currentData.reduce((sum, m) => sum + m.total_points, 0) / currentData.length) : 0;

    return (
        <div className="min-h-screen bg-slate-900 p-2 sm:p-6 font-sans text-gray-100">
            <div className="max-w-7xl mx-auto">
                <header className="text-center mb-4 sm:mb-8">
                    <h1 className="text-xl sm:text-3xl font-light text-white mb-3 tracking-wide">FPL Multi-GW Dashboard</h1>
                    <ViewToggleButtons {...{ availableGameweeks, selectedView, onSelectView: setSelectedView }} />
                </header>

                <section className="grid grid-cols-2 gap-2 sm:gap-6 mb-4 sm:mb-8">
                    <StatCard icon="👑" title="Leader" value={leader?.manager_name || 'N/A'} unit={`${leader?.total_points || 0} pts`} />
                    <StatCard icon="📊" title="Average" value={averageScore} unit="Points" />
                </section>

                <main>
                    <Leaderboard data={currentData} view={selectedView} availableGameweeks={availableGameweeks} />
                </main>
            </div>
        </div>
    );
};

export default FPLMultiGameweekDashboard;

