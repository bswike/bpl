import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Swords,
  BarChart3,
  Flag,
  ExternalLink,
  Medal,
  Sparkles,
  Flame,
  Bird,
  Target,
  Snowflake,
  TrendingUp,
  Crosshair,
  Skull,
} from "lucide-react";

// Team colors match Golf Genius (South red / North blue)
const TEAM = {
  South: {
    text: "text-rose-400",
    dot: "bg-rose-400",
    bar: "bg-rose-500",
    chip: "bg-rose-500/15 text-rose-300 border border-rose-500/30",
    win: "bg-rose-500/15 border-rose-500/40",
    cell: "bg-rose-500/30",
  },
  North: {
    text: "text-sky-400",
    dot: "bg-sky-400",
    bar: "bg-sky-500",
    chip: "bg-sky-500/15 text-sky-300 border border-sky-500/30",
    win: "bg-sky-500/15 border-sky-500/40",
    cell: "bg-sky-500/30",
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
  record: (a, b) => b.w - a.w || a.l - b.l || b.matchPts - a.matchPts,
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
  const [sort, setSort] = useState("record");
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

/* ---------------- scorecard ---------------- */

function ScoreCell({ gross, dots, par }) {
  if (gross == null) return <div className="h-8" />;
  const diff = par == null ? null : gross - par;
  const shape =
    diff == null ? null : diff <= -2 ? "eagle" : diff === -1 ? "birdie" : diff === 1 ? "bogey" : diff >= 2 ? "double" : null;
  const circle = "rounded-full border border-emerald-300/90";
  const square = "border border-rose-400/80";
  const bogey = "border border-slate-400/70";
  const core = (
    <span
      className={`w-[18px] h-[18px] flex items-center justify-center text-[10px] sm:text-[11px] tabular-nums text-gray-100 ${
        shape === "birdie" || shape === "eagle" ? circle : shape === "bogey" ? bogey : shape === "double" ? square : ""
      }`}
    >
      {gross}
    </span>
  );
  return (
    <div className="relative flex items-center justify-center h-8">
      {shape === "eagle" || shape === "double" ? (
        <span className={`p-[2px] flex items-center justify-center ${shape === "eagle" ? circle : square}`}>{core}</span>
      ) : (
        core
      )}
      {dots > 0 && (
        <span className="absolute top-0.5 right-0 text-amber-300 text-[8px] leading-none">{"\u2022".repeat(dots)}</span>
      )}
    </div>
  );
}

function Scorecard({ m, pars }) {
  const { rows, winners } = m.card;
  const grid = { display: "grid", gridTemplateColumns: "3.4rem repeat(9, minmax(0, 1fr)) 2.2rem" };
  const halves = [
    { start: 0, label: "Out" },
    { start: 9, label: "In" },
  ].filter(({ start }) => rows.some((r) => r.gross.slice(start, start + 9).some((g) => g != null)));

  const winCell = (i) => {
    const w = winners[i];
    if (w === "L") return TEAM[m.teamL]?.cell || "bg-slate-700";
    if (w === "R") return TEAM[m.teamR]?.cell || "bg-slate-700";
    if (w === "T") return "bg-slate-700/60";
    return "";
  };

  return (
    <div className="mt-1.5 mb-2 rounded-xl bg-slate-950/60 border border-slate-800 p-2">
      {halves.map(({ start, label }) => {
        const idx = Array.from({ length: 9 }, (_, k) => start + k);
        return (
          <div key={label} className="mb-1.5 last:mb-0">
            <div style={grid} className="text-[9px] uppercase tracking-wider text-gray-500">
              <div className="flex items-center pl-1">Hole</div>
              {idx.map((i) => (
                <div key={i} className={`flex items-center justify-center h-5 rounded-sm font-semibold text-gray-300 ${winCell(i)}`}>
                  {i + 1}
                </div>
              ))}
              <div className="flex items-center justify-center">{label}</div>
            </div>
            {pars && (
              <div style={grid} className="text-[9px] text-gray-500 border-b border-slate-800">
                <div className="flex items-center pl-1 uppercase tracking-wider">Par</div>
                {idx.map((i) => (
                  <div key={i} className="flex items-center justify-center h-4 tabular-nums">{pars[i] ?? ""}</div>
                ))}
                <div className="flex items-center justify-center tabular-nums">
                  {pars.slice(start, start + 9).every((p) => p != null) ? pars.slice(start, start + 9).reduce((a, b) => a + b, 0) : ""}
                </div>
              </div>
            )}
            {rows.map((r) => {
              const tot = idx.reduce((a, i) => a + (r.gross[i] || 0), 0);
              const team = r.side === "L" ? m.teamL : m.teamR;
              return (
                <div key={r.name} style={grid}>
                  <div className="flex items-center gap-1 pl-1 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TEAM[team]?.dot || "bg-slate-600"}`} />
                    <span className="text-[9px] text-gray-300 truncate">{firstLast(r.name)}</span>
                  </div>
                  {idx.map((i) => (
                    <ScoreCell key={i} gross={r.gross[i]} dots={r.dots[i]} par={pars?.[i]} />
                  ))}
                  <div className="flex items-center justify-center text-[10px] tabular-nums text-gray-300 font-semibold">
                    {tot || ""}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 pt-1.5 border-t border-slate-800 text-[9px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full border border-emerald-300/90" /> birdie
        </span>
        <span className="flex items-center gap-1">
          <span className="p-[1.5px] rounded-full border border-emerald-300/90"><span className="w-2 h-2 block rounded-full border border-emerald-300/90" /></span> eagle
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 border border-slate-400/70" /> bogey
        </span>
        <span className="flex items-center gap-1">
          <span className="p-[1.5px] border border-rose-400/80"><span className="w-2 h-2 block border border-rose-400/80" /></span> double+
        </span>
        <span className="flex items-center gap-1"><span className="text-amber-300">•</span> stroke</span>
        <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${TEAM[m.teamL]?.cell}`} /> {m.teamL} won hole</span>
        <span className="flex items-center gap-1"><span className={`w-3 h-3 rounded-sm ${TEAM[m.teamR]?.cell}`} /> {m.teamR} won hole</span>
      </div>
    </div>
  );
}

function MatchRow({ m, pars }) {
  const [open, setOpen] = useState(false);
  const hasCard = !!m.card;
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
    <div>
      <div
        className={`flex items-center gap-2 rounded-lg ${hasCard ? "cursor-pointer hover:bg-slate-800/40" : ""}`}
        onClick={() => hasCard && setOpen(!open)}
      >
        {side(m.teamL, m.playersL, m.ptsL, m.winner === "left")}
        <div className="shrink-0 w-14 text-center">
          <div className={`text-[11px] font-bold ${m.winner === "tie" ? "text-gray-400" : "text-amber-300"}`}>
            {m.result || (m.winner === "tie" ? "Tied" : "")}
          </div>
          {hasCard && (
            <div className="flex justify-center text-gray-600 mt-0.5">
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          )}
        </div>
        {side(m.teamR, m.playersR, m.ptsR, m.winner === "right")}
      </div>
      {open && hasCard && <Scorecard m={m} pars={pars} />}
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

function Tournament({ t, pars }) {
  const [expanded, setExpanded] = useState(false);
  if (t.type === "empty") return null;

  let body = null;
  if (t.type === "match") {
    body = (
      <div className="space-y-1.5">
        {t.matches.map((m, i) => <MatchRow key={i} m={m} pars={pars} />)}
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
          {roundTournaments(r).map((t) => <Tournament key={t.id} t={t} pars={r.pars} />)}
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

// Round names on the breakdown pages look like "Crystal Springs - 2v2 Matchplay"
const courseOf = (roundName) => roundName.split(" - ")[0];

function Superlatives({ players }) {
  const tiles = useMemo(() => {
    const t = [];
    const entries = [];
    players.forEach((p) => (p.scores || []).forEach((s) => {
      if (s.holes === 18) entries.push({ p, s });
    }));
    const pick = (arr, f, best) => {
      const v = best(...arr.map(f));
      return { v, list: arr.filter((x) => f(x) === v) };
    };
    const scoreWho = ({ list }) =>
      list.map((e) => `${firstLast(e.p.name)} · ${courseOf(e.s.round)}`).join("  &  ");
    const distWho = ({ list }) => list.map((e) => firstLast(e.name)).join(" & ");

    if (entries.length) {
      const lg = pick(entries, (e) => e.s.gross, Math.min);
      t.push({ icon: Medal, label: "Low gross", value: lg.v, who: scoreWho(lg) });
      const ln = pick(entries, (e) => e.s.net, Math.min);
      t.push({ icon: Sparkles, label: "Low net", value: ln.v, who: scoreWho(ln) });
      const hg = pick(entries, (e) => e.s.gross, Math.max);
      t.push({ icon: Snowflake, label: "High gross", value: hg.v, who: scoreWho(hg) });
    }

    const withDist = players.filter((p) => p.dist && p.dist.reduce((a, b) => a + b, 0) > 0);
    if (withDist.length) {
      const birdies = pick(withDist, (p) => p.dist[1], Math.max);
      if (birdies.v > 0) t.push({ icon: Flame, label: "Most birdies", value: birdies.v, who: distWho(birdies) });
      const eagles = withDist.filter((p) => p.dist[0] > 0);
      if (eagles.length)
        t.push({
          icon: Bird,
          label: "Eagle club",
          value: eagles.reduce((a, p) => a + p.dist[0], 0),
          who: eagles.map((p) => firstLast(p.name)).join(" & "),
        });
      const pars = pick(withDist, (p) => p.dist[2], Math.max);
      t.push({ icon: Target, label: "Most pars", value: pars.v, who: distWho(pars) });
      const wreck = pick(withDist, (p) => p.dist[4] + p.dist[5], Math.max);
      t.push({ icon: Skull, label: "Doubles or worse", value: wreck.v, who: distWho(wreck) });
    }

    const twoRounds = players.filter((p) => (p.scores || []).filter((s) => s.holes === 18).length >= 2);
    if (twoRounds.length) {
      const bb = pick(twoRounds, (p) => {
        const s = p.scores.filter((x) => x.holes === 18);
        return s[0].net - s[s.length - 1].net;
      }, Math.max);
      if (bb.v > 0)
        t.push({
          icon: TrendingUp,
          label: "Bounce back",
          value: `-${bb.v}`,
          who: distWho(bb),
          sub: "net improvement, Crystal Springs → Black Bear",
        });
    }
    return t;
  }, [players]);

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100 mb-1">Trip superlatives</div>
      <div className="text-[11px] text-gray-500 mb-3">From the individually-scored rounds (Crystal Springs & Black Bear)</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="bg-slate-800/60 rounded-xl p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-gray-500">
              <tile.icon size={12} /> {tile.label}
            </div>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">{tile.value}</div>
            <div className="text-xs text-emerald-300 font-medium mt-0.5">{tile.who}</div>
            {tile.sub && <div className="text-[10px] text-gray-500 mt-0.5">{tile.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Prizes({ rounds }) {
  const wins = [];
  for (const r of rounds)
    for (const t of r.tournaments)
      if (t.type === "list")
        for (const row of t.rows)
          wins.push({ event: t.name.replace(/^RD\d+ - /i, ""), course: r.course, ...row });
  if (!wins.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100 mb-2.5 flex items-center gap-1.5">
        <Crosshair size={15} className="text-amber-300" /> Closest to the pin & long drives
      </div>
      <div className="space-y-1">
        {wins.map((w, i) => (
          <div key={i} className="flex justify-between items-baseline text-xs">
            <span className="text-gray-200 font-medium">
              {w.player} <span className="text-gray-500">· {w.event}</span>
            </span>
            <span className="text-emerald-300 tabular-nums shrink-0 ml-2">{fmtMoney(w.purse)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stats({ data }) {
  return (
    <div className="space-y-4">
      <Superlatives players={data.players} />
      <NetLow netlow={data.netlow} />
      <Prizes rounds={data.rounds} />
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
