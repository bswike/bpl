import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';

const LeagueAnalysis = () => {
  const [loading, setLoading] = useState(true);
  const [analysisData, setAnalysisData] = useState({
    leagueHits: [],
    globalMisses: [],
    crowdDisasters: [],
    hiddenGems: [],
    bestDifferentials: [],
    worstConsensus: [],
    captainAnalysis: []
  });

  useEffect(() => {
    analyzeAllPlayersData();
  }, []);

  const analyzeAllPlayersData = async () => {
  try {
    const CSV_URL =
      import.meta.env.VITE_ALL_PLAYERS_CSV_URL ||
      "https://1b0s3gmik3fqhcvt.public.blob.vercel-storage.com/fpl_all_players_gw1.csv";

    // cache-buster (30s)
    const url = `${CSV_URL}?t=${Math.floor(Date.now() / 30000)}`;

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Failed to fetch CSV: ${response.status}`);

    const csvData = await response.text();

    const parsedData = Papa.parse(csvData, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    });

    const allPlayers = parsedData.data.filter(
      (row) => row && row.player && typeof row.points_gw === "number"
    );

    const results = {
      leagueHits: analyzeLeagueHits(allPlayers),
      globalMisses: analyzeGlobalMisses(allPlayers),
      crowdDisasters: analyzeCrowdDisasters(allPlayers),
      hiddenGems: analyzeHiddenGems(allPlayers),
      bestDifferentials: analyzeBestDifferentials(allPlayers),
      worstConsensus: analyzeWorstConsensus(allPlayers),
      captainAnalysis: analyzeCaptainChoices(allPlayers),
    };

    setAnalysisData(results);
  } catch (error) {
    console.error("Error analyzing all players data:", error);
  } finally {
    setLoading(false);
  }
};


  const analyzeLeagueHits = (players) => {
    // Players with high league ownership who performed well
    return players
      .filter(p => p.league_ownership >= 30 && p.points_gw >= 8)
      .sort((a, b) => b.points_gw - a.points_gw)
      .slice(0, 10);
  };

  const analyzeGlobalMisses = (players) => {
    // Finally! Players with high global ownership but low/zero league ownership who scored well
    return players
      .filter(p => {
        return p.global_ownership >= 15 && // Popular globally
               p.league_ownership <= 10 && // Low league ownership  
               p.points_gw >= 5; // Performed well
      })
      .map(p => ({
        ...p,
        missedBy: Math.round(p.global_ownership - p.league_ownership)
      }))
      .sort((a, b) => b.missedBy - a.missedBy)
      .slice(0, 10);
  };

  const analyzeCrowdDisasters = (players) => {
    // High league ownership players who flopped
    return players
      .filter(p => p.league_ownership >= 40 && p.points_gw <= 3)
      .sort((a, b) => b.league_ownership - a.league_ownership)
      .slice(0, 10);
  };

  const analyzeHiddenGems = (players) => {
    // Low global ownership players who performed well
    return players
      .filter(p => p.global_ownership <= 20 && p.points_gw >= 8)
      .map(p => ({
        ...p,
        spotted: p.league_ownership > 0 ? 'Yes' : 'No'
      }))
      .sort((a, b) => b.points_gw - a.points_gw)
      .slice(0, 10);
  };

  const analyzeBestDifferentials = (players) => {
    // Players where league ownership > global ownership and they performed
    return players
      .filter(p => p.league_ownership > 0 && p.points_gw >= 6)
      .map(p => ({
        ...p,
        differential: p.league_ownership - p.global_ownership
      }))
      .filter(p => p.differential > 0)
      .sort((a, b) => b.differential - a.differential)
      .slice(0, 10);
  };

  const analyzeWorstConsensus = (players) => {
    // High league ownership players with poor value
    return players
      .filter(p => p.league_ownership >= 50 && p.points_gw <= 4)
      .sort((a, b) => a.value_ratio - b.value_ratio)
      .slice(0, 10);
  };

  const analyzeCaptainChoices = (players) => {
    // Players who were captained in the league
    return players
      .filter(p => p.league_captain_percent > 0)
      .sort((a, b) => b.league_captain_percent - a.league_captain_percent)
      .slice(0, 8);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-slate-900">
        <div className="text-yellow-400 text-xl animate-pulse">🧠 Analyzing league intelligence vs 694 FPL players...</div>
      </div>
    );
  }

  const totalAnalyses = Object.values(analysisData).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="p-4 sm:p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-yellow-400 mb-2 drop-shadow-lg">
          🧠 League Intelligence Report
        </h1>
        <p className="text-md sm:text-lg text-gray-400">How did we perform vs ALL 694 FPL players?</p>
        <p className="text-sm text-gray-500 mt-2">Analyzed {totalAnalyses} key insights from global vs league data</p>
      </div>

      {/* Success Stories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-green-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-green-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-green-300 mb-4 text-center">
            🎯 League Hits (Smart Popular Picks)
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.leagueHits.length > 0 ? analysisData.leagueHits.map((player, index) => (
              <li key={index} className="bg-gradient-to-r from-green-800/30 to-slate-700 rounded p-3 border border-green-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-green-200">{player.player}</span>
                    <p className="text-sm text-gray-400">
                      League: {player.league_ownership}% | Global: {player.global_ownership}% | £{player.player_cost}m
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-green-400">{player.points_gw}</span>
                    <p className="text-sm text-gray-500 mt-1">points</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">No major league hits found</li>
            )}
          </ul>
        </div>

        <div className="bg-gradient-to-br from-purple-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-purple-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-purple-300 mb-4 text-center">
            🚀 Best Differentials (League {'>'} Global)
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.bestDifferentials.length > 0 ? analysisData.bestDifferentials.map((player, index) => (
              <li key={index} className="bg-gradient-to-r from-purple-800/30 to-slate-700 rounded p-3 border border-purple-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-purple-200">{player.player}</span>
                    <p className="text-sm text-gray-400">
                      League: {player.league_ownership}% | Global: {player.global_ownership}% | +{player.differential}% diff
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-purple-400">{player.points_gw}</span>
                    <p className="text-sm text-gray-500 mt-1">points</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">No significant differentials found</li>
            )}
          </ul>
        </div>
      </div>

      {/* Failures and Global Misses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-red-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-red-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-red-300 mb-4 text-center">
            💥 Crowd Disasters (Popular League Flops)
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.crowdDisasters.length > 0 ? analysisData.crowdDisasters.map((player, index) => (
              <li key={index} className="bg-gradient-to-r from-red-800/30 to-slate-700 rounded p-3 border border-red-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-red-200">{player.player}</span>
                    <p className="text-sm text-gray-400">
                      League: {player.league_ownership}% | Global: {player.global_ownership}% | £{player.player_cost}m
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-red-400">{player.points_gw}</span>
                    <p className="text-sm text-gray-500 mt-1">points</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">No major crowd disasters - well done!</li>
            )}
          </ul>
        </div>

        <div className="bg-gradient-to-br from-orange-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-orange-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-orange-300 mb-4 text-center">
            😬 Global Misses (Great Players We Ignored!)
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.globalMisses.length > 0 ? analysisData.globalMisses.map((player, index) => (
              <li key={index} className="bg-gradient-to-r from-orange-800/30 to-slate-700 rounded p-3 border border-orange-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-orange-200">{player.player}</span>
                    <p className="text-sm text-gray-400">
                      Global: {player.global_ownership}% | League: {player.league_ownership}% | {player.points_gw} pts
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-orange-400">{player.missedBy}%</span>
                    <p className="text-sm text-gray-500 mt-1">gap</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">No major global misses - excellent coverage!</li>
            )}
          </ul>
        </div>
      </div>

      {/* Hidden Gems and Captain Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-blue-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-blue-300 mb-4 text-center">
            💎 Hidden Gems Hunt (Low Global, High Points)
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.hiddenGems.length > 0 ? analysisData.hiddenGems.map((player, index) => (
              <li key={index} className="bg-gradient-to-r from-blue-800/30 to-slate-700 rounded p-3 border border-blue-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-blue-200">{player.player}</span>
                    <p className="text-sm text-gray-400">
                      Global: {player.global_ownership}% | League: {player.league_ownership}% | Spotted: {player.spotted}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-blue-400">{player.points_gw}</span>
                    <p className="text-sm text-gray-500 mt-1">points</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">No hidden gems identified</li>
            )}
          </ul>
        </div>

        <div className="bg-gradient-to-br from-cyan-900/20 to-slate-900 rounded-xl p-4 sm:p-6 shadow-2xl border border-cyan-700/30">
          <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-4 text-center">
            ⚡ Captain Choices Analysis
          </h2>
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {analysisData.captainAnalysis.length > 0 ? analysisData.captainAnalysis.map((captain, index) => (
              <li key={index} className="bg-gradient-to-r from-cyan-800/30 to-slate-700 rounded p-3 border border-cyan-600/30">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="font-bold text-md text-cyan-200">{captain.player}</span>
                    <p className="text-sm text-gray-400">
                      League: {captain.league_captain_percent}% | {captain.points_gw * 2} captain pts | £{captain.player_cost}m
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-xl text-cyan-400">{captain.league_owner_count}</span>
                    <p className="text-sm text-gray-500 mt-1">owners</p>
                  </div>
                </div>
              </li>
            )) : (
              <li className="text-gray-400 text-center py-4">Loading captain analysis...</li>
            )}
          </ul>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-2xl border border-slate-700 text-center">
          <h3 className="text-lg font-bold text-green-300 mb-1">🎯 League Hits</h3>
          <p className="text-2xl font-bold text-green-400">{analysisData.leagueHits.length}</p>
          <p className="text-xs text-gray-400">Smart popular picks</p>
        </div>
        
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-2xl border border-slate-700 text-center">
          <h3 className="text-lg font-bold text-purple-300 mb-1">🚀 Best Diffs</h3>
          <p className="text-2xl font-bold text-purple-400">{analysisData.bestDifferentials.length}</p>
          <p className="text-xs text-gray-400">League &gt; Global</p>
        </div>
        
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-2xl border border-slate-700 text-center">
          <h3 className="text-lg font-bold text-red-300 mb-1">💥 Disasters</h3>
          <p className="text-2xl font-bold text-red-400">{analysisData.crowdDisasters.length}</p>
          <p className="text-xs text-gray-400">Popular flops</p>
        </div>
        
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 shadow-2xl border border-slate-700 text-center">
          <h3 className="text-lg font-bold text-orange-300 mb-1">😬 Global Misses</h3>
          <p className="text-2xl font-bold text-orange-400">{analysisData.globalMisses.length}</p>
          <p className="text-xs text-gray-400">Great players missed</p>
        </div>
      </div>
    </div>
  );
};

export default LeagueAnalysis;