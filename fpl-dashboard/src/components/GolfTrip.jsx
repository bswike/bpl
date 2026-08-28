import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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

const TRIP_FILES = {
  nj26: "/data/golftrip-nj26.json",
  2025: "/data/golftrip-2025.json",
};

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
  if (gross === "X") {
    return (
      <div className="relative flex items-center justify-center h-8">
        <span className="text-[10px] text-gray-600">X</span>
        {dots > 0 && (
          <span className="absolute top-0.5 right-0 text-amber-300 text-[8px] leading-none">{"\u2022".repeat(dots)}</span>
        )}
      </div>
    );
  }
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

function netOnHole(row, h) {
  return typeof row?.gross[h] === "number" ? row.gross[h] - row.dots[h] : null;
}

function statusFromWinners(winners, mySide) {
  const last = [...holeStatus(winners)].reverse().find(Boolean);
  if (!last) return null;
  if (!last.who) return { label: "AS", won: false, lost: false };
  if (last.who === mySide) return { label: last.label, won: true, lost: false };
  const label = last.label.endsWith(" up") ? last.label.replace(/ up$/, " down") : `${last.label} down`;
  return { label, won: false, lost: true };
}

/** 2v2: this player 1v1 vs each opponent (partner never teed it up). */
function soloVsOpponents(card, playerName) {
  const rows = card?.rows;
  if (!rows || card.scoring === "stableford" || rows.some((r) => r.name.includes(" + "))) return null;
  const me = rows.find((r) => r.name === playerName || nameOnCard(r.name, playerName));
  if (!me) return null;
  const mates = rows.filter((r) => r.side === me.side);
  const opp = rows.filter((r) => r.side !== me.side);
  if (mates.length < 2 || opp.length < 1) return null;
  const out = [];
  for (const o of opp) {
    const winners = [];
    let compared = 0;
    for (let h = 0; h < 18; h++) {
      const a = netOnHole(me, h);
      const b = netOnHole(o, h);
      if (a == null || b == null) {
        winners.push(null);
        continue;
      }
      compared += 1;
      winners.push(a < b ? me.side : a > b ? o.side : "T");
    }
    if (compared < 6) continue;
    const st = statusFromWinners(winners, me.side);
    if (st) out.push({ opp: lastName(o.name), ...st });
  }
  return out.length ? out : null;
}

function Scorecard({ m, pars, highlight }) {
  const { rows, winners } = m.card;
  const grid = { display: "grid", gridTemplateColumns: "4.6rem repeat(9, minmax(0, 1fr)) 1.9rem" };
  const status = holeStatus(winners);

  const individual = highlight && rows.some((r) => r.name === highlight);
  const combined = highlight && !individual && rows.some((r) => nameOnCard(r.name, highlight));

  // In 2v2 best-ball, mark holes where this player's net was the team's best.
  const isCounting = (r, i) => {
    if (!individual || r.name !== highlight || typeof r.gross[i] !== "number") return false;
    const mates = rows.filter((x) => x.side === r.side && typeof x.gross[i] === "number");
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
      if (typeof hlRow.gross[i] !== "number") continue;
      const mates = rows.filter((x) => x.side === hlRow.side && typeof x.gross[i] === "number");
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
              const tot = idx.reduce((a, i) => a + (typeof r.gross[i] === "number" ? r.gross[i] : 0), 0);
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
            {m.card.scoring !== "stableford" && (
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
            )}
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
      {m.card.scoring === "stableford" && (
        <div className="mt-1.5 text-[10px] text-gray-500">Both balls · hole color is who scored more Stableford points</div>
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
  const solos = useMemo(() => {
    const out = {};
    for (const n of [...(m.playersL || []), ...(m.playersR || [])]) {
      const s = soloVsOpponents(m.card, n);
      if (s) out[n] = s;
    }
    return out;
  }, [m]);
  const side = (team, names, pts, won) => (
    <div className="flex-1 min-w-0 py-2">
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${TEAM[team]?.text || "text-gray-500"}`}>
        {team}
        {pts != null && <span className="text-gray-600 normal-case tracking-normal"> · {pts}</span>}
      </div>
      {names.map((n) => {
        const solo = solos[n];
        return (
          <div key={n} className="min-w-0 mb-1 last:mb-0">
            <div className={`text-xs sm:text-sm truncate ${won ? "text-white font-semibold" : "text-gray-500"}`}>{n}</div>
            {solo?.map((s) => (
              <div
                key={s.opp}
                className={`text-[10px] leading-tight truncate ${
                  s.won ? "text-emerald-400" : s.lost ? "text-gray-600" : "text-gray-500"
                }`}
              >
                vs {s.opp} {s.label}
              </div>
            ))}
          </div>
        );
      })}
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

function teamPts(matches) {
  const pts = { South: 0, North: 0 };
  for (const m of matches || []) {
    if (m.teamL && m.ptsL != null) pts[m.teamL] = (pts[m.teamL] || 0) + m.ptsL;
    if (m.teamR && m.ptsR != null) pts[m.teamR] = (pts[m.teamR] || 0) + m.ptsR;
  }
  return { L: +pts.South.toFixed(1), R: +pts.North.toFixed(1) };
}

function Tournament({ t, pars }) {
  const [expanded, setExpanded] = useState(false);
  if (t.type === "empty") return null;

  let body = null;
  if (t.type === "match") {
    const hasSolo = t.matches.some((m) => m.playersL?.length === 2 && m.playersR?.length === 2 && m.card && !m.card.rows?.some((r) => r.name.includes(" + ")));
    body = (
      <div className="space-y-0 divide-y divide-slate-800">
        {hasSolo && (
          <div className="text-[10px] text-gray-600 px-0.5 pb-1.5">
            Under each name: 1v1 if their partner sat
          </div>
        )}
        {t.matches.map((m, i) => <MatchRow key={i} m={m} pars={pars} />)}
        {t.matches?.length > 0 && (
          <div className="flex justify-between text-[11px] font-semibold pt-1 px-1 text-gray-400">
            <span className="text-rose-300">South {teamPts(t.matches).L}</span>
            <span className="uppercase tracking-widest text-gray-600">Totals</span>
            <span className="text-sky-300">North {teamPts(t.matches).R}</span>
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
        rows={t.rows.map((r) => [r.pos, r.player, r.toPar, (r.rounds || []).join(" / ") || "—", r.total, fmtMoney(r.purse)])}
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
const TYPE_ORDER = { match: 0, skins: 1, quota: 2, teamnet: 3, netlow: 4, list: 5 };
const roundTournaments = (r, tripNetlow) =>
  r.tournaments
    .filter((t) => t.type !== "empty" && !(t.type === "netlow" && tripNetlow))
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9));

// South/North points earned in this round's team matches, for the collapsed header
function roundScore(r) {
  let L = 0, R = 0, any = false;
  for (const t of r.tournaments) {
    if (t.type === "match" && t.matches?.length) {
      const pts = teamPts(t.matches);
      L += pts.L;
      R += pts.R;
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

function RoundCard({ r, open, onToggle, tripNetlow }) {
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
          {roundTournaments(r, tripNetlow).map((t) => <Tournament key={t.id} t={t} pars={r.pars} />)}
        </div>
      )}
    </div>
  );
}

function Rounds({ rounds, netlow }) {
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
        <RoundCard key={r.id} r={r} open={open.has(r.id)} onToggle={() => toggle(r.id)} tripNetlow={!!netlow} />
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
        rows={netlow.rows.map((r) => [r.pos, r.player, r.toPar, (r.rounds || []).join(" / ") || "—", r.total, fmtMoney(r.purse)])}
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
        const scored = mates.filter((row) => typeof row.gross[h] === "number");
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
          if (typeof row.gross[h] !== "number") continue;
          const oppScored = opp.filter((x) => typeof x.gross[h] === "number");
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

function pairInitials(a, b) {
  let ia = (lastName(a)[0] || "?").toUpperCase();
  let ib = (lastName(b)[0] || "?").toUpperCase();
  if (ia === ib) {
    ia = (a.trim()[0] || ia).toUpperCase();
    ib = (b.trim()[0] || ib).toUpperCase();
  }
  return [ia, ib];
}

function soloVsBestBall(me, opp) {
  const winners = [];
  let compared = 0;
  for (let h = 0; h < 18; h++) {
    const a = netOnHole(me, h);
    const bs = opp.map((o) => netOnHole(o, h));
    if (a == null || bs.some((x) => x == null)) {
      winners.push(null);
      continue;
    }
    compared += 1;
    const best = Math.min(...bs);
    winners.push(a < best ? me.side : a > best ? opp[0].side : "T");
  }
  if (compared < 6) return null;
  const st = statusFromWinners(winners, me.side);
  return st?.won ? { name: me.name, label: st.label } : null;
}

function analyzeHamEggSide(rows, winners, names, team) {
  const mates = names.map((n) => rows.find((r) => r.name === n || nameOnCard(r.name, n))).filter(Boolean);
  if (mates.length < 2) return null;
  const [a, b] = mates;
  const opp = rows.filter((r) => r.side !== a.side);
  const [ia, ib] = pairInitials(a.name, b.name);
  const holes = [];
  let winA = 0;
  let winB = 0;
  let winBoth = 0;
  let saves = 0;
  for (let h = 0; h < 18; h++) {
    const na = netOnHole(a, h);
    const nb = netOnHole(b, h);
    if (na == null || nb == null) {
      holes.push({ mark: null });
      continue;
    }
    const best = Math.min(na, nb);
    const who = na === best && nb === best ? "both" : na === best ? "a" : "b";
    if (winners[h] !== a.side) {
      holes.push({ mark: null });
      continue;
    }
    if (who === "a") winA += 1;
    else if (who === "b") winB += 1;
    else winBoth += 1;
    const oppNets = opp.map((o) => netOnHole(o, h));
    if (oppNets.every((x) => x != null)) {
      const ob = Math.min(...oppNets);
      if ((na > ob && nb <= ob) || (nb > ob && na <= ob)) saves += 1;
    }
    holes.push({ mark: who === "both" ? "2" : who === "a" ? ia : ib, who });
  }
  const egg = Math.min(winA, winB);
  const carry = egg === 0 && Math.max(winA, winB) >= 2;
  return {
    team,
    a: a.name,
    b: b.name,
    ia,
    ib,
    holes,
    winA,
    winB,
    winBoth,
    saves,
    egg,
    tag: egg >= 2 ? "ham" : carry ? "carry" : null,
    carryName: carry ? (winA >= winB ? a.name : b.name) : null,
    vs2: [soloVsBestBall(a, opp), soloVsBestBall(b, opp)].filter(Boolean),
  };
}

function hamEggData(rounds) {
  const groups = [];
  const sides = [];
  for (const r of rounds || []) {
    const matches = [];
    for (const t of r.tournaments || []) {
      if (t.type !== "match") continue;
      for (const m of t.matches || []) {
        const rows = m.card?.rows;
        if (!rows || m.card.scoring === "stableford" || rows.some((row) => row.name.includes(" + "))) continue;
        if ((m.playersL || []).length !== 2 || (m.playersR || []).length !== 2) continue;
        const left = analyzeHamEggSide(rows, m.card.winners, m.playersL, m.teamL);
        const right = analyzeHamEggSide(rows, m.card.winners, m.playersR, m.teamR);
        if (!left || !right) continue;
        matches.push({ result: m.result, winner: m.winner, left, right });
        sides.push(left, right);
      }
    }
    if (matches.length) groups.push({ label: shortRound(r.label), matches });
  }
  if (!groups.length) return null;
  const hams = sides.filter((s) => s.tag === "ham");
  const carries = sides.filter((s) => s.tag === "carry");
  const bestHam = [...hams].sort((x, y) => y.egg - x.egg || x.winBoth - y.winBoth)[0] || null;
  const bestCarry = [...carries].sort((x, y) => Math.max(y.winA, y.winB) - Math.max(x.winA, x.winB))[0] || null;
  const vs2 = sides.flatMap((s) => s.vs2);
  return { groups, bestHam, bestCarry, vs2 };
}

function inferStrokeIndex(rows) {
  return Array.from({ length: 18 }, (_, h) => {
    let n2 = 0;
    let n1 = 0;
    let mx = 0;
    for (const r of rows) {
      const d = r.dots[h] || 0;
      if (d >= 2) n2 += 1;
      if (d >= 1) n1 += 1;
      if (d > mx) mx = d;
    }
    return { h, n2, n1, mx };
  })
    .sort((a, b) => b.n2 - a.n2 || b.mx - a.mx || b.n1 - a.n1 || a.h - b.h)
    .map((x) => x.h);
}

function strokeDots(n, si) {
  const d = Array(18).fill(0);
  for (let i = 0; i < n; i++) d[si[i % 18]] += 1;
  return d;
}

function flip1v1(st) {
  if (!st.won && !st.lost) return { label: "AS", won: false, lost: false };
  if (st.won) {
    const label = st.label.endsWith(" up") ? st.label.replace(/ up$/, " down") : `${st.label} down`;
    return { label, won: false, lost: true };
  }
  const core = st.label.replace(/ down$/, "");
  return { label: /^\d+$/.test(core) ? `${core} up` : core, won: true, lost: false };
}

function match1v1(a, b, hiA, hiB, si) {
  const ha = Math.round(hiA);
  const hb = Math.round(hiB);
  const da = strokeDots(Math.max(0, ha - hb), si);
  const db = strokeDots(Math.max(0, hb - ha), si);
  const winners = [];
  let compared = 0;
  for (let h = 0; h < 18; h++) {
    const ga = a.gross[h];
    const gb = b.gross[h];
    if (typeof ga !== "number" || typeof gb !== "number") {
      winners.push(null);
      continue;
    }
    compared += 1;
    const na = ga - da[h];
    const nb = gb - db[h];
    winners.push(na < nb ? "L" : na > nb ? "R" : "T");
  }
  if (compared < 6) return null;
  return statusFromWinners(winners, "L");
}

function collectIndividualRows(round) {
  const byName = new Map();
  for (const t of round.tournaments || []) {
    if (t.type !== "match") continue;
    for (const m of t.matches || []) {
      const rows = m.card?.rows;
      if (!rows || m.card.scoring === "stableford" || rows.some((r) => r.name.includes(" + "))) continue;
      for (const r of rows) {
        if (r.gross.filter((g) => typeof g === "number").length < 12) continue;
        byName.set(r.name, r);
      }
    }
  }
  return [...byName.values()];
}

function field1v1Pct(r) {
  const n = r.w + r.l + r.t;
  return n ? (r.w + 0.5 * r.t) / n : 0;
}

function field1v1Rounds(rounds, players) {
  const hiBy = Object.fromEntries(players.map((p) => [p.name, hiOf(p)]));
  const teamOf = Object.fromEntries(players.map((p) => [p.name, p.team]));
  const out = [];
  for (const r of rounds || []) {
    const rows = collectIndividualRows(r);
    if (rows.length < 4) continue;
    const si = inferStrokeIndex(rows);
    const rowBy = Object.fromEntries(rows.map((x) => [x.name, x]));
    const names = rows.map((x) => x.name).filter((n) => hiBy[n] != null);
    const rec = Object.fromEntries(names.map((n) => [n, { w: 0, l: 0, t: 0, vs: [] }]));
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i];
        const b = names[j];
        const st = match1v1(rowBy[a], rowBy[b], hiBy[a], hiBy[b], si);
        if (!st) continue;
        rec[a].vs.push({ opp: b, ...st });
        rec[b].vs.push({ opp: a, ...flip1v1(st) });
        if (st.won) {
          rec[a].w += 1;
          rec[b].l += 1;
        } else if (st.lost) {
          rec[a].l += 1;
          rec[b].w += 1;
        } else {
          rec[a].t += 1;
          rec[b].t += 1;
        }
      }
    }
    const ranking = [...names].sort(
      (a, b) => field1v1Pct(rec[b]) - field1v1Pct(rec[a]) || rec[b].w - rec[a].w || a.localeCompare(b),
    );
    const order = Object.fromEntries(ranking.map((n, i) => [n, i]));
    for (const n of names) rec[n].vs.sort((x, y) => (order[x.opp] ?? 99) - (order[y.opp] ?? 99));
    out.push({
      label: shortRound(r.label),
      ranking,
      rec,
      teamOf,
    });
  }
  return out;
}

function matchNets(netA, netB) {
  const winners = [];
  let compared = 0;
  for (let h = 0; h < 18; h++) {
    const a = netA[h];
    const b = netB[h];
    if (a == null || b == null) {
      winners.push(null);
      continue;
    }
    compared += 1;
    winners.push(a < b ? "L" : a > b ? "R" : "T");
  }
  if (compared < 6) return null;
  return statusFromWinners(winners, "L");
}

function netRoundRobin(entries) {
  const ids = entries.map((e) => e.id);
  const by = Object.fromEntries(entries.map((e) => [e.id, e]));
  const rec = Object.fromEntries(ids.map((id) => [id, { w: 0, l: 0, t: 0, vs: [] }]));
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const st = matchNets(by[a].nets, by[b].nets);
      if (!st) continue;
      rec[a].vs.push({ opp: b, ...st });
      rec[b].vs.push({ opp: a, ...flip1v1(st) });
      if (st.won) {
        rec[a].w += 1;
        rec[b].l += 1;
      } else if (st.lost) {
        rec[a].l += 1;
        rec[b].w += 1;
      } else {
        rec[a].t += 1;
        rec[b].t += 1;
      }
    }
  }
  const ranking = [...ids].sort(
    (a, b) => field1v1Pct(rec[b]) - field1v1Pct(rec[a]) || rec[b].w - rec[a].w || a.localeCompare(b),
  );
  const order = Object.fromEntries(ranking.map((n, i) => [n, i]));
  for (const id of ids) rec[id].vs.sort((x, y) => (order[x.opp] ?? 99) - (order[y.opp] ?? 99));
  return {
    ranking,
    rec,
    teamOf: Object.fromEntries(entries.map((e) => [e.id, e.team])),
    labelOf: Object.fromEntries(entries.map((e) => [e.id, e.label])),
  };
}

function pairingLabel(tName, roundLabel) {
  const t = (tName || "").toLowerCase();
  const r = (roundLabel || "").toLowerCase();
  if (/scramble/.test(t)) return "Scramble";
  if (/wild turkey/.test(t) || /wild turkey/.test(r)) return "W. Turkey";
  if (/pinehurst/.test(t)) return "Pinehurst";
  if (/crystal/.test(t) || /crystal/.test(r)) return "Crystal 2v2";
  if (/2v2/.test(t) || /2v2/.test(r)) return shortRound(roundLabel);
  return shortRound(tName || roundLabel);
}

function pairingDisplay(names) {
  return (names || []).map(familyName).join(" / ");
}

function collectPairingSets(rounds, players) {
  const teamOf = Object.fromEntries(players.map((p) => [p.name, p.team]));
  const out = [];
  const used = new Set();
  for (const r of rounds || []) {
    for (const t of r.tournaments || []) {
      if (t.type !== "match") continue;
      const entries = [];
      for (const m of t.matches || []) {
        const rows = m.card?.rows;
        if (!rows || m.card.scoring === "stableford") continue;
        if ((m.playersL || []).length < 2 || (m.playersR || []).length < 2) continue;
        const combined = rows.some((row) => row.name.includes(" + "));
        for (const [names, side] of [
          [m.playersL, "L"],
          [m.playersR, "R"],
        ]) {
          let nets;
          if (combined) {
            const row = rows.find((x) => x.side === side);
            if (!row) continue;
            nets = row.gross.map((g, h) => (typeof g === "number" ? g - row.dots[h] : null));
          } else {
            const mates = names.map((n) => rows.find((x) => x.name === n || nameOnCard(x.name, n))).filter(Boolean);
            if (mates.length < 2) continue;
            nets = Array.from({ length: 18 }, (_, h) => {
              const ns = mates.map((x) => netOnHole(x, h)).filter((v) => v != null);
              return ns.length ? Math.min(...ns) : null;
            });
          }
          if (nets.filter((v) => v != null).length < 6) continue;
          entries.push({
            id: names.join(" + "),
            names,
            label: pairingDisplay(names),
            team: teamOf[names[0]],
            nets,
          });
        }
      }
      if (entries.length < 4) continue;
      let label = pairingLabel(t.name, r.label);
      if (used.has(label)) label = `${label} ${used.size}`;
      used.add(label);
      out.push({ label, ...netRoundRobin(entries) });
    }
  }
  return out;
}

function recStr(r) {
  if (!r || r.w + r.l + r.t === 0) return "—";
  return `${r.w}-${r.l}-${r.t}`;
}

function addRec(a, b) {
  return { w: a.w + b.w, l: a.l + b.l, t: a.t + b.t };
}

function emptyRec() {
  return { w: 0, l: 0, t: 0 };
}

function sosRoundLabel(label) {
  const l = (label || "").toLowerCase();
  if (/crystal/.test(l)) return "Crystal";
  if (/black bear/.test(l)) return "B. Bear";
  if (/^fri/.test(l)) return "Fri";
  if (/^sat/.test(l)) return "Sat";
  if (/1v1/.test(l)) return "1v1";
  return (label || "").split(" ")[0] || label;
}

function crossTeamRec(set) {
  const out = emptyRec();
  for (const a of set.ranking) {
    if (set.teamOf[a] !== "South") continue;
    for (const v of set.rec[a].vs) {
      if (set.teamOf[v.opp] !== "North") continue;
      if (v.won) out.w += 1;
      else if (v.lost) out.l += 1;
      else out.t += 1;
    }
  }
  return out;
}

function sosBoard(sets) {
  if (!sets.length) return null;
  const names = [...new Set(sets.flatMap((s) => s.ranking))];
  const teamOf = sets[0].teamOf;
  const rows = names.map((name) => {
    const byRound = sets.map((s) => {
      const r = s.rec[name];
      return r ? { w: r.w, l: r.l, t: r.t } : null;
    });
    const combined = byRound.reduce((acc, r) => (r ? addRec(acc, r) : acc), emptyRec());
    return { name, team: teamOf[name], byRound, combined, pct: field1v1Pct(combined) };
  });
  rows.sort((a, b) => b.pct - a.pct || b.combined.w - a.combined.w || a.name.localeCompare(b.name));
  const teamRounds = sets.map((s) => ({ label: s.label, rec: crossTeamRec(s) }));
  const teamCombined = teamRounds.reduce((acc, r) => addRec(acc, r.rec), emptyRec());
  return { sets, rows, teamRounds, teamCombined };
}

function initialsOf(name) {
  const parts = name.trim().split(/\s+/);
  return `${(parts[0]?.[0] || "").toUpperCase()}${(lastName(name)[0] || "").toUpperCase()}`;
}

function familyName(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 3 && /^(van|von|de|del|di|da|la|le|st\.?)$/i.test(parts[parts.length - 2])) {
    return parts.slice(-2).join(" ");
  }
  return parts[parts.length - 1];
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

function lowsFromOfficial(label, players, needles) {
  const tests = (Array.isArray(needles) ? needles : [needles]).map((n) => String(n).toLowerCase());
  const rows = [];
  for (const p of players) {
    for (const s of p.scores || []) {
      const rnd = (s.round || "").toLowerCase();
      if (s.holes === 18 && tests.some((n) => rnd.includes(n))) rows.push({ name: p.name, gross: s.gross, net: s.net });
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
        const holes = row.gross.map((g, i) => (typeof g === "number" ? { g, n: g - row.dots[i] } : null)).filter(Boolean);
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

function officialNeedles(label) {
  const l = label.toLowerCase();
  if (/crystal/.test(l)) return ["crystal"];
  if (/1v1/.test(l)) return ["1v1"];
  if (/stroke|round 7/.test(l)) return ["stroke", "round 7"];
  if (/stableford/.test(l)) return ["stableford"];
  return null;
}

function roundLows(rounds, players) {
  const out = [];
  for (const r of rounds || []) {
    const matches = r.tournaments.filter((t) => t.type === "match");
    const front = matches.filter((t) => /front/i.test(t.name));
    const back = matches.filter((t) => /back/i.test(t.name));
    if (front.length && back.length) {
      const fl = /scramble/i.test(front[0].name) ? "Black Bear — Scramble" : front[0].name;
      const bl = /pinehurst/i.test(back[0].name) ? "Black Bear — Pinehurst" : back[0].name;
      out.push(lowsFromMatches(fl, front, false));
      out.push(lowsFromMatches(bl, back, false));
      continue;
    }
    const needles = officialNeedles(r.label);
    if (needles) {
      const official = lowsFromOfficial(r.label, players, needles);
      if (official) {
        out.push(official);
        continue;
      }
    }
    out.push(lowsFromMatches(r.label, matches, !/scramble|pinehurst|stableford/i.test(r.label)));
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
      if (bb.v > 0) {
        const sample = twoRounds[0].scores.filter((x) => x.holes === 18);
        const a = shortRound(sample[0]?.round || "");
        const b = shortRound(sample[sample.length - 1]?.round || "");
        fun.push({
          label: "Bounce back",
          value: `-${bb.v}`,
          who: distWho(bb),
          hint: a && b ? `net, ${a} → ${b}` : "net, first 18 to last 18",
        });
      }
    }
    return { lows: roundLows(rounds, players), fun };
  }, [players, rounds]);

  return (
    <>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
        <div className="text-sm font-semibold text-gray-100">Round lows</div>
        <div className="text-[11px] text-gray-500 mb-2">Net on rounds with individual scores — not scramble or Pinehurst</div>
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

function HamEggTape({ side, wonMatch }) {
  const team = TEAM[side.team];
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-baseline justify-between gap-2 mb-0.5">
        <div className={`text-[11px] min-w-0 truncate ${wonMatch ? "text-gray-100 font-semibold" : "text-gray-400"}`}>
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${team?.text || "text-gray-500"}`}>
            {side.team}
          </span>{" "}
          {firstLast(side.a)} / {firstLast(side.b)}
        </div>
        <div className="flex flex-wrap justify-end gap-x-1.5 shrink-0 text-[10px]">
          {side.tag === "ham" && <span className="text-emerald-400">Ham & egg</span>}
          {side.tag === "carry" && <span className="text-amber-300">Carry {lastName(side.carryName)}</span>}
          {side.vs2.filter((v) => v.name !== side.carryName).map((v) => (
            <span key={v.name} className="text-emerald-400">
              {lastName(v.name)} 1v2 {v.label}
            </span>
          ))}
        </div>
      </div>
      <div className="grid gap-px" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
        {side.holes.map((h, i) => {
          const wonA = h.who === "a";
          const wonB = h.who === "b";
          const both = h.who === "both";
          return (
            <div
              key={i}
              title={`Hole ${i + 1}${h.mark ? ` · ${h.mark}` : ""}`}
              className={`flex items-center justify-center h-5 rounded-sm text-[9px] font-bold leading-none border ${
                both
                  ? "bg-amber-500/30 text-amber-300 border-amber-500/40"
                  : wonA
                    ? `${team?.cell || "bg-slate-700"} ${team?.text || "text-gray-300"} border-transparent`
                    : wonB
                      ? `${team?.bar || "bg-slate-600"} text-white border-transparent`
                      : "bg-slate-800 border-slate-700"
              }`}
            >
              {h.mark || ""}
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-gray-600 mt-0.5">
        {side.winA} {lastName(side.a)} · {side.winB} {lastName(side.b)}
        {side.winBoth ? ` · ${side.winBoth} together` : ""}
        {side.saves ? ` · ${side.saves} save${side.saves === 1 ? "" : "s"}` : ""}
      </div>
    </div>
  );
}

function HamEgg({ rounds }) {
  const data = useMemo(() => hamEggData(rounds), [rounds]);
  if (!data) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100">Ham & egg</div>
      <div className="text-[11px] text-gray-500 mb-3">
        2v2 matchplay · letter is whose net won the hole. Empty = lost or halved.
      </div>
      {(data.bestHam || data.bestCarry || data.vs2.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
          {data.bestHam && (
            <div className="rounded-xl border border-slate-700 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Best pair</div>
              <div className="text-xs text-gray-100 font-semibold">
                {firstLast(data.bestHam.a)} / {firstLast(data.bestHam.b)}
              </div>
              <div className="text-[10px] text-gray-500">
                {data.bestHam.winA}–{data.bestHam.winB} split
                {data.bestHam.winBoth === 0 ? ", never together" : ""}
              </div>
            </div>
          )}
          {data.bestCarry && (
            <div className="rounded-xl border border-slate-700 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Biggest carry</div>
              <div className="text-xs text-gray-100 font-semibold">{firstLast(data.bestCarry.carryName)}</div>
              <div className="text-[10px] text-gray-500">
                {Math.max(data.bestCarry.winA, data.bestCarry.winB)} holes · partner 0
              </div>
            </div>
          )}
          {data.vs2[0] && (
            <div className="rounded-xl border border-slate-700 px-2.5 py-2">
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Beat 1v2</div>
              <div className="text-xs text-gray-100 font-semibold">{firstLast(data.vs2[0].name)}</div>
              <div className="text-[10px] text-gray-500">vs both balls, {data.vs2[0].label}</div>
            </div>
          )}
        </div>
      )}
      <div className="space-y-4">
        {data.groups.map((g) => (
          <div key={g.label}>
            {data.groups.length > 1 && (
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1.5">{g.label}</div>
            )}
            <div className="divide-y divide-slate-800">
              {g.matches.map((m, i) => (
                <div key={i} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="text-[10px] text-gray-600 mb-1.5">{m.result || "Tied"}</div>
                  <HamEggTape side={m.left} wonMatch={m.winner === "left"} />
                  <HamEggTape side={m.right} wonMatch={m.winner === "right"} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecBar({ rec, className = "" }) {
  const n = rec.w + rec.l + rec.t;
  if (!n) return <div className={`h-2 rounded-full bg-slate-800 ${className}`} />;
  return (
    <div className={`flex h-2 rounded-full overflow-hidden bg-slate-800 ${className}`}>
      {rec.w > 0 && <div className="bg-emerald-500" style={{ width: `${(rec.w / n) * 100}%` }} />}
      {rec.t > 0 && <div className="bg-slate-500" style={{ width: `${(rec.t / n) * 100}%` }} />}
      {rec.l > 0 && <div className="bg-rose-500" style={{ width: `${(rec.l / n) * 100}%` }} />}
    </div>
  );
}

function StrengthOfSchedule({ rounds, players }) {
  const data = useMemo(() => sosBoard(field1v1Rounds(rounds, players)), [rounds, players]);
  const pairSets = useMemo(() => collectPairingSets(rounds, players), [rounds, players]);
  const [mode, setMode] = useState("players");
  const [pairRi, setPairRi] = useState(0);
  const [picked, setPicked] = useState(null);
  if (!data && !pairSets.length) return null;
  const pair = pairSets[Math.min(pairRi, Math.max(0, pairSets.length - 1))];
  const pairSel = pair && picked && pair.rec[picked] ? picked : pair?.ranking[0];
  const pairMine = pair && pairSel ? pair.rec[pairSel] : null;
  const pairCross = pair ? crossTeamRec(pair) : emptyRec();
  const northCombined = data ? { w: data.teamCombined.l, l: data.teamCombined.w, t: data.teamCombined.t } : emptyRec();

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100">Strength of schedule</div>
      <div className="text-[11px] text-gray-500 mb-2.5">
        {mode === "pairings"
          ? "Each pairing vs every other pairing · net as they played that round"
          : "Everyone vs everyone · 1v1 from each round, then added up"}
      </div>
      <div className="flex flex-wrap gap-1 mb-3">
        <button
          type="button"
          onClick={() => setMode("players")}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
            mode === "players" ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
          }`}
        >
          Players
        </button>
        {pairSets.length > 0 && (
          <button
            type="button"
            onClick={() => setMode("pairings")}
            className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
              mode === "pairings" ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
            }`}
          >
            Pairings
          </button>
        )}
      </div>

      {mode === "pairings" && pair && (
        <>
          <div className="flex flex-wrap gap-1 mb-3">
            {pairSets.map((s, i) => (
              <button
                key={s.label}
                type="button"
                onClick={() => {
                  setPairRi(i);
                  setPicked(null);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                  i === pairRi ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="rounded-xl border border-slate-700 p-2.5 mb-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-rose-400 font-semibold tabular-nums">South {recStr(pairCross)}</span>
              <RecBar rec={pairCross} className="flex-1 max-w-[7rem]" />
              <span className="text-sky-400 font-semibold tabular-nums">
                North {recStr({ w: pairCross.l, l: pairCross.w, t: pairCross.t })}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto -mx-1 px-1 mb-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
                  <th className="py-1 pr-2 font-semibold">#</th>
                  <th className="py-1 pr-2 font-semibold">Pairing</th>
                  <th className="py-1 pr-2 font-semibold text-right">Rec</th>
                  <th className="py-1 font-semibold w-[30%]">Win %</th>
                </tr>
              </thead>
              <tbody>
                {pair.ranking.map((id, i) => {
                  const r = pair.rec[id];
                  const pct = field1v1Pct(r);
                  return (
                    <tr
                      key={id}
                      className={`border-t border-slate-800 cursor-pointer ${pairSel === id ? "bg-slate-800/50" : ""}`}
                      onClick={() => setPicked(id)}
                    >
                      <td className="py-1.5 pr-2 text-gray-600 tabular-nums">{i + 1}</td>
                      <td className="py-1.5 pr-2">
                        <span className="inline-flex items-center gap-1.5 min-w-0">
                          <TeamDot team={pair.teamOf[id]} />
                          <span className={`truncate ${pairSel === id ? "text-gray-100 font-semibold" : "text-gray-200"}`}>
                            {pair.labelOf[id]}
                          </span>
                        </span>
                      </td>
                      <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-gray-100 whitespace-nowrap">
                        {recStr(r)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center gap-1.5">
                          <RecBar rec={r} className="flex-1" />
                          <span className={`tabular-nums w-8 text-right text-[11px] ${pct < 0.5 ? "text-rose-300" : "text-emerald-300"}`}>
                            {Math.round(pct * 100)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pairMine && (
            <>
              <div className="text-xs font-semibold text-gray-100 mb-1">
                {pair.labelOf[pairSel]}{" "}
                <span className="text-gray-400 font-medium tabular-nums">
                  {pairMine.w}-{pairMine.l}-{pairMine.t}
                </span>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-slate-800">
                {pairMine.vs.map((v) => (
                  <button
                    key={v.opp}
                    type="button"
                    onClick={() => setPicked(v.opp)}
                    className="w-full flex items-center justify-between gap-2 py-1 text-left"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      <TeamDot team={pair.teamOf[v.opp]} />
                      <span className="text-xs text-gray-300 truncate">{pair.labelOf[v.opp]}</span>
                    </span>
                    <span
                      className={`text-[11px] tabular-nums shrink-0 ${
                        v.won ? "text-emerald-400" : v.lost ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      {v.label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {mode === "players" && data && (
        <>
      <div className="rounded-xl border border-slate-700 p-2.5 mb-3">
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">South vs North</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-gray-500">
              <th className="py-0.5 pr-2 font-semibold text-left">Round</th>
              <th className="py-0.5 pr-2 font-semibold text-right text-rose-400">South</th>
              <th className="py-0.5 font-semibold text-right text-sky-400">North</th>
            </tr>
          </thead>
          <tbody>
            {data.teamRounds.map((r) => (
              <tr key={r.label} className="border-t border-slate-800">
                <td className="py-1 pr-2 text-gray-400">{sosRoundLabel(r.label)}</td>
                <td className="py-1 pr-2 text-right tabular-nums text-gray-200">{recStr(r.rec)}</td>
                <td className="py-1 text-right tabular-nums text-gray-200">
                  {recStr({ w: r.rec.l, l: r.rec.w, t: r.rec.t })}
                </td>
              </tr>
            ))}
            <tr className="border-t border-slate-700">
              <td className="py-1.5 pr-2 font-semibold text-gray-100">All</td>
              <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-rose-400">{recStr(data.teamCombined)}</td>
              <td className="py-1.5 text-right tabular-nums font-semibold text-sky-400">{recStr(northCombined)}</td>
            </tr>
          </tbody>
        </table>
        <RecBar rec={data.teamCombined} className="mt-2" />
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500">
              <th className="py-1 pr-2 font-semibold">#</th>
              <th className="py-1 pr-2 font-semibold">Player</th>
              {data.sets.map((s) => (
                <th key={s.label} className="py-1 pr-2 font-semibold text-right whitespace-nowrap">
                  {sosRoundLabel(s.label)}
                </th>
              ))}
              <th className="py-1 pr-2 font-semibold text-right">All</th>
              <th className="py-1 font-semibold w-[28%]">Win %</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr key={row.name} className="border-t border-slate-800">
                <td className="py-1.5 pr-2 text-gray-600 tabular-nums">{i + 1}</td>
                <td className="py-1.5 pr-2">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <TeamDot team={row.team} />
                    <span className="text-gray-200 truncate">{firstLast(row.name)}</span>
                  </span>
                </td>
                {row.byRound.map((r, j) => (
                  <td key={j} className="py-1.5 pr-2 text-right tabular-nums text-gray-400 whitespace-nowrap">
                    {recStr(r)}
                  </td>
                ))}
                <td className="py-1.5 pr-2 text-right tabular-nums font-semibold text-gray-100 whitespace-nowrap">
                  {recStr(row.combined)}
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-1.5">
                    <RecBar rec={row.combined} className="flex-1" />
                    <span className={`tabular-nums w-8 text-right text-[11px] ${row.pct < 0.5 ? "text-rose-300" : "text-emerald-300"}`}>
                      {Math.round(row.pct * 100)}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </div>
  );
}

function Field1v1({ rounds, players }) {
  const sets = useMemo(() => field1v1Rounds(rounds, players), [rounds, players]);
  const [ri, setRi] = useState(0);
  const [picked, setPicked] = useState(null);
  if (!sets.length) return null;
  const set = sets[Math.min(ri, sets.length - 1)];
  const sel = picked && set.rec[picked] ? picked : set.ranking[0];
  const mine = set.rec[sel];

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3.5 sm:p-4">
      <div className="text-sm font-semibold text-gray-100">Field 1v1</div>
      <div className="text-[11px] text-gray-500 mb-2.5">
        If everyone played everyone · gross that round, strokes from index
      </div>
      {sets.length > 1 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {sets.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setRi(i);
                setPicked(null);
              }}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                i === ri ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto -mx-1 px-1 mb-3">
        <table className="text-[9px] border-separate border-spacing-px min-w-max">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-slate-900" />
              {set.ranking.map((n) => (
                <th
                  key={n}
                  title={n}
                  className={`w-5 h-5 font-semibold ${sel === n ? TEAM[set.teamOf[n]]?.text || "text-gray-300" : "text-gray-500"}`}
                >
                  {initialsOf(n)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {set.ranking.map((a) => (
              <tr key={a}>
                <th
                  className={`sticky left-0 z-10 bg-slate-900 pr-1.5 text-left font-semibold whitespace-nowrap ${
                    sel === a ? TEAM[set.teamOf[a]]?.text || "text-gray-200" : "text-gray-500"
                  }`}
                >
                  <button type="button" className="text-left inline-flex items-baseline gap-1" onClick={() => setPicked(a)}>
                    {familyName(a)}
                    <span className="text-[8px] text-gray-600 font-normal tabular-nums">
                      {set.rec[a].w}-{set.rec[a].l}
                      {set.rec[a].t ? `-${set.rec[a].t}` : ""}
                    </span>
                  </button>
                </th>
                {set.ranking.map((b) => {
                  if (a === b) return <td key={b} className="w-5 h-5 rounded-sm bg-slate-800" />;
                  const st = set.rec[a].vs.find((v) => v.opp === b);
                  if (!st) return <td key={b} className="w-5 h-5" />;
                  return (
                    <td
                      key={b}
                      title={`${firstLast(a)} ${st.label} vs ${firstLast(b)}`}
                      onClick={() => setPicked(a)}
                      className={`w-5 h-5 rounded-sm cursor-pointer ${
                        st.won ? "bg-emerald-500/40" : st.lost ? "bg-rose-500/35" : "bg-slate-600"
                      } ${sel === a || sel === b ? "ring-1 ring-white/40" : ""}`}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 text-[10px] text-gray-600 mb-3">
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/40" /> win</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/35" /> loss</span>
        <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-600" /> AS</span>
      </div>
      <div className="text-xs font-semibold text-gray-100 mb-1">
        {firstLast(sel)}{" "}
        <span className="text-gray-400 font-medium tabular-nums">
          {mine.w}-{mine.l}-{mine.t}
        </span>
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-slate-800">
        {mine.vs.map((v) => (
          <button
            key={v.opp}
            type="button"
            onClick={() => setPicked(v.opp)}
            className="w-full flex items-center justify-between gap-2 py-1 text-left"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <TeamDot team={set.teamOf[v.opp]} />
              <span className="text-xs text-gray-300 truncate">{firstLast(v.opp)}</span>
            </span>
            <span
              className={`text-[11px] tabular-nums shrink-0 ${
                v.won ? "text-emerald-400" : v.lost ? "text-gray-500" : "text-gray-400"
              }`}
            >
              {v.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stats({ data, tripId }) {
  return (
    <div className="space-y-4">
      <HamEgg rounds={data.rounds} />
      <StrengthOfSchedule rounds={data.rounds} players={data.players} />
      <Field1v1 rounds={data.rounds} players={data.players} />
      <Superlatives players={data.players} rounds={data.rounds} />
      <NetLow netlow={data.netlow} />
      <ScoringDist players={data.players} />
      <HandicapLab players={data.players} rounds={data.rounds} />
      <div className="flex justify-center pt-1">
        {tripId === "2025" ? (
          <Link
            to="/golftrip"
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 border border-slate-700 text-gray-500 hover:text-gray-200"
          >
            Crystal Springs '26
          </Link>
        ) : (
          <Link
            to="/golftrip/2025"
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-900 border border-slate-700 text-gray-500 hover:text-gray-200"
          >
            2025 trip
          </Link>
        )}
      </div>
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
  const { tripId } = useParams();
  const src = TRIP_FILES[tripId] || TRIP_FILES.nj26;
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
    setData(null);
    setError(null);
    fetch(src)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setError(e.message));
  }, [src]);

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
        {tab === "rounds" && <Rounds rounds={data.rounds} netlow={data.netlow} />}
        {tab === "stats" && <Stats data={data} tripId={tripId === "2025" ? "2025" : "nj26"} />}

        <footer className="mt-6 text-[10px] text-gray-600">
          Data from Golf Genius · updated {data.trip.fetched}
        </footer>
      </div>
    </div>
  );
}
