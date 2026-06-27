// World Cup Pool API
// - Draft rosters + knockout scoring values come from the Google Sheet (the pool config).
// - All match RESULTS come live from ESPN's FIFA World Cup feed and points are computed here.

import { ANNEX_C, THIRD_WINNER_ORDER } from "./_annexC.js";

const SHEET_ID = "1tR5l3b8yPN9xQdfJkSIsgjN7z2gR6Myp9KqWmP4-_6w";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

const ESPN_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const GROUP_RANGE = "20260611-20260627";
const KO_RANGE = "20260628-20260719";

const MANAGER_OFFSETS = [0, 6, 12, 18];

// Non-overlapping knockout date windows (YYYYMMDD) -> scoring key.
const KO_WINDOWS = [
  { key: "r32", start: "20260628", end: "20260703" },
  { key: "r16", start: "20260704", end: "20260708" },
  { key: "qf", start: "20260709", end: "20260713" },
  { key: "sf", start: "20260714", end: "20260717" },
  { key: "third", start: "20260718", end: "20260718" },
  { key: "champ", start: "20260719", end: "20260719" },
];

const KO_LABELS = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinal",
  sf: "Semifinal",
  third: "Third Place",
  champ: "Final",
};

// Map the sheet's team spellings to ESPN's after normalization.
const ALIASES = {
  turkeye: "turkiye",
  bosnia: "bosniaherzegovina",
  caboverde: "capeverde",
  columbia: "colombia",
  drcongo: "congodr",
  saudiaarabia: "saudiarabia",
  usa: "unitedstates",
};

const norm = (s) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const canon = (s) => {
  const n = norm(s);
  return ALIASES[n] || n;
};

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

// ---- Sheet: rosters (manager -> teams) + knockout scoring values ----
function parseSheet(text) {
  const rows = parseCSV(text);
  const cell = (r, c) => (rows[r] && rows[r][c] != null ? rows[r][c].trim() : "");

  const managers = [];
  for (let r = 0; r < rows.length; r++) {
    for (const off of MANAGER_OFFSETS) {
      if (cell(r, off + 1) === "W" && cell(r, off + 2) === "D") {
        const name = cell(r, off);
        if (!name) continue;
        const teams = [];
        let tr = r + 1;
        while (tr < rows.length) {
          const teamName = cell(tr, off);
          if (!teamName || teamName === "Totals") break;
          teams.push(teamName);
          tr++;
        }
        managers.push({ name, teams });
      }
    }
  }

  const koScoring = {};
  const koLabelToKey = {
    "Round of 32 W": "r32",
    "Round of 16 W": "r16",
    "Quarter W": "qf",
    "Semi W": "sf",
    "Champ W": "champ",
    "Third Place W": "third",
  };
  for (let r = 0; r < rows.length; r++) {
    const label = cell(r, 0);
    if (koLabelToKey[label]) koScoring[koLabelToKey[label]] = Number(cell(r, 1)) || 0;
  }

  const stage = cell(1, 0) || "Group Stage";
  return { managers, koScoring, stage };
}

function eventDateKey(iso) {
  // iso like 2026-06-15T16:00Z -> 20260615
  return iso.slice(0, 10).replace(/-/g, "");
}

function koKeyForDate(yyyymmdd) {
  for (const w of KO_WINDOWS) {
    if (yyyymmdd >= w.start && yyyymmdd <= w.end) return w.key;
  }
  return null;
}

async function fetchEvents(range) {
  const res = await fetch(`${ESPN_BASE}?dates=${range}&limit=300`, {
    headers: { "User-Agent": "Mozilla/5.0 (footie-pool)" },
  });
  if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

// Build a per-team results map keyed by canonical team name.
function buildTeamResults(groupEvents, koEvents, koScoring) {
  const map = {}; // canon -> { group:[], ko:[], gsPoints, koPoints, w,d,l }
  const ensure = (c) =>
    (map[c] = map[c] || {
      group: [],
      ko: [],
      gsPoints: 0,
      koPoints: 0,
      w: 0,
      d: 0,
      l: 0,
    });

  // Group stage: 3 / 1 / 0 per completed match
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const completed = comp.status?.type?.state === "post";
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const a = cs[0];
    const b = cs[1];
    const aC = canon(a.team.displayName);
    const bC = canon(b.team.displayName);
    const aWin = a.winner === true;
    const bWin = b.winner === true;

    const live = comp.status?.type?.state === "in";
    const record = (self, other, won, lost) => {
      const t = ensure(canon(self.team.displayName));
      const result = !completed ? "P" : won ? "W" : lost ? "L" : "D";
      const entry = {
        opponent: other.team.abbreviation || other.team.displayName,
        opponentFull: other.team.displayName,
        home: self.homeAway === "home",
        result,
        gf: completed || live ? Number(self.score) || 0 : null,
        ga: completed || live ? Number(other.score) || 0 : null,
        date: e.date,
        live,
        status: comp.status?.type?.shortDetail || "",
      };
      t.group.push(entry);
      if (completed) {
        if (won) {
          t.w++;
          t.gsPoints += 3;
        } else if (lost) {
          t.l++;
        } else {
          t.d++;
          t.gsPoints += 1;
        }
      }
    };

    record(a, b, aWin, bWin);
    record(b, a, bWin, aWin);
  }

  // Knockout: winner of a match earns that round's bonus
  for (const e of koEvents) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    if (comp.status?.type?.state !== "post") continue;
    const key = koKeyForDate(eventDateKey(e.date));
    if (!key) continue;
    const pts = koScoring[key] || 0;
    const cs = comp.competitors || [];
    for (const self of cs) {
      if (self.winner === true) {
        const t = ensure(canon(self.team.displayName));
        const other = cs.find((x) => x !== self);
        t.ko.push({
          round: key,
          label: KO_LABELS[key] || key,
          points: pts,
          opponent: other?.team?.abbreviation || other?.team?.displayName || "",
          date: e.date,
        });
        t.koPoints += pts;
      }
    }
  }

  return map;
}

// Normalize an American moneyline to a signed string (e.g. 340 -> "+340").
function fmtMl(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  if (s.startsWith("+") || s.startsWith("-")) return s;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  return n > 0 ? `+${n}` : `${n}`;
}

// Pull moneyline (home / draw / away) from the scoreboard odds block, if present.
function extractOdds(comp) {
  const o = (comp.odds || []).find(Boolean);
  if (!o) return null;
  const ml = o.moneyline;
  const pick = (side) =>
    fmtMl(side?.close?.odds ?? side?.open?.odds ?? side?.moneyLine);
  const home = ml ? pick(ml.home) : null;
  const away = ml ? pick(ml.away) : null;
  const draw = (ml && pick(ml.draw)) || fmtMl(o.drawOdds?.moneyLine);
  if (!home && !away && !draw) return null;
  return { home, draw, away, provider: o.provider?.name || null };
}

// Locked/closing odds for a finished game (scoreboard drops these post-match).
async function fetchLockedOdds(eventId) {
  try {
    const url = `https://sports.core.api.espn.com/v2/sports/soccer/leagues/fifa.world/events/${eventId}/competitions/${eventId}/odds`;
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (footie-pool)" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    const items = j.items || [];
    const it = items.find((x) => x.provider?.id === "100") || items[0];
    if (!it) return null;
    const home = fmtMl(it.homeTeamOdds?.moneyLine);
    const away = fmtMl(it.awayTeamOdds?.moneyLine);
    const draw = fmtMl(it.drawOdds?.moneyLine);
    if (!home && !away && !draw) return null;
    return { home, draw, away, provider: it.provider?.name || null, locked: true };
  } catch {
    return null;
  }
}

// Run async fn over items with bounded concurrency.
async function mapLimit(items, limit, fn) {
  let i = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await fn(items[idx], idx);
      }
    }
  );
  await Promise.all(workers);
}

// Flat, date-sorted group-stage schedule; the UI groups it by day.
async function buildSchedule(groupEvents) {
  const matches = [];
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const note = comp.altGameNote || "";
    const gm = note.match(/Group\s+([A-Z])/i);
    const letter = gm ? gm[1].toUpperCase() : "";
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const home = cs.find((c) => c.homeAway === "home") || cs[0];
    const away = cs.find((c) => c.homeAway === "away") || cs[1];
    const state = comp.status?.type?.state || "pre";
    // Scoreboard carries odds for upcoming + live; mark non-upcoming as locked.
    let odds = extractOdds(comp);
    if (odds && state !== "pre") odds.locked = true;
    matches.push({
      id: e.id,
      date: e.date,
      state,
      detail: comp.status?.type?.shortDetail || "",
      group: letter,
      home: home.team.displayName,
      homeAbbr: home.team.abbreviation || "",
      away: away.team.displayName,
      awayAbbr: away.team.abbreviation || "",
      homeScore: state !== "pre" ? Number(home.score) || 0 : null,
      awayScore: state !== "pre" ? Number(away.score) || 0 : null,
      odds,
    });
  }

  // Finished games: fetch locked closing odds from the core odds endpoint.
  const needOdds = matches.filter((m) => m.state === "post" && !m.odds && m.id);
  await mapLimit(needOdds, 8, async (m) => {
    m.odds = await fetchLockedOdds(m.id);
  });

  return matches.sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Re-order teams tied on points/GD/goals using the head-to-head mini-table
// (FIFA group tiebreaker 4–6: points, then GD, then goals among the tied teams).
function breakH2H(block, matches) {
  const set = new Set(block.map((t) => t.canon));
  const st = {};
  block.forEach((t) => (st[t.canon] = { pts: 0, gd: 0, gf: 0 }));
  for (const m of matches) {
    if (!set.has(m.a) || !set.has(m.b)) continue;
    st[m.a].gf += m.sa;
    st[m.a].gd += m.sa - m.sb;
    st[m.b].gf += m.sb;
    st[m.b].gd += m.sb - m.sa;
    if (m.sa > m.sb) st[m.a].pts += 3;
    else if (m.sb > m.sa) st[m.b].pts += 3;
    else {
      st[m.a].pts++;
      st[m.b].pts++;
    }
  }
  return [...block].sort(
    (x, y) =>
      st[y.canon].pts - st[x.canon].pts ||
      st[y.canon].gd - st[x.canon].gd ||
      st[y.canon].gf - st[x.canon].gf ||
      x.team.localeCompare(y.team)
  );
}

// FIFA ranking: points, GD, goals scored, then head-to-head among tied teams,
// then alphabetical (a stand-in for fair-play / drawing of lots, which we can't compute).
function rankTeams(teams, matches) {
  const base = [...teams].sort(
    (x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf
  );
  const out = [];
  let i = 0;
  while (i < base.length) {
    let j = i + 1;
    while (
      j < base.length &&
      base[j].pts === base[i].pts &&
      base[j].gd === base[i].gd &&
      base[j].gf === base[i].gf
    )
      j++;
    const block = base.slice(i, j);
    if (block.length > 1) out.push(...breakH2H(block, matches));
    else out.push(block[0]);
    i = j;
  }
  return out;
}

// ESPN-style group tables computed from completed group matches.
function buildGroups(groupEvents) {
  const groups = {};
  const matchesByGroup = {};
  const ensure = (letter, c) => {
    const g = (groups[letter] = groups[letter] || {});
    const key = canon(c.team.displayName);
    return (g[key] = g[key] || {
      team: c.team.displayName,
      abbr: c.team.abbreviation || "",
      canon: key,
      played: 0,
      w: 0,
      d: 0,
      l: 0,
      gf: 0,
      ga: 0,
      pts: 0,
    });
  };

  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const note = comp.altGameNote || "";
    const m = note.match(/Group\s+([A-Z])/i);
    const letter = m ? m[1].toUpperCase() : "?";
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const a = cs[0];
    const b = cs[1];
    const ta = ensure(letter, a);
    const tb = ensure(letter, b);
    if (comp.status?.type?.state === "post") {
      const as = Number(a.score) || 0;
      const bs = Number(b.score) || 0;
      ta.played++;
      tb.played++;
      ta.gf += as;
      ta.ga += bs;
      tb.gf += bs;
      tb.ga += as;
      if (a.winner === true) {
        ta.w++;
        ta.pts += 3;
        tb.l++;
      } else if (b.winner === true) {
        tb.w++;
        tb.pts += 3;
        ta.l++;
      } else {
        ta.d++;
        tb.d++;
        ta.pts++;
        tb.pts++;
      }
      (matchesByGroup[letter] = matchesByGroup[letter] || []).push({
        a: ta.canon,
        b: tb.canon,
        sa: as,
        sb: bs,
      });
    }
  }

  return Object.keys(groups)
    .sort()
    .map((letter) => {
      const teams = rankTeams(
        Object.values(groups[letter]).map((t) => ({ ...t, gd: t.gf - t.ga })),
        matchesByGroup[letter] || []
      ).map((t, idx) => ({ ...t, pos: idx + 1 }));
      const complete = teams.every((t) => t.played >= 3);
      return { group: letter, teams, complete };
    });
}

// ---- Knockout bracket ----
// Official FIFA 2026 schedule (matches 73–104). Times shown in U.S. Eastern.
// Slot feeds: w = group winner, r = group runner-up, t = best-third pool,
//             mw = winner of match #, ml = loser of match # (3rd-place game).
const KO_TEMPLATE = [
  // Round of 32
  { no: 73, round: "r32", date: "2026-06-28", time: "3:00 PM ET", venue: "SoFi Stadium", city: "Los Angeles", a: { r: "A" }, b: { r: "B" } },
  { no: 76, round: "r32", date: "2026-06-29", time: "1:00 PM ET", venue: "NRG Stadium", city: "Houston", a: { w: "C" }, b: { r: "F" } },
  { no: 74, round: "r32", date: "2026-06-29", time: "4:30 PM ET", venue: "Gillette Stadium", city: "Boston", a: { w: "E" }, b: { t: ["A", "B", "C", "D", "F"] } },
  { no: 75, round: "r32", date: "2026-06-29", time: "9:00 PM ET", venue: "Estadio BBVA", city: "Monterrey", a: { w: "F" }, b: { r: "C" } },
  { no: 78, round: "r32", date: "2026-06-30", time: "1:00 PM ET", venue: "AT&T Stadium", city: "Dallas", a: { r: "E" }, b: { r: "I" } },
  { no: 77, round: "r32", date: "2026-06-30", time: "5:00 PM ET", venue: "MetLife Stadium", city: "New York/New Jersey", a: { w: "I" }, b: { t: ["C", "D", "F", "G", "H"] } },
  { no: 79, round: "r32", date: "2026-06-30", time: "9:00 PM ET", venue: "Estadio Azteca", city: "Mexico City", a: { w: "A" }, b: { t: ["C", "E", "F", "H", "I"] } },
  { no: 80, round: "r32", date: "2026-07-01", time: "12:00 PM ET", venue: "Mercedes-Benz Stadium", city: "Atlanta", a: { w: "L" }, b: { t: ["E", "H", "I", "J", "K"] } },
  { no: 82, round: "r32", date: "2026-07-01", time: "4:00 PM ET", venue: "Lumen Field", city: "Seattle", a: { w: "G" }, b: { t: ["A", "E", "H", "I", "J"] } },
  { no: 81, round: "r32", date: "2026-07-01", time: "8:00 PM ET", venue: "Levi's Stadium", city: "San Francisco Bay Area", a: { w: "D" }, b: { t: ["B", "E", "F", "I", "J"] } },
  { no: 84, round: "r32", date: "2026-07-02", time: "3:00 PM ET", venue: "SoFi Stadium", city: "Los Angeles", a: { w: "H" }, b: { r: "J" } },
  { no: 83, round: "r32", date: "2026-07-02", time: "7:00 PM ET", venue: "BMO Field", city: "Toronto", a: { r: "K" }, b: { r: "L" } },
  { no: 85, round: "r32", date: "2026-07-02", time: "11:00 PM ET", venue: "BC Place", city: "Vancouver", a: { w: "B" }, b: { t: ["E", "F", "G", "I", "J"] } },
  { no: 88, round: "r32", date: "2026-07-03", time: "2:00 PM ET", venue: "AT&T Stadium", city: "Dallas", a: { r: "D" }, b: { r: "G" } },
  { no: 86, round: "r32", date: "2026-07-03", time: "6:00 PM ET", venue: "Hard Rock Stadium", city: "Miami", a: { w: "J" }, b: { r: "H" } },
  { no: 87, round: "r32", date: "2026-07-03", time: "9:30 PM ET", venue: "Arrowhead Stadium", city: "Kansas City", a: { w: "K" }, b: { t: ["D", "E", "I", "J", "L"] } },
  // Round of 16
  { no: 90, round: "r16", date: "2026-07-04", time: "1:00 PM ET", venue: "NRG Stadium", city: "Houston", a: { mw: 73 }, b: { mw: 75 } },
  { no: 89, round: "r16", date: "2026-07-04", time: "5:00 PM ET", venue: "Lincoln Financial Field", city: "Philadelphia", a: { mw: 74 }, b: { mw: 77 } },
  { no: 91, round: "r16", date: "2026-07-05", time: "4:00 PM ET", venue: "MetLife Stadium", city: "New York/New Jersey", a: { mw: 76 }, b: { mw: 78 } },
  { no: 92, round: "r16", date: "2026-07-05", time: "8:00 PM ET", venue: "Estadio Azteca", city: "Mexico City", a: { mw: 79 }, b: { mw: 80 } },
  { no: 93, round: "r16", date: "2026-07-06", time: "3:00 PM ET", venue: "AT&T Stadium", city: "Dallas", a: { mw: 83 }, b: { mw: 84 } },
  { no: 94, round: "r16", date: "2026-07-06", time: "8:00 PM ET", venue: "Lumen Field", city: "Seattle", a: { mw: 81 }, b: { mw: 82 } },
  { no: 95, round: "r16", date: "2026-07-07", time: "12:00 PM ET", venue: "Mercedes-Benz Stadium", city: "Atlanta", a: { mw: 86 }, b: { mw: 88 } },
  { no: 96, round: "r16", date: "2026-07-07", time: "4:00 PM ET", venue: "BC Place", city: "Vancouver", a: { mw: 85 }, b: { mw: 87 } },
  // Quarterfinals
  { no: 97, round: "qf", date: "2026-07-09", time: "4:00 PM ET", venue: "Gillette Stadium", city: "Boston", a: { mw: 89 }, b: { mw: 90 } },
  { no: 98, round: "qf", date: "2026-07-10", time: "3:00 PM ET", venue: "SoFi Stadium", city: "Los Angeles", a: { mw: 93 }, b: { mw: 94 } },
  { no: 99, round: "qf", date: "2026-07-11", time: "5:00 PM ET", venue: "Hard Rock Stadium", city: "Miami", a: { mw: 91 }, b: { mw: 92 } },
  { no: 100, round: "qf", date: "2026-07-11", time: "9:00 PM ET", venue: "Arrowhead Stadium", city: "Kansas City", a: { mw: 95 }, b: { mw: 96 } },
  // Semifinals
  { no: 101, round: "sf", date: "2026-07-14", time: "3:00 PM ET", venue: "AT&T Stadium", city: "Dallas", a: { mw: 97 }, b: { mw: 98 } },
  { no: 102, round: "sf", date: "2026-07-15", time: "3:00 PM ET", venue: "Mercedes-Benz Stadium", city: "Atlanta", a: { mw: 99 }, b: { mw: 100 } },
  // Third place + Final
  { no: 103, round: "third", date: "2026-07-18", time: "5:00 PM ET", venue: "Hard Rock Stadium", city: "Miami", a: { ml: 101 }, b: { ml: 102 } },
  { no: 104, round: "final", date: "2026-07-19", time: "3:00 PM ET", venue: "MetLife Stadium", city: "New York/New Jersey", a: { mw: 101 }, b: { mw: 102 } },
];

const ROUND_LABELS = {
  r32: "Round of 32",
  r16: "Round of 16",
  qf: "Quarterfinal",
  sf: "Semifinal",
  third: "Third-Place Match",
  final: "Final",
};

function slotLabel(slot) {
  if (slot.w) return `Winner ${slot.w}`;
  if (slot.r) return `Runner-up ${slot.r}`;
  if (slot.t) return `3rd ${slot.t.join("/")}`;
  if (slot.mw) return `Winner M${slot.mw}`;
  if (slot.ml) return `Loser M${slot.ml}`;
  return "";
}

// Rank the 12 third-placed teams (FIFA: points, GD, goals, then alphabetical),
// take the best 8 and use the Annex C table to assign each to a group winner.
function computeThirdPlace(groups) {
  const thirds = groups
    .filter((g) => g.teams[2])
    .map((g) => ({ ...g.teams[2], group: g.group }));
  thirds.sort(
    (a, b) =>
      b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  );
  thirds.forEach((t, i) => (t.rank = i + 1));
  const qualifiers = thirds.slice(0, 8);
  const combo = qualifiers
    .map((t) => t.group)
    .sort()
    .join("");
  // winner group -> third-place group letter assigned to face them
  const assignment = ANNEX_C[combo];
  const winnerToThird = {};
  if (assignment && assignment.length === THIRD_WINNER_ORDER.length) {
    THIRD_WINNER_ORDER.forEach((w, i) => {
      winnerToThird[w] = assignment[i];
    });
  }
  return {
    ranking: thirds,
    qualifierGroups: qualifiers.map((t) => t.group),
    combo,
    winnerToThird,
    locked: thirds.length >= 12 && groups.every((g) => g.complete),
  };
}

function buildBracket(groups, koEvents, thirdInfo) {
  const groupBy = {};
  groups.forEach((g) => (groupBy[g.group] = g));
  const teamAt = (letter, pos) => {
    const g = groupBy[letter];
    const t = g && g.teams[pos];
    return t ? { team: t.team, canon: t.canon, abbr: t.abbr } : null;
  };

  // Index played knockout games by the (sorted) pair of team canon names.
  const koByPair = {};
  for (const e of koEvents) {
    const comp = e.competitions?.[0];
    const cs = comp?.competitors || [];
    if (cs.length < 2) continue;
    const k = [canon(cs[0].team.displayName), canon(cs[1].team.displayName)]
      .sort()
      .join("|");
    koByPair[k] = { comp, cs };
  }

  const resolved = {};
  const resolveSlot = (slot, winnerGroupForThird) => {
    if (slot.w) return teamAt(slot.w, 0);
    if (slot.r) return teamAt(slot.r, 1);
    if (slot.t) {
      const tg = thirdInfo.winnerToThird[winnerGroupForThird];
      return tg ? teamAt(tg, 2) : null;
    }
    if (slot.mw) return resolved[slot.mw]?.winner || null;
    if (slot.ml) return resolved[slot.ml]?.loser || null;
    return null;
  };

  const out = [];
  for (const m of KO_TEMPLATE) {
    const home = resolveSlot(m.a, m.a.w);
    const away = resolveSlot(m.b, m.a.w);

    let homeScore = null;
    let awayScore = null;
    let state = "pre";
    let detail = "";
    let winner = null;
    let loser = null;
    let homePens = null;
    let awayPens = null;

    if (home && away) {
      const hit = koByPair[[home.canon, away.canon].sort().join("|")];
      if (hit) {
        const { comp, cs } = hit;
        state = comp.status?.type?.state || "pre";
        detail = comp.status?.type?.shortDetail || "";
        const hc = cs.find((c) => canon(c.team.displayName) === home.canon);
        const ac = cs.find((c) => canon(c.team.displayName) === away.canon);
        if (state !== "pre") {
          homeScore = Number(hc?.score) || 0;
          awayScore = Number(ac?.score) || 0;
          if (hc?.shootoutScore != null) homePens = Number(hc.shootoutScore);
          if (ac?.shootoutScore != null) awayPens = Number(ac.shootoutScore);
        }
        if (state === "post") {
          const w = cs.find((c) => c.winner === true);
          if (w) {
            const wc = canon(w.team.displayName);
            winner = wc === home.canon ? home : away;
            loser = wc === home.canon ? away : home;
          }
        }
      }
    }

    resolved[m.no] = { winner, loser };
    out.push({
      no: m.no,
      round: m.round,
      roundLabel: ROUND_LABELS[m.round],
      date: m.date,
      time: m.time,
      venue: m.venue,
      city: m.city,
      home: home
        ? { ...home, label: slotLabel(m.a) }
        : { team: null, canon: null, abbr: null, label: slotLabel(m.a) },
      away: away
        ? { ...away, label: slotLabel(m.b) }
        : { team: null, canon: null, abbr: null, label: slotLabel(m.b) },
      homeScore,
      awayScore,
      homePens,
      awayPens,
      state,
      detail,
      winnerCanon: winner?.canon || null,
    });
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const [sheetText, groupEvents, koEvents] = await Promise.all([
      fetch(CSV_URL, { headers: { "User-Agent": "Mozilla/5.0 (footie-pool)" } }).then(
        (r) => {
          if (!r.ok) throw new Error(`Sheet fetch failed: ${r.status}`);
          return r.text();
        }
      ),
      fetchEvents(GROUP_RANGE),
      fetchEvents(KO_RANGE).catch(() => []),
    ]);

    const { managers: roster, koScoring, stage } = parseSheet(sheetText);

    // Snake draft pick number per team (manager order == draft seat order).
    const draftPicks = {};
    const seats = roster.length;
    roster.forEach((m, seat) => {
      m.teams.forEach((teamName, round) => {
        const posInRound = round % 2 === 0 ? seat : seats - 1 - seat;
        draftPicks[canon(teamName)] = round * seats + posInRound + 1;
      });
    });

    const teamResults = buildTeamResults(groupEvents, koEvents, koScoring);
    const schedule = await buildSchedule(groupEvents);
    const groups = buildGroups(groupEvents);

    // Who advances: top 2 per group + the best 8 third-placed teams.
    const thirdInfo = computeThirdPlace(groups);
    const qualifyingThirds = new Set(thirdInfo.qualifierGroups);
    groups.forEach((g) => {
      g.teams.forEach((t) => {
        if (t.pos === 1) t.advance = "W";
        else if (t.pos === 2) t.advance = "RU";
        else if (t.pos === 3 && qualifyingThirds.has(g.group)) t.advance = "3Q";
        else t.advance = null;
      });
    });
    const bracket = buildBracket(groups, koEvents, thirdInfo);

    const managers = roster.map((m) => {
      const teams = m.teams.map((teamName) => {
        const tr = teamResults[canon(teamName)] || {
          group: [],
          ko: [],
          gsPoints: 0,
          koPoints: 0,
          w: 0,
          d: 0,
          l: 0,
        };
        const played = tr.group.filter((g) => g.result !== "P").length;
        const upcoming = tr.group
          .filter((g) => g.result === "P")
          .sort((a, b) => new Date(a.date) - new Date(b.date));
        const next = upcoming[0]
          ? {
              opponent: upcoming[0].opponentFull,
              opponentAbbr: upcoming[0].opponent,
              home: upcoming[0].home,
              date: upcoming[0].date,
            }
          : null;
        return {
          team: teamName,
          group: tr.group,
          ko: tr.ko,
          gsPoints: tr.gsPoints,
          koPoints: tr.koPoints,
          points: tr.gsPoints + tr.koPoints,
          w: tr.w,
          d: tr.d,
          l: tr.l,
          played,
          remaining: Math.max(0, 3 - played),
          nextGame: next,
        };
      });
      const gsPoints = teams.reduce((s, t) => s + t.gsPoints, 0);
      const koPoints = teams.reduce((s, t) => s + t.koPoints, 0);
      return {
        name: m.name,
        teams,
        gsPoints,
        koPoints,
        wins: teams.reduce((s, t) => s + t.w, 0),
        draws: teams.reduce((s, t) => s + t.d, 0),
        losses: teams.reduce((s, t) => s + t.l, 0),
        pending: teams.reduce((s, t) => s + t.remaining, 0),
      };
    });

    const standings = managers
      .map((m) => ({
        name: m.name,
        gs: m.gsPoints,
        ko: m.koPoints,
        total: m.gsPoints + m.koPoints,
      }))
      .sort((a, b) => b.total - a.total || b.gs - a.gs);

    const anyLive = [...groupEvents, ...koEvents].some(
      (e) => e.competitions?.[0]?.status?.type?.state === "in"
    );
    const cacheTime = anyLive ? 30 : 120;
    res.setHeader(
      "Cache-Control",
      `s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );

    return res.status(200).json({
      title: "2026 World Cup Pool",
      stage,
      source: "espn",
      live: anyLive,
      managers,
      standings,
      schedule,
      groups,
      bracket,
      thirdPlace: {
        ranking: thirdInfo.ranking,
        qualifierGroups: thirdInfo.qualifierGroups,
        locked: thirdInfo.locked,
      },
      draftPicks,
      koScoring,
      fetched: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Footie API error:", err);
    res.setHeader("Cache-Control", "s-maxage=10");
    return res
      .status(500)
      .json({ error: "Failed to load pool data", managers: [], standings: [] });
  }
}
