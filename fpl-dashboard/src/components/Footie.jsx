import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Trophy, RefreshCw, ChevronLeft, Globe } from "lucide-react";
import LoadingSpinner from "./LoadingSpinner";

const FLAGS = {
  France: "🇫🇷",
  Uruguay: "🇺🇾",
  Switzerland: "🇨🇭",
  Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Czechia: "🇨🇿",
  Haiti: "🇭🇹",
  Spain: "🇪🇸",
  Japan: "🇯🇵",
  Turkeye: "🇹🇷",
  Turkey: "🇹🇷",
  Bosnia: "🇧🇦",
  Algeria: "🇩🇿",
  "Cabo Verde": "🇨🇻",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Norway: "🇳🇴",
  Ecuador: "🇪🇨",
  Australia: "🇦🇺",
  Panama: "🇵🇦",
  Curacao: "🇨🇼",
  Brazil: "🇧🇷",
  Mexico: "🇲🇽",
  Canada: "🇨🇦",
  Paraguay: "🇵🇾",
  Iran: "🇮🇷",
  Iraq: "🇮🇶",
  Argentina: "🇦🇷",
  Belgium: "🇧🇪",
  Croatia: "🇭🇷",
  "South Korea": "🇰🇷",
  Tunisia: "🇹🇳",
  Jordan: "🇯🇴",
  Portugal: "🇵🇹",
  Columbia: "🇨🇴",
  Colombia: "🇨🇴",
  Senegal: "🇸🇳",
  Sweden: "🇸🇪",
  "South Africa": "🇿🇦",
  "DR Congo": "🇨🇩",
  Germany: "🇩🇪",
  Morocco: "🇲🇦",
  Austria: "🇦🇹",
  Ghana: "🇬🇭",
  "Saudia Arabia": "🇸🇦",
  "Saudi Arabia": "🇸🇦",
  Qatar: "🇶🇦",
  USA: "🇺🇸",
  Netherlands: "🇳🇱",
  "Ivory Coast": "🇨🇮",
  Egypt: "🇪🇬",
  Uzbekistan: "🇺🇿",
  "New Zealand": "🇳🇿",
};

const RESULT_STYLE = {
  W: { label: "W", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  D: { label: "D", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  L: { label: "L", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  P: { label: "—", cls: "bg-slate-700/40 text-slate-500 border-slate-600/40" },
};

function ResultPip({ result, title }) {
  const rs = RESULT_STYLE[result] || RESULT_STYLE.P;
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center w-5 h-5 rounded border text-[10px] font-bold ${rs.cls}`}
    >
      {rs.label}
    </span>
  );
}

const KO_ROUNDS = [
  ["r32", "Round of 32"],
  ["r16", "Round of 16"],
  ["qf", "Quarterfinal"],
  ["sf", "Semifinal"],
  ["third", "Third Place"],
  ["champ", "Champion"],
];

const flagFor = (team) => FLAGS[team] || "⚽";

function Leaderboard({ standings }) {
  const leaderTotal = standings.length ? standings[0].total : 0;
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <Trophy size={16} className="text-cyan-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Standings
        </h2>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
              <th className="py-2 px-4 w-10">#</th>
              <th className="py-2 px-2">Manager</th>
              <th className="py-2 px-2 text-right">GS</th>
              <th className="py-2 px-2 text-right">KO</th>
              <th className="py-2 px-4 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const isLeader = s.total === leaderTotal && s.total > 0;
              return (
                <tr
                  key={s.name}
                  className="border-t border-slate-700/40 hover:bg-slate-700/20"
                >
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-cyan-400 text-slate-900"
                          : "bg-slate-700 text-slate-300"
                      }`}
                    >
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 font-semibold text-slate-100">
                    {s.name}
                    {isLeader && (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-cyan-400">
                        Lead
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-300">
                    {s.gs}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-slate-400">
                    {s.ko}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-cyan-400">
                    {s.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManagerCard({ manager, rank }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {rank != null && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold shrink-0">
              {rank}
            </span>
          )}
          <h3 className="font-bold text-slate-100 truncate">{manager.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold font-mono text-cyan-400 leading-none">
            {(manager.gsPoints || 0) + (manager.koPoints || 0)}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            pts
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-400 mb-3">
        <span className="text-emerald-400">{manager.wins}W</span>
        <span className="text-amber-400">{manager.draws}D</span>
        <span className="text-rose-400">{manager.losses}L</span>
        {manager.pending > 0 && (
          <span className="text-slate-500">· {manager.pending} to play</span>
        )}
      </div>

      <ul className="space-y-1.5">
        {manager.teams.map((t) => {
          const played = (t.group || []).filter((g) => g.result !== "P");
          const noResults = played.length === 0 && (t.ko || []).length === 0;
          return (
            <li key={t.team} className="flex items-center gap-2 text-sm">
              <span className="text-base leading-none w-6 text-center shrink-0">
                {flagFor(t.team)}
              </span>
              <span
                className={`flex-1 min-w-0 truncate ${
                  noResults ? "text-slate-500" : "text-slate-200"
                }`}
              >
                {t.team}
              </span>
              <span className="flex items-center gap-0.5 shrink-0">
                {played.map((g, i) => (
                  <ResultPip
                    key={`g${i}`}
                    result={g.result}
                    title={`${g.result} vs ${g.opponent}${
                      g.gf != null ? ` (${g.gf}-${g.ga})` : ""
                    }`}
                  />
                ))}
                {(t.ko || []).map((k, i) => (
                  <span
                    key={`k${i}`}
                    title={`${k.label} win vs ${k.opponent} (+${k.points})`}
                    className="inline-flex items-center justify-center h-5 px-1 rounded border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-[10px] font-bold"
                  >
                    +{k.points}
                  </span>
                ))}
                {Array.from({ length: t.remaining || 0 }).map((_, i) => (
                  <ResultPip key={`p${i}`} result="P" title="Upcoming" />
                ))}
              </span>
              <span className="w-5 text-right font-mono text-xs text-slate-400">
                {noResults ? "·" : t.points}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ScoringRules({ koScoring }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Globe size={16} className="text-cyan-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Scoring
        </h2>
      </div>
      <div className="text-sm text-slate-300 space-y-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            Group stage (per team)
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="px-2 py-1 rounded bg-emerald-500/15 text-emerald-400 text-xs border border-emerald-500/30">
              Win = 3
            </span>
            <span className="px-2 py-1 rounded bg-amber-500/15 text-amber-400 text-xs border border-amber-500/30">
              Draw = 1
            </span>
            <span className="px-2 py-1 rounded bg-rose-500/15 text-rose-400 text-xs border border-rose-500/30">
              Loss = 0
            </span>
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            Knockout bonus (per win)
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {KO_ROUNDS.map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between px-2.5 py-1.5 rounded bg-slate-700/40 border border-slate-600/40"
              >
                <span className="text-xs text-slate-300">{label}</span>
                <span className="font-mono font-bold text-cyan-400 text-sm">
                  {koScoring?.[key] ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Footie() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/footie");
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (err) {
      setError(err.message || "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Map manager name -> standings rank for the cards
  const rankByName = {};
  if (data?.standings) {
    data.standings.forEach((s, i) => {
      rankByName[s.name] = i + 1;
    });
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-400 transition-colors mb-1"
            >
              <ChevronLeft size={14} /> Home
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <span>🏆</span> {data?.title || "World Cup Pool"}
              {data?.live && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 rounded">
                  <span className="animate-pulse inline-block w-1.5 h-1.5 rounded-full bg-rose-400" />
                  Live
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">
              {data?.stage || "Group Stage"} · scores auto-updated from ESPN
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-60 shrink-0"
          >
            <RefreshCw
              size={14}
              className={refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="py-24">
            <LoadingSpinner size="lg" message="Loading pool..." />
          </div>
        ) : error ? (
          <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center">
            <p className="text-rose-300 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => load()}
              className="bg-rose-500 hover:bg-rose-400 text-white font-medium px-6 py-2 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Leaderboard standings={data.standings} />
              </div>
              <ScoringRules koScoring={data.koScoring} />
            </div>

            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">
                Squads
              </h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.managers.map((m) => (
                  <ManagerCard
                    key={m.name}
                    manager={m}
                    rank={rankByName[m.name]}
                  />
                ))}
              </div>
            </div>

            {data.fetched && (
              <p className="text-center text-[11px] text-slate-600">
                Updated {new Date(data.fetched).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
