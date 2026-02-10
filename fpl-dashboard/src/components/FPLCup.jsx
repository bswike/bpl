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
    if (latestGameweek === 29) return 'play-in';
    if (latestGameweek === 30) return 'quarterfinals';
    if (latestGameweek === 31) return 'semifinals';
    if (latestGameweek >= 32) return 'final';
    return 'groups';
  }, [latestGameweek]);

  const renderGroupTable = (groupName) => {
    const standings = groupStandings[groupName] || [];
    
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
    
    // Get team by seed
    const getTeamBySeed = (seed) => {
      if (!groupStageComplete) return `Seed ${seed}`;
      const team = knockoutSeedings.find(t => t.seed === seed);
      return team?.name || `Seed ${seed}`;
    };

    const BracketMatch = ({ label, team1, team2, round, isPlayIn = false }) => (
      <div className={`rounded-lg border overflow-hidden w-48 ${
        isPlayIn ? 'bg-orange-900/30 border-orange-600/50' : 'bg-slate-800 border-slate-700'
      }`}>
        <div className={`text-xs text-center py-1 ${isPlayIn ? 'bg-orange-900/50 text-orange-300' : 'bg-slate-900 text-gray-500'}`}>
          {label}
        </div>
        <div className="p-2 space-y-1">
          <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-300 truncate">{team1}</div>
          <div className="bg-slate-900/50 rounded px-2 py-1.5 text-xs text-gray-300 truncate">{team2}</div>
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        {!groupStageComplete && (
          <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-4 text-amber-200 text-sm">
            <strong>Group Stage in Progress</strong> - Bracket will update after GW28.
          </div>
        )}

        {/* Knockout Seedings */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy size={20} className="text-yellow-400" />
            Knockout Qualifiers (10 Teams)
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {(groupStageComplete ? knockoutSeedings : Array(10).fill(null)).map((team, idx) => {
              const seed = idx + 1;
              const isPlayIn = seed >= 7;
              const hasBye = seed <= 6;
              
              return (
                <div 
                  key={idx}
                  className={`p-2 rounded-lg text-center ${
                    isPlayIn ? 'bg-orange-900/30 border border-orange-600/30' : 
                    'bg-green-900/20 border border-green-600/30'
                  }`}
                >
                  <div className={`text-xs font-bold ${isPlayIn ? 'text-orange-400' : 'text-green-400'}`}>
                    Seed {seed}
                  </div>
                  <div className="text-sm text-white truncate mt-1">
                    {team?.name || 'TBD'}
                  </div>
                  {team && (
                    <div className="text-xs text-gray-500">
                      {team.cup_points}pts • Grp {team.group}
                    </div>
                  )}
                  <div className={`text-[10px] mt-1 ${isPlayIn ? 'text-orange-400' : 'text-green-400'}`}>
                    {isPlayIn ? '⚡ Play-In' : '✓ Bye to QF'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bracket Visualization */}
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start justify-center gap-4 min-w-[900px]">
            
            {/* Play-In */}
            <div className="space-y-3">
              <h4 className="text-center text-orange-400 text-sm mb-2 flex items-center justify-center gap-1">
                <Zap size={14} /> Play-In (GW29)
              </h4>
              <BracketMatch 
                label="PI-A: 7 vs 10" 
                team1={getTeamBySeed(7)} 
                team2={getTeamBySeed(10)}
                isPlayIn={true}
              />
              <BracketMatch 
                label="PI-B: 8 vs 9" 
                team1={getTeamBySeed(8)} 
                team2={getTeamBySeed(9)}
                isPlayIn={true}
              />
              <div className="text-center text-xs text-gray-500 mt-2">
                Seeds 1-6 have BYE
              </div>
            </div>

            <ChevronRight className="text-gray-600 mt-16" size={24} />

            {/* Quarterfinals */}
            <div className="space-y-3">
              <h4 className="text-center text-gray-400 text-sm mb-2">Quarterfinals (GW30)</h4>
              <BracketMatch 
                label="QF1" 
                team1={getTeamBySeed(1)} 
                team2="Winner PI-B"
              />
              <BracketMatch 
                label="QF2" 
                team1={getTeamBySeed(4)} 
                team2={getTeamBySeed(5)}
              />
              <BracketMatch 
                label="QF3" 
                team1={getTeamBySeed(2)} 
                team2="Winner PI-A"
              />
              <BracketMatch 
                label="QF4" 
                team1={getTeamBySeed(3)} 
                team2={getTeamBySeed(6)}
              />
            </div>

            <ChevronRight className="text-gray-600 mt-24" size={24} />

            {/* Semifinals */}
            <div className="space-y-3 mt-12">
              <h4 className="text-center text-gray-400 text-sm mb-2">Semifinals (GW31)</h4>
              <BracketMatch 
                label="SF1" 
                team1="Winner QF1" 
                team2="Winner QF2"
              />
              <div className="h-8"></div>
              <BracketMatch 
                label="SF2" 
                team1="Winner QF3" 
                team2="Winner QF4"
              />
            </div>

            <ChevronRight className="text-gray-600 mt-24" size={24} />

            {/* Final */}
            <div className="space-y-3 mt-20">
              <h4 className="text-center text-gray-400 text-sm mb-2">Final (GW32)</h4>
              <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg overflow-hidden w-52 shadow-lg shadow-yellow-900/30">
                <div className="text-xs text-center py-1 bg-yellow-900/50 text-yellow-200 flex items-center justify-center gap-1">
                  <Trophy size={12} /> FINAL
                </div>
                <div className="p-3 space-y-2 bg-slate-900/80">
                  <div className="bg-slate-800 rounded px-2 py-1.5 text-sm text-gray-400 truncate text-center">Winner SF1</div>
                  <div className="bg-slate-800 rounded px-2 py-1.5 text-sm text-gray-400 truncate text-center">Winner SF2</div>
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
        <strong className="text-gray-400">Format:</strong> 5 Groups of 4 → Top 2 qualify (10 teams) → Seeds 7-10 play Play-In → 8 teams for Quarterfinals •
        <strong className="text-gray-400 ml-2">Scoring:</strong> Win = 3 pts, Draw = 1 pt
      </div>
    </div>
  );
};

export default FPLCup;
