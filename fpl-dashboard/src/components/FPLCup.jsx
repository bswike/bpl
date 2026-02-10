import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Trophy, Users, Calendar, ChevronRight, Star } from 'lucide-react';

// Cup configuration
const CUP_CONFIG = {
  seeding_gw: 25,
  groups: {
    A: ["Garrett Kunkel", "Max Maier", "Evan Bagheri", "Andrew Vidal", "Patrick McCleary"],
    B: ["Kevin Tomek", "Tony Tharakan", "Brett Swikle", "JP Fischer", "Jared Alexander"],
    C: ["Dean Maghsadi", "Wes H", "John Matthew", "Nate Cohen", "Chris Munoz"],
    D: ["John Sebastian", "Joe Curran", "Kevin K", "Adrian McLoughlin", "Brian Pleines"]
  },
  fixtures: {
    A: [
      { gameweek: 26, matches: [{ home: "Max Maier", away: "Patrick McCleary" }, { home: "Evan Bagheri", away: "Andrew Vidal" }], bye: "Garrett Kunkel" },
      { gameweek: 27, matches: [{ home: "Garrett Kunkel", away: "Patrick McCleary" }, { home: "Max Maier", away: "Evan Bagheri" }], bye: "Andrew Vidal" },
      { gameweek: 28, matches: [{ home: "Garrett Kunkel", away: "Andrew Vidal" }, { home: "Patrick McCleary", away: "Evan Bagheri" }], bye: "Max Maier" },
      { gameweek: 29, matches: [{ home: "Garrett Kunkel", away: "Evan Bagheri" }, { home: "Andrew Vidal", away: "Max Maier" }], bye: "Patrick McCleary" },
      { gameweek: 30, matches: [{ home: "Garrett Kunkel", away: "Max Maier" }, { home: "Andrew Vidal", away: "Patrick McCleary" }], bye: "Evan Bagheri" }
    ],
    B: [
      { gameweek: 26, matches: [{ home: "Tony Tharakan", away: "Jared Alexander" }, { home: "Brett Swikle", away: "JP Fischer" }], bye: "Kevin Tomek" },
      { gameweek: 27, matches: [{ home: "Kevin Tomek", away: "Jared Alexander" }, { home: "Tony Tharakan", away: "Brett Swikle" }], bye: "JP Fischer" },
      { gameweek: 28, matches: [{ home: "Kevin Tomek", away: "JP Fischer" }, { home: "Jared Alexander", away: "Brett Swikle" }], bye: "Tony Tharakan" },
      { gameweek: 29, matches: [{ home: "Kevin Tomek", away: "Brett Swikle" }, { home: "JP Fischer", away: "Tony Tharakan" }], bye: "Jared Alexander" },
      { gameweek: 30, matches: [{ home: "Kevin Tomek", away: "Tony Tharakan" }, { home: "JP Fischer", away: "Jared Alexander" }], bye: "Brett Swikle" }
    ],
    C: [
      { gameweek: 26, matches: [{ home: "Wes H", away: "Chris Munoz" }, { home: "John Matthew", away: "Nate Cohen" }], bye: "Dean Maghsadi" },
      { gameweek: 27, matches: [{ home: "Dean Maghsadi", away: "Chris Munoz" }, { home: "Wes H", away: "John Matthew" }], bye: "Nate Cohen" },
      { gameweek: 28, matches: [{ home: "Dean Maghsadi", away: "Nate Cohen" }, { home: "Chris Munoz", away: "John Matthew" }], bye: "Wes H" },
      { gameweek: 29, matches: [{ home: "Dean Maghsadi", away: "John Matthew" }, { home: "Nate Cohen", away: "Wes H" }], bye: "Chris Munoz" },
      { gameweek: 30, matches: [{ home: "Dean Maghsadi", away: "Wes H" }, { home: "Nate Cohen", away: "Chris Munoz" }], bye: "John Matthew" }
    ],
    D: [
      { gameweek: 26, matches: [{ home: "Joe Curran", away: "Brian Pleines" }, { home: "Kevin K", away: "Adrian McLoughlin" }], bye: "John Sebastian" },
      { gameweek: 27, matches: [{ home: "John Sebastian", away: "Brian Pleines" }, { home: "Joe Curran", away: "Kevin K" }], bye: "Adrian McLoughlin" },
      { gameweek: 28, matches: [{ home: "John Sebastian", away: "Adrian McLoughlin" }, { home: "Brian Pleines", away: "Kevin K" }], bye: "Joe Curran" },
      { gameweek: 29, matches: [{ home: "John Sebastian", away: "Kevin K" }, { home: "Adrian McLoughlin", away: "Joe Curran" }], bye: "Brian Pleines" },
      { gameweek: 30, matches: [{ home: "John Sebastian", away: "Joe Curran" }, { home: "Adrian McLoughlin", away: "Brian Pleines" }], bye: "Kevin K" }
    ]
  },
  schedule: {
    group_stage: [26, 27, 28, 29, 30],
    quarterfinals: 31,
    semifinals: 32,
    final: 33
  },
  knockout_bracket: {
    QF1: { team1: "A1", team2: "B2" },
    QF2: { team1: "C1", team2: "D2" },
    QF3: { team1: "B1", team2: "A2" },
    QF4: { team1: "D1", team2: "C2" }
  }
};

const GROUP_COLORS = {
  A: 'from-blue-600 to-blue-800',
  B: 'from-emerald-600 to-emerald-800',
  C: 'from-amber-600 to-amber-800',
  D: 'from-purple-600 to-purple-800'
};

const FPLCup = () => {
  const { gwData, latestGameweek } = useData();
  const [selectedTab, setSelectedTab] = useState('groups'); // 'groups', 'fixtures', 'bracket'
  const [selectedGroup, setSelectedGroup] = useState('A');

  // Calculate group standings based on H2H results
  const groupStandings = useMemo(() => {
    const standings = {};
    
    Object.entries(CUP_CONFIG.groups).forEach(([groupName, teams]) => {
      // Initialize standings for each team
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

      // Process each matchday
      const groupFixtures = CUP_CONFIG.fixtures[groupName] || [];
      groupFixtures.forEach(matchday => {
        const gw = matchday.gameweek;
        const gwManagers = gwData?.[gw] || [];

        // Create lookup for this GW's scores
        const scores = {};
        gwManagers.forEach(m => {
          scores[m.manager_name] = m.total_points || 0;
        });

        // Process each match
        matchday.matches.forEach(match => {
          const homeScore = scores[match.home];
          const awayScore = scores[match.away];

          // Only count if we have data for this GW
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

      // Sort by cup points, then points_for, then goal difference equivalent
      standings[groupName] = Object.values(groupStats).sort((a, b) => {
        if (b.cup_points !== a.cup_points) return b.cup_points - a.cup_points;
        if (b.points_for !== a.points_for) return b.points_for - a.points_for;
        return (b.points_for - b.points_against) - (a.points_for - a.points_against);
      });
    });

    return standings;
  }, [gwData]);

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

  // Determine current phase
  const currentPhase = useMemo(() => {
    if (!latestGameweek) return 'upcoming';
    if (latestGameweek < 26) return 'upcoming';
    if (latestGameweek <= 30) return 'groups';
    if (latestGameweek === 31) return 'quarterfinals';
    if (latestGameweek === 32) return 'semifinals';
    if (latestGameweek >= 33) return 'final';
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
                <th className="text-left px-4 py-2 w-8">#</th>
                <th className="text-left px-4 py-2">Manager</th>
                <th className="text-center px-2 py-2">P</th>
                <th className="text-center px-2 py-2">W</th>
                <th className="text-center px-2 py-2">D</th>
                <th className="text-center px-2 py-2">L</th>
                <th className="text-center px-2 py-2">PF</th>
                <th className="text-center px-2 py-2">PA</th>
                <th className="text-center px-3 py-2 font-bold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, idx) => (
                <tr 
                  key={team.name}
                  className={`border-b border-slate-700/50 ${
                    idx < 2 ? 'bg-green-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    {idx < 2 ? (
                      <span className="text-green-400 font-bold">{idx + 1}</span>
                    ) : (
                      <span className="text-gray-500">{idx + 1}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {idx === 0 && <Star size={14} className="text-yellow-400" />}
                      <span className={idx < 2 ? 'text-white font-medium' : 'text-gray-300'}>
                        {team.name}
                      </span>
                    </div>
                  </td>
                  <td className="text-center px-2 py-3 text-gray-400">{team.played}</td>
                  <td className="text-center px-2 py-3 text-green-400">{team.won}</td>
                  <td className="text-center px-2 py-3 text-gray-400">{team.drawn}</td>
                  <td className="text-center px-2 py-3 text-red-400">{team.lost}</td>
                  <td className="text-center px-2 py-3 text-gray-300">{team.points_for}</td>
                  <td className="text-center px-2 py-3 text-gray-500">{team.points_against}</td>
                  <td className="text-center px-3 py-3 font-bold text-cyan-400">{team.cup_points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 bg-slate-900/50 text-xs text-gray-500">
          <span className="inline-block w-3 h-3 bg-green-900/50 rounded mr-1"></span>
          Advances to Knockout Stage
        </div>
      </div>
    );
  };

  const renderFixtures = () => {
    const fixtures = CUP_CONFIG.fixtures[selectedGroup] || [];
    
    return (
      <div className="space-y-4">
        {/* Group selector */}
        <div className="flex gap-2 mb-4">
          {['A', 'B', 'C', 'D'].map(g => (
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

        {/* Fixtures list */}
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
                  <span className="text-xs text-gray-500">Completed</span>
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
                      <div className={`flex-1 text-right ${result.winner === 'home' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
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
                      <div className={`flex-1 text-left ${result.winner === 'away' ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                        {match.away}
                      </div>
                    </div>
                  );
                })}
                
                {matchday.bye && (
                  <div className="text-center text-xs text-gray-500 pt-2 border-t border-slate-700">
                    Bye: {matchday.bye}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderBracket = () => {
    // Get qualified teams from group standings
    const getQualifiedTeams = () => {
      const qualified = { A1: null, A2: null, B1: null, B2: null, C1: null, C2: null, D1: null, D2: null };
      
      Object.entries(groupStandings).forEach(([group, standings]) => {
        if (standings.length >= 2) {
          qualified[`${group}1`] = standings[0]?.name || `${group}1`;
          qualified[`${group}2`] = standings[1]?.name || `${group}2`;
        }
      });
      
      return qualified;
    };

    const qualified = getQualifiedTeams();
    const groupStageComplete = latestGameweek >= 30;

    const BracketMatch = ({ team1Label, team2Label, round, matchNum }) => {
      const team1 = groupStageComplete ? qualified[team1Label] || team1Label : team1Label;
      const team2 = groupStageComplete ? qualified[team2Label] || team2Label : team2Label;
      
      return (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-w-[180px]">
          <div className="text-xs text-center py-1 bg-slate-900 text-gray-500">
            {round}
          </div>
          <div className="p-2 space-y-1">
            <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-300 truncate">
              {team1}
            </div>
            <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-300 truncate">
              {team2}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        {!groupStageComplete && (
          <div className="bg-amber-900/20 border border-amber-600/50 rounded-lg p-4 text-amber-200 text-sm">
            <strong>Group Stage in Progress</strong> - Bracket will update after GW30 when groups are decided.
          </div>
        )}

        <div className="overflow-x-auto pb-4">
          <div className="flex items-center justify-center gap-8 min-w-[800px]">
            {/* Quarterfinals */}
            <div className="space-y-4">
              <h4 className="text-center text-gray-400 text-sm mb-2">Quarterfinals (GW31)</h4>
              <BracketMatch team1Label="A1" team2Label="B2" round="QF1" />
              <BracketMatch team1Label="C1" team2Label="D2" round="QF2" />
              <BracketMatch team1Label="B1" team2Label="A2" round="QF3" />
              <BracketMatch team1Label="D1" team2Label="C2" round="QF4" />
            </div>

            <ChevronRight className="text-gray-600" size={32} />

            {/* Semifinals */}
            <div className="space-y-4">
              <h4 className="text-center text-gray-400 text-sm mb-2">Semifinals (GW32)</h4>
              <div className="space-y-8">
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-w-[180px]">
                  <div className="text-xs text-center py-1 bg-slate-900 text-gray-500">SF1</div>
                  <div className="p-2 space-y-1">
                    <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-500 truncate">Winner QF1</div>
                    <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-500 truncate">Winner QF2</div>
                  </div>
                </div>
                <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden min-w-[180px]">
                  <div className="text-xs text-center py-1 bg-slate-900 text-gray-500">SF2</div>
                  <div className="p-2 space-y-1">
                    <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-500 truncate">Winner QF3</div>
                    <div className="bg-slate-900/50 rounded px-3 py-2 text-sm text-gray-500 truncate">Winner QF4</div>
                  </div>
                </div>
              </div>
            </div>

            <ChevronRight className="text-gray-600" size={32} />

            {/* Final */}
            <div className="space-y-4">
              <h4 className="text-center text-gray-400 text-sm mb-2">Final (GW33)</h4>
              <div className="bg-gradient-to-r from-yellow-600 to-amber-600 rounded-lg overflow-hidden min-w-[200px] shadow-lg shadow-yellow-900/30">
                <div className="text-xs text-center py-1 bg-yellow-900/50 text-yellow-200 flex items-center justify-center gap-1">
                  <Trophy size={12} /> FINAL
                </div>
                <div className="p-3 space-y-2 bg-slate-900/80">
                  <div className="bg-slate-800 rounded px-3 py-2 text-sm text-gray-400 truncate text-center">
                    Winner SF1
                  </div>
                  <div className="bg-slate-800 rounded px-3 py-2 text-sm text-gray-400 truncate text-center">
                    Winner SF2
                  </div>
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
              GW26-33 • Groups + Knockout
            </p>
          </div>
        </div>
      </div>

      {/* Current Phase Indicator */}
      <div className="flex items-center gap-2 text-sm">
        <Calendar size={16} className="text-gray-400" />
        <span className="text-gray-400">Current Phase:</span>
        <span className="text-cyan-400 font-medium capitalize">{currentPhase}</span>
        {latestGameweek && (
          <span className="text-gray-500">• GW{latestGameweek}</span>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-700 pb-2">
        {[
          { id: 'groups', label: 'Group Tables', icon: Users },
          { id: 'fixtures', label: 'Fixtures', icon: Calendar },
          { id: 'bracket', label: 'Knockout Bracket', icon: Trophy }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-t-lg transition-all ${
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

      {/* Tab Content */}
      {selectedTab === 'groups' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {['A', 'B', 'C', 'D'].map(g => (
            <div key={g}>{renderGroupTable(g)}</div>
          ))}
        </div>
      )}

      {selectedTab === 'fixtures' && renderFixtures()}

      {selectedTab === 'bracket' && renderBracket()}

      {/* Legend */}
      <div className="bg-slate-800/30 rounded-lg p-4 text-xs text-gray-500">
        <strong className="text-gray-400">Scoring:</strong> Win = 3 pts, Draw = 1 pt, Loss = 0 pts • 
        <strong className="text-gray-400 ml-2">Tiebreaker:</strong> Total FPL points scored, then head-to-head
      </div>
    </div>
  );
};

export default FPLCup;

