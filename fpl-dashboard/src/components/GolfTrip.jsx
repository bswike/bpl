import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  ChevronDown,
  ChevronUp,
  Swords,
  BarChart3,
  Flag,
  ExternalLink,
} from "lucide-react";
import "./GolfTrip.css";

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

const fmtMoney = (n) => {
  if (n == null) return "—";
  const v = Number(n);
  const rounded = Math.abs(v % 1) < 0.005 ? v.toFixed(0) : v.toFixed(2);
  const [a, b] = rounded.split(".");
  const withCommas = a.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return b ? `$${withCommas}.${b}` : `$${withCommas}`;
};

const firstLast = (name) => {
  if (name.includes(" + ")) return name.split(" + ").map(firstLast).join(" + ");
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
};

const lastName = (name) => {
  if (name.includes(" + ")) return name.split(" + ").map(lastName).join("+");
  const parts = name.trim().split(" ");
  return parts[parts.length - 1];
};

const nameOnCard = (rowName, player) =>
  rowName === player || rowName.split(" + ").map((s) => s.trim()).includes(player);

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

function TeamBanner({ teams, players }) {
  const south = teams.find((t) => t.name === "South");
  const north = teams.find((t) => t.name === "North");
  if (!south || !north) return null;
  const purseOf = (name) =>
    (players || []).filter((p) => p.team === name).reduce((s, p) => s + (p.purse || 0), 0);
  const southPurse = purseOf("South");
  const northPurse = purseOf("North");
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
        <span>Team purse {fmtMoney(southPurse)}</span>
        <span>Team purse {fmtMoney(northPurse)}</span>
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

// Resolve a player's match summary back to the full match object (with
// scorecard) in the rounds data. A player appears at most once per tournament.
function findMatch(rounds, playerName, m) {
  for (const r of rounds || []) {
    if (r.label !== m.round) continue;
    for (const t of r.tournaments) {
      if (t.type !== "match" || t.name !== m.format) continue;
      const mt = t.matches.find((x) => x.playersL.includes(playerName) || x.playersR.includes(playerName));
      if (mt) return { mt, pars: r.pars };
    }
  }
  return null;
}

function matchRoundLabel(m) {
  if (/scramble/i.test(m.format)) return "Black Bear — Scramble";
  if (/pinehurst/i.test(m.format) && /black bear/i.test(m.round)) return "Black Bear — Pinehurst";
  return m.round;
}

function PlayerDetail({ p, rounds }) {
  const [openRound, setOpenRound] = useState(null);
  const grouped = useMemo(() => {
    const order = new Map((rounds || []).map((r, i) => [r.label, i]));
    const map = new Map();
    for (const m of p.matches) {
      const label = matchRoundLabel(m);
      const key = `${m.round}::${m.format}`;
      if (!map.has(key)) map.set(key, { label, round: m.round, items: [] });
      map.get(key).items.push({ m, found: findMatch(rounds, p.name, m) });
    }
    return [...map.values()].sort((a, b) => {
      const d = (order.get(a.round) ?? 99) - (order.get(b.round) ?? 99);
      if (d) return d;
      const rank = (fmt) => (/scramble/i.test(fmt) ? 0 : /pinehurst/i.test(fmt) ? 1 : 2);
      return rank(a.items[0]?.m.format || "") - rank(b.items[0]?.m.format || "");
    });
  }, [p.matches, p.name, rounds]);

  return (
    <div className="px-3 pb-3 pt-1 space-y-3 text-xs" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-gray-400">
        {p.hi != null && <span>HI <span className="text-gray-200 font-semibold">{p.hi}</span></span>}
        {p.avgNet != null && <span>Avg net <span className="text-gray-200 font-semibold">{p.avgNet}</span></span>}
        <span>Match pts <span className="text-gray-200 font-semibold">{p.matchPts.toFixed(1)}</span></span>
      </div>
      <PurseChips purseBy={p.purseBy} />
      {grouped.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-1.5">Rounds — tap one for the scorecard</div>
          <div className="space-y-1.5">
            {grouped.map(({ label, round, items }) => {
              const key = `${round}::${items[0]?.m.format}`;
              const open = openRound === key;
              const hasCard = items.some((x) => x.found?.mt?.card);
              return (
                <div key={key} className="rounded-lg border border-slate-700/80 overflow-hidden">
                  <button
                    type="button"
                    className={`w-full flex items-center gap-2 px-2 py-1.5 text-left ${hasCard ? "hover:bg-slate-700/40" : ""} ${open ? "bg-slate-700/40" : ""}`}
                    onClick={() => hasCard && setOpenRound(open ? null : key)}
                  >
                    <span className="flex gap-0.5 shrink-0">
                      {items.map((x, i) => (
                        <span
                          key={i}
                          className={`w-5 h-5 rounded flex items-center justify-center font-bold ${
                            x.m.outcome === "W"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : x.m.outcome === "L"
                                ? "bg-rose-500/20 text-rose-300"
                                : "bg-slate-700 text-gray-300"
                          }`}
                        >
                          {x.m.outcome}
                        </span>
                      ))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-gray-100 font-medium block truncate">{label}</span>
                      <span className="text-gray-500">
                        {items.map((x) => {
                          const vs = x.m.partner ? `w/ ${firstLast(x.m.partner)} vs ${x.m.opp}` : `vs ${x.m.opp}`;
                          const res = x.m.result && x.m.result !== "Tied" ? ` · ${x.m.result}` : "";
                          return vs + res;
                        }).join("  ·  ")}
                      </span>
                    </span>
                    {hasCard && (open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-500 shrink-0" />)}
                  </button>
                  {open && hasCard && (
                    <div className="px-1.5 pb-2 pt-1 border-t border-slate-700/80">
                      {items.map((x, i) =>
                        x.found?.mt?.card ? (
                          <Scorecard key={i} m={x.found.mt} pars={x.found.pars} highlight={p.name} />
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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

function Standings({ players, rounds }) {
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
            <PlayerRows key={p.name} p={p} rounds={rounds} rank={i + 1} open={open === p.name} onToggle={() => setOpen(open === p.name ? null : p.name)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlayerRows({ p, rounds, rank, open, onToggle }) {
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
        <tr className="border-b border-slate-800 bg-slate-800/40" onClick={(e) => e.stopPropagation()}>
          <td colSpan={7}><PlayerDetail p={p} rounds={rounds} /></td>
        </tr>
      )}
    </>
  );
}

/* ---------------- rounds tab ---------------- */

/* ---------------- scorecard ---------------- */

function ScoreCell({ gross, dots, par, counted }) {
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
    <div className={`relative flex items-center justify-center h-8 ${counted ? "bg-emerald-500/25 rounded-md ring-1 ring-emerald-400/40" : ""}`}>
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

function holeStatus(winners) {
  const played = [];
  for (let i = 0; i < 18; i++) if (winners[i]) played.push(i);
  const start = played[0] ?? 0;
  const last = played[played.length - 1] ?? -1;
  const end = start < 9 && last >= 9 ? 18 : start >= 9 ? 18 : 9;
  const out = Array(18).fill(null);
  let l = 0;
  let r = 0;
  let closed = false;
  for (let i = 0; i < 18; i++) {
    const w = winners[i];
    if (!w || closed) continue;
    if (w === "L") l += 1;
    else if (w === "R") r += 1;
    const lead = Math.abs(l - r);
    const who = l === r ? null : l > r ? "L" : "R";
    const remaining = end - i - 1;
    if (!who) out[i] = { label: "AS", who: null };
    else if (remaining > 0 && lead > remaining) {
      out[i] = { label: `${lead} & ${remaining}`, who };
      closed = true;
    } else out[i] = { label: `${lead} up`, who };
  }
  return out;
}

function Scorecard({ m, pars, highlight }) {
  const { rows, winners } = m.card;
  const grid = { display: "grid", gridTemplateColumns: "4.6rem repeat(9, minmax(0, 1fr)) 1.9rem" };
  const status = holeStatus(winners);

  const individual = highlight && rows.some((r) => r.name === highlight);
  const combined = highlight && !individual && rows.some((r) => nameOnCard(r.name, highlight));

  // In 2v2 best-ball, mark holes where this player's net was the team's best.
  const isCounting = (r, i) => {
    if (!individual || r.name !== highlight || r.gross[i] == null) return false;
    const mates = rows.filter((x) => x.side === r.side && x.gross[i] != null);
    if (rows.filter((x) => x.side === r.side).length < 2) return false;
    const best = Math.min(...mates.map((x) => x.gross[i] - x.dots[i]));
    return r.gross[i] - r.dots[i] === best;
  };
  const hlRow = individual ? rows.find((r) => r.name === highlight) : null;
  const hlTeammates = hlRow ? rows.filter((r) => r.side === hlRow.side).length : 0;
  let countedSolo = 0;
  let countedPush = 0;
  let countedWon = 0;
  if (hlRow && hlTeammates >= 2) {
    for (let i = 0; i < 18; i++) {
      if (hlRow.gross[i] == null) continue;
      const mates = rows.filter((x) => x.side === hlRow.side && x.gross[i] != null);
      if (!mates.length) continue;
      const best = Math.min(...mates.map((x) => x.gross[i] - x.dots[i]));
      if (hlRow.gross[i] - hlRow.dots[i] !== best) continue;
      const withPartner = mates.filter((x) => x.gross[i] - x.dots[i] === best).length > 1;
      if (withPartner) countedPush += 1;
      else countedSolo += 1;
      if (winners[i] === hlRow.side) countedWon += 1;
    }
  }
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
    <div className="mt-2 mb-1 rounded-md bg-slate-950/70 border border-slate-800 p-2">
      {halves.map(({ start, label }) => {
        const idx = Array.from({ length: 9 }, (_, k) => start + k);
        return (
          <div key={label} className={start === 0 && halves.length > 1 ? "mb-6" : halves.length > 1 ? "mt-6 pt-5 border-t border-slate-600" : ""}>
            <div style={grid} className="text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">
              <div className="flex items-center pl-1 text-gray-400 font-semibold">{label === "Out" ? "Front" : label === "In" ? "Back" : "Hole"}</div>
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
              const mine = highlight && nameOnCard(r.name, highlight);
              return (
                <div key={r.name} style={grid} className={highlight && !mine ? "opacity-45" : ""}>
                  <div className="flex items-center gap-1 pl-1 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TEAM[team]?.dot || "bg-slate-600"}`} />
                    <span className={`text-[9px] truncate ${mine ? "text-white font-semibold" : "text-gray-300"}`}>{lastName(r.name)}</span>
                  </div>
                  {idx.map((i) => (
                    <ScoreCell key={i} gross={r.gross[i]} dots={r.dots[i]} par={pars?.[i]} counted={isCounting(r, i)} />
                  ))}
                  <div className="flex items-center justify-center text-[10px] tabular-nums text-gray-300 font-semibold">
                    {tot || ""}
                  </div>
                </div>
              );
            })}
            <div style={grid} className="mt-0.5">
              <div className="flex items-center pl-1 text-[9px] uppercase tracking-wider text-gray-500 font-semibold">Match</div>
              {idx.map((i) => {
                const s = status[i];
                if (!s) return <div key={i} />;
                const team = s.who === "L" ? m.teamL : s.who === "R" ? m.teamR : null;
                return (
                  <div
                    key={i}
                    className={`flex items-center justify-center h-5 px-0.5 rounded-sm text-[8px] font-bold leading-none text-center ${
                      team ? TEAM[team]?.text : "text-gray-400"
                    } ${s.who === "L" ? TEAM[m.teamL]?.cell : s.who === "R" ? TEAM[m.teamR]?.cell : ""}`}
                  >
                    {s.label}
                  </div>
                );
              })}
              <div />
            </div>
          </div>
        );
      })}
      {hlRow && hlTeammates >= 2 && (countedSolo + countedPush > 0) && (
        <div className="mt-1.5 text-[10px] text-emerald-300">
          <span className="inline-block w-3 h-3 rounded-md bg-emerald-500/25 align-[-2px] mr-1.5" />
          {firstLast(highlight)}'s ball · {countedSolo} solo · {countedPush} with partner · won {countedWon}
        </div>
      )}
      {combined && (
        <div className="mt-1.5 text-[10px] text-gray-500">
          Combined team score — individual balls aren't recorded for this format
        </div>
      )}
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
    <div className="flex-1 min-w-0 py-2">
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${TEAM[team]?.text || "text-gray-500"}`}>
        {team}
        {pts != null && <span className="text-gray-600 normal-case tracking-normal"> · {pts}</span>}
      </div>
      {names.map((n) => (
        <div key={n} className={`text-xs sm:text-sm truncate ${won ? "text-white font-semibold" : "text-gray-500"}`}>{n}</div>
      ))}
    </div>
  );
  return (
    <div>
      <button
        type="button"
        disabled={!hasCard}
        className={`w-full flex items-center gap-2 text-left px-0.5 ${hasCard ? "cursor-pointer hover:bg-slate-800/70 active:bg-slate-800" : "cursor-default"} ${open ? "bg-slate-800/50" : ""}`}
        onClick={() => hasCard && setOpen(!open)}
      >
        {side(m.teamL, m.playersL, m.ptsL, m.winner === "left")}
        <div className="shrink-0 w-[4.75rem] text-center py-2">
          <div
            className={`text-xs font-bold ${
              m.winner === "left"
                ? TEAM[m.teamL]?.text || "text-gray-300"
                : m.winner === "right"
                  ? TEAM[m.teamR]?.text || "text-gray-300"
                  : "text-gray-300"
            }`}
          >
            {m.result || (m.winner === "tie" ? "Tied" : "")}
          </div>
          {hasCard && (
            <div className={`mt-0.5 text-[9px] uppercase tracking-wider ${open ? "text-emerald-400" : "text-gray-500"}`}>
              {open ? "Hide" : "Scorecard"} {open ? <ChevronUp size={10} className="inline -mt-0.5" /> : <ChevronDown size={10} className="inline -mt-0.5" />}
            </div>
          )}
        </div>
        {side(m.teamR, m.playersR, m.ptsR, m.winner === "right")}
      </button>
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
      <div className="space-y-0 divide-y divide-slate-800">
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

function splitRounds(rounds) {
  const out = [];
  for (const r of rounds) {
    const front = r.tournaments.filter((t) => /front/i.test(t.name));
    const back = r.tournaments.filter((t) => /back/i.test(t.name));
    if (front.some((t) => t.type === "match") && back.some((t) => t.type === "match")) {
      out.push({ ...r, id: `${r.id}-scramble`, label: "Black Bear — Scramble", tournaments: front });
      out.push({ ...r, id: `${r.id}-pinehurst`, label: "Black Bear — Pinehurst", tournaments: back });
    } else {
      out.push(r);
    }
  }
  return out;
}

function RoundCard({ r, open, onToggle }) {
  const score = roundScore(r);
  return (
    <div className="bg-slate-900 border border-slate-700/80 rounded-lg overflow-hidden">
      <button className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-800/60" onClick={onToggle}>
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
        <div className="px-3 pb-3 border-t border-slate-800 pt-1">
          {roundTournaments(r).map((t) => <Tournament key={t.id} t={t} pars={r.pars} />)}
        </div>
      )}
    </div>
  );
}

function Rounds({ rounds }) {
  const list = useMemo(() => splitRounds(rounds), [rounds]);
  const [open, setOpen] = useState(() => new Set());
  const toggle = (id) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  return (
    <div className="space-y-3">
      {list.map((r) => (
        <RoundCard key={r.id} r={r} open={open.has(r.id)} onToggle={() => toggle(r.id)} />
      ))}
    </div>
  );
}

/* ---------------- stats tab ---------------- */

const DIST_COLS = [
  { id: 0, label: "E", title: "Eagle", text: "text-yellow-400" },
  { id: 1, label: "B", title: "Birdie", text: "text-emerald-400" },
  { id: 2, label: "Par", title: "Par", text: "text-sky-400" },
  { id: 3, label: "Bog", title: "Bogey", text: "text-slate-300" },
  { id: 4, label: "Dbl", title: "Double", text: "text-orange-400" },
  { id: 5, label: "3+", title: "Triple+", text: "text-rose-400" },
];

function ScoringDist({ players }) {
  const [sort, setSort] = useState(2);
  const rows = useMemo(() => {
    return players
      .filter((p) => p.dist && p.dist.reduce((a, b) => a + b, 0) > 0)
      .sort((a, b) => (b.dist[sort] - a.dist[sort]) || a.name.localeCompare(b.name));
  }, [players, sort]);
  const sortedBy = DIST_COLS[sort];
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden">
      <div className="px-3.5 sm:px-4 pt-3.5 pb-2">
        <div className="text-sm font-semibold text-gray-100">Scoring distribution</div>
        <div className="text-[11px] text-gray-500">
          All trip holes · sorted by {sortedBy.title} · tap a heading to sort
        </div>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="border-t border-slate-800 text-left text-[10px] uppercase tracking-wider">
            <th className="py-2 pl-3.5 sm:pl-4 pr-2 text-gray-500 font-semibold">Player</th>
            {DIST_COLS.map((c) => (
              <th
                key={c.id}
                title={`Sort by ${c.title}`}
                onClick={() => setSort(c.id)}
                className={`py-2 px-1 font-semibold text-right cursor-pointer select-none whitespace-nowrap ${
                  sort === c.id ? "text-emerald-300" : "text-gray-500 hover:text-gray-300"
                } ${c.id === 5 ? "pr-3.5 sm:pr-4" : ""}`}
              >
                <span className="inline-flex items-center justify-end gap-0.5">
                  {c.label}
                  <ChevronDown
                    size={11}
                    className={sort === c.id ? "opacity-100" : "opacity-25"}
                  />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.name} className="border-t border-slate-800">
              <td className="py-1.5 pl-3.5 sm:pl-4 pr-2">
                <span className="flex items-center gap-1.5 min-w-0">
                  <TeamDot team={p.team} />
                  <span className="text-gray-200 truncate">{firstLast(p.name)}</span>
                </span>
              </td>
              {DIST_COLS.map((c) => {
                const n = p.dist[c.id];
                return (
                  <td
                    key={c.id}
                    className={`py-1.5 px-1 text-right tabular-nums ${
                      n ? c.text : "text-gray-700"
                    } ${sort === c.id ? "font-semibold" : ""} ${c.id === 5 ? "pr-3.5 sm:pr-4" : ""}`}
                  >
                    {n || "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
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

function matchCards(rounds) {
  const out = [];
  for (const r of rounds || []) {
    for (const t of r.tournaments) {
      if (t.type !== "match") continue;
      for (const m of t.matches) {
        const rows = m.card?.rows;
        if (!rows || rows.some((row) => row.name.includes(" + "))) continue;
        out.push(rows);
      }
    }
  }
  return out;
}

function clutchCounts(rounds) {
  const counts = {};
  for (const rows of matchCards(rounds)) {
    for (const side of ["L", "R"]) {
      const mates = rows.filter((row) => row.side === side);
      if (mates.length < 2) continue;
      for (let h = 0; h < 18; h++) {
        const scored = mates.filter((row) => row.gross[h] != null);
        if (!scored.length) continue;
        const best = Math.min(...scored.map((row) => row.gross[h] - row.dots[h]));
        for (const row of scored) {
          if (row.gross[h] - row.dots[h] === best) counts[row.name] = (counts[row.name] || 0) + 1;
        }
      }
    }
  }
  return counts;
}

function holeWPCounts(rounds) {
  const counts = {};
  for (const rows of matchCards(rounds)) {
    for (const side of ["L", "R"]) {
      const mine = rows.filter((row) => row.side === side);
      const opp = rows.filter((row) => row.side === (side === "L" ? "R" : "L"));
      for (const row of mine) {
        for (let h = 0; h < 18; h++) {
          if (row.gross[h] == null) continue;
          const oppScored = opp.filter((x) => x.gross[h] != null);
          if (!oppScored.length) continue;
          const myNet = row.gross[h] - row.dots[h];
          const oppBest = Math.min(...oppScored.map((x) => x.gross[h] - x.dots[h]));
          if (myNet <= oppBest) counts[row.name] = (counts[row.name] || 0) + 1;
        }
      }
    }
  }
  return counts;
}

function teamLeaders(counts, teamOf) {
  return ["South", "North"].map((team) => {
    const names = Object.keys(counts).filter((n) => teamOf[n] === team);
    if (!names.length) return null;
    const best = Math.max(...names.map((n) => counts[n]));
    return { team, best, who: names.filter((n) => counts[n] === best) };
  }).filter(Boolean);
}

function shortWho(name) {
  if (name.includes(" + ")) return name.split(" + ").map(lastName).join(" + ");
  return firstLast(name);
}

function bestScore(rows, key) {
  if (!rows.length) return null;
  const v = Math.min(...rows.map((r) => r[key]));
  return { v, names: rows.filter((r) => r[key] === v).map((r) => r.name) };
}

function lowsFromOfficial(label, players, needle) {
  const rows = [];
  for (const p of players) {
    for (const s of p.scores || []) {
      if (s.holes === 18 && s.round.includes(needle)) rows.push({ name: p.name, gross: s.gross, net: s.net });
    }
  }
  const gross = bestScore(rows, "gross");
  const net = bestScore(rows, "net");
  return gross && net ? { label, gross, net } : null;
}

function lowsFromMatches(label, tournaments, includeNet = true) {
  const rows = [];
  for (const t of tournaments) {
    for (const m of t.matches || []) {
      for (const row of m.card?.rows || []) {
        const holes = row.gross.map((g, i) => (g == null ? null : { g, n: g - row.dots[i] })).filter(Boolean);
        if (!holes.length) continue;
        rows.push({
          name: row.name,
          gross: holes.reduce((a, h) => a + h.g, 0),
          net: holes.reduce((a, h) => a + h.n, 0),
        });
      }
    }
  }
  const gross = bestScore(rows, "gross");
  if (!gross) return null;
  return { label, gross, net: includeNet ? bestScore(rows, "net") : null };
}

function roundLows(rounds, players) {
  const out = [];
  for (const r of rounds || []) {
    const matches = r.tournaments.filter((t) => t.type === "match");
    const front = matches.filter((t) => /front/i.test(t.name));
    const back = matches.filter((t) => /back/i.test(t.name));
    if (front.length && back.length) {
      out.push(lowsFromMatches("Black Bear — Scramble", front, false));
      out.push(lowsFromMatches("Black Bear — Pinehurst", back, false));
    } else if (/crystal springs/i.test(r.label)) {
      out.push(lowsFromOfficial(r.label, players, "Crystal Springs"));
    } else if (/1v1/i.test(r.label)) {
      out.push(lowsFromOfficial(r.label, players, "1v1"));
    } else {
      out.push(lowsFromMatches(r.label, matches, false));
    }
  }
  return out.filter(Boolean);
}

function shortRound(label) {
  return label.replace(/\s*[—-]\s*/g, " ").replace(/ Matchplay/g, "").replace(/2v2 /g, "");
}

function LowCell({ block }) {
  if (!block) return <span className="text-gray-600">—</span>;
  return (
    <div className="leading-snug">
      <span className="tabular-nums font-semibold text-gray-100">{block.v}</span>
      {block.names.length > 1 && (
        <span className="ml-1 text-[10px] uppercase tracking-wider text-amber-300">tied</span>
      )}
      <span className="text-[11px] text-gray-400"> {block.names.map(shortWho).join(", ")}</span>
    </div>
  );
}

function Superlatives({ players, rounds }) {
  const { lows, fun } = useMemo(() => {
    const pick = (arr, f, best) => {
      const v = best(...arr.map(f));
      return { v, list: arr.filter((x) => f(x) === v) };
    };
    const distWho = ({ list }) => list.map((e) => firstLast(e.name)).join(", ");
    const fun = [];
    const withDist = players.filter((p) => p.dist && p.dist.reduce((a, b) => a + b, 0) > 0);
    if (withDist.length) {
      const birdies = pick(withDist, (p) => p.dist[1], Math.max);
      if (birdies.v > 0) fun.push({ label: "Most birdies", value: birdies.v, who: distWho(birdies) });
      const eagles = withDist.filter((p) => p.dist[0] > 0);
      if (eagles.length)
        fun.push({
          label: "Eagle club",
          value: eagles.reduce((a, p) => a + p.dist[0], 0),
          who: eagles.map((p) => firstLast(p.name)).join(", "),
        });
      const pars = pick(withDist, (p) => p.dist[2], Math.max);
      fun.push({ label: "Most pars", value: pars.v, who: distWho(pars) });
      const bogeys = pick(withDist, (p) => p.dist[3], Math.max);
      if (bogeys.v > 0) fun.push({ label: "Most bogeys", value: bogeys.v, who: distWho(bogeys) });
    }
    const counted = clutchCounts(rounds);
    const holeWP = holeWPCounts(rounds);
    const teamOf = Object.fromEntries(players.map((p) => [p.name, p.team]));
    const clutch = teamLeaders(counted, teamOf);
    if (clutch.length) {
      fun.push({
        label: "Clutch gene",
        who: clutch.map((c) => `${c.who.map(firstLast).join(", ")} ${c.best}`).join("  ·  "),
        hint: "2v2 matchplay · holes their ball counted",
      });
    }
    const wp = teamLeaders(holeWP, teamOf);
    if (wp.length) {
      fun.push({
        label: "Won or pushed",
        who: wp.map((c) => `${c.who.map(firstLast).join(", ")} ${c.best}`).join("  ·  "),
        hint: "individual holes vs the other side, 2v2 & 1v1",
      });
    }
    const twoRounds = players.filter((p) => (p.scores || []).filter((s) => s.holes === 18).length >= 2);
    if (twoRounds.length) {
      const bb = pick(twoRounds, (p) => {
        const s = p.scores.filter((x) => x.holes === 18);
        return s[0].net - s[s.length - 1].net;
      }, Math.max);
      if (bb.v > 0) fun.push({ label: "Bounce back", value: `-${bb.v}`, who: distWho(bb), hint: "net, Crystal Springs → Black Bear" });
    }
    return { lows: roundLows(rounds, players), fun };
  }, [players, rounds]);

  return (
    <>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
        <div className="text-sm font-semibold text-gray-100">Round lows</div>
        <div className="text-[11px] text-gray-500 mb-2">Net only on Crystal Springs and Black Bear 1v1</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="py-1 pr-2 font-semibold">Round</th>
              <th className="py-1 pr-2 font-semibold">Gross</th>
              <th className="py-1 font-semibold">Net</th>
            </tr>
          </thead>
          <tbody>
            {lows.map((r) => (
              <tr key={r.label} className="border-t border-slate-800">
                <td className="py-1.5 pr-2 text-gray-300">{shortRound(r.label)}</td>
                <td className="py-1.5 pr-2"><LowCell block={r.gross} /></td>
                <td className="py-1.5"><LowCell block={r.net} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
        <div className="text-sm font-semibold text-gray-100 mb-2">Highlights</div>
        <table className="w-full text-xs">
          <tbody>
            {fun.map((f) => (
              <tr key={f.label} className="border-t border-slate-800 first:border-t-0">
                <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{f.label}</td>
                <td className="py-1.5 pr-3 tabular-nums font-semibold text-gray-100">{f.value ?? ""}</td>
                <td className="py-1.5 text-gray-300 text-right">
                  {f.who}
                  {f.hint && <div className="text-[10px] text-gray-600">{f.hint}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function hiOf(p) {
  const n = Number(p.hi);
  return Number.isFinite(n) ? n : null;
}

function winPct(p) {
  const n = (p.w || 0) + (p.l || 0) + (p.t || 0);
  return n ? (p.w + 0.5 * p.t) / n : 0;
}

function hiBand(hi) {
  if (hi <= 5) return "0–5";
  if (hi <= 10) return "6–10";
  if (hi <= 15) return "11–15";
  if (hi <= 20) return "16–20";
  return "21+";
}

const HI_BANDS = ["0–5", "6–10", "11–15", "16–20", "21+"];

function nameJitter(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 33 + name.charCodeAt(i)) >>> 0;
  return ((h % 9) - 4) * 1.5;
}

function beeswarm(players, maxHi) {
  const sorted = [...players].sort((a, b) => hiOf(a) - hiOf(b) || a.name.localeCompare(b.name));
  const dots = [];
  const minDist = 0.04;
  for (const p of sorted) {
    const x = hiOf(p) / maxHi;
    const used = new Set();
    for (const d of dots) {
      if (Math.abs(d.x - x) < minDist) used.add(d.lane);
    }
    let lane = 0;
    if (used.has(0)) {
      let k = 1;
      while (used.has(k) && used.has(-k)) k += 1;
      lane = used.has(k) ? -k : k;
    }
    dots.push({ p, x, lane });
  }
  return { dots, maxLane: Math.max(1, ...dots.map((d) => Math.abs(d.lane))) };
}

function HandicapLab({ players, rounds }) {
  const data = useMemo(() => {
    const active = players.filter((p) => hiOf(p) != null && (p.w || 0) + (p.l || 0) + (p.t || 0) > 0);
    if (!active.length) return null;
    const bands = HI_BANDS.map((label) => {
      const list = active.filter((p) => hiBand(hiOf(p)) === label);
      const w = list.reduce((s, p) => s + p.w, 0);
      const l = list.reduce((s, p) => s + p.l, 0);
      const t = list.reduce((s, p) => s + p.t, 0);
      const n = w + l + t;
      const champ = [...list].sort((a, b) => winPct(b) - winPct(a) || (a.l || 0) - (b.l || 0))[0];
      return { label, list, w, l, t, n, pct: n ? (w + 0.5 * t) / n : 0, champ };
    }).filter((b) => b.list.length);
    const hiBy = Object.fromEntries(active.map((p) => [p.name, hiOf(p)]));
    const duels = [];
    for (const r of rounds || []) {
      for (const t of r.tournaments) {
        if (t.type !== "match") continue;
        for (const m of t.matches || []) {
          if (m.playersL.length !== 1 || m.playersR.length !== 1 || m.winner === "tie") continue;
          const winner = m.winner === "left" ? m.playersL[0] : m.playersR[0];
          const loser = m.winner === "left" ? m.playersR[0] : m.playersL[0];
          if (hiBy[winner] == null || hiBy[loser] == null) continue;
          duels.push({
            winner,
            loser,
            result: m.result,
            gap: hiBy[winner] - hiBy[loser],
            winnerHi: hiBy[winner],
            loserHi: hiBy[loser],
          });
        }
      }
    }
    const upsets = duels.filter((d) => d.gap >= 1).sort((a, b) => b.gap - a.gap);
    const best = [...active].sort((a, b) => winPct(b) - winPct(a) || hiOf(b) - hiOf(a))[0];
    const worstHi = [...active].sort((a, b) => hiOf(a) - hiOf(b))[0];
    const bestNet = [...active].filter((p) => p.avgNet != null).sort((a, b) => a.avgNet - b.avgNet)[0];
    const cold = [...bands]
      .filter((b) => b.label !== "21+")
      .sort((a, b) => a.pct - b.pct)[0] || [...bands].sort((a, b) => a.pct - b.pct)[0];
    return { active, bands, upsets, best, worstHi, bestNet, cold };
  }, [players, rounds]);

  if (!data) return null;
  const maxHi = Math.max(26, ...data.active.map((p) => hiOf(p)));
  const swarm = beeswarm(data.active, maxHi);
  const labeled = (() => {
    const names = new Set();
    const pick = [...data.active].sort((a, b) => winPct(b) - winPct(a) || hiOf(b) - hiOf(a))[0];
    const sink = [...data.active].sort((a, b) => winPct(a) - winPct(b) || hiOf(b) - hiOf(a))[0];
    const stick = [...data.active].sort((a, b) => hiOf(a) - hiOf(b))[0];
    for (const p of [pick, sink, stick]) if (p) names.add(p.name);
    return names;
  })();

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100">Handicap lab</div>
      <div className="text-[11px] text-gray-500 mb-3">
        Index from Golf Genius · {data.active.length} who teed it up
      </div>

      <div className="flex items-baseline justify-between gap-2 text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">
        <span>The field</span>
        <span className="flex items-center gap-2.5 normal-case tracking-normal">
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-400" /> South
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> North
          </span>
        </span>
      </div>
      <div className="relative mb-1" style={{ height: `${28 + swarm.maxLane * 14}px` }}>
        <div className="absolute inset-x-0 top-1/2 h-px bg-slate-600" />
        {swarm.dots.map(({ p, x, lane }) => (
          <span
            key={p.name}
            title={`${p.name} · ${hiOf(p).toFixed(1)} · ${p.w}-${p.l}-${p.t}`}
            className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-1 ring-slate-900/80 ${TEAM[p.team]?.dot || "bg-slate-500"}`}
            style={{ left: `${x * 100}%`, top: `calc(50% + ${lane * 11}px)` }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 mb-4">
        <span>scratch</span>
        <span>{Math.round(maxHi)}</span>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Records by index</div>
      <table className="w-full text-xs mb-4">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
            <th className="py-1 pr-2 font-semibold">Band</th>
            <th className="py-1 pr-2 font-semibold">Record</th>
            <th className="py-1 pr-2 font-semibold w-[38%]">Win %</th>
            <th className="py-1 font-semibold text-right">Best</th>
          </tr>
        </thead>
        <tbody>
          {data.bands.map((b) => (
            <tr key={b.label} className="border-t border-slate-800">
              <td className="py-1.5 pr-2">
                <div className="font-medium text-gray-200">{b.label}</div>
                <div className="text-[10px] text-gray-600">{b.list.length} players</div>
              </td>
              <td className="py-1.5 pr-2 tabular-nums text-gray-300 whitespace-nowrap">
                {b.w}-{b.l}-{b.t}
              </td>
              <td className="py-1.5 pr-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.pct < 0.5 ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(b.pct * 100, 4)}%` }}
                    />
                  </div>
                  <span className={`tabular-nums w-8 text-right ${b.pct < 0.5 ? "text-rose-300" : "text-emerald-300"}`}>
                    {Math.round(b.pct * 100)}%
                  </span>
                </div>
              </td>
              <td className="py-1.5 text-right">
                {b.champ && (
                  <>
                    <div className="text-gray-200">{lastName(b.champ.name)}</div>
                    <div className="text-[10px] text-gray-500 tabular-nums">
                      {b.champ.w}-{b.champ.l}-{b.champ.t}
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">Index vs match win %</div>
      <div className="relative h-48 rounded-lg bg-slate-800/50 border border-slate-800 mb-1 overflow-hidden">
        <div className="absolute left-8 right-3 top-3 bottom-5">
          <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-600" />
          {data.active.map((p) => {
            const left = (hiOf(p) / maxHi) * 100;
            const bottom = Math.min(96, Math.max(4, winPct(p) * 100 + nameJitter(p.name)));
            return (
              <span
                key={p.name}
                title={`${firstLast(p.name)} · HI ${hiOf(p).toFixed(1)} · ${p.w}-${p.l}-${p.t}`}
                className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -translate-y-1/2 ring-1 ring-slate-900/60 ${TEAM[p.team]?.dot || "bg-slate-500"}`}
                style={{ left: `${left}%`, bottom: `${bottom}%` }}
              />
            );
          })}
          {data.active
            .filter((p) => labeled.has(p.name))
            .map((p) => {
              const left = (hiOf(p) / maxHi) * 100;
              const bottom = Math.min(96, Math.max(4, winPct(p) * 100 + nameJitter(p.name)));
              const flip = left > 62;
              return (
                <span
                  key={`lbl-${p.name}`}
                  className="absolute text-[9px] text-gray-400 whitespace-nowrap pointer-events-none"
                  style={{
                    left: flip ? "auto" : `${left}%`,
                    right: flip ? `${100 - left}%` : "auto",
                    bottom: `${bottom}%`,
                    transform: flip ? "translate(-4px, -11px)" : "translate(8px, -11px)",
                  }}
                >
                  {lastName(p.name).split("-")[0]}
                </span>
              );
            })}
        </div>
        <div className="absolute left-1 top-2 text-[9px] text-gray-600">100%</div>
        <div className="absolute left-1 top-1/2 -mt-2 text-[9px] text-gray-600">50%</div>
        <div className="absolute left-1 bottom-3 text-[9px] text-gray-600">0%</div>
      </div>
      <div className="flex justify-between text-[9px] text-gray-600 mb-4 px-7">
        <span>scratch</span>
        <span>high index</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {data.best && (
          <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Played out of his shoes</div>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">{firstLast(data.best.name)}</div>
            <div className="text-[11px] text-emerald-300">
              {data.best.w}-{data.best.l}-{data.best.t} from a {hiOf(data.best).toFixed(1)}
            </div>
          </div>
        )}
        {data.worstHi && (
          <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Scratch tax</div>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">{firstLast(data.worstHi.name)}</div>
            <div className="text-[11px] text-gray-400">
              {data.worstHi.w}-{data.worstHi.l}-{data.worstHi.t} from a {hiOf(data.worstHi).toFixed(1)}
            </div>
          </div>
        )}
        {data.bestNet && (
          <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Best avg net</div>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">{firstLast(data.bestNet.name)}</div>
            <div className="text-[11px] text-sky-300">
              {data.bestNet.avgNet} net · HI {hiOf(data.bestNet).toFixed(1)}
            </div>
          </div>
        )}
        {data.cold && (
          <div className="rounded-lg bg-slate-800/50 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Danger zone</div>
            <div className="text-sm font-semibold text-gray-100 mt-0.5">{data.cold.label} indexes</div>
            <div className="text-[11px] text-rose-300">
              {data.cold.w}-{data.cold.l}-{data.cold.t} · {Math.round(data.cold.pct * 100)}%
            </div>
          </div>
        )}
      </div>

      {data.upsets.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">1v1 giant killers</div>
          <div className="space-y-1">
            {data.upsets.map((d) => (
              <div key={`${d.winner}-${d.loser}`} className="flex items-baseline justify-between gap-2 text-xs">
                <span className="text-gray-300 min-w-0 truncate">
                  {firstLast(d.winner)}
                  <span className="text-gray-500"> ({d.winnerHi.toFixed(1)})</span>
                  {" beat "}
                  {firstLast(d.loser)}
                  <span className="text-gray-500"> ({d.loserHi.toFixed(1)})</span>
                </span>
                <span className="text-emerald-300 tabular-nums shrink-0">+{d.gap.toFixed(1)}</span>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-gray-600 mt-1">Index strokes the winner gave away and still won</div>
        </div>
      )}
    </div>
  );
}

function Stats({ data }) {
  return (
    <div className="space-y-4">
      <Superlatives players={data.players} rounds={data.rounds} />
      <NetLow netlow={data.netlow} />
      <ScoringDist players={data.players} />
      <HandicapLab players={data.players} rounds={data.rounds} />
    </div>
  );
}

/* ---------------- page ---------------- */

const TABS = [
  { id: "standings", label: "Standings", icon: Trophy },
  { id: "rounds", label: "Rounds", icon: Swords },
  { id: "stats", label: "Stats", icon: BarChart3 },
];

function ThemeToggle({ dark, onToggle }) {
  return (
    <button
      type="button"
      aria-pressed={dark}
      onClick={onToggle}
      className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold leading-tight text-right border ${
        dark
          ? "bg-slate-800 text-white border-slate-600"
          : "bg-slate-900 border-slate-700 text-gray-400 hover:text-white"
      }`}
    >
      Dark
      <span className="block font-medium opacity-80">mode</span>
    </button>
  );
}

export default function GolfTrip() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("standings");
  const [gg, setGg] = useState(() => {
    try {
      return localStorage.getItem("golftrip-dark") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    fetch("/data/golftrip-nj26.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("golftrip-dark", gg ? "0" : "1");
    } catch {
      /* ignore */
    }
    const bg = gg ? "#f2f2f2" : "";
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    return () => {
      document.documentElement.style.backgroundColor = "";
      document.body.style.backgroundColor = "";
    };
  }, [gg]);

  const shell = `min-h-screen bg-slate-950 text-gray-100 ${gg ? "gg-theme" : ""}`;

  if (error) {
    return (
      <div className={`${shell} flex items-center justify-center p-6`}>
        <div className="max-w-md w-full bg-slate-900 border border-slate-700 rounded-2xl p-6 text-sm text-gray-300">
          Couldn't load trip data ({error}).
        </div>
      </div>
    );
  }
  if (!data) return <div className={shell} />;

  return (
    <div className={shell}>
      <div className="max-w-3xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
        <header className="mb-4 sm:mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
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
            </div>
            <ThemeToggle dark={!gg} onToggle={() => setGg((v) => !v)} />
          </div>
        </header>

        <TeamBanner teams={data.teams} players={data.players} />

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

        {tab === "standings" && <Standings players={data.players} rounds={data.rounds} />}
        {tab === "rounds" && <Rounds rounds={data.rounds} />}
        {tab === "stats" && <Stats data={data} />}

        <footer className="mt-6 text-[10px] text-gray-600">
          Data from Golf Genius · updated {data.trip.fetched}
        </footer>
      </div>
    </div>
  );
}
