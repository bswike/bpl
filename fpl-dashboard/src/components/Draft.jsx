import {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  GitBranch,
  Trophy,
  Save,
  RotateCcw,
  X,
  Loader2,
  RefreshCw,
  Check,
  Pencil,
  Trash2,
  Plus,
  Lock,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize,
} from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import LoadingSpinner from "./LoadingSpinner";

// ---------------------------------------------------------------------------
// Shared helpers (mirrors Footie.jsx so the bracket looks identical).
// ---------------------------------------------------------------------------
const FLAGS = {
  France: "🇫🇷", Uruguay: "🇺🇾", Switzerland: "🇨🇭", Scotland: "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  Czechia: "🇨🇿", Haiti: "🇭🇹", Spain: "🇪🇸", Japan: "🇯🇵", Turkeye: "🇹🇷",
  Türkiye: "🇹🇷", Bosnia: "🇧🇦", "Bosnia-Herzegovina": "🇧🇦", Algeria: "🇩🇿",
  "Cabo Verde": "🇨🇻", "Cape Verde": "🇨🇻", England: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", Norway: "🇳🇴",
  Ecuador: "🇪🇨", Australia: "🇦🇺", Panama: "🇵🇦", Curacao: "🇨🇼", Curaçao: "🇨🇼",
  Brazil: "🇧🇷", Mexico: "🇲🇽", Canada: "🇨🇦", Paraguay: "🇵🇾", Iran: "🇮🇷",
  Iraq: "🇮🇶", Argentina: "🇦🇷", Belgium: "🇧🇪", Croatia: "🇭🇷",
  "South Korea": "🇰🇷", Tunisia: "🇹🇳", Jordan: "🇯🇴", Portugal: "🇵🇹",
  Columbia: "🇨🇴", Colombia: "🇨🇴", Senegal: "🇸🇳", Sweden: "🇸🇪",
  "South Africa": "🇿🇦", "DR Congo": "🇨🇩", "Congo DR": "🇨🇩", Germany: "🇩🇪",
  Morocco: "🇲🇦", Austria: "🇦🇹", Ghana: "🇬🇭", "Saudia Arabia": "🇸🇦",
  "Saudi Arabia": "🇸🇦", Qatar: "🇶🇦", USA: "🇺🇸", "United States": "🇺🇸",
  Netherlands: "🇳🇱", "Ivory Coast": "🇨🇮", Egypt: "🇪🇬", Uzbekistan: "🇺🇿",
  "New Zealand": "🇳🇿",
};
const normName = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const FLAG_ALIASES = {
  capeverde: "caboverde", turkiye: "turkeye", colombia: "columbia",
  congodr: "drcongo", unitedstates: "usa", bosniaherzegovina: "bosnia",
};
const FLAG_NORM = {};
Object.entries(FLAGS).forEach(([k, v]) => {
  FLAG_NORM[normName(k)] = v;
});
const flagFor = (team) => {
  const n = normName(team);
  return FLAG_NORM[n] || FLAG_NORM[FLAG_ALIASES[n]] || "⚽";
};

const dayDiffFromToday = (d) => {
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((a - b) / 86400000);
};
const koDayParts = (ymd) => {
  const [y, mo, d] = (ymd || "").split("-").map(Number);
  if (!y) return null;
  const date = new Date(y, mo - 1, d);
  return { date, diff: dayDiffFromToday(date), md: `${mo}/${d}` };
};
const koDayLabel = (ymd) => {
  const p = koDayParts(ymd);
  if (!p) return "";
  return `${p.date.toLocaleString("en-US", { weekday: "short" })} ${p.md}`;
};
const koIsToday = (ymd) => {
  const p = koDayParts(ymd);
  return !!p && p.diff === 0;
};
const koTimeShort = (t) => {
  const m = String(t || "").match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return "";
  const min = m[2] === "00" ? "" : `:${m[2]}`;
  return `${m[1]}${min}${m[3].toUpperCase() === "PM" ? "p" : "a"}`;
};
const CITY_SHORT = {
  "New York/New Jersey": "NY/NJ", "San Francisco Bay Area": "SF Bay Area",
  "Mexico City": "Mexico", "Kansas City": "KC", "Los Angeles": "LA",
  Atlanta: "ATL", Philadelphia: "Philly",
};
const shortCity = (city) => CITY_SHORT[city] || city;

// Vertical match order per round so the connector tree lines up.
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

// Winner/loser feeds for matches 89-104 (R32 = 73-88 come straight from groups).
const FEEDS = {
  89: { a: { mw: 74 }, b: { mw: 77 } },
  90: { a: { mw: 73 }, b: { mw: 75 } },
  91: { a: { mw: 76 }, b: { mw: 78 } },
  92: { a: { mw: 79 }, b: { mw: 80 } },
  93: { a: { mw: 83 }, b: { mw: 84 } },
  94: { a: { mw: 81 }, b: { mw: 82 } },
  95: { a: { mw: 86 }, b: { mw: 88 } },
  96: { a: { mw: 85 }, b: { mw: 87 } },
  97: { a: { mw: 89 }, b: { mw: 90 } },
  98: { a: { mw: 93 }, b: { mw: 94 } },
  99: { a: { mw: 91 }, b: { mw: 92 } },
  100: { a: { mw: 95 }, b: { mw: 96 } },
  101: { a: { mw: 97 }, b: { mw: 98 } },
  102: { a: { mw: 99 }, b: { mw: 100 } },
  103: { a: { ml: 101 }, b: { ml: 102 } }, // third place: SF losers
  104: { a: { mw: 101 }, b: { mw: 102 } },
};
// Pickable knockout matches: 73-102 plus the final (104). The third-place
// match (103) is intentionally excluded from the bracket.
const KO_NUMS = [...Array.from({ length: 30 }, (_, i) => 73 + i), 104]; // 31

// Scoring (mirrors api/draft.js). The Sunday 6/28 play-in never counts.
const ROUND_POINTS = { r32: 1, r16: 2, qf: 3, sf: 4, final: 5 };
const EXCLUDED_DATES = new Set(["2026-06-28"]);

// Remember each bracket's password on this device so you don't retype it.
const pwKey = (id) => `draftpw:${id}`;
const getStoredPw = (id) => {
  try {
    return localStorage.getItem(pwKey(id)) || "";
  } catch {
    return "";
  }
};
const setStoredPw = (id, pw) => {
  try {
    if (pw) localStorage.setItem(pwKey(id), pw);
    else localStorage.removeItem(pwKey(id));
  } catch {
    /* ignore */
  }
};
const REVEAL_LABEL = "Monday, Jun 29 · 1:00 PM EDT";
// Reveal/lock moment: Mon Jun 29 2026 1:00 PM EDT (17:00 UTC). Must match the API.
const REVEAL_AT = Date.UTC(2026, 5, 29, 17, 0, 0);
const isRevealed = () => Date.now() >= REVEAL_AT;
const NO_PICKS = {};

// Resolve the bracket: R32 teams come from the live API standings; every other
// match's two contestants come from whoever has advanced up the tree.
// Finished games (real ESPN winner) advance automatically and lock; undecided
// games advance the user's pick. The user's own pick is still recorded so the
// UI can flag whether it matched the actual result, and so it persists on save.
function resolveBracket(data, rawPicks, followPicks = false) {
  const byNo = {};
  (data?.bracket || []).forEach((m) => (byNo[m.no] = m));
  const teamObj = (slot) =>
    slot && slot.canon ? { team: slot.team, canon: slot.canon, abbr: slot.abbr } : null;
  const comp = {};
  const win = {};
  const lose = {};
  const locked = {}; // match decided by a real ESPN result
  const picks = {};
  const fromFeed = (f) => {
    if (!f) return null;
    if (f.mw != null) return win[f.mw] || null;
    if (f.ml != null) return lose[f.ml] || null;
    return null;
  };
  for (const no of KO_NUMS) {
    let home, away;
    if (no <= 88) {
      const m = byNo[no];
      home = m ? teamObj(m.home) : null;
      away = m ? teamObj(m.away) : null;
    } else {
      const f = FEEDS[no];
      home = fromFeed(f?.a);
      away = fromFeed(f?.b);
    }
    comp[no] = { home, away };

    const isHere = (c) => c && (home?.canon === c || away?.canon === c);
    const real = byNo[no]?.winnerCanon || null;
    const p = rawPicks?.[no];
    if (isHere(p)) picks[no] = p; // remember the user's pick when still valid

    let eff = null;
    if (followPicks) {
      // Manager view: their predicted winner drives the whole tree so we always
      // show the team they picked to advance (painted red later if it's out),
      // never a "TBD" or reality's replacement. Still note real results.
      if (isHere(p)) eff = p;
      else if (isHere(real)) eff = real;
      if (isHere(real)) locked[no] = true;
    } else if (isHere(real)) {
      eff = real; // finished game: reality wins and locks
      locked[no] = true;
    } else if (isHere(p)) {
      eff = p;
    }
    win[no] = eff ? (home?.canon === eff ? home : away) : null;
    lose[no] = eff ? (home?.canon === eff ? away : home) : null;
  }
  return { byNo, comp, win, lose, locked, picks, champion: win[104] || null };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function Connectors({ count, colH }) {
  return (
    <div className="flex flex-col shrink-0" style={{ width: 12 }}>
      <div className="h-4 mb-1" />
      <div className="flex flex-col justify-around" style={{ height: colH }}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center" style={{ flex: 1 }}>
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
        ))}
      </div>
    </div>
  );
}

function MatchSlot({ no, slot, sideCanon, winCanon, locked, dead, meta, editable, onPick }) {
  const known = !!(slot && slot.canon);
  const isWinner = !!winCanon && sideCanon === winCanon;
  // This exact team has already been knocked out for real (winner or loser slot).
  const slotDead = !!(known && dead);
  const score =
    known && (no <= 88 || meta.matchesReality) && meta.scoreByCanon[sideCanon] != null
      ? meta.scoreByCanon[sideCanon]
      : null;
  // Did the user pick this team, and does reality agree? (only once decided)
  const isUserPick = !!meta.userPick && meta.userPick === sideCanon;
  const correct =
    isUserPick && locked ? meta.realWinner === sideCanon : null;
  const live = meta.state === "in";
  const clickable = editable && known && !locked;
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onPick(no, sideCanon)}
      className={`flex items-center gap-1 px-1.5 h-[26px] w-full text-left transition-colors ${
        slotDead
          ? "bg-rose-500/20"
          : isWinner
          ? locked
            ? "bg-emerald-500/15"
            : "bg-cyan-500/15"
          : known
          ? clickable
            ? "hover:bg-slate-700/40"
            : "opacity-60"
          : ""
      } ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <span className="text-[11px] leading-none shrink-0">
        {known ? flagFor(slot.team) : "·"}
      </span>
      {known ? (
        <span
          className={`flex-1 min-w-0 truncate text-[11px] leading-none ${
            slotDead
              ? "text-rose-200 font-bold line-through"
              : isWinner
              ? locked
                ? "text-emerald-100 font-bold"
                : "text-cyan-100 font-bold"
              : "text-slate-200 font-semibold"
          }`}
          title={slot.team}
        >
          {slot.team}
        </span>
      ) : (
        <span
          className="flex-1 min-w-0 truncate text-[10px] leading-none text-slate-500 italic"
          title={slot?.label}
        >
          {slot?.label || "TBD"}
        </span>
      )}
      {correct === true && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
      {(correct === false || (slotDead && isWinner)) && (
        <X className="w-3 h-3 text-rose-400 shrink-0" />
      )}
      {score != null && (
        <span
          className={`shrink-0 font-mono text-[10px] leading-none ${
            live ? "text-cyan-300 font-bold" : "text-slate-400"
          }`}
        >
          {score}
        </span>
      )}
    </button>
  );
}

function DraftMatch({ m, editable, onPick, colHeight, count }) {
  const { no, home, away, winCanon, locked, meta } = m;
  const live = meta.state === "in";
  const isToday = koIsToday(meta.date);
  return (
    <div
      style={{ minHeight: colHeight ? colHeight / count : undefined }}
      className="flex items-center"
    >
      <div
        className={`w-full rounded-md border overflow-hidden ${
          m.meta.winnerDead
            ? "border-rose-500/50 bg-rose-500/[0.07]"
            : isToday
            ? "border-white/50 bg-slate-800/70 ring-1 ring-white/20"
            : "border-slate-700/60 bg-slate-800/50"
        }`}
      >
        <div className="flex items-center justify-between px-1.5 py-[2px] bg-slate-900/50 border-b border-slate-700/40">
          <span
            title={`${koDayLabel(meta.date)} · ${meta.time || ""} · ${
              meta.city || ""
            }`}
            className={`text-[8px] truncate ${
              isToday ? "text-white font-bold" : "text-slate-500 font-medium"
            }`}
          >
            {[koDayLabel(meta.date), koTimeShort(meta.time), shortCity(meta.city)]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {live ? (
            <span className="text-[8px] text-cyan-400 font-bold shrink-0 ml-1">
              {meta.detail || "LIVE"}
            </span>
          ) : (
            <span className="text-[8px] text-slate-600 shrink-0 ml-1">M{no}</span>
          )}
        </div>
        <MatchSlot
          no={no}
          slot={home}
          sideCanon={home?.canon || null}
          winCanon={winCanon}
          locked={locked}
          dead={m.homeDead}
          meta={meta}
          editable={editable}
          onPick={onPick}
        />
        <div className="border-t border-slate-700/40" />
        <MatchSlot
          no={no}
          slot={away}
          sideCanon={away?.canon || null}
          winCanon={winCanon}
          locked={locked}
          dead={m.awayDead}
          meta={meta}
          editable={editable}
          onPick={onPick}
        />
      </div>
    </div>
  );
}

// Height of a bracket column (also the tallest, first-round column). Shared so
// the mobile "fit to device" zoom can be computed both inside BracketGrid and
// by the manager modal header controls.
const BRACKET_COL_H = 1040;

function computeMobileFit() {
  const VIEWPORT_VH = 0.87;
  const TREE_H = BRACKET_COL_H + 24; // column height + round-label row
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const targetPx = vh * VIEWPORT_VH;
  const fitScale = Math.max(0.25, Math.min(1, targetPx / TREE_H));
  const wrapperH = Math.round(TREE_H * fitScale);
  return { fitScale, wrapperH };
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth < breakpoint);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpoint]);
  return mobile;
}

// Native-style pull-to-refresh for the (non-scrolling) mobile screens: drag
// down to reveal a spinner bubble, release past the threshold to reload.
function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(null);
  const THRESHOLD = 64;
  const MAX = 96;

  const begin = (e) => {
    if (refreshing || e.touches.length !== 1) return;
    startY.current = e.touches[0].clientY;
  };
  const move = (e) => {
    if (refreshing || startY.current == null || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragging(true);
    setPull(dy > 0 ? Math.min(MAX, dy * 0.55) : 0);
  };
  const end = async () => {
    startY.current = null;
    setDragging(false);
    if (refreshing) return;
    if (pull >= THRESHOLD) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh?.();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const progress = Math.min(1, pull / THRESHOLD);
  return (
    <div
      className="relative h-full min-h-0 overflow-hidden"
      onTouchStart={begin}
      onTouchMove={move}
      onTouchEnd={end}
      onTouchCancel={end}
    >
      <div
        className="absolute left-1/2 z-10 pointer-events-none"
        style={{
          top: 4,
          transform: `translate(-50%, ${pull - 44}px)`,
          opacity: refreshing ? 1 : progress,
        }}
      >
        <div className="w-9 h-9 rounded-full bg-slate-800/95 border border-slate-600/70 shadow-lg backdrop-blur flex items-center justify-center">
          <RefreshCw
            className={`w-4 h-4 text-cyan-300 ${
              refreshing ? "animate-spin" : ""
            }`}
            style={
              refreshing ? undefined : { transform: `rotate(${progress * 300}deg)` }
            }
          />
        </div>
      </div>
      <div
        className="h-full min-h-0 flex flex-col gap-2"
        style={{
          transform: `translateY(${pull}px)`,
          transition: dragging ? "none" : "transform 0.25s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function BracketGrid({
  data,
  picks,
  editable,
  onPick,
  followPicks = false,
  zoomRef = null,
  hideControls = false,
  fillHeight = false,
}) {
  const isMobile = useIsMobile();
  // When we fill the available space (e.g. the Bracket tab), measure the real
  // height left under the header/tabs instead of guessing from innerHeight —
  // otherwise the bottom of the tree (final game) gets clipped by the browser
  // toolbar. ResizeObserver keeps it correct across rotation/toolbar changes.
  const viewportRef = useRef(null);
  const [availH, setAvailH] = useState(0);
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => setAvailH(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isMobile, fillHeight]);
  const resolved = useMemo(
    () => resolveBracket(data, picks, followPicks),
    [data, picks, followPicks]
  );

  // Teams knocked out for real (loser of any decided match). Used to paint the
  // dead branches red when a manager routed an eliminated team deeper.
  const eliminated = useMemo(() => {
    const s = new Set();
    (data?.bracket || []).forEach((m) => {
      if (!m.winnerCanon) return;
      [m.home?.canon, m.away?.canon].forEach((c) => {
        if (c && c !== m.winnerCanon) s.add(c);
      });
    });
    return s;
  }, [data]);

  const matchOf = (no) => {
    const c = resolved.comp[no] || {};
    const api = resolved.byNo[no] || {};
    const apiH = api.home?.canon;
    const apiA = api.away?.canon;
    const scoreByCanon = {};
    if (api.state && api.state !== "pre") {
      if (apiH) scoreByCanon[apiH] = api.homeScore;
      if (apiA) scoreByCanon[apiA] = api.awayScore;
    }
    const disp = [c.home?.canon, c.away?.canon].filter(Boolean);
    const matchesReality = !!(
      apiH &&
      apiA &&
      disp.includes(apiH) &&
      disp.includes(apiA)
    );
    const winCanon = resolved.win[no]?.canon || null;
    return {
      no,
      home: c.home,
      away: c.away,
      winCanon,
      // Either team in this match can already be knocked out for real.
      homeDead: !!(c.home?.canon && eliminated.has(c.home.canon)),
      awayDead: !!(c.away?.canon && eliminated.has(c.away.canon)),
      locked: !!resolved.locked[no],
      meta: {
        date: api.date,
        time: api.time,
        city: api.city,
        venue: api.venue,
        state: api.state,
        detail: api.detail,
        realWinner: api.winnerCanon || null,
        userPick: resolved.picks[no] || null,
        scoreByCanon,
        matchesReality,
        // Manager routed a team here that's already been knocked out -> dead pick.
        winnerDead: !!(winCanon && eliminated.has(winCanon)),
      },
    };
  };

  if (!data?.bracket?.length) {
    return (
      <p className="text-center text-slate-500 py-12">
        Bracket unavailable right now.
      </p>
    );
  }

  const champion = resolved.champion;
  const championDead = !!(champion && eliminated.has(champion.canon));
  const COL_H = BRACKET_COL_H;

  const tree = (
    <div className="flex" style={{ minWidth: 1200 }}>
          {BR_COLS.map((col, ci) => {
            const order = BR_ORDER[col.key];
            const next = BR_COLS[ci + 1];
            return (
              <div key={col.key} className="flex shrink-0">
                <div
                  className="flex flex-col shrink-0"
                  style={{ width: ci === 0 ? 188 : 172 }}
                >
                  <div className="text-center text-[9px] uppercase tracking-wider text-slate-500 font-semibold mb-1 h-4">
                    {col.label}
                  </div>
                  <div
                    className="flex flex-col justify-around px-1"
                    style={{ height: COL_H }}
                  >
                    {order.map((no) => (
                      <DraftMatch
                        key={no}
                        m={matchOf(no)}
                        editable={editable}
                        onPick={onPick}
                        colHeight={COL_H}
                        count={order.length}
                      />
                    ))}
                  </div>
                </div>
                {next && (
                  <Connectors count={BR_ORDER[next.key].length} colH={COL_H} />
                )}
              </div>
            );
          })}

          {/* Champion at the end of the tree */}
          <div className="flex flex-col shrink-0 pl-2" style={{ width: 180 }}>
            <div className="text-center text-[9px] uppercase tracking-wider text-amber-400/80 font-semibold mb-1 h-4">
              Champion
            </div>
            <div
              className="flex flex-col justify-center"
              style={{ height: COL_H }}
            >
              <div
                className={`w-full rounded-lg border px-2 py-3 text-center ${
                  championDead
                    ? "border-rose-500/50 bg-rose-500/10"
                    : champion
                    ? "border-amber-400/50 bg-amber-400/10"
                    : "border-slate-700/60 bg-slate-800/40"
                }`}
              >
                <Trophy
                  className={`w-4 h-4 mx-auto mb-1 ${
                    championDead
                      ? "text-rose-400"
                      : champion
                      ? "text-amber-300"
                      : "text-slate-600"
                  }`}
                />
                <div className="text-lg leading-none mb-0.5">
                  {champion ? flagFor(champion.team) : ""}
                </div>
                <div
                  className={`text-xs font-bold break-words ${
                    championDead
                      ? "text-rose-200 line-through"
                      : champion
                      ? "text-amber-200"
                      : "text-slate-600 italic"
                  }`}
                >
                  {champion ? champion.team : "TBD"}
                </div>
              </div>
            </div>
          </div>
    </div>
  );

  if (isMobile) {
    const btn =
      "flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700";

    // Fill mode (Bracket tab): size the viewport to the *measured* available
    // space so the bottom game is never clipped by the toolbar.
    if (fillHeight) {
      const TREE_H = BRACKET_COL_H + 24;
      const measuredH = availH || Math.round(window.innerHeight * 0.8);
      const fScale = Math.max(0.25, Math.min(1, measuredH / TREE_H));
      return (
        <div className="h-full min-h-0 flex flex-col">
          <div ref={viewportRef} className="flex-1 min-h-0 overflow-hidden">
            {availH > 0 && (
              <TransformWrapper
                ref={zoomRef}
                key={`fh${Math.round(fScale * 100)}-${measuredH}`}
                initialScale={fScale}
                initialPositionX={0}
                initialPositionY={0}
                minScale={Math.min(0.25, fScale)}
                maxScale={2.6}
                centerZoomedOut
                limitToBounds
                doubleClick={{ step: 0.7 }}
                wheel={{ disabled: true }}
                panning={{ velocityDisabled: true }}
              >
                <TransformComponent
                  wrapperStyle={{ width: "100%", height: `${measuredH}px` }}
                  wrapperClass="rounded-xl border border-slate-700/50 bg-slate-900/40"
                >
                  {tree}
                </TransformComponent>
              </TransformWrapper>
            )}
          </div>
        </div>
      );
    }

    // Fit the zoom to the device so the entire first round (tallest column)
    // is visible on load, then let the user pan right for later rounds.
    // The viewport is sized to the *exact* fitted tree height so there's no
    // vertical slack for the pan library to re-settle (avoids a jump on swipe).
    const { fitScale, wrapperH } = computeMobileFit();
    return (
      <div className="space-y-2">
        <TransformWrapper
          ref={zoomRef}
          key={`z${Math.round(fitScale * 100)}`}
          initialScale={fitScale}
          initialPositionX={0}
          initialPositionY={0}
          minScale={Math.min(0.25, fitScale)}
          maxScale={2.6}
          centerZoomedOut
          limitToBounds
          doubleClick={{ step: 0.7 }}
          wheel={{ disabled: true }}
          panning={{ velocityDisabled: true }}
        >
          {({ zoomIn, zoomOut, setTransform }) => (
            <>
              {!hideControls && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => zoomOut()}
                    className={btn}
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomIn()}
                    className={btn}
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransform(0, 0, fitScale, 200)}
                    className={btn}
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                  <span className="text-[10px] text-slate-500 ml-auto">
                    pinch to zoom · drag to pan
                  </span>
                </div>
              )}
              <TransformComponent
                wrapperStyle={{ width: "100%", height: `${wrapperH}px` }}
                wrapperClass="rounded-xl border border-slate-700/50 bg-slate-900/40"
              >
                {tree}
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-2">
        <div className="text-[10px] text-cyan-500/70 font-medium mb-1">
          ← swipe sideways for all rounds →
        </div>
        {tree}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// "My Bracket" (pick) tab
// ---------------------------------------------------------------------------
function PickTab({ data, onSaved, editTarget, onClearEdit }) {
  const [picks, setPicks] = useState({});
  const [title, setTitle] = useState("");
  const [pw, setPw] = useState("");
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  // Load a saved bracket in for editing whenever one is selected.
  useEffect(() => {
    if (editTarget) {
      setPicks(editTarget.picks ? { ...editTarget.picks } : {});
      setTitle(editTarget.name || "");
      setPw(editTarget.password || "");
      setEditId(editTarget.id || null);
      setMsg(null);
    }
  }, [editTarget]);

  const onPick = useCallback(
    (no, canon) => {
      setPicks((prev) => {
        const next = { ...prev };
        if (next[no] === canon) delete next[no];
        else next[no] = canon;
        // Re-resolve to drop any downstream picks that are now impossible.
        return resolveBracket(data, next).picks;
      });
    },
    [data]
  );

  const newBracket = () => {
    setPicks({});
    setTitle("");
    setPw("");
    setEditId(null);
    setMsg(null);
    onClearEdit?.();
  };

  const reset = () => {
    if (!confirm("Clear all of your picks?")) return;
    setPicks({});
    setMsg(null);
  };

  const resolved = useMemo(() => resolveBracket(data, picks), [data, picks]);
  const made = Object.keys(resolved.picks).length;
  const remaining = useMemo(
    () => KO_NUMS.filter((no) => !resolved.win[no]).length,
    [resolved]
  );
  const complete = remaining === 0;

  // Surface a "lock it in" save card the moment the bracket is finished.
  const [dismissedSaveCard, setDismissedSaveCard] = useState(false);
  useEffect(() => {
    if (!complete) setDismissedSaveCard(false);
  }, [complete]);
  const showSaveCard = complete && !dismissedSaveCard;

  const save = async () => {
    if (!title.trim()) {
      setMsg({ type: "err", text: "Add your name first." });
      return;
    }
    if (!pw.trim()) {
      setMsg({ type: "err", text: "Set a password for your bracket." });
      return;
    }
    if (made < 1) {
      setMsg({ type: "err", text: "Make at least one pick." });
      return;
    }
    if (!complete) {
      const ok = window.confirm(
        `Heads up — your bracket is incomplete. ${remaining} match${
          remaining === 1 ? "" : "es"
        } still ${remaining === 1 ? "needs" : "need"} a pick. Submit it anyway?`
      );
      if (!ok) return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId || undefined,
          name: title.trim(),
          password: pw,
          picks: resolved.picks,
          champion: resolved.champion?.team || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed.");
      setStoredPw(json.id, pw);
      setMsg({ type: "ok", text: editId ? "Updated!" : "Saved!" });
      onSaved?.(json.id);
    } catch (e) {
      setMsg({ type: "err", text: String(e.message || e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {editId && (
        <div className="flex items-center justify-between gap-2 text-xs rounded-lg px-3 py-2 border border-cyan-500/40 bg-cyan-500/10 text-cyan-200">
          <span className="flex items-center gap-1.5 min-w-0">
            <Pencil className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              Editing <span className="font-semibold">{title || "this bracket"}</span>
            </span>
          </span>
          <button
            type="button"
            onClick={newBracket}
            className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 px-2 py-1 font-medium hover:bg-cyan-500/20 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New bracket
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Your name (e.g. Joe)"
          maxLength={60}
          className="flex-1 min-w-[120px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
        />
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          type="password"
          placeholder="Create bracket password"
          maxLength={60}
          autoComplete="off"
          className="flex-1 min-w-[150px] rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
        />
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700/60"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          {editId ? "Update bracket" : "Save bracket"}
        </button>
      </div>
      <p className="text-[11px] text-slate-500 -mt-1">
        Make up a password — you'll use it to view or edit your bracket before
        the Mon 1 PM ET deadline.
      </p>

      {msg && (
        <div
          className={`text-xs rounded-lg px-3 py-2 border ${
            msg.type === "ok"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/10 text-rose-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div>
        {complete ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
            <Check className="w-3 h-3" />
            Complete bracket
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="w-3 h-3" />
            Incomplete — {remaining} match{remaining === 1 ? "" : "es"} left to
            pick
          </span>
        )}
      </div>

      <BracketGrid data={data} picks={picks} editable onPick={onPick} />

      {showSaveCard && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none animate-[slideUp_.25s_ease-out]">
          <style>{`@keyframes slideUp{from{transform:translateY(110%)}to{transform:translateY(0)}}`}</style>
          <div className="pointer-events-auto max-w-xl mx-auto rounded-2xl border border-cyan-500/40 bg-slate-900/95 backdrop-blur shadow-2xl shadow-cyan-950/50 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                <span className="text-base">🎉</span>
                {editId ? "Update your bracket" : "Bracket complete — lock it in!"}
              </div>
              <button
                type="button"
                onClick={() => setDismissedSaveCard(true)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Your name"
                maxLength={60}
                className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
              />
              <input
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                type="password"
                placeholder="Create bracket password"
                maxLength={60}
                autoComplete="off"
                className="flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500/60"
              />
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 shrink-0"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {editId ? "Update" : "Save bracket"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Make up a password — you'll use it to view or edit your bracket
              before the Mon 1 PM ET deadline.
            </p>
            {msg && (
              <div
                className={`mt-2 text-xs rounded-lg px-3 py-2 border ${
                  msg.type === "ok"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/40 bg-rose-500/10 text-rose-300"
                }`}
              >
                {msg.text}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saved brackets tab
// ---------------------------------------------------------------------------
function SavedTab({ data, refreshKey, onEdit, fill = false }) {
  const [list, setList] = useState(null);
  const [revealed, setRevealed] = useState(true);
  const [err, setErr] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [openData, setOpenData] = useState(null);
  const [openErr, setOpenErr] = useState(null);
  const [loadingOne, setLoadingOne] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const isMobile = useIsMobile();
  const zoomRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/draft");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load.");
      setList(json.brackets || []);
      setRevealed(json.revealed !== false);
    } catch (e) {
      setErr(String(e.message || e));
      setList([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Keep standings fresh while this tab is open.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Knockout games that are live right now (from the live ESPN feed).
  const liveMatches = useMemo(() => {
    return (data?.bracket || [])
      .filter((m) => m.state === "in" && (m.home?.canon || m.away?.canon))
      .map((m) => {
        const hs = Number(m.homeScore ?? 0);
        const as = Number(m.awayScore ?? 0);
        return {
          no: m.no,
          detail: m.detail || "LIVE",
          home: { canon: m.home?.canon, team: m.home?.team, score: hs },
          away: { canon: m.away?.canon, team: m.away?.team, score: as },
          leader: hs > as ? m.home?.canon : as > hs ? m.away?.canon : null,
          odds: m.odds || null,
        };
      });
  }, [data]);

  // Teams knocked out for real (loser of any decided match).
  const eliminatedTeams = useMemo(() => {
    const s = new Set();
    (data?.bracket || []).forEach((m) => {
      if (!m.winnerCanon) return;
      [m.home?.canon, m.away?.canon].forEach((c) => {
        if (c && c !== m.winnerCanon) s.add(c);
      });
    });
    return s;
  }, [data]);

  // Teams currently losing in a live game -> if the score holds they're out.
  const losingTeams = useMemo(() => {
    const s = new Set();
    for (const lm of liveMatches) {
      if (!lm.leader) continue; // tied: nobody's getting screwed yet
      const trailing =
        lm.leader === lm.home.canon ? lm.away.canon : lm.home.canon;
      if (trailing) s.add(trailing);
    }
    return s;
  }, [liveMatches]);

  // "Most screwed": how many *max* points an entry would forfeit if every
  // currently-losing team they're riding on stayed down. That's the sum of
  // the undecided points still pinned to those teams across their bracket.
  const atRiskFor = (entry) => {
    if (!losingTeams.size || !entry?.picks) return 0;
    const byNo = {};
    (data?.bracket || []).forEach((m) => (byNo[m.no] = m));
    let risk = 0;
    for (const [no, pick] of Object.entries(entry.picks)) {
      if (!losingTeams.has(pick)) continue;
      const m = byNo[Number(no)];
      if (!m || m.winnerCanon || EXCLUDED_DATES.has(m.date)) continue;
      risk += ROUND_POINTS[m.round] || 0;
    }
    return risk;
  };

  // The teams an entry has riding on the currently-live games.
  const livePillsFor = (entry) => {
    if (!entry?.picks || !liveMatches.length) return [];
    const out = [];
    for (const lm of liveMatches) {
      const pick = entry.picks[lm.no];
      if (!pick) continue;
      const side =
        pick === lm.home.canon ? lm.home : pick === lm.away.canon ? lm.away : null;
      if (!side) continue; // their pick isn't one of the two teams playing
      const status =
        lm.leader == null ? "tied" : lm.leader === pick ? "leading" : "trailing";
      out.push({ no: lm.no, team: side.team, status });
    }
    return out;
  };

  // Top "live now" strip with a who-has-who split per live game.
  const liveStrip = useMemo(() => {
    if (!liveMatches.length || !Array.isArray(list)) return [];
    return liveMatches.map((lm) => {
      let homeCount = 0;
      let awayCount = 0;
      for (const e of list) {
        const p = e.picks?.[lm.no];
        if (p === lm.home.canon) homeCount += 1;
        else if (p === lm.away.canon) awayCount += 1;
      }
      return { ...lm, homeCount, awayCount };
    });
  }, [liveMatches, list]);

  // Next upcoming knockout game (both teams already set) + the manager split,
  // shown when nothing is live so there's always a "who has who" pulse.
  const nextGame = useMemo(() => {
    if (!Array.isArray(list)) return null;
    const cands = (data?.bracket || []).filter(
      (m) => m.state === "pre" && m.home?.canon && m.away?.canon
    );
    if (!cands.length) return null;
    cands.sort((a, b) =>
      String(a.kickoff || `${a.date} ${a.time}` || "").localeCompare(
        String(b.kickoff || `${b.date} ${b.time}` || "")
      )
    );
    const m = cands[0];
    let homeCount = 0;
    let awayCount = 0;
    for (const e of list) {
      const p = e.picks?.[m.no];
      if (p === m.home.canon) homeCount += 1;
      else if (p === m.away.canon) awayCount += 1;
    }
    return { ...m, homeCount, awayCount };
  }, [data, list]);

  const open = async (id) => {
    setOpenId(id);
    setLoadingOne(true);
    setOpenData(null);
    setOpenErr(null);
    try {
      let pwd = getStoredPw(id);
      let res = await fetch(`/api/draft?id=${encodeURIComponent(id)}`, {
        headers: pwd ? { "x-draft-password": pwd } : {},
      });
      if (res.status === 403) {
        pwd =
          window.prompt(
            "This bracket is locked until the reveal. Enter its password (or the admin password) to view:"
          ) || "";
        if (!pwd) {
          setOpenId(null);
          return;
        }
        res = await fetch(`/api/draft?id=${encodeURIComponent(id)}`, {
          headers: { "x-draft-password": pwd },
        });
      }
      const json = await res.json();
      if (res.status === 403) {
        setOpenErr("Wrong password for this bracket.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed.");
      setStoredPw(id, pwd);
      setOpenData(json);
    } catch (e) {
      setOpenErr(String(e.message || e));
    } finally {
      setLoadingOne(false);
    }
  };

  const remove = async (id, name) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    let pwd = getStoredPw(id);
    if (!pwd) {
      pwd =
        window.prompt(
          "Enter this bracket's password (or the admin password) to delete it:"
        ) || "";
      if (!pwd) return;
    }
    setDeleting(id);
    setErr(null);
    try {
      const res = await fetch(`/api/draft?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { "x-draft-password": pwd },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Delete failed.");
      }
      setStoredPw(id, "");
      setList((cur) => (cur || []).filter((x) => x.id !== id));
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setDeleting(null);
    }
  };

  if (list === null) {
    return (
      <div className="py-16 flex justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  const content = (
    <>
      {err && (
        <div className="text-xs rounded-lg px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-300 shrink-0">
          {err}
        </div>
      )}
      {!revealed && (
        <div className="text-xs rounded-lg px-3 py-2 border border-amber-500/40 bg-amber-500/10 text-amber-200 flex items-start gap-2 shrink-0">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Brackets stay private until the reveal ({REVEAL_LABEL}). You can only
            open the ones you have the password for.
          </span>
        </div>
      )}
      {liveStrip.map((lm) => (
        <div
          key={lm.no}
          className="rounded-xl border border-rose-500/40 bg-rose-500/5 px-3 py-2 shrink-0"
        >
          <div className="flex items-center gap-1.5 text-[11px] mb-1">
            <span className="inline-flex items-center gap-1 font-bold text-rose-400">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              LIVE
            </span>
            <span className="text-slate-500">{lm.detail}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-lg leading-none shrink-0">
                {flagFor(lm.home.team)}
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100 truncate">
                  {lm.home.team}
                </span>
                {lm.odds?.home && (
                  <span className="block text-[9px] font-mono text-slate-500 leading-none">
                    {lm.odds.home}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 px-2 text-center">
              <div className="font-mono font-bold text-slate-100 leading-none">
                {lm.home.score}–{lm.away.score}
              </div>
              {lm.odds?.draw && (
                <div className="text-[9px] font-mono text-slate-500 leading-none mt-0.5">
                  X {lm.odds.draw}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <span className="block text-sm font-semibold text-slate-100 truncate">
                  {lm.away.team}
                </span>
                {lm.odds?.away && (
                  <span className="block text-[9px] font-mono text-slate-500 leading-none">
                    {lm.odds.away}
                  </span>
                )}
              </div>
              <span className="text-lg leading-none shrink-0">
                {flagFor(lm.away.team)}
              </span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {lm.homeCount} {lm.homeCount === 1 ? "manager" : "managers"} advancing
            </span>
            <span>
              advancing {lm.awayCount} {lm.awayCount === 1 ? "manager" : "managers"}
            </span>
          </div>
        </div>
      ))}

      {liveStrip.length === 0 && nextGame && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px] mb-1">
            <span className="font-bold uppercase tracking-wide text-cyan-300">
              Next
            </span>
            <span className="text-slate-500 truncate">
              {nextGame.roundLabel}
              {nextGame.time ? ` · ${nextGame.time}` : ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="text-lg leading-none shrink-0">
                {flagFor(nextGame.home.team)}
              </span>
              <div className="min-w-0">
                <span className="block text-sm font-semibold text-slate-100 truncate">
                  {nextGame.home.team}
                </span>
                {nextGame.odds?.home && (
                  <span className="block text-[9px] font-mono text-slate-500 leading-none">
                    {nextGame.odds.home}
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 px-2 text-center">
              <div className="text-[10px] font-bold text-slate-400 leading-none">
                VS
              </div>
              {nextGame.odds?.draw && (
                <div className="text-[9px] font-mono text-slate-500 leading-none mt-0.5">
                  X {nextGame.odds.draw}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
              <div className="min-w-0 text-right">
                <span className="block text-sm font-semibold text-slate-100 truncate">
                  {nextGame.away.team}
                </span>
                {nextGame.odds?.away && (
                  <span className="block text-[9px] font-mono text-slate-500 leading-none">
                    {nextGame.odds.away}
                  </span>
                )}
              </div>
              <span className="text-lg leading-none shrink-0">
                {flagFor(nextGame.away.team)}
              </span>
            </div>
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {nextGame.homeCount}{" "}
              {nextGame.homeCount === 1 ? "manager" : "managers"} advancing
            </span>
            <span>
              advancing {nextGame.awayCount}{" "}
              {nextGame.awayCount === 1 ? "manager" : "managers"}
            </span>
          </div>
        </div>
      )}

      <div
        className={`rounded-2xl border border-slate-700/60 bg-slate-800/40 overflow-hidden ${
          fill ? "flex-1 min-h-0 flex flex-col" : ""
        }`}
      >
        {list.length === 0 ? (
          <p className="text-center text-slate-500 py-12 text-sm">
            No brackets submitted yet. Fill one out and hit save.
          </p>
        ) : (
          <div className={fill ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-700/40 bg-slate-900/40 shrink-0">
              <span className="w-6 text-center shrink-0">Rk</span>
              <span className="w-7 text-center shrink-0">Pk</span>
              <span className="flex-1 min-w-0">Entry</span>
              <span className="w-9 text-right shrink-0">Pts</span>
              <span className="w-9 text-right shrink-0">Max</span>
              <span className="w-10 text-right shrink-0">Goals</span>
              {!revealed && <span className="w-[52px] shrink-0" />}
            </div>

            {list.map((b, i) => {
              const pills = livePillsFor(b);
              const leadingNow = pills.some((p) => p.status === "leading");
              const atRisk = atRiskFor(b);
              // Scale the font down for long entry names so the full name fits
              // on a single line instead of wrapping / truncating.
              const nameLen = (b.name || "").length;
              const nameCls =
                nameLen > 26
                  ? "text-[9px]"
                  : nameLen > 20
                  ? "text-[11px]"
                  : "text-[13px]";
              // Their picked champion is already knocked out -> cross the entry out.
              const championOut = !!(
                b.picks &&
                b.picks[104] &&
                eliminatedTeams.has(b.picks[104])
              );
              return (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => open(b.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") open(b.id);
                }}
                className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 cursor-pointer transition-colors hover:bg-slate-700/20 ${
                  fill ? "flex-1 min-h-0 overflow-hidden" : ""
                } ${leadingNow ? "border-l-2 border-l-emerald-500/70" : ""} ${
                  i % 2 ? "bg-slate-800/20" : ""
                } ${i < list.length - 1 ? "border-b border-slate-700/30" : ""}`}
              >
                <div className="w-6 flex justify-center shrink-0">
                  {i < 3 ? (
                    <span
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-extrabold ${
                        i === 0
                          ? "bg-amber-400 text-slate-900"
                          : i === 1
                          ? "bg-slate-300 text-slate-900"
                          : "bg-amber-700 text-amber-50"
                      }`}
                    >
                      {i + 1}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-500 tabular-nums">
                      {i + 1}
                    </span>
                  )}
                </div>

                {/* Champion pick flag */}
                <div className="w-7 text-center shrink-0">
                  {b.locked ? (
                    <Lock className="w-3.5 h-3.5 text-amber-400 inline" />
                  ) : b.champion ? (
                    <span
                      className="relative inline-flex items-center justify-center"
                      title={
                        championOut
                          ? `Champion eliminated: ${b.champion}`
                          : `Champion: ${b.champion}`
                      }
                    >
                      <span
                        className={`text-lg leading-none ${
                          championOut ? "opacity-50" : ""
                        }`}
                      >
                        {flagFor(b.champion)}
                      </span>
                      {championOut && (
                        <X
                          className="absolute w-5 h-5 text-rose-500"
                          strokeWidth={3}
                        />
                      )}
                    </span>
                  ) : (
                    <span className="text-slate-600 text-sm">—</span>
                  )}
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div
                    className={`flex items-center gap-1.5 font-semibold leading-tight text-slate-100 min-w-0 ${nameCls}`}
                  >
                    <span className="truncate">{b.name}</span>
                    {b.complete ? (
                      <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle
                        className="w-3 h-3 text-amber-400/80 shrink-0"
                        title="Incomplete bracket"
                      />
                    )}
                  </div>
                  {pills.length ? (
                    <div className="mt-0.5 flex flex-nowrap gap-1 overflow-hidden">
                      {pills.map((p) => (
                        <span
                          key={p.no}
                          className={`inline-flex items-center gap-1 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${
                            p.status === "leading"
                              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                              : p.status === "trailing"
                              ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
                              : "border-slate-500/40 bg-slate-600/30 text-slate-200"
                          }`}
                        >
                          <span>{flagFor(p.team)}</span>
                          {p.team}
                          <span className="font-bold">
                            {p.status === "leading"
                              ? "▲"
                              : p.status === "trailing"
                              ? "▼"
                              : "–"}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-0.5 text-[10px] break-words">
                      {b.locked ? (
                        <span className="text-slate-500">Locked until reveal</span>
                      ) : b.champion ? (
                        <span
                          className={
                            championOut
                              ? "text-slate-500 line-through decoration-rose-500/70"
                              : "text-slate-500"
                          }
                          title={championOut ? "Champion eliminated" : undefined}
                        >
                          🏆 {b.champion}
                        </span>
                      ) : (
                        <span className="text-slate-500">No champion picked</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-9 text-right shrink-0">
                  <span className="text-sm font-bold tabular-nums leading-none text-cyan-300">
                    {b.points ?? 0}
                  </span>
                </div>
                <div className="w-9 text-right shrink-0 leading-none">
                  <span className="text-xs font-semibold tabular-nums text-slate-300">
                    {b.max ?? b.points ?? 0}
                  </span>
                  {atRisk > 0 && (
                    <span
                      className="block text-[9px] font-medium tabular-nums text-rose-400/60"
                      title={`Would lose ${atRisk} max pts if the live result(s) hold`}
                    >
                      −{atRisk}
                    </span>
                  )}
                </div>
                <div className="w-10 text-right shrink-0">
                  <span className="text-xs font-semibold tabular-nums leading-none text-slate-400">
                    {b.goals ?? 0}
                  </span>
                </div>

                {!revealed && (
                  <div className="w-[52px] shrink-0 flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(b.id);
                      }}
                      title="Edit bracket"
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-slate-700/60 hover:text-cyan-300"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(b.id, b.name);
                      }}
                      disabled={deleting === b.id}
                      title="Delete bracket"
                      className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-50"
                    >
                      {deleting === b.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {fill ? (
        <PullToRefresh
          onRefresh={async () => {
            await Promise.all([
              load(),
              new Promise((r) => setTimeout(r, 650)),
            ]);
          }}
        >
          {content}
        </PullToRefresh>
      ) : (
        <div className="space-y-3">{content}</div>
      )}

      {openId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2">
            <div className="min-w-0 flex items-baseline gap-2">
              <h3 className="text-sm font-bold text-slate-100 truncate">
                {openData?.name || "Bracket"}
              </h3>
              {openData?.champion && (
                <span className="text-[11px] text-amber-300 flex items-center gap-1 shrink-0">
                  <Trophy className="w-3 h-3" /> {flagFor(openData.champion)}{" "}
                  {openData.champion}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isMobile && openData && (
                <div className="flex items-center gap-1 mr-1">
                  <button
                    type="button"
                    onClick={() => zoomRef.current?.zoomOut()}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => zoomRef.current?.zoomIn()}
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      zoomRef.current?.setTransform(
                        0,
                        0,
                        computeMobileFit().fitScale,
                        200
                      )
                    }
                    className="flex items-center justify-center w-7 h-7 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {!revealed && (
                <button
                  type="button"
                  onClick={() => {
                    const id = openId;
                    setOpenId(null);
                    setOpenData(null);
                    onEdit?.(id);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setOpenId(null);
                  setOpenData(null);
                }}
                className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto px-4 py-4">
            {openErr ? (
              <div className="py-16 flex flex-col items-center gap-2 text-center">
                <Lock className="w-6 h-6 text-amber-400" />
                <p className="text-sm text-rose-300">{openErr}</p>
                <button
                  type="button"
                  onClick={() => open(openId)}
                  className="mt-1 inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700/60"
                >
                  Try password again
                </button>
              </div>
            ) : loadingOne || !openData ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
              </div>
            ) : (
              <BracketGrid
                data={data}
                picks={openData.picks || {}}
                editable={false}
                onPick={() => {}}
                followPicks
                zoomRef={zoomRef}
                hideControls
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Live read-only bracket tab (shown after the reveal)
// ---------------------------------------------------------------------------
function LiveBracketTab({ data, zoomRef }) {
  const isMobile = useIsMobile();
  return (
    <div
      className={
        isMobile ? "h-full min-h-0 flex flex-col" : "space-y-2"
      }
    >
      <p className="hidden sm:block text-[11px] text-slate-500">
        Live World Cup knockout bracket — fills in automatically from ESPN as
        games finish.
      </p>
      <BracketGrid
        data={data}
        picks={NO_PICKS}
        editable={false}
        onPick={() => {}}
        zoomRef={zoomRef}
        hideControls
        fillHeight={isMobile}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export default function Draft() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(() => isRevealed());
  const [view, setView] = useState(() => (isRevealed() ? "saved" : "pick"));
  const [refreshKey, setRefreshKey] = useState(0);
  const [editTarget, setEditTarget] = useState(null);
  const isMobile = useIsMobile();
  const liveZoomRef = useRef(null);

  // Flip to revealed/locked state when the deadline passes.
  useEffect(() => {
    if (revealed) return;
    const check = () => {
      if (isRevealed()) setRevealed(true);
    };
    const id = setInterval(check, 30000);
    check();
    return () => clearInterval(id);
  }, [revealed]);

  // Once locked, the "My Bracket" create/edit view goes away.
  useEffect(() => {
    if (revealed && (view === "pick")) setView("saved");
  }, [revealed, view]);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch("/api/footie");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load bracket.");
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  // On mobile we render as a fixed-height (100dvh) app so nothing scrolls.
  // The global stylesheet pins body/#root to `min-height: 100vh`, which on
  // mobile is *taller* than the visible dynamic viewport and would let the
  // page scroll by the toolbar height. Lock those to the dynamic viewport
  // while this screen is mounted on mobile, and restore on unmount.
  useEffect(() => {
    if (!isMobile) return;
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyHeight: body.style.height,
      bodyMinHeight: body.style.minHeight,
      bodyOverscroll: body.style.overscrollBehavior,
      rootHeight: root?.style.height,
      rootMinHeight: root?.style.minHeight,
    };
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.height = "100dvh";
    body.style.minHeight = "0";
    body.style.overscrollBehavior = "none";
    if (root) {
      root.style.height = "100dvh";
      root.style.minHeight = "0";
    }
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.height = prev.bodyHeight;
      body.style.minHeight = prev.bodyMinHeight;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      if (root) {
        root.style.height = prev.rootHeight || "";
        root.style.minHeight = prev.rootMinHeight || "";
      }
    };
  }, [isMobile]);

  const handleSaved = () => {
    setRefreshKey((k) => k + 1);
    setEditTarget(null);
    setView("saved");
  };

  const startEdit = useCallback(async (id) => {
    // Editing always needs the bracket's password (to authorize the save).
    let pwd = getStoredPw(id);
    if (!pwd) {
      pwd = window.prompt("Enter this bracket's password to edit it:") || "";
      if (!pwd) return;
    }
    try {
      const res = await fetch(`/api/draft?id=${encodeURIComponent(id)}`, {
        headers: { "x-draft-password": pwd },
      });
      const j = await res.json();
      if (res.status === 403) {
        alert("Wrong password for this bracket.");
        return;
      }
      if (!res.ok) throw new Error(j.error || "Failed to load.");
      setStoredPw(id, pwd);
      setEditTarget({
        id: j.id,
        name: j.name,
        picks: j.picks || {},
        password: pwd,
        nonce: Date.now(),
      });
      setView("pick");
    } catch {
      /* ignore */
    }
  }, []);

  const tabs = revealed
    ? [
        { id: "saved", label: "Standings", icon: Trophy },
        { id: "live", label: "Bracket", icon: GitBranch },
      ]
    : [
        { id: "pick", label: "My Bracket", icon: GitBranch },
        { id: "saved", label: "Standings", icon: Trophy },
      ];

  return (
    <div
      className={`w-full bg-slate-900 text-slate-100 ${
        isMobile
          ? "h-[100dvh] overflow-hidden flex flex-col"
          : "min-h-screen overflow-x-hidden"
      }`}
    >
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10 shrink-0">
        <div className="max-w-5xl mx-auto px-4 py-1.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight flex items-center gap-2 leading-tight">
              <GitBranch className="w-5 h-5 text-cyan-400" />
              Draft Order Bracket
            </h1>
            <p className="hidden sm:block text-[11px] text-slate-500 leading-tight">
              Pick the World Cup knockout, save it, compare with everyone else.
            </p>
          </div>
          <button
            type="button"
            onClick={() => load(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-slate-700/60 shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isLive && (
              <span className="text-cyan-400 font-semibold">Live</span>
            )}
          </button>
        </div>
      </header>

      <main
        className={`max-w-5xl mx-auto w-full px-4 py-3 ${
          isMobile ? "flex-1 min-h-0 flex flex-col" : ""
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
          <div className="inline-flex p-1 bg-slate-800/60 border border-slate-700/60 rounded-xl max-w-full overflow-x-auto">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = view === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setView(t.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
                    active
                      ? "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
          {isMobile && view === "live" && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => liveZoomRef.current?.zoomOut()}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => liveZoomRef.current?.zoomIn()}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => liveZoomRef.current?.resetTransform(200)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-700/60 bg-slate-800/70 text-slate-200 active:bg-slate-700"
              >
                <Maximize className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div
          className={
            isMobile ? "flex-1 min-h-0 flex flex-col overflow-hidden" : ""
          }
        >
          {loading ? (
            <div className="py-24">
              <LoadingSpinner size="lg" message="Loading bracket..." />
            </div>
          ) : error ? (
            <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/30 rounded-2xl p-8 text-center">
              <p className="text-rose-300 mb-4">{error}</p>
              <button
                type="button"
                onClick={() => load(false)}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
              >
                Try again
              </button>
            </div>
          ) : view === "pick" && !revealed ? (
            <PickTab
              data={data}
              onSaved={handleSaved}
              editTarget={editTarget}
              onClearEdit={() => setEditTarget(null)}
            />
          ) : view === "live" ? (
            <LiveBracketTab data={data} zoomRef={liveZoomRef} />
          ) : (
            <SavedTab
              data={data}
              refreshKey={refreshKey}
              onEdit={startEdit}
              fill={isMobile}
            />
          )}
        </div>
      </main>
    </div>
  );
}
