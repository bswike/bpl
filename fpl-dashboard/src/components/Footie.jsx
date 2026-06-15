import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Trophy,
  RefreshCw,
  ChevronLeft,
  ChevronDown,
  Globe,
  CalendarDays,
  Users,
} from "lucide-react";
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
  Türkiye: "🇹🇷",
  Bosnia: "🇧🇦",
  "Bosnia-Herzegovina": "🇧🇦",
  Algeria: "🇩🇿",
  "Cabo Verde": "🇨🇻",
  "Cape Verde": "🇨🇻",
  England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  Norway: "🇳🇴",
  Ecuador: "🇪🇨",
  Australia: "🇦🇺",
  Panama: "🇵🇦",
  Curacao: "🇨🇼",
  Curaçao: "🇨🇼",
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
  "Congo DR": "🇨🇩",
  Germany: "🇩🇪",
  Morocco: "🇲🇦",
  Austria: "🇦🇹",
  Ghana: "🇬🇭",
  "Saudia Arabia": "🇸🇦",
  "Saudi Arabia": "🇸🇦",
  Qatar: "🇶🇦",
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Netherlands: "🇳🇱",
  "Ivory Coast": "🇨🇮",
  Egypt: "🇪🇬",
  Uzbekistan: "🇺🇿",
  "New Zealand": "🇳🇿",
};

// Resolve a flag regardless of sheet vs ESPN spelling (accents/punctuation/aliases).
const normName = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const FLAG_ALIASES = {
  capeverde: "caboverde",
  turkiye: "turkeye",
  colombia: "columbia",
  congodr: "drcongo",
  unitedstates: "usa",
  bosniaherzegovina: "bosnia",
};
const FLAG_NORM = {};
Object.entries(FLAGS).forEach(([k, v]) => {
  FLAG_NORM[normName(k)] = v;
});
const flagFor = (team) => {
  const n = normName(team);
  return FLAG_NORM[n] || FLAG_NORM[FLAG_ALIASES[n]] || "⚽";
};
// Canonical team key so a roster spelling and ESPN's spelling map together.
const teamCanon = (team) => {
  const n = normName(team);
  return FLAG_ALIASES[n] || n;
};

const RESULT_STYLE = {
  W: { label: "W", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  D: { label: "D", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  L: { label: "L", cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
  P: { label: "—", cls: "bg-slate-700/40 text-slate-500 border-slate-600/40" },
};

function ResultPip({ result, live, title }) {
  if (live) {
    return (
      <span
        title={title}
        className="inline-flex items-center justify-center w-5 h-5 rounded border border-cyan-500/40 bg-cyan-500/15"
      >
        <span className="animate-pulse w-1.5 h-1.5 rounded-full bg-cyan-400" />
      </span>
    );
  }
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

const fmtDay = (iso) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
const fmtTime = (iso) =>
  new Date(iso).toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
// "Today" / "Tomorrow" / weekday for near dates, else a short date.
const relDay = (iso) => {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((startOf(d) - startOf(now)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return d.toLocaleString("en-US", { weekday: "long" });
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
};
const fmtRelative = (iso) => `${relDay(iso)}, ${fmtTime(iso)}`;

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

// Flatten a manager's teams into a chronological log of played/live games + KO wins.
function buildGameLog(manager) {
  const log = [];
  manager.teams.forEach((t) => {
    (t.group || []).forEach((g) => {
      if (g.result !== "P" || g.live) {
        log.push({
          kind: "group",
          team: t.team,
          opponent: g.opponentFull || g.opponent,
          home: g.home,
          result: g.result,
          live: g.live,
          gf: g.gf,
          ga: g.ga,
          date: g.date,
        });
      }
    });
    (t.ko || []).forEach((k) => {
      log.push({
        kind: "ko",
        team: t.team,
        opponent: k.opponent,
        result: "W",
        label: k.label,
        points: k.points,
        date: k.date,
      });
    });
  });
  return log.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function ManagerCard({ manager, rank }) {
  const [open, setOpen] = useState(false);
  const total = (manager.gsPoints || 0) + (manager.koPoints || 0);
  const log = open ? buildGameLog(manager) : [];

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 min-w-0 group text-left"
        >
          {rank != null && (
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold shrink-0">
              {rank}
            </span>
          )}
          <h3 className="font-bold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">
            {manager.name}
          </h3>
          <ChevronDown
            size={14}
            className={`text-slate-500 shrink-0 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
        <div className="text-right shrink-0">
          <div className="text-xl font-bold font-mono text-cyan-400 leading-none">
            {total}
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

      {open && (
        <div className="mb-3 rounded-lg border border-slate-700/60 bg-slate-900/40 divide-y divide-slate-700/40">
          {log.length === 0 ? (
            <p className="text-xs text-slate-500 px-3 py-2">No games played yet.</p>
          ) : (
            log.map((g, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1.5 text-xs"
              >
                <span className="w-12 shrink-0 text-slate-500 font-light">
                  {fmtDay(g.date)}
                </span>
                <span className="w-5 text-center shrink-0">{flagFor(g.team)}</span>
                <span className="flex-1 min-w-0 truncate text-slate-300">
                  {g.kind === "ko" ? (
                    <span className="text-cyan-300">{g.label}</span>
                  ) : (
                    <>
                      {g.home ? "vs " : "@ "}
                      {g.opponent}
                    </>
                  )}
                </span>
                {g.kind === "ko" ? (
                  <span className="font-mono font-bold text-cyan-300 shrink-0">
                    +{g.points}
                  </span>
                ) : g.live ? (
                  <span className="font-mono text-cyan-300 shrink-0">
                    {g.gf}-{g.ga}{" "}
                    <span className="text-[9px] uppercase">live</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-slate-400">
                      {g.gf}-{g.ga}
                    </span>
                    <ResultPip result={g.result} />
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <ul className="space-y-2">
        {manager.teams.map((t) => {
          const games = [...(t.group || [])].sort(
            (a, b) => new Date(a.date) - new Date(b.date)
          );
          const hasResults = games.some((g) => g.result !== "P" || g.live);
          const ng = t.nextGame;
          return (
            <li key={t.team} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none w-6 text-center shrink-0">
                  {flagFor(t.team)}
                </span>
                <span
                  className={`flex-1 min-w-0 truncate ${
                    hasResults ? "text-slate-200" : "text-slate-400"
                  }`}
                >
                  {t.team}
                </span>
                <span className="flex items-center gap-0.5 shrink-0">
                  {games.map((g, i) => (
                    <ResultPip
                      key={`g${i}`}
                      result={g.result}
                      live={g.live}
                      title={
                        g.result === "P" && !g.live
                          ? `Upcoming ${g.home ? "vs" : "@"} ${g.opponent}`
                          : `${g.result} ${g.home ? "vs" : "@"} ${g.opponent}${
                              g.gf != null ? ` (${g.gf}-${g.ga})` : ""
                            }`
                      }
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
                </span>
                <span className="w-5 text-right font-mono text-xs text-slate-400">
                  {hasResults ? t.points : "·"}
                </span>
              </div>
              {ng && (
                <div className="pl-8 text-[11px] font-light text-slate-500">
                  Next: {ng.home ? "vs " : "@ "}
                  {ng.opponent} · {fmtRelative(ng.date)}
                </div>
              )}
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

function MatchRow({ m, ownerFor }) {
  const finished = m.state === "post";
  const live = m.state === "in";
  const scored = finished || live;
  const homeWon = scored && m.homeScore > m.awayScore;
  const awayWon = scored && m.awayScore > m.homeScore;
  const homeOwner = ownerFor(m.home);
  const awayOwner = ownerFor(m.away);
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs border-t border-slate-700/30 first:border-t-0">
      <span className="w-14 shrink-0 text-slate-500 font-light leading-tight">
        {finished ? (
          <span className="text-slate-600">FT</span>
        ) : live ? (
          <span className="text-cyan-400 font-medium">{m.detail || "LIVE"}</span>
        ) : (
          <>
            {fmtDay(m.date)}
            <br />
            {fmtTime(m.date)}
          </>
        )}
      </span>
      <div className="flex-1 min-w-0 flex flex-col items-end">
        <span
          className={`flex items-center gap-1.5 min-w-0 max-w-full ${
            homeWon ? "text-slate-100 font-semibold" : "text-slate-400"
          }`}
        >
          <span className="truncate">{m.home}</span>
          <span className="shrink-0">{flagFor(m.home)}</span>
        </span>
        {homeOwner && (
          <span className="text-[10px] text-cyan-500/80 font-light truncate max-w-full">
            {homeOwner}
          </span>
        )}
      </div>
      <span className="w-12 shrink-0 text-center font-mono">
        {scored ? (
          <span className={live ? "text-cyan-400 font-bold" : "text-slate-200 font-bold"}>
            {m.homeScore}–{m.awayScore}
          </span>
        ) : (
          <span className="text-slate-600">v</span>
        )}
      </span>
      <div className="flex-1 min-w-0 flex flex-col items-start">
        <span
          className={`flex items-center gap-1.5 min-w-0 max-w-full ${
            awayWon ? "text-slate-100 font-semibold" : "text-slate-400"
          }`}
        >
          <span className="shrink-0">{flagFor(m.away)}</span>
          <span className="truncate">{m.away}</span>
        </span>
        {awayOwner && (
          <span className="text-[10px] text-cyan-500/80 font-light truncate max-w-full">
            {awayOwner}
          </span>
        )}
      </div>
    </div>
  );
}

function ScheduleView({ schedule, managers }) {
  if (!schedule || schedule.length === 0) {
    return (
      <p className="text-center text-slate-500 py-12">Schedule unavailable.</p>
    );
  }
  const ownerMap = {};
  (managers || []).forEach((m) => {
    (m.teams || []).forEach((t) => {
      ownerMap[teamCanon(t.team)] = m.name;
    });
  });
  const ownerFor = (team) => ownerMap[teamCanon(team)] || null;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {schedule.map((g) => (
        <div
          key={g.group}
          className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-cyan-400 text-slate-900 text-xs font-bold">
              {g.group}
            </span>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Group {g.group}
            </h3>
          </div>
          <div>
            {g.matches.map((m, i) => (
              <MatchRow key={i} m={m} ownerFor={ownerFor} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Tabs({ view, setView }) {
  const tabs = [
    { id: "pool", label: "Pool", icon: Users },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
  ];
  return (
    <div className="inline-flex p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-6">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = view === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-cyan-400 text-slate-900"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon size={14} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Footie() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState("pool");

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
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
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
          <>
            <Tabs view={view} setView={setView} />

            {view === "pool" ? (
              <div className="space-y-6">
                <div className="grid lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <Leaderboard standings={data.standings} />
                  </div>
                  <ScoringRules koScoring={data.koScoring} />
                </div>

                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Squads
                  </h2>
                  <p className="text-[11px] text-slate-600 mb-3">
                    Tap a manager to see every result so far.
                  </p>
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
              </div>
            ) : (
              <ScheduleView schedule={data.schedule} managers={data.managers} />
            )}

            {data.fetched && (
              <p className="text-center text-[11px] text-slate-600 mt-6">
                Updated {new Date(data.fetched).toLocaleString()}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
