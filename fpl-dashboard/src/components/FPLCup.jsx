import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Calendar, ChevronRight, Star, Zap } from 'lucide-react';
import { PlayerDetailsModal, PlayerStatsModal } from './FPLMultiGameweekDashboard';

// Cup configuration - 5 Groups of 4 with Play-In
const CUP_CONFIG = {
  seeding_gw: 25,
  groups: {
    A: ["Garrett Kunkel", "Wes H", "John Matthew", "Chris Munoz"],
    B: ["Kevin Tomek", "Brett Swikle", "Andrew Vidal", "Patrick McCleary"],
    C: ["Dean Maghsadi", "Tony Tharakan", "Adrian McLoughlin", "JP Fischer"],
    D: ["John Sebastian", "Max Maier", "Kevin K", "Brian Pleines"],
    E: ["Joe Curran", "Evan Bagheri", "Nate Cohen", "Jared Alexander"]
  },
  fixtures: {
    A: [
      { gameweek: 26, matches: [{ home: "Garrett Kunkel", away: "Chris Munoz" }, { home: "Wes H", away: "John Matthew" }] },
      { gameweek: 27, matches: [{ home: "Garrett Kunkel", away: "John Matthew" }, { home: "Chris Munoz", away: "Wes H" }] },
      { gameweek: 28, matches: [{ home: "Garrett Kunkel", away: "Wes H" }, { home: "John Matthew", away: "Chris Munoz" }] }
    ],
    B: [
      { gameweek: 26, matches: [{ home: "Kevin Tomek", away: "Patrick McCleary" }, { home: "Brett Swikle", away: "Andrew Vidal" }] },
      { gameweek: 27, matches: [{ home: "Kevin Tomek", away: "Andrew Vidal" }, { home: "Patrick McCleary", away: "Brett Swikle" }] },
      { gameweek: 28, matches: [{ home: "Kevin Tomek", away: "Brett Swikle" }, { home: "Andrew Vidal", away: "Patrick McCleary" }] }
    ],
    C: [
      { gameweek: 26, matches: [{ home: "Dean Maghsadi", away: "JP Fischer" }, { home: "Tony Tharakan", away: "Adrian McLoughlin" }] },
      { gameweek: 27, matches: [{ home: "Dean Maghsadi", away: "Adrian McLoughlin" }, { home: "JP Fischer", away: "Tony Tharakan" }] },
      { gameweek: 28, matches: [{ home: "Dean Maghsadi", away: "Tony Tharakan" }, { home: "Adrian McLoughlin", away: "JP Fischer" }] }
    ],
    D: [
      { gameweek: 26, matches: [{ home: "John Sebastian", away: "Brian Pleines" }, { home: "Max Maier", away: "Kevin K" }] },
      { gameweek: 27, matches: [{ home: "John Sebastian", away: "Kevin K" }, { home: "Brian Pleines", away: "Max Maier" }] },
      { gameweek: 28, matches: [{ home: "John Sebastian", away: "Max Maier" }, { home: "Kevin K", away: "Brian Pleines" }] }
    ],
    E: [
      { gameweek: 26, matches: [{ home: "Joe Curran", away: "Jared Alexander" }, { home: "Evan Bagheri", away: "Nate Cohen" }] },
      { gameweek: 27, matches: [{ home: "Joe Curran", away: "Nate Cohen" }, { home: "Jared Alexander", away: "Evan Bagheri" }] },
      { gameweek: 28, matches: [{ home: "Joe Curran", away: "Evan Bagheri" }, { home: "Nate Cohen", away: "Jared Alexander" }] }
    ]
  },
  schedule: {
    group_stage: [26, 27, 28],
    play_in: 29,
    quarterfinals: 30,
    semifinals: 31,
    final: 32
  }
};

const GROUP_COLORS = {
  A: 'from-blue-600 to-blue-800',
  B: 'from-emerald-600 to-emerald-800',
  C: 'from-amber-600 to-amber-800',
  D: 'from-purple-600 to-purple-800',
  E: 'from-rose-600 to-rose-800'
};

const FPLCup = () => {
  const { gameweekData, latestGameweek, fixtureData, projectionsLookup } = useData();
  const [selectedTab, setSelectedTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState('A');
  const [selectedManager, setSelectedManager] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [h2hMatch, setH2hMatch] = useState(null); // { home, away, gameweek }

  // Calculate seeds based on cumulative points through GW25 (entering GW26)
  const managerSeeds = useMemo(() => {
    const seedingGw = CUP_CONFIG.seeding_gw; // GW25
    const managerTotals = {};

    // Sum up points from GW1 through GW25
    for (let gw = 1; gw <= seedingGw; gw++) {
      const gwManagers = gameweekData?.[gw] || [];
      gwManagers.forEach(m => {
        if (!managerTotals[m.manager_name]) {
          managerTotals[m.manager_name] = 0;
        }
        // Use net points (total_points_applied) when available
        managerTotals[m.manager_name] += (m.total_points_applied ?? m.total_points ?? 0);
      });
    }

    // Sort by total points and assign seeds
    const sorted = Object.entries(managerTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name], idx) => ({ name, seed: idx + 1 }));

    // Create lookup map
    const seedMap = {};
    sorted.forEach(({ name, seed }) => {
      seedMap[name] = seed;
    });

    return seedMap;
  }, [gameweekData]);

  // Helper to get seed badge
  const getSeedBadge = (managerName) => {
    const seed = managerSeeds[managerName];
    if (!seed) return null;
    return (
      <span className="text-[10px] bg-slate-700 text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
        #{seed}
      </span>
    );
  };

  // Handler to open manager modal - find manager data in current or relevant GW
  const handleManagerClick = useCallback((managerName, gw = null) => {
    const targetGw = gw || latestGameweek;
    const gwManagers = gameweekData?.[targetGw] || [];
    const managerData = gwManagers.find(m => m.manager_name === managerName);
    if (managerData) {
      setSelectedManager({ ...managerData, gameweek: targetGw });
    }
  }, [gameweekData, latestGameweek]);

  // Handler to open H2H view
  const handleH2HClick = useCallback((match, gw) => {
    const gwManagers = gameweekData?.[gw] || [];
    const homeData = gwManagers.find(m => m.manager_name === match.home);
    const awayData = gwManagers.find(m => m.manager_name === match.away);
    if (homeData && awayData) {
      setH2hMatch({
        home: { ...homeData, gameweek: gw },
        away: { ...awayData, gameweek: gw },
        gameweek: gw
      });
    }
  }, [gameweekData]);

  const handleCloseModal = useCallback(() => {
    setSelectedManager(null);
  }, []);

  const handleCloseH2H = useCallback(() => {
    setH2hMatch(null);
  }, []);

  // Calculate group standings based on H2H results
  const groupStandings = useMemo(() => {
    const standings = {};
    
    Object.entries(CUP_CONFIG.groups).forEach(([groupName, teams]) => {
      const groupStats = {};
      teams.forEach(team => {
        groupStats[team] = {
          name: team,
          group: groupName,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          points_for: 0,
          points_against: 0,
          cup_points: 0
        };
      });

      const groupFixtures = CUP_CONFIG.fixtures[groupName] || [];
      groupFixtures.forEach(matchday => {
        const gw = matchday.gameweek;
        const gwManagers = gameweekData?.[gw] || [];

        const scores = {};
        gwManagers.forEach(m => {
          scores[m.manager_name] = m.total_points || 0;
        });

        matchday.matches.forEach(match => {
          const homeScore = scores[match.home];
          const awayScore = scores[match.away];

          if (homeScore !== undefined && awayScore !== undefined) {
            groupStats[match.home].played++;
            groupStats[match.away].played++;
            groupStats[match.home].points_for += homeScore;
            groupStats[match.away].points_for += awayScore;
            groupStats[match.home].points_against += awayScore;
            groupStats[match.away].points_against += homeScore;

            if (homeScore > awayScore) {
              groupStats[match.home].won++;
              groupStats[match.home].cup_points += 3;
              groupStats[match.away].lost++;
            } else if (awayScore > homeScore) {
              groupStats[match.away].won++;
              groupStats[match.away].cup_points += 3;
              groupStats[match.home].lost++;
            } else {
              groupStats[match.home].drawn++;
              groupStats[match.away].drawn++;
              groupStats[match.home].cup_points += 1;
              groupStats[match.away].cup_points += 1;
            }
          }
        });
      });

      standings[groupName] = Object.values(groupStats).sort((a, b) => {
        if (b.cup_points !== a.cup_points) return b.cup_points - a.cup_points;
        if (b.points_for !== a.points_for) return b.points_for - a.points_for;
        return (b.points_for - b.points_against) - (a.points_for - a.points_against);
      });
    });

    return standings;
  }, [gameweekData]);

  // Get all qualifiers (top 2 from each group) sorted by overall performance
  const knockoutSeedings = useMemo(() => {
    const qualifiers = [];
    
    Object.entries(groupStandings).forEach(([group, standings]) => {
      // Top 2 from each group qualify
      standings.slice(0, 2).forEach((team, position) => {
        qualifiers.push({
          ...team,
          group,
          group_position: position + 1
        });
      });
    });

    // Sort by cup points, then points for
    return qualifiers.sort((a, b) => {
      if (b.cup_points !== a.cup_points) return b.cup_points - a.cup_points;
      if (b.points_for !== a.points_for) return b.points_for - a.points_for;
      return (b.points_for - b.points_against) - (a.points_for - a.points_against);
    }).map((team, idx) => ({ ...team, seed: idx + 1 }));
  }, [groupStandings]);

  // Get match result for display
  const getMatchResult = (match, gw) => {
    const gwManagers = gameweekData?.[gw] || [];
    const homeData = gwManagers.find(m => m.manager_name === match.home);
    const awayData = gwManagers.find(m => m.manager_name === match.away);
    
    if (!homeData || !awayData) {
      return { status: 'upcoming', homeScore: null, awayScore: null };
    }

    const homeScore = homeData.total_points || 0;
    const awayScore = awayData.total_points || 0;
    const isLive = gw === latestGameweek;
    
    // Calculate starters only (multiplier >= 1) - excludes bench
    const homeStarters = (homeData.players || []).filter(p => p.multiplier >= 1);
    const awayStarters = (awayData.players || []).filter(p => p.multiplier >= 1);
    
    // Live = started but not finished
    const homeLive = homeStarters.filter(p => p.fixture_started && !p.fixture_finished).length;
    const awayLive = awayStarters.filter(p => p.fixture_started && !p.fixture_finished).length;
    
    // Remaining = not yet started
    const homeRemaining = homeStarters.filter(p => !p.fixture_started).length;
    const awayRemaining = awayStarters.filter(p => !p.fixture_started).length;
    
    const hasLivePlayers = homeLive > 0 || awayLive > 0;

    return {
      status: isLive ? (hasLivePlayers ? 'live' : 'today') : 'completed',
      homeScore,
      awayScore,
      homeLive,
      awayLive,
      homeRemaining,
      awayRemaining,
      winner: homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw')
    };
  };

  const currentPhase = useMemo(() => {
    if (!latestGameweek) return 'upcoming';
    if (latestGameweek < 26) return 'upcoming';
    if (latestGameweek <= 28) return 'groups';
    if (latestGameweek === 29) return 'play-in';
    if (latestGameweek === 30) return 'quarterfinals';
    if (latestGameweek === 31) return 'semifinals';
    if (latestGameweek >= 32) return 'final';
    return 'groups';
  }, [latestGameweek]);

  const isGroupStageLive = latestGameweek >= 26 && latestGameweek <= 28;

  const renderGroupTable = (groupName) => {
    const standings = groupStandings[groupName] || [];
    
    return (
      <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
        <div className={`bg-gradient-to-r ${GROUP_COLORS[groupName]} px-4 py-3 flex items-center justify-between`}>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Users size={18} />
            Group {groupName}
          </h3>
          {isGroupStageLive && (
            <span className="flex items-center gap-1 text-xs bg-black/30 px-2 py-1 rounded-full">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-white font-medium">LIVE</span>
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-slate-700">
                <th className="text-left px-3 py-2 w-8">#</th>
                <th className="text-left px-3 py-2">Manager</th>
                <th className="text-center px-2 py-2">P</th>
                <th className="text-center px-2 py-2">W</th>
                <th className="text-center px-2 py-2">D</th>
                <th className="text-center px-2 py-2">L</th>
                <th className="text-center px-2 py-2">PF</th>
                <th className="text-center px-2 py-2 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, idx) => {
                const qualifies = idx < 2;
                
                return (
                  <tr 
                    key={team.name}
                    className={`border-b border-slate-700/50 ${qualifies ? 'bg-green-900/20' : ''}`}
                  >
                    <td className="px-3 py-2">
                      {qualifies ? (
                        <span className="text-green-400 font-bold">{idx + 1}</span>
                      ) : (
                        <span className="text-gray-500">{idx + 1}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <button 
                        onClick={() => handleManagerClick(team.name)}
                        className="flex items-center gap-2 hover:text-cyan-400 transition-colors text-left"
                      >
                        {idx === 0 && <Star size={14} className="text-yellow-400" />}
                        <span className={`underline decoration-slate-600 hover:decoration-cyan-400 ${qualifies ? 'text-white font-medium' : 'text-gray-300'}`}>
                          {team.name}
                        </span>
                        {getSeedBadge(team.name)}
                      </button>
                    </td>
                    <td className="text-center px-2 py-2 text-gray-400">{team.played}</td>
                    <td className="text-center px-2 py-2 text-green-400">{team.won}</td>
                    <td className="text-center px-2 py-2 text-gray-400">{team.drawn}</td>
                    <td className="text-center px-2 py-2 text-red-400">{team.lost}</td>
                    <td className="text-center px-2 py-2 text-gray-300">{team.points_for}</td>
                    <td className="text-center px-2 py-2 font-bold text-cyan-400">{team.cup_points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 bg-slate-900/50 text-xs text-gray-500">
          <span className="inline-block w-2 h-2 bg-green-600 rounded mr-1"></span>
          Top 2 advance to knockout
        </div>
      </div>
    );
  };

  const renderFixtures = () => {
    // Collect all matches by gameweek
    const matchesByGW = {};
    const groupStageGWs = CUP_CONFIG.schedule.group_stage; // [26, 27, 28]
    
    groupStageGWs.forEach(gw => {
      matchesByGW[gw] = [];
    });
    
    // Gather all matches from all groups, organized by GW
    Object.entries(CUP_CONFIG.fixtures).forEach(([groupName, groupFixtures]) => {
      groupFixtures.forEach(matchday => {
        matchday.matches.forEach(match => {
          matchesByGW[matchday.gameweek].push({
            ...match,
            group: groupName
          });
        });
      });
    });
    
    return (
      <div className="space-y-6">
        {groupStageGWs.map((gw, gwIdx) => {
          const isCurrentGW = gw === latestGameweek;
          const isPast = gw < latestGameweek;
          const matches = matchesByGW[gw] || [];
          
          return (
            <div 
              key={gw}
              className={`bg-slate-800/50 rounded-xl border ${
                isCurrentGW ? 'border-cyan-500' : 'border-slate-700'
              } overflow-hidden`}
            >
              <div className={`px-4 py-3 ${isCurrentGW ? 'bg-cyan-900/30' : 'bg-slate-900/50'} flex justify-between items-center`}>
                <div>
                  <span className="text-lg font-bold text-white">
                    Gameweek {gw}
                  </span>
                  <span className="text-sm text-gray-400 ml-2">
                    Matchday {gwIdx + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isCurrentGW && (
                    <span className="text-xs bg-cyan-500 text-black px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  )}
                  {isPast && (
                    <span className="text-xs text-green-400 flex items-center gap-1">
                      <span>✓</span> Completed
                    </span>
                  )}
                  <span className="text-xs text-gray-500">{matches.length} matches</span>
                </div>
              </div>
              
              <div className="p-4 space-y-2">
                {/* Group matches by group for visual organization */}
                {['A', 'B', 'C', 'D', 'E'].map(groupName => {
                  const groupMatches = matches.filter(m => m.group === groupName);
                  if (groupMatches.length === 0) return null;
                  
                  return (
                    <div key={groupName} className="space-y-2">
                      <div className="flex items-center gap-2 px-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded bg-gradient-to-r ${GROUP_COLORS[groupName]} text-white`}>
                          Group {groupName}
                        </span>
                      </div>
                      {groupMatches.map((match, mIdx) => {
                        const result = getMatchResult(match, gw);
                        const isLive = result.status === 'live' || result.status === 'today';
                        
                        return (
                          <div 
                            key={mIdx}
                            className={`flex items-center justify-between rounded-lg p-3 ${
                              isLive ? 'bg-cyan-900/20 border border-cyan-600/30' : 'bg-slate-900/50'
                            }`}
                          >
                            <div className="flex-1 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button 
                                  onClick={() => handleManagerClick(match.home, gw)}
                                  className={`text-sm hover:text-cyan-400 transition-colors underline decoration-slate-600 hover:decoration-cyan-400 ${result.winner === 'home' ? 'text-green-400 font-bold' : 'text-gray-300'}`}
                                >
                                  {match.home}
                                </button>
                                {getSeedBadge(match.home)}
                              </div>
                              {isLive && (result.homeLive > 0 || result.homeRemaining > 0) && (
                                <div className="text-[10px] flex items-center justify-end gap-2">
                                  {result.homeLive > 0 && (
                                    <span className="text-cyan-400">{result.homeLive} playing</span>
                                  )}
                                  {result.homeRemaining > 0 && (
                                    <span className="text-yellow-400">{result.homeRemaining} left</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <button 
                              onClick={() => handleH2HClick(match, gw)}
                              className="px-4 min-w-[100px] text-center hover:bg-slate-700/50 rounded-lg py-1 transition-colors cursor-pointer"
                              title="View Head-to-Head"
                            >
                              {result.status === 'live' ? (
                                <div>
                                  <div className="flex items-center justify-center gap-1 mb-0.5">
                                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                                    <span className="text-[10px] text-red-400 font-medium">LIVE</span>
                                  </div>
                                  <span className="font-bold text-cyan-400 text-lg">
                                    {result.homeScore} - {result.awayScore}
                                  </span>
                                  <div className="text-[9px] text-gray-500 mt-0.5">tap for H2H</div>
                                </div>
                              ) : result.status === 'today' ? (
                                <div>
                                  <span className="font-bold text-white text-lg">
                                    {result.homeScore} - {result.awayScore}
                                  </span>
                                  <div className="text-[9px] text-gray-500 mt-0.5">tap for H2H</div>
                                </div>
                              ) : result.status === 'completed' ? (
                                <div>
                                  <span className="font-bold text-white">
                                    {result.homeScore} - {result.awayScore}
                                  </span>
                                  <div className="text-[9px] text-gray-500 mt-0.5">tap for H2H</div>
                                </div>
                              ) : (
                                <span className="text-gray-500 text-sm">vs</span>
                              )}
                            </button>
                            <div className="flex-1 text-left">
                              <div className="flex items-center gap-1.5">
                                {getSeedBadge(match.away)}
                                <button 
                                  onClick={() => handleManagerClick(match.away, gw)}
                                  className={`text-sm hover:text-cyan-400 transition-colors underline decoration-slate-600 hover:decoration-cyan-400 ${result.winner === 'away' ? 'text-green-400 font-bold' : 'text-gray-300'}`}
                                >
                                  {match.away}
                                </button>
                              </div>
                              {isLive && (result.awayLive > 0 || result.awayRemaining > 0) && (
                                <div className="text-[10px] flex items-center gap-2">
                                  {result.awayLive > 0 && (
                                    <span className="text-cyan-400">{result.awayLive} playing</span>
                                  )}
                                  {result.awayRemaining > 0 && (
                                    <span className="text-yellow-400">{result.awayRemaining} left</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBracket = () => {
    const groupStageComplete = latestGameweek >= 28;
    const playInComplete = latestGameweek >= 29;
    const qfComplete = latestGameweek >= 30;
    const sfComplete = latestGameweek >= 31;
    
    // Get team by seed
    const getTeamBySeed = (seed) => {
      if (!groupStageComplete) return { name: `Seed ${seed}`, score: null };
      const team = knockoutSeedings.find(t => t.seed === seed);
      return { name: team?.name || `Seed ${seed}`, seed };
    };

    // Get live score for a team in a specific GW
    const getLiveScore = (teamName, gw) => {
      if (!teamName || teamName.startsWith('Seed ') || teamName.startsWith('Winner ')) return null;
      const gwManagers = gameweekData?.[gw] || [];
      const manager = gwManagers.find(m => m.manager_name === teamName);
      return manager ? {
        score: manager.total_points || 0,
        live: manager.players_live || 0
      } : null;
    };

    // Bracket match component with live scores
    const BracketMatch = ({ label, team1Name, team2Name, matchGw, isPlayIn = false, isFinal = false, onTeamClick }) => {
      const isCurrentRound = matchGw === latestGameweek;
      const isCompleted = matchGw < latestGameweek;
      const team1Score = getLiveScore(team1Name, matchGw);
      const team2Score = getLiveScore(team2Name, matchGw);
      const hasScores = team1Score !== null && team2Score !== null;
      const isLive = isCurrentRound && hasScores;
      
      // Determine winner
      let winner = null;
      if (hasScores && isCompleted) {
        winner = team1Score.score > team2Score.score ? 'team1' : (team2Score.score > team1Score.score ? 'team2' : null);
      }

      return (
        <div className={`rounded-lg border overflow-hidden w-52 ${
          isFinal ? 'bg-gradient-to-b from-yellow-900/30 to-amber-900/30 border-yellow-600/50' :
          isPlayIn ? 'bg-orange-900/30 border-orange-600/50' : 
          isLive ? 'bg-cyan-900/30 border-cyan-500' :
          'bg-slate-800 border-slate-700'
        }`}>
          <div className={`text-xs text-center py-1 flex items-center justify-center gap-1 ${
            isFinal ? 'bg-yellow-900/50 text-yellow-300' :
            isPlayIn ? 'bg-orange-900/50 text-orange-300' : 
            isLive ? 'bg-cyan-900/50 text-cyan-300' :
            'bg-slate-900 text-gray-500'
          }`}>
            {isLive && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
            {label}
            {isCompleted && <span className="ml-1 text-green-400">✓</span>}
          </div>
          <div className="p-2 space-y-1">
            {/* Team 1 */}
            <div className={`flex items-center justify-between rounded px-2 py-1.5 ${
              winner === 'team1' ? 'bg-green-900/50 border border-green-600/50' : 'bg-slate-900/50'
            }`}>
              <button 
                onClick={() => onTeamClick && team1Name && !team1Name.startsWith('Seed') && !team1Name.startsWith('Winner') && onTeamClick(team1Name, matchGw)}
                disabled={!team1Name || team1Name.startsWith('Seed') || team1Name.startsWith('Winner')}
                className={`text-xs truncate flex-1 text-left hover:text-cyan-400 transition-colors ${
                  !team1Name || team1Name.startsWith('Seed') || team1Name.startsWith('Winner') ? 'cursor-default' : 'cursor-pointer underline decoration-slate-600 hover:decoration-cyan-400'
                } ${winner === 'team1' ? 'text-green-400 font-bold' : 'text-gray-300'}`}
              >
                {team1Name}
              </button>
              {hasScores && (
                <span className={`text-sm font-bold ml-2 ${isLive ? 'text-cyan-400' : 'text-white'}`}>
                  {team1Score.score}
                </span>
              )}
            </div>
            {/* Team 2 */}
            <div className={`flex items-center justify-between rounded px-2 py-1.5 ${
              winner === 'team2' ? 'bg-green-900/50 border border-green-600/50' : 'bg-slate-900/50'
            }`}>
              <button 
                onClick={() => onTeamClick && team2Name && !team2Name.startsWith('Seed') && !team2Name.startsWith('Winner') && onTeamClick(team2Name, matchGw)}
                disabled={!team2Name || team2Name.startsWith('Seed') || team2Name.startsWith('Winner')}
                className={`text-xs truncate flex-1 text-left hover:text-cyan-400 transition-colors ${
                  !team2Name || team2Name.startsWith('Seed') || team2Name.startsWith('Winner') ? 'cursor-default' : 'cursor-pointer underline decoration-slate-600 hover:decoration-cyan-400'
                } ${winner === 'team2' ? 'text-green-400 font-bold' : 'text-gray-300'}`}
              >
                {team2Name}
              </button>
              {hasScores && (
                <span className={`text-sm font-bold ml-2 ${isLive ? 'text-cyan-400' : 'text-white'}`}>
                  {team2Score.score}
                </span>
              )}
            </div>
          </div>
        </div>
      );
    };

    // Get Play-In winners (for QF matchups)
    const getPlayInWinner = (matchId) => {
      if (!playInComplete) return `Winner ${matchId}`;
      const seeds = matchId === 'PI-A' ? [7, 10] : [8, 9];
      const team1 = getTeamBySeed(seeds[0]);
      const team2 = getTeamBySeed(seeds[1]);
      const score1 = getLiveScore(team1.name, 29);
      const score2 = getLiveScore(team2.name, 29);
      if (score1 && score2) {
        return score1.score > score2.score ? team1.name : team2.name;
      }
      return `Winner ${matchId}`;
    };

    // Get QF winners (for SF matchups)
    const getQFWinner = (qfNum) => {
      if (!qfComplete) return `Winner QF${qfNum}`;
      // This would need actual QF matchup tracking - simplified for now
      return `Winner QF${qfNum}`;
    };

    return (
      <div className="space-y-4">
        {!groupStageComplete && (
          <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-3 text-amber-200 text-sm">
            <strong>Group Stage in Progress</strong> - Bracket will update after GW28.
          </div>
        )}

        {/* Bracket Visualization */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start justify-center gap-4 min-w-[950px]">
            
            {/* Play-In */}
            <div className="space-y-3">
              <h4 className={`text-center text-sm mb-2 flex items-center justify-center gap-1 ${
                latestGameweek === 29 ? 'text-cyan-400 font-bold' : 'text-orange-400'
              }`}>
                <Zap size={14} /> Play-In (GW29)
                {latestGameweek === 29 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1"></span>}
              </h4>
              <BracketMatch 
                label="PI-A: 7 vs 10" 
                team1Name={getTeamBySeed(7).name}
                team2Name={getTeamBySeed(10).name}
                matchGw={29}
                isPlayIn={true}
                onTeamClick={handleManagerClick}
              />
              <BracketMatch 
                label="PI-B: 8 vs 9" 
                team1Name={getTeamBySeed(8).name}
                team2Name={getTeamBySeed(9).name}
                matchGw={29}
                isPlayIn={true}
                onTeamClick={handleManagerClick}
              />
              <div className="text-center text-xs text-gray-500 mt-2">
                Seeds 1-6 have BYE
              </div>
            </div>

            <ChevronRight className="text-gray-600 mt-16" size={24} />

            {/* Quarterfinals */}
            <div className="space-y-3">
              <h4 className={`text-center text-sm mb-2 ${
                latestGameweek === 30 ? 'text-cyan-400 font-bold' : 'text-gray-400'
              }`}>
                Quarterfinals (GW30)
                {latestGameweek === 30 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1 inline-block"></span>}
              </h4>
              <BracketMatch 
                label="QF1" 
                team1Name={getTeamBySeed(1).name}
                team2Name={getPlayInWinner('PI-B')}
                matchGw={30}
                onTeamClick={handleManagerClick}
              />
              <BracketMatch 
                label="QF2" 
                team1Name={getTeamBySeed(4).name}
                team2Name={getTeamBySeed(5).name}
                matchGw={30}
                onTeamClick={handleManagerClick}
              />
              <BracketMatch 
                label="QF3" 
                team1Name={getTeamBySeed(2).name}
                team2Name={getPlayInWinner('PI-A')}
                matchGw={30}
                onTeamClick={handleManagerClick}
              />
              <BracketMatch 
                label="QF4" 
                team1Name={getTeamBySeed(3).name}
                team2Name={getTeamBySeed(6).name}
                matchGw={30}
                onTeamClick={handleManagerClick}
              />
            </div>

            <ChevronRight className="text-gray-600 mt-24" size={24} />

            {/* Semifinals */}
            <div className="space-y-3 mt-12">
              <h4 className={`text-center text-sm mb-2 ${
                latestGameweek === 31 ? 'text-cyan-400 font-bold' : 'text-gray-400'
              }`}>
                Semifinals (GW31)
                {latestGameweek === 31 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1 inline-block"></span>}
              </h4>
              <BracketMatch 
                label="SF1" 
                team1Name={getQFWinner(1)}
                team2Name={getQFWinner(2)}
                matchGw={31}
                onTeamClick={handleManagerClick}
              />
              <div className="h-8"></div>
              <BracketMatch 
                label="SF2" 
                team1Name={getQFWinner(3)}
                team2Name={getQFWinner(4)}
                matchGw={31}
                onTeamClick={handleManagerClick}
              />
            </div>

            <ChevronRight className="text-gray-600 mt-24" size={24} />

            {/* Final */}
            <div className="space-y-3 mt-20">
              <h4 className={`text-center text-sm mb-2 ${
                latestGameweek === 32 ? 'text-cyan-400 font-bold' : 'text-gray-400'
              }`}>
                Final (GW32)
                {latestGameweek === 32 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse ml-1 inline-block"></span>}
              </h4>
              <BracketMatch 
                label="🏆 FINAL"
                team1Name={sfComplete ? "Winner SF1" : "Winner SF1"}
                team2Name={sfComplete ? "Winner SF2" : "Winner SF2"}
                matchGw={32}
                isFinal={true}
                onTeamClick={handleManagerClick}
              />
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-600 via-amber-600 to-yellow-700 rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <Trophy size={32} className="text-yellow-200" />
          <div>
            <h1 className="text-2xl font-bold text-white">BPL Mid-Season Cup</h1>
            <p className="text-yellow-200 text-sm">
              5 Groups • Play-In • 8 Team Knockout
            </p>
          </div>
        </div>
      </div>

      {/* Current Phase */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <Calendar size={16} className="text-gray-400" />
        <span className="text-gray-400">Current Phase:</span>
        <span className="text-cyan-400 font-medium capitalize">{currentPhase}</span>
        {latestGameweek && <span className="text-gray-500">• GW{latestGameweek}</span>}
      </div>

      {/* Schedule Overview */}
      <div className="flex gap-2 text-xs flex-wrap">
        {[
          { label: 'Groups', gws: '26-28', active: currentPhase === 'groups' },
          { label: 'Play-In', gws: '29', active: currentPhase === 'play-in' },
          { label: 'QF', gws: '30', active: currentPhase === 'quarterfinals' },
          { label: 'SF', gws: '31', active: currentPhase === 'semifinals' },
          { label: 'Final', gws: '32', active: currentPhase === 'final' },
        ].map(phase => (
          <div 
            key={phase.label}
            className={`px-3 py-1 rounded-full ${
              phase.active 
                ? 'bg-cyan-500 text-black font-medium' 
                : 'bg-slate-800 text-gray-400'
            }`}
          >
            {phase.label} <span className="opacity-70">GW{phase.gws}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 pb-2 overflow-x-auto">
        {[
          { id: 'groups', label: 'Groups', icon: Users },
          { id: 'fixtures', label: 'Fixtures', icon: Calendar },
          { id: 'bracket', label: 'Bracket', icon: Trophy }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all whitespace-nowrap ${
              selectedTab === tab.id
                ? 'bg-slate-800 text-cyan-400 border-b-2 border-cyan-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {selectedTab === 'groups' && (
        <div className="space-y-4">
          {isGroupStageLive && (
            <div className="bg-cyan-900/20 border border-cyan-600/30 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              <span className="text-cyan-400 font-medium text-sm">Live Standings</span>
              <span className="text-gray-400 text-sm">• Updates as GW{latestGameweek} scores change</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {['A', 'B', 'C', 'D', 'E'].map(g => (
              <div key={g}>{renderGroupTable(g)}</div>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'fixtures' && renderFixtures()}
      {selectedTab === 'bracket' && renderBracket()}

      {/* Legend */}
      <div className="bg-slate-800/30 rounded-lg p-4 text-xs text-gray-500">
        <strong className="text-gray-400">Format:</strong> 5 Groups of 4 → Top 2 qualify (10 teams) → Seeds 7-10 play Play-In → 8 teams for Quarterfinals •
        <strong className="text-gray-400 ml-2">Scoring:</strong> Win = 3 pts, Draw = 1 pt
      </div>

      {/* Manager Team Modal */}
      {selectedManager && (
        <PlayerDetailsModal 
          manager={selectedManager} 
          onClose={handleCloseModal} 
          filterType="all" 
          fixtureData={fixtureData || { fixtures: [], teamMap: {}, playerTeamMap: {} }} 
          gameweekData={gameweekData} 
          onPlayerClick={(player) => setSelectedPlayer(player)}
          projectionsLookup={projectionsLookup || {}}
        />
      )}
      {selectedPlayer && (
        <PlayerStatsModal 
          elementId={selectedPlayer.element_id} 
          playerName={selectedPlayer.name} 
          currentGameweek={selectedManager?.gameweek || h2hMatch?.gameweek} 
          onClose={() => setSelectedPlayer(null)} 
        />
      )}

      {/* H2H Match Modal */}
      {h2hMatch && (
        <H2HModal 
          match={h2hMatch}
          onClose={handleCloseH2H}
          onPlayerClick={(player) => setSelectedPlayer(player)}
          fixtureData={fixtureData}
          managerSeeds={managerSeeds}
        />
      )}
    </div>
  );
};

// Head-to-Head Modal Component
const H2HModal = ({ match, onClose, onPlayerClick, fixtureData, managerSeeds = {} }) => {
  const { home, away, gameweek } = match;
  
  const getSeedBadge = (managerName) => {
    const seed = managerSeeds[managerName];
    if (!seed) return null;
    return (
      <span className="text-xs bg-slate-700 text-gray-300 px-1.5 py-0.5 rounded-full font-mono">
        #{seed}
      </span>
    );
  };
  
  const getPositionOrder = (pos) => {
    const order = { GK: 1, DEF: 2, MID: 3, FWD: 4 };
    return order[pos] || 5;
  };

  const getPositionColor = (pos) => {
    const colors = { GK: 'text-yellow-400', DEF: 'text-blue-400', MID: 'text-green-400', FWD: 'text-red-400' };
    return colors[pos] || 'text-gray-400';
  };

  const getPositionBg = (pos) => {
    const colors = { GK: 'bg-yellow-500/10', DEF: 'bg-blue-500/10', MID: 'bg-green-500/10', FWD: 'bg-red-500/10' };
    return colors[pos] || 'bg-gray-500/10';
  };

  // Sort players by position and then by points
  const sortPlayers = (players) => {
    return [...(players || [])].sort((a, b) => {
      if (a.multiplier === 0 && b.multiplier > 0) return 1;
      if (a.multiplier > 0 && b.multiplier === 0) return -1;
      const posOrder = getPositionOrder(a.position) - getPositionOrder(b.position);
      if (posOrder !== 0) return posOrder;
      return (b.points_applied || 0) - (a.points_applied || 0);
    });
  };

  // Build aligned rows by position: GK, DEF, MID, FWD - with common players in same row
  const buildAlignedRowsByPosition = (homePlayers, awayPlayers) => {
    const positions = ['GK', 'DEF', 'MID', 'FWD'];
    const allRows = [];

    positions.forEach(pos => {
      const homeInPos = (homePlayers || []).filter(p => p.position === pos);
      const awayInPos = (awayPlayers || []).filter(p => p.position === pos);
      const usedAwayIndices = new Set();
      const posRows = [];

      // First: find and pair common players in this position
      homeInPos.forEach(homePlayer => {
        const awayIdx = awayInPos.findIndex((awayPlayer, idx) => 
          !usedAwayIndices.has(idx) && 
          (awayPlayer.element_id === homePlayer.element_id || awayPlayer.name === homePlayer.name)
        );
        
        if (awayIdx !== -1) {
          usedAwayIndices.add(awayIdx);
          posRows.push({ 
            home: homePlayer, 
            away: awayInPos[awayIdx], 
            isCommon: true,
            position: pos
          });
        }
      });

      // Get remaining unique players for this position
      const remainingHome = homeInPos.filter(hp => 
        !posRows.some(r => r.home?.element_id === hp.element_id || r.home?.name === hp.name)
      );
      const remainingAway = awayInPos.filter((_, idx) => !usedAwayIndices.has(idx));

      // Sort remaining by points
      remainingHome.sort((a, b) => (b.points_applied || 0) - (a.points_applied || 0));
      remainingAway.sort((a, b) => (b.points_applied || 0) - (a.points_applied || 0));

      // Pair up remaining (unique) players
      const maxRemaining = Math.max(remainingHome.length, remainingAway.length);
      for (let i = 0; i < maxRemaining; i++) {
        posRows.push({
          home: remainingHome[i] || null,
          away: remainingAway[i] || null,
          isCommon: false,
          position: pos
        });
      }

      // Add all rows for this position (common first, then unique)
      posRows.sort((a, b) => {
        if (a.isCommon && !b.isCommon) return -1;
        if (!a.isCommon && b.isCommon) return 1;
        return 0;
      });

      allRows.push(...posRows);
    });

    return allRows;
  };

  const homeStartersRaw = home.players?.filter(p => p.multiplier >= 1) || [];
  const awayStartersRaw = away.players?.filter(p => p.multiplier >= 1) || [];
  const homeBenchRaw = home.players?.filter(p => p.multiplier === 0) || [];
  const awayBenchRaw = away.players?.filter(p => p.multiplier === 0) || [];

  const starterRows = buildAlignedRowsByPosition(homeStartersRaw, awayStartersRaw);
  const benchRows = buildAlignedRowsByPosition(homeBenchRaw, awayBenchRaw);

  const homeTotal = home.total_points || 0;
  const awayTotal = away.total_points || 0;
  const isLive = home.players?.some(p => p.fixture_started && !p.fixture_finished) || 
                 away.players?.some(p => p.fixture_started && !p.fixture_finished);

  const renderPlayer = (player, side) => {
    if (!player) return <div className="h-10" />;
    
    const isCaptain = player.is_captain;
    const isVice = player.is_vice_captain;
    const isPlaying = player.fixture_started && !player.fixture_finished;
    const isFinished = player.fixture_finished;
    const points = player.multiplier === 0 ? player.points_gw : player.points_applied;

    return (
      <button
        onClick={() => onPlayerClick(player)}
        className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors hover:bg-slate-700/50 ${
          side === 'home' ? 'flex-row' : 'flex-row-reverse'
        } ${getPositionBg(player.position)}`}
      >
        <div className={`flex-1 ${side === 'home' ? 'text-left' : 'text-right'}`}>
          <div className="flex items-center gap-1" style={{ flexDirection: side === 'home' ? 'row' : 'row-reverse' }}>
            <span className={`text-[10px] font-bold ${getPositionColor(player.position)}`}>
              {player.position}
            </span>
            <span className={`text-xs truncate ${isPlaying ? 'text-cyan-300' : 'text-gray-200'}`}>
              {player.name}
              {isCaptain && <span className="ml-1 text-yellow-400 font-bold">(C)</span>}
              {isVice && <span className="ml-1 text-gray-400">(V)</span>}
            </span>
          </div>
          <div className={`text-[9px] text-gray-500 ${side === 'home' ? 'text-left' : 'text-right'}`}>
            {player.team}
          </div>
        </div>
        <div className={`flex items-center gap-1 ${side === 'home' ? 'flex-row' : 'flex-row-reverse'}`}>
          {isPlaying && (
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
          )}
          <span className={`text-sm font-bold min-w-[24px] ${
            isPlaying ? 'text-cyan-400' : 
            isFinished ? 'text-white' : 
            'text-gray-500'
          } ${side === 'home' ? 'text-right' : 'text-left'}`}>
            {player.fixture_started ? points : '-'}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 p-4 border-b border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400">GW{gameweek} • Head-to-Head</span>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">×</button>
          </div>
          
          {/* Score Display */}
          <div className="flex items-center justify-center gap-4">
            <div className="text-right flex-1">
              <div className="flex items-center justify-end gap-2">
                <p className="text-white font-bold text-lg truncate">{home.manager_name}</p>
                {getSeedBadge(home.manager_name)}
              </div>
              <p className="text-gray-500 text-xs truncate">{home.team_name}</p>
            </div>
            <div className="flex items-center gap-3 px-4">
              <span className={`text-3xl font-black ${homeTotal > awayTotal ? 'text-green-400' : homeTotal < awayTotal ? 'text-red-400' : 'text-white'}`}>
                {homeTotal}
              </span>
              <div className="flex flex-col items-center">
                {isLive && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mb-1"></span>
                )}
                <span className="text-gray-500 text-sm">-</span>
              </div>
              <span className={`text-3xl font-black ${awayTotal > homeTotal ? 'text-green-400' : awayTotal < homeTotal ? 'text-red-400' : 'text-white'}`}>
                {awayTotal}
              </span>
            </div>
            <div className="text-left flex-1">
              <div className="flex items-center gap-2">
                {getSeedBadge(away.manager_name)}
                <p className="text-white font-bold text-lg truncate">{away.manager_name}</p>
              </div>
              <p className="text-gray-500 text-xs truncate">{away.team_name}</p>
            </div>
          </div>
        </div>

        {/* Players Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {/* Starting XI */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Starting XI</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Starting XI</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              {starterRows.map((row, idx) => (
                <React.Fragment key={idx}>
                  <div className={row.isCommon ? 'ring-1 ring-purple-500/30 rounded-lg' : ''}>
                    {renderPlayer(row.home, 'home')}
                  </div>
                  <div className={row.isCommon ? 'ring-1 ring-purple-500/30 rounded-lg' : ''}>
                    {renderPlayer(row.away, 'away')}
                  </div>
                </React.Fragment>
              ))}
            </div>
            {starterRows.some(r => r.isCommon) && (
              <div className="text-center mt-2">
                <span className="text-[9px] text-purple-400">
                  ⚡ Purple highlight = both managers own this player
                </span>
              </div>
            )}
          </div>

          {/* Bench */}
          <div className="border-t border-slate-700/50 pt-3">
            <div className="flex items-center justify-between mb-2 px-2">
              <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Bench</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-600 font-bold">Bench</span>
            </div>
            <div className="grid grid-cols-2 gap-1 opacity-60">
              {benchRows.map((row, idx) => (
                <React.Fragment key={idx}>
                  <div className={row.isCommon ? 'ring-1 ring-purple-500/30 rounded-lg' : ''}>
                    {renderPlayer(row.home, 'home')}
                  </div>
                  <div className={row.isCommon ? 'ring-1 ring-purple-500/30 rounded-lg' : ''}>
                    {renderPlayer(row.away, 'away')}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Stats */}
        <div className="bg-slate-800/50 border-t border-slate-700 p-3">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="flex items-center justify-around">
              <div>
                <p className="text-cyan-400 font-bold">{home.players?.filter(p => p.multiplier >= 1 && p.fixture_started && !p.fixture_finished).length || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Playing</p>
              </div>
              <div>
                <p className="text-yellow-400 font-bold">{home.players?.filter(p => p.multiplier >= 1 && !p.fixture_started).length || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Left</p>
              </div>
              <div>
                <p className="text-gray-400 font-bold">{home.bench_points || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Bench</p>
              </div>
            </div>
            <div className="flex items-center justify-around">
              <div>
                <p className="text-gray-400 font-bold">{away.bench_points || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Bench</p>
              </div>
              <div>
                <p className="text-yellow-400 font-bold">{away.players?.filter(p => p.multiplier >= 1 && !p.fixture_started).length || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Left</p>
              </div>
              <div>
                <p className="text-cyan-400 font-bold">{away.players?.filter(p => p.multiplier >= 1 && p.fixture_started && !p.fixture_finished).length || 0}</p>
                <p className="text-[9px] text-gray-500 uppercase">Playing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FPLCup;
