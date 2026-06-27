import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  ChevronDown,
  Globe,
  CalendarDays,
  Users,
  Lock,
  LayoutGrid,
  GitBranch,
  Trophy,
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
// Maps each sheet spelling to ESPN's normalized form (mirrors the API).
const TEAM_ALIASES = {
  turkeye: "turkiye",
  bosnia: "bosniaherzegovina",
  caboverde: "capeverde",
  columbia: "colombia",
  drcongo: "congodr",
  saudiaarabia: "saudiarabia",
  usa: "unitedstates",
};
const teamCanon = (team) => {
  const n = normName(team);
  return TEAM_ALIASES[n] || n;
};

// Build a team-name -> owning manager lookup from the roster data.
function makeOwnerFor(managers) {
  const map = {};
  (managers || []).forEach((m) => {
    (m.teams || []).forEach((t) => {
      map[teamCanon(t.team)] = m.name;
    });
  });
  return (team) => map[teamCanon(team)] || null;
}

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
// Compact kickoff time for tight columns, e.g. "3:00 PM" -> "3:00p".
const fmtTimeShort = (iso) =>
  fmtTime(iso).replace(" AM", "a").replace(" PM", "p");
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

const localDayKey = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
};
const dayDiffFromToday = (d) => {
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
};
// "Today" / "Tomorrow" / weekday this week, else "Monday 6/21".
const dayHeading = (key) => {
  const [y, m, dd] = key.split("-").map(Number);
  const d = new Date(y, m - 1, dd);
  const diff = dayDiffFromToday(d);
  const wd = d.toLocaleString("en-US", { weekday: "long" });
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff >= 2 && diff <= 6) return wd;
  return `${wd} ${d.getMonth() + 1}/${d.getDate()}`;
};
function TodayMatches({ schedule, managers, draftPicks }) {
  const ownerFor = makeOwnerFor(managers);
  const pickFor = (team) => draftPicks?.[teamCanon(team)] ?? null;

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
  const matches = (schedule || [])
    .filter((m) => localDayKey(m.date) === todayKey)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/60">
        <CalendarDays size={16} className="text-cyan-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
          Today's Matches
        </h2>
        {matches.length > 0 && (
          <span className="text-[11px] text-slate-500 font-normal normal-case ml-auto">
            {matches.length} {matches.length === 1 ? "match" : "matches"}
          </span>
        )}
      </div>
      <div className="px-3">
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">
            No matches today.
          </p>
        ) : (
          matches.map((m, i) => (
            <MatchRow key={i} m={m} ownerFor={ownerFor} pickFor={pickFor} />
          ))
        )}
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

function GameLog({ manager, ownerFor, pickFor }) {
  const log = buildGameLog(manager);
  return (
    <div className="rounded-lg border border-slate-700/60 bg-slate-900/40 divide-y divide-slate-700/40">
      {log.length === 0 ? (
        <p className="text-xs text-slate-500 px-3 py-2">No games played yet.</p>
      ) : (
        log.map((g, i) => {
          const oppOwner =
            g.kind === "group" && ownerFor ? ownerFor(g.opponent) : null;
          const oppPick =
            g.kind === "group" && pickFor ? pickFor(g.opponent) : null;
          return (
          <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
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
                  {oppPick != null && (
                    <span className="text-slate-600 font-light">
                      {" "}
                      ({oppPick})
                    </span>
                  )}
                  {oppOwner && (
                    <span className="text-cyan-500/80 font-light">
                      {" "}
                      · {oppOwner}
                    </span>
                  )}
                </>
              )}
            </span>
            {g.kind === "ko" ? (
              <span className="font-mono font-bold text-cyan-300 shrink-0">
                +{g.points}
              </span>
            ) : g.live ? (
              <span className="font-mono text-cyan-300 shrink-0">
                {g.gf}-{g.ga} <span className="text-[9px] uppercase">live</span>
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
          );
        })
      )}
    </div>
  );
}

const ORDINAL = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" };

function PlaceBadge({ place }) {
  if (!place || !place.pos) return null;
  // Colour by clinch status, not current position: leading a group after two
  // games isn't safe if a final-day loss could drop the team to 3rd or worse.
  const out = place.status === "out" || place.eliminated;
  const green = place.status === "in";
  const amber = !out && !green;
  const locked = place.posBest != null && place.posBest === place.posWorst;
  const range =
    place.posBest == null
      ? ORDINAL[place.pos]
      : locked
      ? ORDINAL[place.posBest]
      : `${ORDINAL[place.posBest]}–${ORDINAL[place.posWorst]}`;
  const cls = out
    ? "bg-rose-500/15 text-rose-300"
    : green
    ? "bg-emerald-500/20 text-emerald-300"
    : "bg-amber-500/20 text-amber-300";
  const title = out
    ? "Eliminated"
    : green
    ? "Knockout spot clinched"
    : `Can still finish ${range}`;
  return (
    <span
      title={title}
      className={`shrink-0 text-[9px] font-bold px-1 py-px rounded whitespace-nowrap ${cls}`}
    >
      {place.group}·{out ? "OUT" : range}
      {green ? " ✓" : ""}
    </span>
  );
}

function SquadTeams({ manager, pickFor, placeFor }) {
  return (
    <ul className="space-y-2">
      {manager.teams.map((t) => {
        const games = [...(t.group || [])].sort(
          (a, b) => new Date(a.date) - new Date(b.date)
        );
        const hasResults = games.some((g) => g.result !== "P" || g.live);
        const ng = t.nextGame;
        const pick = pickFor ? pickFor(t.team) : null;
        const place = placeFor ? placeFor(t.team) : null;
        return (
          <li key={t.team} className="text-sm">
            <div className="flex items-center gap-2">
              <span className="text-base leading-none w-6 text-center shrink-0">
                {flagFor(t.team)}
              </span>
              <span
                className={`flex-1 min-w-0 flex items-center gap-1.5 ${
                  hasResults ? "text-slate-200" : "text-slate-400"
                }`}
              >
                <span
                  className={`truncate min-w-0 ${
                    place?.eliminated ? "line-through text-slate-500" : ""
                  }`}
                >
                  {t.team}
                </span>
                {pick != null && (
                  <span className="shrink-0 text-slate-500 font-normal">
                    ({pick})
                  </span>
                )}
                <PlaceBadge place={place} />
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
  );
}

function ManagerRow({ manager, rank, ownerFor, pickFor, placeFor }) {
  const [open, setOpen] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const total = (manager.gsPoints || 0) + (manager.koPoints || 0);

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-700/20 transition-colors"
      >
        {rank != null && (
          <span
            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${
              rank === 1 ? "bg-cyan-400 text-slate-900" : "bg-slate-700 text-slate-300"
            }`}
          >
            {rank}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-100 truncate leading-tight">
            {manager.name}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="text-emerald-400">{manager.wins}W</span>
            <span className="text-amber-400">{manager.draws}D</span>
            <span className="text-rose-400">{manager.losses}L</span>
            {manager.pending > 0 && (
              <span className="text-slate-500">· {manager.pending} to play</span>
            )}
          </div>
          <div className="flex items-center gap-1 text-[10px] mt-0.5 flex-wrap">
            {manager.advanced > 0 && (
              <span
                title="Teams that have clinched a knockout spot"
                className="px-1 py-px rounded bg-emerald-500/15 text-emerald-300 font-semibold"
              >
                {manager.advanced} thru
              </span>
            )}
            {manager.bubble > 0 && (
              <span
                title="Teams still in contention"
                className="px-1 py-px rounded bg-amber-500/15 text-amber-300 font-semibold"
              >
                {manager.bubble} bubble
              </span>
            )}
            {manager.eliminated > 0 && (
              <span
                title="Teams officially eliminated"
                className="px-1 py-px rounded bg-rose-500/15 text-rose-300 font-semibold"
              >
                {manager.eliminated} out
              </span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold font-mono text-cyan-400 leading-none">
            {total}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            pts
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-slate-500 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/40 space-y-3">
          <SquadTeams manager={manager} pickFor={pickFor} placeFor={placeFor} />
          <div>
            <button
              type="button"
              onClick={() => setShowResults((s) => !s)}
              className="w-full flex items-center justify-between text-[10px] uppercase tracking-wide text-slate-500 hover:text-slate-300 transition-colors py-1"
            >
              <span>Results so far</span>
              <ChevronDown
                size={13}
                className={`transition-transform ${
                  showResults ? "rotate-180" : ""
                }`}
              />
            </button>
            {showResults && (
              <div className="mt-1">
                <GameLog
                  manager={manager}
                  ownerFor={ownerFor}
                  pickFor={pickFor}
                />
              </div>
            )}
          </div>
        </div>
      )}
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

function OddsLine({ m }) {
  if (!m.odds) return null;
  const items = [
    { key: "home", label: m.homeAbbr, ml: m.odds.home },
    { key: "draw", label: "Draw", ml: m.odds.draw },
    { key: "away", label: m.awayAbbr, ml: m.odds.away },
  ].filter((o) => o.ml);
  if (items.length === 0) return null;

  // Only highlight once a match is live/finished, marking the actual outcome.
  // Upcoming matches show odds with no highlight.
  let favKey = null;
  const scored = m.state === "post" || m.state === "in";
  if (scored && m.homeScore != null && m.awayScore != null) {
    favKey =
      m.homeScore > m.awayScore
        ? "home"
        : m.awayScore > m.homeScore
        ? "away"
        : "draw";
  }
  return (
    <div className="flex items-center justify-center gap-3 mt-0.5 pl-12 text-[10px]">
      {m.odds.locked && (
        <Lock size={9} className="text-slate-600 shrink-0" title="Final odds" />
      )}
      {items.map((o) => (
        <span
          key={o.key}
          className={
            o.key === favKey
              ? "text-cyan-300 font-semibold"
              : "text-slate-500"
          }
        >
          {o.label} <span className="font-mono">{o.ml}</span>
        </span>
      ))}
    </div>
  );
}

const STAKE_ACCENT = {
  high: "border-l-emerald-500/60",
  medium: "border-l-amber-500/50",
  dead: "border-l-slate-600/50",
};

const STAKE_DOT = {
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  dead: "bg-slate-500",
};

const STAKE_TONE = {
  good: "text-emerald-400",
  warn: "text-amber-400",
  bad: "text-rose-400/80",
  neutral: "text-slate-400",
};

const probPill = (p) =>
  p >= 0.8
    ? "bg-emerald-500/15 text-emerald-300"
    : p >= 0.35
    ? "bg-amber-500/15 text-amber-300"
    : "bg-rose-500/15 text-rose-300";

// Keep precision for long shots: 0.3% rather than rounding to 0%.
const fmtPct = (p) => {
  const v = p * 100;
  if (v <= 0) return "0%";
  if (v < 0.1) return "<0.1%";
  if (v < 10) {
    const s = v.toFixed(1);
    return `${s.endsWith(".0") ? s.slice(0, -2) : s}%`;
  }
  return `${Math.round(v)}%`;
};

function StakeTeamRow({ abbr, note }) {
  return (
    <div className="flex items-center gap-1.5 text-[10px] leading-tight py-0.5">
      <span className="text-slate-300 font-semibold w-9 shrink-0">{abbr}</span>
      <span className={`min-w-0 ${STAKE_TONE[note.tone] || STAKE_TONE.neutral}`}>
        {note.need}
      </span>
      {note.prob != null && !note.eliminated && (
        <span
          className={`ml-auto shrink-0 px-1 py-px rounded font-mono ${probPill(
            note.prob
          )}`}
          title="Model's chance this team reaches the knockout round, from live Vegas odds"
        >
          {fmtPct(note.prob)} to advance
        </span>
      )}
    </div>
  );
}

function StakeDetail({ abbr, lines }) {
  if (!lines || lines.length === 0) return null;
  return (
    <div className="text-[10px] leading-tight">
      <span className="text-slate-400 font-semibold">{abbr}</span>
      <ul className="mt-0.5 space-y-0.5">
        {lines.map((l, i) => (
          <li key={i} className="text-slate-400 pl-2">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StakesLine({ m }) {
  const s = m.stakes;
  const [open, setOpen] = useState(false);
  const [showScen, setShowScen] = useState(false);
  if (!s || !s.teams) return null;
  const hNote = s.teams[teamCanon(m.home)];
  const aNote = s.teams[teamCanon(m.away)];
  if (!hNote && !aNote) return null;
  const accent = STAKE_ACCENT[s.level] || STAKE_ACCENT.dead;
  const dot = STAKE_DOT[s.level] || STAKE_DOT.dead;
  const hasDetail =
    (hNote?.detail?.length || 0) + (aNote?.detail?.length || 0) > 0;
  return (
    <div className="mt-1 ml-11 mr-0.5">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          open
            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
            : "border-slate-600/70 bg-slate-700/40 text-slate-200 hover:bg-slate-600/50 hover:border-cyan-500/40 hover:text-cyan-200"
        }`}
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        What's at stake
        <ChevronDown
          size={12}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          className={`mt-1 rounded-md bg-slate-900/40 border border-slate-700/40 border-l-2 ${accent} px-2 py-1`}
        >
          {hNote && <StakeTeamRow abbr={m.homeAbbr || m.home} note={hNote} />}
          {aNote && <StakeTeamRow abbr={m.awayAbbr || m.away} note={aNote} />}
          {hasDetail && (
            <button
              onClick={() => setShowScen((o) => !o)}
              className="mt-0.5 text-[9px] uppercase tracking-wider text-cyan-500/80 hover:text-cyan-300"
            >
              {showScen ? "Hide scenarios" : "See scenarios"}
            </button>
          )}
          {showScen && (
            <div className="mt-1 pt-1 border-t border-slate-700/40 space-y-1.5">
              {hNote?.detail?.length > 0 && (
                <StakeDetail abbr={m.homeAbbr || m.home} lines={hNote.detail} />
              )}
              {aNote?.detail?.length > 0 && (
                <StakeDetail abbr={m.awayAbbr || m.away} lines={aNote.detail} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MatchRow({ m, ownerFor, pickFor }) {
  const finished = m.state === "post";
  const live = m.state === "in";
  const scored = finished || live;
  const homeWon = scored && m.homeScore > m.awayScore;
  const awayWon = scored && m.awayScore > m.homeScore;
  const homeOwner = ownerFor(m.home);
  const awayOwner = ownerFor(m.away);
  const homePick = pickFor ? pickFor(m.home) : null;
  const awayPick = pickFor ? pickFor(m.away) : null;
  return (
    <div className="py-1.5 border-t border-slate-700/30 first:border-t-0">
      <div className="flex items-center gap-1.5 text-xs">
        <span className="w-9 shrink-0 text-right leading-tight text-[10px]">
          {finished ? (
            <span className="text-slate-600">FT</span>
          ) : live ? (
            <span className="text-cyan-400 font-medium">
              {m.detail || "LIVE"}
            </span>
          ) : (
            <span className="text-slate-500 font-light">
              {fmtTimeShort(m.date)}
            </span>
          )}
        </span>
        <div className="flex-1 min-w-0 flex flex-col items-end">
          <span
            className={`flex items-center gap-1.5 min-w-0 max-w-full ${
              homeWon ? "text-slate-100 font-semibold" : "text-slate-300"
            }`}
          >
            <span className="truncate min-w-0">{m.home}</span>
            {homePick != null && (
              <span className="shrink-0 text-slate-500 font-normal">
                ({homePick})
              </span>
            )}
            <span className="shrink-0">{flagFor(m.home)}</span>
          </span>
          {homeOwner && (
            <span className="text-[10px] text-cyan-500/80 font-light truncate max-w-full">
              {homeOwner}
            </span>
          )}
        </div>
        <span className="w-10 shrink-0 text-center font-mono">
          {scored ? (
            <span
              className={live ? "text-cyan-400 font-bold" : "text-slate-100 font-bold"}
            >
              {m.homeScore}–{m.awayScore}
            </span>
          ) : (
            <span className="text-slate-600">v</span>
          )}
        </span>
        <div className="flex-1 min-w-0 flex flex-col items-start">
          <span
            className={`flex items-center gap-1.5 min-w-0 max-w-full ${
              awayWon ? "text-slate-100 font-semibold" : "text-slate-300"
            }`}
          >
            <span className="shrink-0">{flagFor(m.away)}</span>
            <span className="truncate min-w-0">{m.away}</span>
            {awayPick != null && (
              <span className="shrink-0 text-slate-500 font-normal">
                ({awayPick})
              </span>
            )}
          </span>
          {awayOwner && (
            <span className="text-[10px] text-cyan-500/80 font-light truncate max-w-full">
              {awayOwner}
            </span>
          )}
        </div>
        {m.group && (
          <span className="w-4 shrink-0 text-center text-[10px] text-slate-500 font-medium">
            {m.group}
          </span>
        )}
      </div>
      <OddsLine m={m} />
      <StakesLine m={m} />
    </div>
  );
}

function DayCard({ dayKey, matches, ownerFor, pickFor }) {
  const dayMatches = [...matches].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60">
        <h3 className="text-sm font-bold text-slate-100">
          {dayHeading(dayKey)}
        </h3>
        <span className="text-[11px] text-slate-500">
          {dayMatches.length} {dayMatches.length === 1 ? "match" : "matches"}
        </span>
      </div>
      <div className="px-3">
        {dayMatches.map((m, i) => (
          <MatchRow key={i} m={m} ownerFor={ownerFor} pickFor={pickFor} />
        ))}
      </div>
    </div>
  );
}

function ScheduleView({ schedule, managers, draftPicks }) {
  const [showPast, setShowPast] = useState(false);

  if (!schedule || schedule.length === 0) {
    return (
      <p className="text-center text-slate-500 py-12">Schedule unavailable.</p>
    );
  }
  const ownerFor = makeOwnerFor(managers);
  const pickFor = (team) => draftPicks?.[teamCanon(team)] ?? null;

  const byDay = {};
  schedule.forEach((m) => {
    const k = localDayKey(m.date);
    (byDay[k] = byDay[k] || []).push(m);
  });
  const days = Object.keys(byDay).sort();

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(now.getDate()).padStart(2, "0")}`;
  const pastDays = days.filter((d) => d < todayKey);
  const upcomingDays = days.filter((d) => d >= todayKey);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-600">
        Moneyline odds (DraftKings) · favorite highlighted · 🔒 = final odds ·
        letter = group.
      </p>

      {pastDays.length > 0 && (
        <button
          type="button"
          onClick={() => setShowPast((s) => !s)}
          className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
        >
          <ChevronDown
            size={13}
            className={`transition-transform ${showPast ? "rotate-180" : ""}`}
          />
          {showPast ? "Hide" : "Show"} previous matches ({pastDays.length}{" "}
          {pastDays.length === 1 ? "day" : "days"})
        </button>
      )}

      {showPast &&
        pastDays.map((key) => (
          <DayCard
            key={key}
            dayKey={key}
            matches={byDay[key]}
            ownerFor={ownerFor}
            pickFor={pickFor}
          />
        ))}

      {upcomingDays.length === 0 ? (
        <p className="text-center text-slate-500 py-8">
          No upcoming matches.
        </p>
      ) : (
        upcomingDays.map((key) => (
          <DayCard
            key={key}
            dayKey={key}
            matches={byDay[key]}
            ownerFor={ownerFor}
            pickFor={pickFor}
          />
        ))
      )}
    </div>
  );
}

function GroupTable({ group, ownerFor, pickFor }) {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-cyan-400 text-slate-900 text-xs font-bold">
          {group.group}
        </span>
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Group {group.group}
        </h3>
        {group.live && (
          <span
            className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-300"
            title="Table includes an in-progress match — provisional"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Live
          </span>
        )}
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full text-xs min-w-[360px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-slate-500">
              <th className="text-left font-medium py-2 pl-3 pr-2">Team</th>
              <th className="font-medium px-1.5 text-center">P</th>
              <th className="font-medium px-1.5 text-center">W</th>
              <th className="font-medium px-1.5 text-center">D</th>
              <th className="font-medium px-1.5 text-center">L</th>
              <th className="font-medium px-1.5 text-center">GF</th>
              <th className="font-medium px-1.5 text-center">GA</th>
              <th className="font-medium px-1.5 text-center">GD</th>
              <th className="font-medium pl-1.5 pr-3 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {group.teams.map((t, i) => {
              const owner = ownerFor(t.team);
              // Colour by clinch status, not current position: a team sitting
              // 1st after 2 games that could still drop out is amber, not green.
              const out = t.status === "out";
              const green = t.status === "in";
              const amber = !out && !green;
              const pick = pickFor ? pickFor(t.team) : null;
              // What can still happen to this team's finishing position?
              const locked = t.posBest != null && t.posBest === t.posWorst;
              const range =
                t.posBest == null
                  ? ORDINAL[t.pos]
                  : locked
                  ? ORDINAL[t.posBest]
                  : `${ORDINAL[t.posBest]}–${ORDINAL[t.posWorst]}`;
              const badgeText = out
                ? "OUT"
                : green
                ? `${range} ✓`
                : range;
              return (
                <tr
                  key={t.canon}
                  className={`border-t border-slate-700/40 ${
                    out
                      ? "bg-rose-500/5"
                      : green
                      ? "bg-emerald-500/5"
                      : amber
                      ? "bg-amber-500/5"
                      : ""
                  }`}
                >
                  <td className="py-1.5 pl-3 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-4 text-center text-[10px] font-mono shrink-0 ${
                          out
                            ? "text-rose-400/70"
                            : green
                            ? "text-emerald-400"
                            : amber
                            ? "text-amber-400"
                            : "text-slate-500"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className={`shrink-0 ${out ? "opacity-60" : ""}`}>
                        {flagFor(t.team)}
                      </span>
                      <div className="min-w-0">
                        <div className="text-slate-200 truncate leading-tight flex items-center gap-1">
                          <span
                            className={`truncate ${
                              out ? "line-through text-slate-500" : ""
                            }`}
                          >
                            {t.team}
                          </span>
                          {pick != null && (
                            <span className="shrink-0 text-[10px] text-slate-500 font-normal">
                              ({pick})
                            </span>
                          )}
                          <span
                            className={`shrink-0 text-[8px] font-bold px-1 py-px rounded whitespace-nowrap ${
                              out
                                ? "bg-rose-500/20 text-rose-300"
                                : green
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                            title={
                              out
                                ? "Eliminated"
                                : green
                                ? "Knockout spot clinched"
                                : `Can still finish ${badgeText}`
                            }
                          >
                            {badgeText}
                          </span>
                        </div>
                        {owner && (
                          <div className="text-[10px] text-cyan-500/80 font-light truncate leading-tight">
                            {owner}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-1.5 text-center text-slate-400">
                    {t.played}
                  </td>
                  <td className="px-1.5 text-center text-slate-300">{t.w}</td>
                  <td className="px-1.5 text-center text-slate-300">{t.d}</td>
                  <td className="px-1.5 text-center text-slate-300">{t.l}</td>
                  <td className="px-1.5 text-center text-slate-400">{t.gf}</td>
                  <td className="px-1.5 text-center text-slate-400">{t.ga}</td>
                  <td className="px-1.5 text-center text-slate-300">
                    {t.gd > 0 ? `+${t.gd}` : t.gd}
                  </td>
                  <td className="pl-1.5 pr-3 text-center font-mono font-bold text-cyan-400">
                    {t.pts}
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

function ThirdPlaceRace({ ranking, ownerFor, live }) {
  const [open, setOpen] = useState(null);
  if (!ranking || ranking.length === 0) return null;
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60 flex-wrap">
        <Trophy size={14} className="text-amber-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
          Bubble Boys
        </h3>
        {live && (
          <span
            className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-rose-300"
            title="Standings and odds include in-progress matches"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
            Live
          </span>
        )}
        <span className="text-[10px] text-slate-500">
          best 8 thirds advance · anyone who could slip into the race · tap for
          details
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-1.5 text-[10px] border-b border-slate-700/40">
        <span className="text-emerald-300">● Clinched</span>
        <span className="text-amber-300">● Bubble</span>
        <span className="text-rose-300">● Out</span>
        <span className="text-slate-500">% = chance to advance (live odds)</span>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 text-[9px] uppercase tracking-wider text-slate-500 border-b border-slate-700/40">
        <span className="w-5 text-center shrink-0" title="Third-place rank">
          #
        </span>
        <span className="w-5 text-center shrink-0" />
        <span className="w-4 text-center shrink-0" title="Group">
          Grp
        </span>
        <span className="flex-1 min-w-0">Team / Owner</span>
        <span className="w-7 text-right shrink-0" title="Points">
          Pts
        </span>
        <span className="w-8 text-right shrink-0" title="Goal difference">
          GD
        </span>
        <span className="w-7 text-right shrink-0" title="Goals for">
          GF
        </span>
        <span className="w-[58px] text-center shrink-0">Status</span>
        <span className="w-3 shrink-0" />
      </div>
      <div className="divide-y divide-slate-700/40">
        {ranking.map((t) => {
          const owner = ownerFor(t.team);
          const remaining = Math.max(0, 3 - (t.played || 0));
          const status = t.status || (t.rank <= 8 ? "bubble" : "out");
          const isIn = status === "in";
          const isOut = status === "out";
          const isOpen = open === t.canon;
          const scenarios = t.detail || [];
          const expandable = !!t.need || scenarios.length > 0;
          const rowCls = isIn
            ? "bg-emerald-500/5"
            : isOut
            ? "opacity-50"
            : "bg-amber-500/5";
          const numCls = isIn
            ? "text-emerald-400 font-bold"
            : isOut
            ? "text-slate-600"
            : "text-amber-400 font-bold";
          const badge = isIn
            ? { cls: "bg-emerald-500/20 text-emerald-300", text: "CLINCHED" }
            : isOut
            ? { cls: "bg-rose-500/20 text-rose-300", text: "OUT" }
            : { cls: "bg-amber-500/20 text-amber-300", text: "BUBBLE" };
          return (
            <div key={t.canon}>
            <div
              onClick={() =>
                expandable && setOpen((o) => (o === t.canon ? null : t.canon))
              }
              className={`flex items-center gap-2 px-3 py-1.5 text-xs ${rowCls} ${
                expandable ? "cursor-pointer hover:bg-slate-700/30" : ""
              }`}
            >
              <span
                className={`w-5 text-center font-mono text-[11px] shrink-0 ${numCls}`}
              >
                {t.rank}
              </span>
              <span
                className={`w-5 text-center shrink-0 ${isOut ? "opacity-60" : ""}`}
              >
                {flagFor(t.team)}
              </span>
              <span className="w-4 text-center text-[9px] text-slate-500 font-mono shrink-0">
                {t.group}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-200 leading-tight flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className={isOut ? "line-through text-slate-500" : ""}>
                    {t.team}
                  </span>
                  {t.pos !== 3 && ORDINAL[t.pos] && (
                    <span
                      className="shrink-0 text-[8px] font-semibold px-1 py-px rounded bg-slate-600/40 text-slate-300 whitespace-nowrap"
                      title={`Currently ${ORDINAL[t.pos]} — could still land in the third-place race`}
                    >
                      {ORDINAL[t.pos]} now
                    </span>
                  )}
                  {remaining > 0 && (
                    <span className="shrink-0 text-[8px] font-semibold px-1 py-px rounded bg-cyan-500/15 text-cyan-300">
                      {remaining} to play
                    </span>
                  )}
                  {t.posBest != null &&
                    t.posWorst != null &&
                    t.posBest !== t.posWorst && (
                      <span
                        className="shrink-0 text-[8px] font-semibold px-1 py-px rounded bg-slate-600/40 text-slate-300 whitespace-nowrap"
                        title={`Can still finish ${ORDINAL[t.posBest]}–${ORDINAL[t.posWorst]} in the group`}
                      >
                        {ORDINAL[t.posBest]}–{ORDINAL[t.posWorst]}
                      </span>
                    )}
                </div>
                {owner && (
                  <div className="text-[10px] text-cyan-500/80 font-light truncate leading-tight">
                    {owner}
                  </div>
                )}
              </div>
              <span className="w-7 text-right shrink-0 font-mono text-slate-300 text-[11px] font-bold">
                {t.pts}
              </span>
              <span className="shrink-0 font-mono text-slate-500 text-[11px] w-8 text-right">
                {t.gd > 0 ? `+${t.gd}` : t.gd}
              </span>
              <span className="shrink-0 font-mono text-slate-500 text-[11px] w-7 text-right">
                {t.gf}
              </span>
              <div className="w-[58px] shrink-0 flex flex-col items-center gap-0.5">
                <span
                  className={`text-[8px] font-bold px-1 py-px rounded w-full text-center ${badge.cls}`}
                >
                  {badge.text}
                </span>
                {!isIn && !isOut && t.prob != null && (
                  <span
                    className="text-[9px] font-mono text-amber-300"
                    title="Chance to advance (live odds)"
                  >
                    {fmtPct(t.prob)}
                  </span>
                )}
              </div>
              <span className="w-3 shrink-0 flex justify-center text-slate-500">
                {expandable && (
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </span>
            </div>
            {isOpen && expandable && (
              <div className={`px-3 py-2 ${rowCls}`}>
                {t.need && (
                  <div className="text-[11px] text-slate-200 font-medium mb-1 pl-7">
                    {t.need}
                  </div>
                )}
                {scenarios.length > 0 && (
                  <ul className="space-y-0.5 pl-7">
                    {scenarios.map((l, i) => (
                      <li key={i} className="text-[10px] text-slate-400">
                        {l}
                      </li>
                    ))}
                  </ul>
                )}
                {scenarios.length === 0 && !t.need && (
                  <div className="text-[10px] text-slate-500 pl-7">
                    No remaining games — fate decided by other groups.
                  </div>
                )}
              </div>
            )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GroupsView({ groups, managers, thirdPlace, draftPicks }) {
  if (!groups || groups.length === 0) {
    return (
      <p className="text-center text-slate-500 py-12">Groups unavailable.</p>
    );
  }
  const ownerMap = {};
  (managers || []).forEach((m) => {
    (m.teams || []).forEach((t) => {
      ownerMap[teamCanon(t.team)] = m.name;
    });
  });
  const ownerFor = (team) => ownerMap[teamCanon(team)] || null;
  const pickFor = (team) => draftPicks?.[teamCanon(team)] ?? null;

  const anyLive = groups.some((g) => g.live);
  return (
    <div className="space-y-3">
      <ThirdPlaceRace
        ranking={thirdPlace?.ranking}
        ownerFor={ownerFor}
        live={anyLive}
      />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500/40 align-middle mr-1" />
          Knockout spot clinched (✓)
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-amber-500/40 align-middle mr-1" />
          Still in the balance
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-rose-500/40 align-middle mr-1" />
          Eliminated
        </span>
        <span className="basis-full text-slate-600">
          Badge shows the range a team can still finish — e.g.{" "}
          <span className="text-amber-300/80 font-medium">1st–3rd</span> means
          they lead now but could slip to third. Top 2 advance + best 8 thirds;
          tiebreakers: pts → GD → goals → head-to-head.
        </span>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {groups.map((g) => (
          <GroupTable
            key={g.group}
            group={g}
            ownerFor={ownerFor}
            pickFor={pickFor}
          />
        ))}
      </div>
    </div>
  );
}

// Vertical match order per round so the connector tree lines up correctly.
const BR_ORDER = {
  r32: [74, 77, 73, 75, 83, 84, 81, 82, 76, 78, 79, 80, 86, 88, 85, 87],
  r16: [89, 90, 93, 94, 91, 92, 95, 96],
  qf: [97, 98, 99, 100],
  sf: [101, 102],
  final: [104],
};
const BR_COLS = [
  { key: "r32", label: "Round of 32" },
  { key: "r16", label: "Round of 16" },
  { key: "qf", label: "Quarters" },
  { key: "sf", label: "Semis" },
  { key: "final", label: "Final" },
];

const koDayParts = (ymd) => {
  const [y, mo, d] = (ymd || "").split("-").map(Number);
  if (!y) return null;
  const date = new Date(y, mo - 1, d);
  return { date, diff: dayDiffFromToday(date), md: `${mo}/${d}` };
};
// Relative day for a bracket card: "Today", "Tomorrow 6/28", "Friday", "Sat 7/4".
const koDayLabel = (ymd) => {
  const p = koDayParts(ymd);
  if (!p) return "";
  const { date, diff, md } = p;
  if (diff === 0) return "Today";
  if (diff === 1) return `Tomorrow ${md}`;
  if (diff === -1) return "Yesterday";
  if (diff >= 2 && diff <= 6)
    return date.toLocaleString("en-US", { weekday: "long" });
  return `${date.toLocaleString("en-US", { weekday: "short" })} ${md}`;
};
const koIsToday = (ymd) => {
  const p = koDayParts(ymd);
  return !!p && p.diff === 0;
};

// Show the World Cup host-city name instead of the stadium.
const CITY_SHORT = {
  "New York/New Jersey": "NY/NJ",
  "San Francisco Bay Area": "SF Bay Area",
  "Mexico City": "Mexico City",
  "Kansas City": "Kansas City",
};
const shortCity = (city) => CITY_SHORT[city] || city;

function BracketSlot({ slot, score, pens, isWinner, decided, live, owner, pick }) {
  const known = !!slot.team;
  const hasMeta = owner || pick != null;
  return (
    <div
      className={`flex items-center gap-1 px-1.5 h-[24px] ${
        decided && !isWinner ? "opacity-45" : ""
      }`}
    >
      <span className="text-[11px] leading-none shrink-0">
        {known ? flagFor(slot.team) : "·"}
      </span>
      {known ? (
        <>
          <span
            className={`shrink-0 text-[10px] leading-none ${
              isWinner ? "text-slate-50 font-bold" : "text-slate-200 font-semibold"
            }`}
            title={slot.team}
          >
            {slot.abbr || slot.team}
          </span>
          {hasMeta && (
            <span className="flex-1 min-w-0 truncate text-[8px] leading-none text-cyan-500/70 font-light">
              {owner || "—"}
              {pick != null && <span className="text-slate-600"> #{pick}</span>}
            </span>
          )}
          {!hasMeta && <span className="flex-1" />}
        </>
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-[10px] leading-none text-slate-500 italic"
          title={slot.label}
        >
          {slot.label}
        </span>
      )}
      {score != null && (
        <span
          className={`shrink-0 font-mono text-[10px] leading-none ${
            live
              ? "text-cyan-300 font-bold"
              : isWinner
              ? "text-slate-50 font-bold"
              : "text-slate-400"
          }`}
        >
          {score}
          {pens != null && (
            <span className="text-[8px] text-slate-500"> ({pens})</span>
          )}
        </span>
      )}
    </div>
  );
}

function BracketMatch({ m, ownerFor, pickFor, colHeight, count }) {
  const live = m.state === "in";
  const post = m.state === "post";
  const decided = post && !!m.winnerCanon;
  const hWin = m.winnerCanon && m.home.canon === m.winnerCanon;
  const aWin = m.winnerCanon && m.away.canon === m.winnerCanon;
  const hOwner = m.home.team && ownerFor ? ownerFor(m.home.team) : null;
  const aOwner = m.away.team && ownerFor ? ownerFor(m.away.team) : null;
  const hPick = m.home.team && pickFor ? pickFor(m.home.team) : null;
  const aPick = m.away.team && pickFor ? pickFor(m.away.team) : null;
  const isToday = koIsToday(m.date);
  return (
    <div
      style={{ minHeight: colHeight ? colHeight / count : undefined }}
      className="flex items-center"
    >
      <div
        className={`w-full rounded-md border overflow-hidden ${
          isToday
            ? "border-white/60 bg-slate-800/70 ring-1 ring-white/20"
            : "border-slate-700/60 bg-slate-800/50"
        }`}
      >
        <div className="flex items-center justify-between px-1.5 py-[2px] bg-slate-900/50 border-b border-slate-700/40">
          <span
            className={`text-[8px] truncate ${
              isToday ? "text-white font-bold" : "text-slate-500 font-medium"
            }`}
          >
            {koDayLabel(m.date)} · {shortCity(m.city)}
          </span>
          {live ? (
            <span className="text-[8px] text-cyan-400 font-bold shrink-0 ml-1">
              {m.detail || "LIVE"}
            </span>
          ) : (
            <span className="text-[8px] text-slate-600 shrink-0 ml-1">
              M{m.no}
            </span>
          )}
        </div>
        <BracketSlot
          slot={m.home}
          score={m.state !== "pre" ? m.homeScore : null}
          pens={m.homePens}
          isWinner={hWin}
          decided={decided}
          live={live}
          owner={hOwner}
          pick={hPick}
        />
        <div className="border-t border-slate-700/40" />
        <BracketSlot
          slot={m.away}
          score={m.state !== "pre" ? m.awayScore : null}
          pens={m.awayPens}
          isWinner={aWin}
          decided={decided}
          live={live}
          owner={aOwner}
          pick={aPick}
        />
      </div>
    </div>
  );
}

function BracketView({ bracket, managers, draftPicks }) {
  if (!bracket || bracket.length === 0) {
    return (
      <p className="text-center text-slate-500 py-12">Bracket unavailable.</p>
    );
  }
  const byNo = {};
  bracket.forEach((m) => (byNo[m.no] = m));
  const ownerMap = {};
  (managers || []).forEach((m) => {
    (m.teams || []).forEach((t) => {
      ownerMap[teamCanon(t.team)] = m.name;
    });
  });
  const ownerFor = (team) => ownerMap[teamCanon(team)] || null;
  const pickFor = (team) => draftPicks?.[teamCanon(team)] ?? null;

  const third = byNo[103];
  const COL_H = 1040;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
          Knockout Bracket
        </h2>
        <p className="text-[10px] text-slate-600">
          Projected from current standings · updates live as games finish.
        </p>
      </div>

      <div className="overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-2">
        <div className="text-[10px] text-cyan-500/70 font-medium mb-1">
          ← swipe sideways for all rounds →
        </div>
        <div className="flex" style={{ minWidth: 900 }}>
          {BR_COLS.map((col, ci) => {
            const order = BR_ORDER[col.key];
            const next = BR_COLS[ci + 1];
            return (
              <div key={col.key} className="flex shrink-0">
                <div
                  className="flex flex-col shrink-0"
                  style={{ width: ci === 0 ? 150 : 132 }}
                >
                  <div className="text-center text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 h-4">
                    {col.label}
                  </div>
                  <div
                    className="flex flex-col justify-around px-1"
                    style={{ height: COL_H }}
                  >
                    {order.map((no) =>
                      byNo[no] ? (
                        <BracketMatch
                          key={no}
                          m={byNo[no]}
                          ownerFor={ownerFor}
                          pickFor={pickFor}
                          colHeight={COL_H}
                          count={order.length}
                        />
                      ) : null
                    )}
                  </div>
                </div>
                {next && (
                  <div className="flex flex-col shrink-0" style={{ width: 12 }}>
                    <div className="h-4 mb-1" />
                    <div
                      className="flex flex-col justify-around"
                      style={{ height: COL_H }}
                    >
                      {Array.from({ length: BR_ORDER[next.key].length }).map(
                        (_, i) => (
                          <div
                            key={i}
                            className="flex items-center"
                            style={{ flex: 1 }}
                          >
                            <div
                              className="w-full"
                              style={{
                                height: "50%",
                                borderRight: "1px solid #334155",
                                borderTop: "1px solid #334155",
                                borderBottom: "1px solid #334155",
                                borderTopRightRadius: 3,
                                borderBottomRightRadius: 3,
                              }}
                            />
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {third && (
        <div className="max-w-xs">
          <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
            Third-Place Match
          </div>
          <BracketMatch m={third} ownerFor={ownerFor} pickFor={pickFor} count={1} />
        </div>
      )}
    </div>
  );
}

function Tabs({ view, setView }) {
  const tabs = [
    { id: "pool", label: "Pool", icon: Users },
    { id: "groups", label: "Groups", icon: LayoutGrid },
    { id: "bracket", label: "Bracket", icon: GitBranch },
    { id: "schedule", label: "Schedule", icon: CalendarDays },
    { id: "scoring", label: "Scoring", icon: Globe },
  ];
  return (
    <div className="inline-flex p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl mb-4 max-w-full overflow-x-auto">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = view === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors shrink-0 whitespace-nowrap ${
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

  // Keep scores, standings and odds fresh while games are on. Poll fast when
  // anything is live, slower otherwise, and pause when the tab is hidden.
  const isLive = !!data?.live;
  useEffect(() => {
    const everyMs = isLive ? 15000 : 90000;
    const id = setInterval(() => {
      if (!document.hidden) load(true);
    }, everyMs);
    const onVisible = () => {
      if (!document.hidden) load(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isLive, load]);

  const rankByName = {};
  if (data?.standings) {
    data.standings.forEach((s, i) => {
      rankByName[s.name] = i + 1;
    });
  }

  const placeByCanon = {};
  (data?.groups || []).forEach((g) => {
    g.teams.forEach((t) => {
      placeByCanon[t.canon] = {
        group: g.group,
        pos: t.pos,
        advance: t.advance,
        eliminated: t.eliminated,
        status: t.status,
        posBest: t.posBest,
        posWorst: t.posWorst,
        complete: g.complete,
      };
    });
  });
  const placeFor = (team) => placeByCanon[teamCanon(team)] || null;

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-900 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 leading-tight">
              <span>🏆</span>
              <span className="truncate">{data?.title || "World Cup Pool"}</span>
            </h1>
            <p className="text-[10px] text-slate-500 truncate">
              {data?.stage || "Group Stage"} · auto-updated from ESPN
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 shrink-0"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-4">
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
              <div className="space-y-4">
                <TodayMatches
                  schedule={data.schedule}
                  managers={data.managers}
                  draftPicks={data.draftPicks}
                />

                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Squads
                  </h2>
                  <p className="text-[11px] text-slate-600 mb-3">
                    Ranked first to last · tap a manager to see their squad &
                    results.
                  </p>
                  <div className="grid lg:grid-cols-2 gap-2">
                    {[...data.managers]
                      .sort(
                        (a, b) =>
                          (rankByName[a.name] || 99) - (rankByName[b.name] || 99)
                      )
                      .map((m) => (
                        <ManagerRow
                          key={m.name}
                          manager={m}
                          rank={rankByName[m.name]}
                          ownerFor={makeOwnerFor(data.managers)}
                          pickFor={(team) =>
                            data.draftPicks?.[teamCanon(team)] ?? null
                          }
                          placeFor={placeFor}
                        />
                      ))}
                  </div>
                </div>
              </div>
            ) : view === "groups" ? (
              <GroupsView
                groups={data.groups}
                managers={data.managers}
                thirdPlace={data.thirdPlace}
                draftPicks={data.draftPicks}
              />
            ) : view === "bracket" ? (
              <BracketView
                bracket={data.bracket}
                managers={data.managers}
                draftPicks={data.draftPicks}
              />
            ) : view === "schedule" ? (
              <ScheduleView
                schedule={data.schedule}
                managers={data.managers}
                draftPicks={data.draftPicks}
              />
            ) : (
              <div className="max-w-xl">
                <ScoringRules koScoring={data.koScoring} />
              </div>
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
