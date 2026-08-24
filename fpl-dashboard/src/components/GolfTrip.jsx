import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Swords,
  Coins,
  BarChart3,
  Flag,
  ExternalLink,
} from "lucide-react";

// Team colors match Golf Genius (South red / North blue)
const TEAM = {
  South: {
    text: "text-rose-400",
    dot: "bg-rose-400",
    bar: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    win: "bg-rose-500/15 border-rose-500/40",
  },
  North: {
    text: "text-sky-400",
    dot: "bg-sky-400",
    bar: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    win: "bg-sky-500/15 border-sky-500/40",
  },
};

const fmtMoney = (n) =>
  n == null ? "—" : `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

const firstLast = (name) => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
};

function TeamDot({ team }) {
  if (!team) return <span className="inline-block w-2 h-2 rounded-full bg-slate-600 shrink-0" />;
  return <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${TEAM[team]?.dot || "bg-slate-600"}`} />;
}

function Record({ p }) {
  return (
    <span className="tabular-nums whitespace-nowrap">
      <span className="text-emerald-400">{p.w}</span>
      <span className="text-gray-600">-</span>
      <span className="text-rose-400">{p.l}</span>
      <span className="text-gray-600">-</span>
      <span className="text-gray-400">{p.t}</span>
    </span>
  );
}

/* ---------------- team score banner ---------------- */

function TeamBanner({ teams }) {
  const south = teams.find((t) => t.name === "South");
  const north = teams.find((t) => t.name === "North");
  if (!south || !north) return null;
  const total = south.total + north.total || 1;
  const leader = south.total === north.total ? null : south.total > north.total ? south : north;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl sm:text-3xl font-bold text-rose-400 tabular-nums">{south.total}</span>
          <span className="text-sm font-semibold text-rose-300">South</span>
        </div>
        {leader && (
          <div className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold uppercase tracking-widest">
            <Trophy size={14} /> {leader.name} wins
          </div>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-sky-300">North</span>
          <span className="text-2xl sm:text-3xl font-bold text-sky-400 tabular-nums">{north.total}</span>
        </div>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex bg-slate-800">
        <div className="bg-rose-500" style={{ width: `${(south.total / total) * 100}%` }} />
        <div className="bg-sky-500" style={{ width: `${(north.total / total) * 100}%` }} />
      </div>
      <div className="flex justify-between mt-1.5 text-[11px] text-gray-500">
        <span>Team purse {fmtMoney(south.purse)}</span>
        <span>Team purse {fmtMoney(north.purse)}</span>
      </div>
    </div>
  );
}

/* ---------------- standings tab ---------------- */

const SORTS = {
  purse: (a, b) => (b.purse || 0) - (a.purse || 0),
  record: (a, b) => b.w - a.w || a.l - b.l || (b.purse || 0) - (a.purse || 0),
  pts: (a, b) => b.matchPts - a.matchPts || b.w - a.w,
  skins: (a, b) => b.skins - a.skins || (b.skinsPurse || 0) - (a.skinsPurse || 0),
  net: (a, b) => (a.avgNet ?? 999) - (b.avgNet ?? 999),
};

const PURSE_CATS = [
  ["Skins", "bg-emerald-500", "text-emerald-300"],
  ["Quota", "bg-sky-500", "text-sky-300"],
  ["CTP", "bg-violet-500", "text-violet-300"],
  ["Long Drive", "bg-amber-500", "text-amber-300"],
  ["Net-Low", "bg-rose-500", "text-rose-300"],
  ["Other", "bg-slate-500", "text-gray-300"],
];

function PurseChips({ purseBy }) {
  const items = PURSE_CATS.filter(([cat]) => purseBy?.[cat] > 0);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(([cat, , text]) => (
        <span key={cat} className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px]">
          <span className="text-gray-400">{cat}</span>{" "}
          <span className={`font-semibold tabular-nums ${text}`}>{fmtMoney(purseBy[cat])}</span>
        </span>
      ))}
    </div>
  );
}

function PlayerDetail({ p }) {
  return (
    <div className="px-3 pb-3 pt-1 space-y-3 text-xs">
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-gray-400">
        {p.hi != null && <span>HI <span className="text-gray-200 font-semibold">{p.hi}</span></span>}
        {p.avgNet != null && <span>Avg net <span className="text-gray-200 font-semibold">{p.avgNet}</span></span>}
        <span>Match pts <span className="text-gray-200 font-semibold">{p.matchPts.toFixed(1)}</span></span>
      </div>
      <PurseChips purseBy={p.purseBy} />
      {p.matches.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Matches</div>
          <div className="space-y-1">
            {p.matches.map((m, i) => (
              <div key={i} className="flex items-center gap-2">
                <span
                  className={`w-5 h-5 rounded flex items-center justify-center font-bold shrink-0 ${
                    m.outcome === "W"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : m.outcome === "L"
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-slate-700 text-gray-300"
                  }`}
                >
                  {m.outcome}
                </span>
                <span className="text-gray-300 min-w-0">
                  {m.partner ? `w/ ${firstLast(m.partner)} ` : ""}vs {m.opp}
                  {m.result && m.result !== "Tied" && <span className="text-gray-500"> · {m.result}</span>}
                  <span className="text-gray-600"> · {m.round}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {p.skinDetails.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Skins</div>
          {p.skinDetails.map((s, i) => (
            <div key={i} className="text-gray-300">{s}</div>
          ))}
        </div>
      )}
      {p.ctps.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Prizes</div>
          {p.ctps.map((c, i) => (
            <div key={i} className="text-gray-300">
              {c.event} ({c.round}) · {fmtMoney(c.purse)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Standings({ players }) {
  const [sort, setSort] = useState("purse");
  const [open, setOpen] = useState(null);
  const sorted = useMemo(() => [...players].sort(SORTS[sort]), [players, sort]);

  const Th = ({ id, children, className = "" }) => (
    <th
      className={`py-2 px-2 font-semibold cursor-pointer select-none whitespace-nowrap ${
        sort === id ? "text-emerald-300" : "text-gray-500 hover:text-gray-300"
      } ${className}`}
      onClick={() => setSort(id)}
    >
      {children}
    </th>
  );

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-slate-700/70 text-left text-[11px] uppercase tracking-wider">
            <th className="py-2 pl-3 pr-1 text-gray-500 font-semibold w-7">#</th>
            <th className="py-2 px-2 text-gray-500 font-semibold">Player</th>
            <Th id="record" className="!px-1">W-L-T</Th>
            <Th id="pts" className="text-right !px-1">Pts</Th>
            <Th id="skins" className="text-center hidden sm:table-cell">Skins</Th>
            <Th id="net" className="text-right hidden sm:table-cell">Avg Net</Th>
            <Th id="purse" className="text-right pr-3">Purse</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p, i) => (
            <PlayerRows key={p.name} p={p} rank={i + 1} open={open === p.name} onToggle={() => setOpen(open === p.name ? null : p.name)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRows({ p, rank, open, onToggle }) {
  return (
    <>
      <tr
        className={`border-b border-slate-800 cursor-pointer hover:bg-slate-800/60 ${open ? "bg-slate-800/60" : ""}`}
        onClick={onToggle}
      >
        <td className="py-2 pl-3 pr-1 text-gray-500 tabular-nums">{rank}</td>
        <td className="py-2 px-2">
          <span className="flex items-center gap-2 min-w-0">
            <TeamDot team={p.team} />
            <span className="font-medium text-gray-100 truncate">{p.name}</span>
            {open ? <ChevronUp size={13} className="text-gray-500 shrink-0" /> : <ChevronDown size={13} className="text-gray-600 shrink-0" />}
          </span>
        </td>
        <td className="py-2 px-1"><Record p={p} /></td>
        <td className="py-2 px-1 text-right tabular-nums text-gray-300">{p.matchPts ? p.matchPts.toFixed(1) : "—"}</td>
        <td className="py-2 px-2 text-center tabular-nums text-gray-300 hidden sm:table-cell">{p.skins || "—"}</td>
        <td className="py-2 px-2 text-right tabular-nums text-gray-300 hidden sm:table-cell">{p.avgNet ?? "—"}</td>
        <td className={`py-2 px-2 pr-3 text-right tabular-nums font-semibold ${p.purse ? "text-emerald-300" : "text-gray-600"}`}>
          {fmtMoney(p.purse || 0)}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-800 bg-slate-800/40">
          <td colSpan={7}><PlayerDetail p={p} /></td>
        </tr>
      )}
    </>
  );
}

/* ---------------- rounds tab ---------------- */

function MatchRow({ m }) {
  const side = (team, names, pts, won) => (
    <div className={`flex-1 rounded-lg px-2 py-1.5 border ${won ? TEAM[team]?.win || "border-slate-700" : "border-transparent"}`}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${TEAM[team]?.text || "text-gray-500"}`}>
        {team} {pts != null && <span className="text-gray-500 normal-case tracking-normal">· {pts} pts</span>}
      </div>
      {names.map((n) => (
        <div key={n} className={`text-xs sm:text-sm truncate ${won ? "text-white font-semibold" : "text-gray-400"}`}>{n}</div>
      ))}
    </div>
  );
  return (
    <div className="flex items-center gap-2">
      {side(m.teamL, m.playersL, m.ptsL, m.winner === "left")}
      <div className="shrink-0 w-14 text-center">
        <div className={`text-[11px] font-bold ${m.winner === "tie" ? "text-gray-400" : "text-amber-300"}`}>
          {m.result || (m.winner === "tie" ? "Tied" : "")}
        </div>
      </div>
      {side(m.teamR, m.playersR, m.ptsR, m.winner === "right")}
    </div>
  );
}

function MiniTable({ head, rows }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
          {head.map((h, i) => (
            <th key={i} className={`py-1 px-1.5 font-semibold ${i >= head.length - 1 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((cells, i) => (
          <tr key={i} className="border-t border-slate-800">
            {cells.map((c, j) => (
              <td key={j} className={`py-1 px-1.5 ${j >= cells.length - 1 ? "text-right tabular-nums" : ""} ${j === 0 ? "text-gray-500" : "text-gray-300"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Tournament({ t }) {
  const [expanded, setExpanded] = useState(false);
  if (t.type === "empty") return null;

  let body = null;
  if (t.type === "match") {
    body = (
      <div className="space-y-1.5">
        {t.matches.map((m, i) => <MatchRow key={i} m={m} />)}
        {t.totals && (
          <div className="flex justify-between text-[11px] font-semibold pt-1 px-1 text-gray-400">
            <span className="text-rose-300">South {t.totals.L}</span>
            <span className="uppercase tracking-widest text-gray-600">Totals</span>
            <span className="text-sky-300">North {t.totals.R}</span>
          </div>
        )}
      </div>
    );
  } else if (t.type === "skins") {
    body = (
      <MiniTable
        head={["Player", "Skins", "Won on", "Purse"]}
        rows={t.rows.map((r) => [r.player, r.skins, r.details || "—", fmtMoney(r.purse)])}
      />
    );
  } else if (t.type === "quota") {
    const rows = expanded ? t.rows : t.rows.slice(0, 5);
    body = (
      <>
        <MiniTable
          head={["Pos", "Player", "+/-", "Gross", "Purse"]}
          rows={rows.map((r) => [r.pos, r.player, r.quota > 0 ? `+${r.quota}` : r.quota, r.gross ?? "—", fmtMoney(r.purse)])}
        />
        {t.rows.length > 5 && (
          <button className="mt-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : `Show all ${t.rows.length}`}
          </button>
        )}
      </>
    );
  } else if (t.type === "teamnet") {
    const rows = expanded ? t.rows : t.rows.slice(0, 5);
    body = (
      <>
        <MiniTable
          head={["Pos", "Team", "To Par", "Net", "Purse"]}
          rows={rows.map((r) => [r.pos, r.players.map(firstLast).join(" + "), r.toPar ?? "—", r.total ?? "—", fmtMoney(r.purse)])}
        />
        {t.rows.length > 5 && (
          <button className="mt-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show less" : `Show all ${t.rows.length}`}
          </button>
        )}
      </>
    );
  } else if (t.type === "netlow") {
    body = (
      <MiniTable
        head={["Pos", "Player", "To Par", "Rounds", "Total", "Purse"]}
        rows={t.rows.map((r) => [r.pos, r.player, r.toPar, r.rounds.join(" / "), r.total, fmtMoney(r.purse)])}
      />
    );
  } else if (t.type === "list") {
    body = (
      <div className="space-y-0.5">
        {t.rows.map((r, i) => (
          <div key={i} className="flex justify-between text-xs">
            <span className="text-gray-200 font-medium">{r.player}{r.details ? <span className="text-gray-500"> · {r.details}</span> : null}</span>
            <span className="text-emerald-300 tabular-nums">{fmtMoney(r.purse)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (!body) return null;

  return (
    <div className="border-t border-slate-800 pt-2.5 mt-2.5 first:border-0 first:pt-0 first:mt-0">
      <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{t.name}</div>
      {body}
    </div>
  );
}

// Netlow is a trip-long game; show it in Stats instead of inside a round card.
// Lead with the team matches, then the side games.
const TYPE_ORDER = { match: 0, skins: 1, quota: 2, teamnet: 3, list: 4 };
const roundTournaments = (r) =>
  r.tournaments
    .filter((t) => t.type !== "netlow" && t.type !== "empty")
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));

// South/North points earned in this round's team matches, for the collapsed header
function roundScore(r) {
  let L = 0, R = 0, any = false;
  for (const t of r.tournaments) {
    if (t.type === "match" && t.totals) {
      L += t.totals.L;
      R += t.totals.R;
      any = true;
    }
  }
  return any ? { L: +L.toFixed(1), R: +R.toFixed(1) } : null;
}

function RoundCard({ r, open, onToggle }) {
  const score = roundScore(r);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <button className="w-full flex items-center gap-3 p-3.5 sm:p-4 text-left hover:bg-slate-800/50" onClick={onToggle}>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-gray-100 text-sm sm:text-base truncate">{r.label}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">{r.date}</div>
        </div>
        {score && (
          <div className="shrink-0 text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap">
            <span className={score.L > score.R ? "text-rose-300" : "text-rose-400/60"}>{score.L}</span>
            <span className="text-gray-600 mx-1">–</span>
            <span className={score.R > score.L ? "text-sky-300" : "text-sky-400/60"}>{score.R}</span>
          </div>
        )}
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-3.5 sm:px-4 pb-3.5 sm:pb-4 border-t border-slate-800 pt-3">
          {roundTournaments(r).map((t) => <Tournament key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}

function Rounds({ rounds }) {
  const [open, setOpen] = useState(() => new Set(rounds.length ? [rounds[0].id] : []));
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <div className="space-y-3">
      {rounds.map((r) => (
        <RoundCard key={r.id} r={r} open={open.has(r.id)} onToggle={() => toggle(r.id)} />
      ))}
    </div>
  );
}

/* ---------------- stats tab ---------------- */

const DIST_COLORS = ["bg-yellow-400", "bg-emerald-500", "bg-sky-500", "bg-slate-500", "bg-orange-500", "bg-rose-600"];
const DIST_LABELS = ["Eagle", "Birdie", "Par", "Bogey", "Double", "Triple+"];

function ScoringDist({ players }) {
  const rows = useMemo(() => {
    return players
      .filter((p) => p.dist && p.dist.reduce((a, b) => a + b, 0) > 0)
      .map((p) => {
        const total = p.dist.reduce((a, b) => a + b, 0);
        return { ...p, total, good: (p.dist[0] + p.dist[1] + p.dist[2]) / total };
      })
      .sort((a, b) => b.good - a.good);
  }, [players]);
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100 mb-1">Scoring distribution</div>
      <div className="text-[11px] text-gray-500 mb-3">All trip holes · sorted by % of holes at par or better</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {DIST_LABELS.map((l, i) => (
          <span key={l} className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className={`w-2 h-2 rounded-sm ${DIST_COLORS[i]}`} /> {l}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-28 sm:w-36 text-xs text-gray-300 truncate flex items-center gap-1.5">
              <TeamDot team={p.team} />
              <span className="truncate">{firstLast(p.name)}</span>
            </span>
            <div className="flex-1 h-4 rounded overflow-hidden flex bg-slate-800">
              {p.dist.map((n, i) =>
                n > 0 ? <div key={i} className={DIST_COLORS[i]} style={{ width: `${(n / p.total) * 100}%` }} title={`${DIST_LABELS[i]}: ${n}`} /> : null
              )}
            </div>
            <span className="w-10 text-right text-[11px] tabular-nums text-gray-400">{Math.round(p.good * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NetLow({ netlow }) {
  if (!netlow) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100 mb-2.5">{netlow.name}</div>
      <MiniTable
        head={["Pos", "Player", "To Par", "Rounds", "Total", "Purse"]}
        rows={netlow.rows.map((r) => [r.pos, r.player, r.toPar, r.rounds.join(" / "), r.total, fmtMoney(r.purse)])}
      />
    </div>
  );
}

function MoneyList({ players }) {
  const rows = players.filter((p) => p.purse > 0);
  const max = rows[0]?.purse || 1;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100 mb-1">Money leaders</div>
      <div className="text-[11px] text-gray-500 mb-2">All winnings: skins, quota, CTP, long drive, net-low</div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3">
        {PURSE_CATS.filter(([cat]) => rows.some((p) => p.purseBy?.[cat] > 0)).map(([cat, bg]) => (
          <span key={cat} className="flex items-center gap-1 text-[10px] text-gray-400">
            <span className={`w-2 h-2 rounded-sm ${bg}`} /> {cat}
          </span>
        ))}
      </div>
      <div className="space-y-1.5">
        {rows.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-28 sm:w-36 text-xs text-gray-300 truncate flex items-center gap-1.5">
              <TeamDot team={p.team} />
              <span className="truncate">{firstLast(p.name)}</span>
            </span>
            <div className="flex-1 h-3.5 rounded overflow-hidden flex bg-slate-800">
              {PURSE_CATS.map(([cat, bg]) =>
                p.purseBy?.[cat] > 0 ? (
                  <div key={cat} className={bg} style={{ width: `${(p.purseBy[cat] / max) * 100}%` }} title={`${cat}: ${fmtMoney(p.purseBy[cat])}`} />
                ) : null
              )}
            </div>
            <span className="w-16 text-right text-[11px] tabular-nums text-emerald-300 font-semibold">{fmtMoney(p.purse)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats({ data }) {
  return (
    <div className="space-y-4">
      <NetLow netlow={data.netlow} />
      <MoneyList players={data.players} />
      <ScoringDist players={data.players} />
    </div>
  );
}

/* ---------------- page ---------------- */

const TABS = [
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "rounds", label: "Rounds", icon: Swords },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

export default function GolfTrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("standings");

  useEffect(() => {
    fetch("/data/golftrip-nj26.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 text-gray-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-sm text-gray-300">
          Couldn't load trip data ({error}).
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen bg-slate-950" />;

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
        <header className="mb-4 sm:mb-5">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-amber-300 font-semibold mb-1">
            <Flag size={12} /> Buddies trip
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold">{data.trip.name}</h1>
          <div className="text-xs sm:text-sm text-gray-400 mt-1 flex flex-wrap items-center gap-x-2">
            <span>{data.trip.dates}</span>
            <span className="text-gray-700">·</span>
            <span>{data.trip.location}</span>
            <span className="text-gray-700">·</span>
            <a
              href={`https://www.golfgenius.com/ggid/${data.trip.ggid}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
            >
              Golf Genius <ExternalLink size={11} />
            </a>
          </div>
        </header>

        <TeamBanner teams={data.teams} />

        <nav className="flex gap-1.5 my-4 sm:my-5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-colors ${
                tab === id ? "bg-emerald-600 text-white" : "bg-slate-900 border border-slate-700 text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </nav>

        {tab === "standings" && <Standings players={data.players} />}
        {tab === "rounds" && <Rounds rounds={data.rounds} />}
        {tab === "stats" && <Stats data={data} />}

        <footer className="mt-6 text-[10px] text-gray-600">
          Data from Golf Genius · updated {data.trip.fetched}
        </footer>
      </div>
    </div>
  );
}
