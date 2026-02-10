import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Calendar, ChevronRight, Star, Medal } from 'lucide-react';

// Cup configuration - 5 Groups of 4
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
    quarterfinals: 29,
    semifinals: 30,
    final: 31
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
  const { gwData, latestGameweek } = useData();
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
        const gwManagers = gwData?.[gw] || [];

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
  }, [gwData]);

  // Get all runners-up sorted to find best 3
  const bestRunnersUp = useMemo(() => {
    const runnersUp = [];
    Object.entries(groupStandings).forEach(([group, standings]) => {
      if (standings.length >= 2) {
        runnersUp.push({ ...standings[1], group });
      }
    });
    return runnersUp.sort((a, b) => {
      if (b.cup_points !== a.cup_points) return b.cup_points - a.cup_points;
      return b.points_for - a.points_for;
    });
  }, [groupStandings]);

  // Get match result for display
  const getMatchResult = (match, gw) => {
    const gwManagers = gwData?.[gw] || [];
    const homeData = gwManagers.find(m => m.manager_name === match.home);
    const awayData = gwManagers.find(m => m.manager_name === match.away);
    
    if (!homeData || !awayData) {
      return { status: 'upcoming', homeScore: null, awayScore: null };
    }

    const homeScore = homeData.total_points || 0;
    const awayScore = awayData.total_points || 0;

    return {
      status: 'completed',
      homeScore,
      awayScore,
      winner: homeScore > awayScore ? 'home' : (awayScore > homeScore ? 'away' : 'draw')
    };
  };

  const currentPhase = useMemo(() => {
    if (!latestGameweek) return 'upcoming';
    if (latestGameweek < 26) return 'upcoming';
    if (latestGameweek <= 28) return 'groups';
    if (latestGameweek === 29) return 'quarterfinals';
    if (latestGameweek === 30) return 'semifinals';
    if (latestGameweek >= 31) return 'final';
    return 'groups';
  }, [latestGameweek]);

  const renderGroupTable = (groupName) => {
    const standings = groupStandings[groupName] || [];
    
    // Check if this runner-up qualifies
    const qualifyingRunnersUp = bestRunnersUp.slice(0, 3).map(r => r.name);
    
    return (
      <div className="bg-slate-800/50 rounded-xl overflow-hidden border border-slate-700">
        <div className={`bg-gradient-to-r ${GROUP_COLORS[groupName]} px-4 py-3`}>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            <Users size={18} />
            Group {groupName}
          </h3>
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
                const isWinner = idx === 0;
                const isRunnerUp = idx === 1;
                const qualifiesAsRunnerUp = isRunnerUp && qualifyingRunnersUp.includes(team.name);
                const qualifies = isWinner || qualifiesAsRunnerUp;
                
                return (
                  <tr 
                    key={team.name}
                    className={`border-b border-slate-700/50 ${
                      qualifies ? 'bg-green-900/20' : ''
                    }`}
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
                        {isWinner && <Star size={14} className="text-yellow-400" />}
                        {qualifiesAsRunnerUp && <Medal size={14} className="text-cyan-400" />}
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
        <div className="px-3 py-2 bg-slate-900/50 text-xs text-gray-500 flex gap-4">
          <span><Star size={10} className="inline text-yellow-400 mr-1" />Group Winner</span>
          <span><Medal size={10} className="inline text-cyan-400 mr-1" />Best Runner-up</span>
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
                  
                  return (
                    <div 
                      key={mIdx}
                      className="flex items-center justify-between bg-slate-900/50 rounded-lg p-3"
                    >
                      <div className={`flex-1 text-right text-sm ${result.winner === 'home' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                        {match.home}
                      </div>
                      <div className="px-4 min-w-[80px] text-center">
                        {result.status === 'completed' ? (
                          <span className="font-bold text-white">
                            {result.homeScore} - {result.awayScore}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-sm">vs</span>
                        )}
                      </div>
                      <div className={`flex-1 text-left text-sm ${result.winner === 'away' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                        {match.away}
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
    
    // Get qualified teams
    const getQualifiedTeams = () => {
      const winners = {};
      const runnersUp = [];
      
      Object.entries(groupStandings).forEach(([group, standings]) => {
        if (standings.length >= 1) {
          winners[group] = standings[0]?.name || `${group}1`;
        }
        if (standings.length >= 2) {
          runnersUp.push({ name: standings[1]?.name, group, ...standings[1] });
        }
      });
      
      // Sort runners-up to find best 3
      runnersUp.sort((a, b) => {
        if (b.cup_points !== a.cup_points) return b.cup_points - a.cup_points;
        return b.points_for - a.points_for;
      });
      
      return { winners, bestRunnersUp: runnersUp.slice(0, 3) };
    };

    const { winners, bestRunnersUp: qualifiedRU } = getQualifiedTeams();

    return (
      <div className="space-y-6">
        {!groupStageComplete && (
          <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-4 text-amber-200 text-sm">
            <strong>Group Stage in Progress</strong> - Bracket will update after GW28.
          </div>
        )}

        {/* Qualification Summary */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-400" />
            Knockout Qualifiers (8 Teams)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Group Winners (5)</h4>
              <div className="space-y-1">
                {['A', 'B', 'C', 'D', 'E'].map(g => (
                  <div key={g} className="flex items-center gap-2 text-sm">
                    <Star size={12} className="text-yellow-400" />
                    <span className={`px-2 py-0.5 rounded text-xs bg-gradient-to-r ${GROUP_COLORS[g]} text-white`}>
                      {g}
                    </span>
                    <span className="text-white">
                      {groupStageComplete ? winners[g] : `${g}1`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Best Runners-Up (3)</h4>
              <div className="space-y-1">
                {groupStageComplete ? (
                  qualifiedRU.map((ru, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Medal size={12} className="text-cyan-400" />
                      <span className={`px-2 py-0.5 rounded text-xs bg-gradient-to-r ${GROUP_COLORS[ru.group]} text-white`}>
                        {ru.group}
                      </span>
                      <span className="text-white">{ru.name}</span>
                      <span className="text-gray-500 text-xs">({ru.cup_points}pts, {ru.points_for}PF)</span>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm italic">TBD after group stage</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bracket Visualization */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-center justify-center gap-6 min-w-[700px]">
            {/* Quarterfinals */}
            <div className="space-y-3">
              <h4 className="text-center text-gray-400 text-sm mb-2">Quarterfinals (GW29)</h4>
              {[1, 2, 3, 4].map(qf => (
                <div key={qf} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden w-44">
                  <div className="text-xs text-center py-1 bg-slate-900 text-gray-500">QF{qf}</div>
                  <div className="p-2 space-y-1">
                    <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-400 truncate">
                      {groupStageComplete ? (qf <= 5 ? winners[['A', 'B', 'C', 'D', 'E'][qf-1]] : 'TBD') : `Seed ${qf}`}
                    </div>
                    <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-400 truncate">
                      {groupStageComplete && qualifiedRU[qf-1] ? qualifiedRU[qf > 3 ? qf - 4 : qf - 1]?.name : 'TBD'}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <ChevronRight className="text-gray-600" size={24} />

            {/* Semifinals */}
            <div className="space-y-3">
              <h4 className="text-center text-gray-400 text-sm mb-2">Semifinals (GW30)</h4>
              <div className="space-y-6">
                {[1, 2].map(sf => (
                  <div key={sf} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden w-44">
                    <div className="text-xs text-center py-1 bg-slate-900 text-gray-500">SF{sf}</div>
                    <div className="p-2 space-y-1">
                      <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-500 truncate">Winner QF{sf * 2 - 1}</div>
                      <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-500 truncate">Winner QF{sf * 2}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <ChevronRight className="text-gray-600" size={24} />

            {/* Final */}
            <div className="space-y-3">
              <h4 className="text-center text-gray-400 text-sm mb-2">Final (GW31)</h4>
              <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg overflow-hidden w-48 shadow-lg shadow-yellow-900/30">
                <div className="text-xs text-center py-1 bg-yellow-900/50 text-yellow-200 flex items-center justify-center gap-1">
                  <Trophy size={12} /> FINAL
                </div>
                <div className="p-3 space-y-2 bg-slate-900/80">
                  <div className="bg-slate-800 rounded px-2 py-1.5 text-xs text-gray-400 truncate text-center">Winner SF1</div>
                  <div className="bg-slate-800 rounded px-2 py-1.5 text-xs text-gray-400 truncate text-center">Winner SF2</div>
                </div>
              </div>
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
              5 Groups • 8 Team Knockout • GW26-31
            </p>
          </div>
        </div>
      </div>

      {/* Current Phase */}
      <div className="flex items-center gap-2 text-sm">
        <Calendar size={16} className="text-gray-400" />
        <span className="text-gray-400">Current Phase:</span>
        <span className="text-cyan-400 font-medium capitalize">{currentPhase}</span>
        {latestGameweek && <span className="text-gray-500">• GW{latestGameweek}</span>}
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
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {['A', 'B', 'C', 'D', 'E'].map(g => (
            <div key={g}>{renderGroupTable(g)}</div>
          ))}
        </div>
      )}

      {selectedTab === 'fixtures' && renderFixtures()}
      {selectedTab === 'bracket' && renderBracket()}

      {/* Legend */}
      <div className="bg-slate-800/30 rounded-lg p-4 text-xs text-gray-500">
        <strong className="text-gray-400">Format:</strong> 5 Groups of 4 → 5 Winners + 3 Best Runners-Up = 8 Teams for Knockout •
        <strong className="text-gray-400 ml-2">Scoring:</strong> Win = 3 pts, Draw = 1 pt •
        <strong className="text-gray-400 ml-2">Tiebreaker:</strong> Points For, then Goal Difference
      </div>
    </div>
  );
};

export default FPLCup;
