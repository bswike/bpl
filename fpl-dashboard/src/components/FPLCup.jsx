import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Calendar, ChevronRight, Star, Zap } from 'lucide-react';

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
  const { gameweekData, latestGameweek } = useData();
  const [selectedTab, setSelectedTab] = useState('groups');
  const [selectedGroup, setSelectedGroup] = useState('A');

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
    const homeLivePlayers = homeData.players_live || 0;
    const awayLivePlayers = awayData.players_live || 0;
    const hasLivePlayers = homeLivePlayers > 0 || awayLivePlayers > 0;

    return {
      status: isLive ? (hasLivePlayers ? 'live' : 'today') : 'completed',
      homeScore,
      awayScore,
      homeLive: homeLivePlayers,
      awayLive: awayLivePlayers,
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
                      <div className="flex items-center gap-2">
                        {idx === 0 && <Star size={14} className="text-yellow-400" />}
                        <span className={qualifies ? 'text-white font-medium' : 'text-gray-300'}>
                          {team.name}
                        </span>
                      </div>
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
    const fixtures = CUP_CONFIG.fixtures[selectedGroup] || [];
    
    return (
      <div className="space-y-4">
        <div className="flex gap-2 mb-4 flex-wrap">
          {['A', 'B', 'C', 'D', 'E'].map(g => (
            <button
              key={g}
              onClick={() => setSelectedGroup(g)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedGroup === g 
                  ? `bg-gradient-to-r ${GROUP_COLORS[g]} text-white` 
                  : 'bg-slate-800 text-gray-400 hover:bg-slate-700'
              }`}
            >
              Group {g}
            </button>
          ))}
        </div>

        {fixtures.map((matchday, idx) => {
          const isCurrentGW = matchday.gameweek === latestGameweek;
          const isPast = matchday.gameweek < latestGameweek;
          
          return (
            <div 
              key={matchday.gameweek}
              className={`bg-slate-800/50 rounded-xl border ${
                isCurrentGW ? 'border-cyan-500' : 'border-slate-700'
              } overflow-hidden`}
            >
              <div className={`px-4 py-2 ${isCurrentGW ? 'bg-cyan-900/30' : 'bg-slate-900/50'} flex justify-between items-center`}>
                <span className="text-sm font-medium text-gray-300">
                  Matchday {idx + 1} • GW{matchday.gameweek}
                </span>
                {isCurrentGW && (
                  <span className="text-xs bg-cyan-500 text-black px-2 py-0.5 rounded-full font-medium">
                    LIVE
                  </span>
                )}
                {isPast && (
                  <span className="text-xs text-green-400">✓ Completed</span>
                )}
              </div>
              
              <div className="p-4 space-y-3">
                {matchday.matches.map((match, mIdx) => {
                  const result = getMatchResult(match, matchday.gameweek);
                  const isLive = result.status === 'live' || result.status === 'today';
                  
                  return (
                    <div 
                      key={mIdx}
                      className={`flex items-center justify-between rounded-lg p-3 ${
                        isLive ? 'bg-cyan-900/20 border border-cyan-600/30' : 'bg-slate-900/50'
                      }`}
                    >
                      <div className="flex-1 text-right">
                        <div className={`text-sm ${result.winner === 'home' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                          {match.home}
                        </div>
                        {isLive && result.homeLive > 0 && (
                          <div className="text-[10px] text-cyan-400">
                            {result.homeLive} playing
                          </div>
                        )}
                      </div>
                      <div className="px-4 min-w-[100px] text-center">
                        {result.status === 'live' ? (
                          <div>
                            <div className="flex items-center justify-center gap-1 mb-0.5">
                              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                              <span className="text-[10px] text-red-400 font-medium">LIVE</span>
                            </div>
                            <span className="font-bold text-cyan-400 text-lg">
                              {result.homeScore} - {result.awayScore}
                            </span>
                          </div>
                        ) : result.status === 'today' ? (
                          <div>
                            <span className="font-bold text-white text-lg">
                              {result.homeScore} - {result.awayScore}
                            </span>
                          </div>
                        ) : result.status === 'completed' ? (
                          <span className="font-bold text-white">
                            {result.homeScore} - {result.awayScore}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">vs</span>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <div className={`text-sm ${result.winner === 'away' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                          {match.away}
                        </div>
                        {isLive && result.awayLive > 0 && (
                          <div className="text-[10px] text-cyan-400">
                            {result.awayLive} playing
                          </div>
                        )}
                      </div>
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
    const BracketMatch = ({ label, team1Name, team2Name, matchGw, isPlayIn = false, isFinal = false }) => {
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
              <span className={`text-xs truncate flex-1 ${winner === 'team1' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                {team1Name}
              </span>
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
              <span className={`text-xs truncate flex-1 ${winner === 'team2' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                {team2Name}
              </span>
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
              />
              <BracketMatch 
                label="PI-B: 8 vs 9" 
                team1Name={getTeamBySeed(8).name}
                team2Name={getTeamBySeed(9).name}
                matchGw={29}
                isPlayIn={true}
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
              />
              <BracketMatch 
                label="QF2" 
                team1Name={getTeamBySeed(4).name}
                team2Name={getTeamBySeed(5).name}
                matchGw={30}
              />
              <BracketMatch 
                label="QF3" 
                team1Name={getTeamBySeed(2).name}
                team2Name={getPlayInWinner('PI-A')}
                matchGw={30}
              />
              <BracketMatch 
                label="QF4" 
                team1Name={getTeamBySeed(3).name}
                team2Name={getTeamBySeed(6).name}
                matchGw={30}
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
              />
              <div className="h-8"></div>
              <BracketMatch 
                label="SF2" 
                team1Name={getQFWinner(3)}
                team2Name={getQFWinner(4)}
                matchGw={31}
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
    </div>
  );
};

export default FPLCup;
