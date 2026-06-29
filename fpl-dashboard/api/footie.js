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
      live: false,
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
    const state = comp.status?.type?.state;
    const ta = ensure(letter, a);
    const tb = ensure(letter, b);
    // Count finished matches and in-progress ones (the latter provisionally, so
    // the table reflects the live picture "as it stands"). Finished games still
    // count toward `played`, which is what decides whether a group is complete.
    if (state === "post" || state === "in") {
      const as = Number(a.score) || 0;
      const bs = Number(b.score) || 0;
      if (state === "post") {
        ta.played++;
        tb.played++;
      } else {
        ta.live = true;
        tb.live = true;
      }
      ta.gf += as;
      ta.ga += bs;
      tb.gf += bs;
      tb.ga += as;
      if (as > bs) {
        ta.w++;
        ta.pts += 3;
        tb.l++;
      } else if (bs > as) {
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
      const live = teams.some((t) => t.live);
      return { group: letter, teams, complete, live };
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
// The display ranking also folds in still-alive current 4th-place teams: while
// their group is unfinished they can still climb into the third-place picture,
// so they belong in the race.
const thirdSort = (a, b) =>
  b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team);

function computeThirdPlace(groups, teamStatus = {}) {
  const thirds = groups
    .filter((g) => g.teams[2])
    .map((g) => ({ ...g.teams[2], group: g.group }));
  thirds.sort(thirdSort);
  // Annex C / bracket projection uses the actual current 3rd of each group.
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

  // In groups still in progress, the top 2 isn't settled — any team that's on
  // the bubble (not yet clinched, not eliminated) could slip into the
  // third-place race, so include them too (e.g. a current 2nd that could drop
  // to 3rd). The current 3rd of every group is already in `thirds`.
  const challengers = [];
  groups
    .filter((g) => !g.complete)
    .forEach((g) => {
      g.teams.forEach((t, idx) => {
        if (idx === 2) return;
        if ((teamStatus[t.canon]?.status || "bubble") === "bubble")
          challengers.push({ ...t, group: g.group });
      });
    });

  const ranking = [...thirds, ...challengers].sort(thirdSort);
  ranking.forEach((t, i) => (t.rank = i + 1));

  return {
    ranking,
    qualifierGroups: qualifiers.map((t) => t.group),
    combo,
    winnerToThird,
    locked: thirds.length >= 12 && groups.every((g) => g.complete),
  };
}

// Confirmed (finished-match-only) points/goals per team. The display tables can
// fold in live in-progress scores, but the projection maths must run off
// settled results and treat in-progress games as still-to-be-played.
function confirmedStats(groups, groupEvents) {
  const base = {};
  groups.forEach((g) =>
    g.teams.forEach((t) => (base[t.canon] = { pts: 0, gf: 0, ga: 0 }))
  );
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp || comp.status?.type?.state !== "post") continue;
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const a = canon(cs[0].team.displayName);
    const b = canon(cs[1].team.displayName);
    if (!base[a] || !base[b]) continue;
    const sa = Number(cs[0].score) || 0;
    const sb = Number(cs[1].score) || 0;
    base[a].gf += sa;
    base[a].ga += sb;
    base[b].gf += sb;
    base[b].ga += sa;
    if (sa > sb) base[a].pts += 3;
    else if (sb > sa) base[b].pts += 3;
    else {
      base[a].pts += 1;
      base[b].pts += 1;
    }
  }
  return base;
}

// Determine every team's fate by brute-forcing all possible outcomes
// (win/draw/loss) of the remaining group matches:
//   "in"     – advances in EVERY remaining scenario (clinched)
//   "out"    – advances in NO scenario (officially eliminated)
//   "bubble" – still alive but not yet decided
// "Advances" means finishing top 2 of its group OR among the best 8 thirds.
// Also returns the best/worst finishing position still reachable per team, so the
// UI can show that e.g. a current group leader could still slip to 3rd.
// Returns { [canon]: { status, posBest, posWorst } }.
function computeTeamStatus(groups, groupEvents) {
  const confirmed = confirmedStats(groups, groupEvents);
  const base = {};
  const groupTeams = {};
  groups.forEach((g) => {
    groupTeams[g.group] = [];
    g.teams.forEach((t) => {
      const c = confirmed[t.canon] || { pts: 0, gf: 0, ga: 0 };
      base[t.canon] = { team: t.team, pts: c.pts, gf: c.gf, ga: c.ga };
      groupTeams[g.group].push(t.canon);
    });
  });

  const rem = [];
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp || comp.status?.type?.state === "post") continue;
    const m = (comp.altGameNote || "").match(/Group\s+([A-Z])/i);
    const cs = comp.competitors || [];
    if (cs.length < 2 || !m) continue;
    const a = canon(cs[0].team.displayName);
    const b = canon(cs[1].team.displayName);
    if (base[a] && base[b]) rem.push({ a, b });
  }

  const allCanon = Object.keys(base);
  const status = {};
  const R = rem.length;
  // Cap the search; this matters most near the end when R is small anyway.
  if (Math.pow(3, R) > 20000) {
    allCanon.forEach(
      (c) => (status[c] = { status: "bubble", posBest: null, posWorst: null })
    );
    return status;
  }

  const letters = Object.keys(groupTeams);
  const inCount = {};
  const posMin = {};
  const posMax = {};
  allCanon.forEach((c) => {
    inCount[c] = 0;
    posMin[c] = 99;
    posMax[c] = 0;
  });
  let total = 0;
  const idx = new Array(R).fill(0);
  const step = () => {
    for (let i = 0; i < R; i++) {
      if (idx[i] < 2) {
        idx[i]++;
        return true;
      }
      idx[i] = 0;
    }
    return false;
  };

  do {
    total++;
    const s = {};
    for (const c in base) s[c] = { pts: base[c].pts, gf: base[c].gf, ga: base[c].ga };
    for (let i = 0; i < R; i++) {
      const { a, b } = rem[i];
      const o = idx[i]; // 0 = a win, 1 = draw, 2 = b win (nominal 1-0 scoreline)
      if (o === 0) {
        s[a].pts += 3;
        s[a].gf += 1;
        s[b].ga += 1;
      } else if (o === 2) {
        s[b].pts += 3;
        s[b].gf += 1;
        s[a].ga += 1;
      } else {
        s[a].pts += 1;
        s[b].pts += 1;
      }
    }
    const advanced = new Set();
    const thirds = [];
    for (const L of letters) {
      const arr = groupTeams[L]
        .map((c) => ({
          c,
          pts: s[c].pts,
          gd: s[c].gf - s[c].ga,
          gf: s[c].gf,
        }))
        .sort(
          (x, y) =>
            y.pts - x.pts ||
            y.gd - x.gd ||
            y.gf - x.gf ||
            base[x.c].team.localeCompare(base[y.c].team)
        );
      advanced.add(arr[0].c);
      advanced.add(arr[1].c);
      if (arr[2]) thirds.push(arr[2]);
      arr.forEach((row, k) => {
        const p = k + 1;
        if (p < posMin[row.c]) posMin[row.c] = p;
        if (p > posMax[row.c]) posMax[row.c] = p;
      });
    }
    thirds.sort(
      (x, y) =>
        y.pts - x.pts ||
        y.gd - x.gd ||
        y.gf - x.gf ||
        base[x.c].team.localeCompare(base[y.c].team)
    );
    const top8 = new Set(thirds.slice(0, 8).map((t) => t.c));
    for (const c of allCanon) if (advanced.has(c) || top8.has(c)) inCount[c]++;
  } while (step());

  for (const c of allCanon) {
    status[c] = {
      status: inCount[c] === total ? "in" : inCount[c] === 0 ? "out" : "bubble",
      posBest: posMin[c] === 99 ? null : posMin[c],
      posWorst: posMax[c] === 0 ? null : posMax[c],
    };
  }
  return status;
}

const setsEqual = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

// American moneyline -> implied probability (ignores vig until normalised).
function mlImplied(ml) {
  if (ml == null || ml === "") return null;
  const n = Number(String(ml).replace("+", ""));
  if (Number.isNaN(n)) return null;
  return n > 0 ? 100 / (n + 100) : -n / (-n + 100);
}

// Vegas win/draw/loss probabilities for a fixture (vig removed), or null.
function winProbs(comp) {
  const od = extractOdds(comp);
  if (!od) return null;
  const h = mlImplied(od.home);
  const a = mlImplied(od.away);
  if (h == null || a == null) return null;
  const d = mlImplied(od.draw) || 0;
  const sum = h + d + a;
  if (sum <= 0) return null;
  return { home: h / sum, draw: d / sum, away: a / sum };
}

// Minutes elapsed in a live match, parsed from ESPN's clock/labels.
function liveMinute(comp) {
  const st = comp.status || {};
  const dc = st.displayClock || st.type?.shortDetail || "";
  const sd = (st.type?.shortDetail || "").toLowerCase();
  if (sd.includes("half") || sd === "ht") return 45;
  const m = String(dc).match(/(\d+)/);
  if (m) return Math.min(95, Number(m[1]));
  if (typeof st.clock === "number" && st.clock > 0)
    return Math.min(95, st.clock / 60);
  return 45; // unknown but live: assume roughly halfway
}

// Blend pre-match [a, draw, b] probabilities with the live scoreline. As the
// clock runs down we trust the current score more (a small Poisson model for
// the remaining goals), so advancement odds drift toward what's on the pitch.
function liveProbs(preP, sA, sB, minute) {
  const remFrac = Math.max(0, Math.min(1, (90 - minute) / 90));
  const elapsed = 1 - remFrac;
  const BASE = 1.35; // avg goals per team across a full match
  const pa = preP[0];
  const pb = preP[2];
  const denom = pa + pb || 1;
  const lamA = BASE * remFrac * ((2 * pa) / denom);
  const lamB = BASE * remFrac * ((2 * pb) / denom);
  const fact = [1, 1, 2, 6, 24, 120, 720, 5040, 40320];
  const poi = (lam, k) => (Math.exp(-lam) * Math.pow(lam, k)) / fact[k];
  let pA = 0;
  let pD = 0;
  let pB = 0;
  for (let ga = 0; ga <= 8; ga++) {
    for (let gb = 0; gb <= 8; gb++) {
      const w = poi(lamA, ga) * poi(lamB, gb);
      const fa = sA + ga;
      const fb = sB + gb;
      if (fa > fb) pA += w;
      else if (fb > fa) pB += w;
      else pD += w;
    }
  }
  const ps = pA + pD + pB || 1;
  const live = [pA / ps, pD / ps, pB / ps];
  // Early on lean on Vegas; late on lean on the scoreline.
  const out = [0, 1, 2].map((i) => (1 - elapsed) * preP[i] + elapsed * live[i]);
  const s = out[0] + out[1] + out[2] || 1;
  return [out[0] / s, out[1] / s, out[2] / s];
}

const joinOr = (arr) =>
  arr.length <= 1
    ? arr[0] || ""
    : `${arr.slice(0, -1).join(", ")} or ${arr[arr.length - 1]}`;

// Percentage that keeps precision for long shots (0.3% instead of 0%).
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

// Plain-language finishing outcome from the set of tiers a result can yield.
function tierText(set) {
  const t = [...set].filter((x) => x !== "out");
  const h1 = t.includes("1st");
  const h2 = t.includes("2nd");
  const h3 = t.includes("3Q");
  if (h1 && !h2 && !h3) return "win the group";
  if (h2 && !h1 && !h3) return "go through 2nd";
  if ((h1 || h2) && !h3) return "go through (top 2)";
  if (h3 && !h1 && !h2) return "go through (best third)";
  return "go through";
}

// Work out what each remaining/live group match decides. Replays every
// win/draw/loss permutation of the outstanding group games, weighting each by
// its Vegas-implied probability, and records per team: the odds of advancing,
// the result(s) they need, and concise scenario lines (incl. the deciding
// other match in their group). Returns a map keyed by ESPN event id.
function computeMatchStakes(groups, groupEvents, teamStatus = {}) {
  const confirmed = confirmedStats(groups, groupEvents);
  const base = {};
  const groupTeams = {};
  groups.forEach((g) => {
    groupTeams[g.group] = [];
    g.teams.forEach((t) => {
      const c = confirmed[t.canon] || { pts: 0, gf: 0, ga: 0 };
      base[t.canon] = { team: t.team, pts: c.pts, gf: c.gf, ga: c.ga };
      groupTeams[g.group].push(t.canon);
    });
  });

  const rem = [];
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp || comp.status?.type?.state === "post") continue;
    const gm = (comp.altGameNote || "").match(/Group\s+([A-Z])/i);
    const cs = comp.competitors || [];
    if (cs.length < 2 || !gm) continue;
    const a = canon(cs[0].team.displayName);
    const b = canon(cs[1].team.displayName);
    if (!base[a] || !base[b]) continue;
    // Outcome probabilities aligned to [a wins, draw, b wins].
    const wp = winProbs(comp);
    let p = [1 / 3, 1 / 3, 1 / 3];
    if (wp) {
      const cs0Home = cs[0].homeAway === "home";
      p = cs0Home ? [wp.home, wp.draw, wp.away] : [wp.away, wp.draw, wp.home];
    }
    // For an in-progress match, fold the live scoreline + clock into the odds.
    if (comp.status?.type?.state === "in") {
      const sA = Number(cs[0].score) || 0;
      const sB = Number(cs[1].score) || 0;
      p = liveProbs(p, sA, sB, liveMinute(comp));
    }
    rem.push({
      id: e.id,
      group: gm[1].toUpperCase(),
      a,
      b,
      aAbbr: cs[0].team.abbreviation || base[a].team,
      bAbbr: cs[1].team.abbreviation || base[b].team,
      p,
    });
  }

  const out = {};
  const R = rem.length;
  if (R === 0 || Math.pow(3, R) > 20000)
    return { stakes: out, advanceProb: {} };

  // The single other remaining match in the same group (drives dependencies).
  const other = rem.map((m, i) => {
    const js = rem
      .map((x, k) => k)
      .filter((k) => k !== i && rem[k].group === m.group);
    return js.length === 1 ? js[0] : -1;
  });

  const remCount = {};
  rem.forEach((m) => {
    remCount[m.a] = (remCount[m.a] || 0) + 1;
    remCount[m.b] = (remCount[m.b] || 0) + 1;
  });
  const abbrOf = {};
  groups.forEach((g) =>
    g.teams.forEach((t) => (abbrOf[t.canon] = t.abbr || t.team))
  );

  // Teams that are done playing but still on the bubble: their fate is settled
  // by the remaining matches in OTHER groups (the best-third cut-off). Track
  // each one's advance probability conditioned on every remaining outcome so we
  // can show them scenarios too. mOut[i][o] = total weight of outcome o in match i.
  const condCanons = Object.keys(base).filter(
    (c) =>
      (remCount[c] || 0) === 0 &&
      (teamStatus[c]?.status || "bubble") === "bubble"
  );
  const condAdv = {};
  condCanons.forEach((c) => (condAdv[c] = rem.map(() => [0, 0, 0])));
  const mOut = rem.map(() => [0, 0, 0]);

  const letters = Object.keys(groupTeams);
  const mkGrid = () => [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const mkSide = () => ({
    tot: mkGrid(),
    adv: mkGrid(),
    tiers: [new Set(), new Set(), new Set()],
  });
  const stat = rem.map(() => ({ a: mkSide(), b: mkSide() }));

  // Odds-weighted P(advance) for every team (not just those playing today).
  const teamAdv = {};
  for (const c in base) teamAdv[c] = 0;
  let totalProb = 0;

  const idx = new Array(R).fill(0);
  const step = () => {
    for (let i = 0; i < R; i++) {
      if (idx[i] < 2) {
        idx[i]++;
        return true;
      }
      idx[i] = 0;
    }
    return false;
  };

  do {
    let sp = 1;
    for (let i = 0; i < R; i++) sp *= rem[i].p[idx[i]];
    totalProb += sp;

    const s = {};
    for (const c in base) s[c] = { pts: base[c].pts, gf: base[c].gf, ga: base[c].ga };
    for (let i = 0; i < R; i++) {
      const { a, b } = rem[i];
      const o = idx[i]; // 0 = a win, 1 = draw, 2 = b win
      if (o === 0) {
        s[a].pts += 3;
        s[a].gf += 1;
        s[b].ga += 1;
      } else if (o === 2) {
        s[b].pts += 3;
        s[b].gf += 1;
        s[a].ga += 1;
      } else {
        s[a].pts += 1;
        s[b].pts += 1;
      }
    }

    const tier = {};
    const thirds = [];
    for (const L of letters) {
      const arr = groupTeams[L]
        .map((c) => ({ c, pts: s[c].pts, gd: s[c].gf - s[c].ga, gf: s[c].gf }))
        .sort(
          (x, y) =>
            y.pts - x.pts ||
            y.gd - x.gd ||
            y.gf - x.gf ||
            base[x.c].team.localeCompare(base[y.c].team)
        );
      tier[arr[0].c] = "1st";
      tier[arr[1].c] = "2nd";
      if (arr[2]) {
        tier[arr[2].c] = "out";
        thirds.push(arr[2]);
      }
      if (arr[3]) tier[arr[3].c] = "out";
    }
    thirds
      .sort(
        (x, y) =>
          y.pts - x.pts ||
          y.gd - x.gd ||
          y.gf - x.gf ||
          base[x.c].team.localeCompare(base[y.c].team)
      )
      .slice(0, 8)
      .forEach((t) => (tier[t.c] = "3Q"));

    for (const c in base) if (tier[c] !== "out") teamAdv[c] += sp;

    for (let i = 0; i < R; i++) mOut[i][idx[i]] += sp;
    for (const c of condCanons) {
      if (tier[c] === "out") continue;
      for (let i = 0; i < R; i++) condAdv[c][i][idx[i]] += sp;
    }

    for (let i = 0; i < R; i++) {
      const { a, b } = rem[i];
      const oi = idx[i];
      const oj = other[i] >= 0 ? idx[other[i]] : 0;
      const sa = stat[i].a;
      const sb = stat[i].b;
      sa.tot[oi][oj] += sp;
      sb.tot[oi][oj] += sp;
      if (tier[a] !== "out") sa.adv[oi][oj] += sp;
      if (tier[b] !== "out") sb.adv[oi][oj] += sp;
      sa.tiers[oi].add(tier[a]);
      sb.tiers[oi].add(tier[b]);
    }
  } while (step());

  const EPS = 1e-9;
  // For match j, describe one of its 3 outcomes in plain language.
  const describeOj = (j, oj) => {
    const { aAbbr, bAbbr } = rem[j];
    if (oj === 0) return `${aAbbr} beat ${bAbbr}`;
    if (oj === 2) return `${bAbbr} beat ${aAbbr}`;
    return `${aAbbr} & ${bAbbr} draw`;
  };

  // Points-only check of what a given result does for the group title.
  // res: 0 = win, 1 = draw, 2 = loss (from this team's perspective).
  // Tie-aware: if a rival can finish level on points, the winner is a goal-
  // difference call (which the nominal-scoreline sim can't settle), so we say
  // so rather than falsely promising top spot. Final matchday only (1 game left).
  const seedFor = (i, slot, res) => {
    const canonT = slot === "a" ? rem[i].a : rem[i].b;
    if (remCount[canonT] !== 1) return { kind: "na" };
    const grp = rem[i].group;
    const oppCanon = slot === "a" ? rem[i].b : rem[i].a;
    const tPts = base[canonT].pts + (res === 0 ? 3 : res === 1 ? 1 : 0);
    let above = 0;
    const tie = [];
    for (const u of groupTeams[grp]) {
      if (u === canonT) continue;
      // The opponent's points are pinned by this result; everyone else can
      // still win their own remaining match.
      const uMax =
        u === oppCanon
          ? base[u].pts + (res === 0 ? 0 : res === 1 ? 1 : 3)
          : base[u].pts + 3 * (remCount[u] || 0);
      if (uMax > tPts) above++;
      else if (uMax === tPts) tie.push(abbrOf[u] || u);
    }
    if (above === 0 && tie.length === 0) return { kind: "guarantee" };
    if (above === 0) return { kind: "tie", tie };
    return { kind: "contested" };
  };

  const buildTeam = (i, slot) => {
    const m = rem[i];
    const canonT = slot === "a" ? m.a : m.b;
    const side = stat[i][slot];
    const st = teamStatus[canonT]?.status || "bubble";
    const prob = totalProb > 0 ? teamAdv[canonT] / totalProb : null;
    // Map each label to this team's own-result index in the grid.
    const order =
      slot === "a"
        ? [["Win", 0], ["Draw", 1], ["Lose", 2]]
        : [["Win", 2], ["Draw", 1], ["Lose", 0]];

    const cls = {};
    for (const [label, oi] of order) {
      let totR = 0;
      let advR = 0;
      for (let oj = 0; oj < 3; oj++) {
        totR += side.tot[oi][oj];
        advR += side.adv[oi][oj];
      }
      cls[label] = { oi, totR, advR, tiers: side.tiers[oi] };
    }

    const lineFor = (label) => {
      const c = cls[label];
      if (c.totR <= EPS) return null;
      if (c.advR >= c.totR - EPS) return `${label} → ${tierText(c.tiers)}`;
      if (c.advR <= EPS) return `${label} → out`;
      const oi = c.oi;
      const pct = fmtPct(c.advR / c.totR);
      if (other[i] >= 0) {
        const full = [];
        const nonZero = [];
        for (let oj = 0; oj < 3; oj++) {
          const tt = side.tot[oi][oj];
          const aa = side.adv[oi][oj];
          if (tt <= EPS) continue;
          if (aa > EPS) nonZero.push(oj);
          if (aa >= tt - EPS) full.push(oj);
        }
        const fullSet = new Set(full);
        const cleanlyDecided =
          nonZero.length > 0 &&
          nonZero.length < 3 &&
          nonZero.every((oj) => fullSet.has(oj));
        if (cleanlyDecided) {
          const cond = joinOr(nonZero.map((oj) => describeOj(other[i], oj)));
          return `${label} → through if ${cond}`;
        }
        if (nonZero.length > 0 && nonZero.length < 3) {
          const cond = joinOr(nonZero.map((oj) => describeOj(other[i], oj)));
          return `${label} → ${pct}: needs ${cond} + other groups`;
        }
      }
      return `${label} → ${pct} (needs other results)`;
    };

    const safe = (label) => cls[label].advR >= cls[label].totR - EPS;
    const canAdv = (label) => cls[label].advR > EPS;
    const allTiers = new Set([
      ...cls.Win.tiers,
      ...cls.Draw.tiers,
      ...cls.Lose.tiers,
    ]);
    const sWin = seedFor(i, slot, 0);
    const sDraw = seedFor(i, slot, 1);
    const sLoss = seedFor(i, slot, 2);

    let need;
    let tone;
    const clinched = st === "in";
    const eliminated = st === "out";
    if (clinched) {
      tone = "good";
      if (sLoss.kind === "guarantee") {
        need = "Group already won";
      } else if (sDraw.kind === "guarantee") {
        need = "Win or draw to win the group";
      } else if (sWin.kind === "guarantee") {
        need = "Win to win the group";
      } else if (sWin.kind === "tie") {
        need = `Through — top spot on GD vs ${sWin.tie.join("/")}`;
      } else if (allTiers.has("1st")) {
        need = "Through — 1st still in reach";
      } else {
        need = "Through to the last 32";
      }
    } else if (eliminated) {
      need = "Eliminated";
      tone = "bad";
    } else if (safe("Win") && safe("Draw")) {
      need = "Win or draw to advance";
      tone = "good";
    } else if (safe("Win")) {
      need = "Must win to advance";
      tone = "warn";
    } else if (canAdv("Win")) {
      need = "Win and need other results";
      tone = "warn";
    } else {
      need = "Long shot — win and need help";
      tone = "warn";
    }

    // Override the result lines with the points-based group-title verdict so
    // the breakdown is accurate about top spot (incl. goal-difference ties).
    const seedLine = (label, c, s) => {
      let l = lineFor(label);
      if (!l || !safe(label)) return l;
      if (s.kind === "guarantee") return `${label} → win the group`;
      if (s.kind === "tie")
        return s.tie.length === 1
          ? `${label} → 1st or 2nd, decided on GD vs ${s.tie[0]}`
          : `${label} → top spot decided on goal difference`;
      return l;
    };
    const detail = eliminated
      ? []
      : [
          seedLine("Win", cls.Win, sWin),
          seedLine("Draw", cls.Draw, sDraw),
          seedLine("Lose", cls.Lose, sLoss),
        ].filter(Boolean);

    const varies = !(
      setsEqual(cls.Win.tiers, cls.Draw.tiers) &&
      setsEqual(cls.Draw.tiers, cls.Lose.tiers)
    );

    return { obj: { prob, need, tone, detail, clinched, eliminated }, varies, st };
  };

  rem.forEach((m, i) => {
    const a = buildTeam(i, "a");
    const b = buildTeam(i, "b");
    const anyBubble = a.st === "bubble" || b.st === "bubble";
    const level = anyBubble ? "high" : a.varies || b.varies ? "medium" : "dead";
    out[m.id] = {
      level,
      teams: { [m.a]: a.obj, [m.b]: b.obj },
    };
  });

  // Scenarios for the done-and-dusted bubble teams (decided by other groups).
  const outcomeShort = (i, o) =>
    o === 0 ? `${rem[i].aAbbr} win` : o === 2 ? `${rem[i].bAbbr} win` : "draw";
  const bubbleScenarios = {};
  for (const c of condCanons) {
    const prob = totalProb > 0 ? teamAdv[c] / totalProb : null;
    const swings = [];
    for (let i = 0; i < R; i++) {
      const co = [0, 1, 2]
        .filter((o) => mOut[i][o] > EPS)
        .map((o) => ({ o, p: condAdv[c][i][o] / mOut[i][o] }));
      if (co.length < 2) continue;
      const best = co.reduce((x, y) => (y.p > x.p ? y : x));
      const worst = co.reduce((x, y) => (y.p < x.p ? y : x));
      const spread = best.p - worst.p;
      if (spread < 0.04) continue;
      swings.push({ i, best, worst, spread });
    }
    swings.sort((x, y) => y.spread - x.spread);
    const detail = swings
      .slice(0, 3)
      .map(
        ({ i, best, worst }) =>
          `${rem[i].aAbbr} v ${rem[i].bAbbr}: ${outcomeShort(i, best.o)} → ${fmtPct(
            best.p
          )} · ${outcomeShort(i, worst.o)} → ${fmtPct(worst.p)}`
      );
    let need;
    if (prob == null) need = "Needs results elsewhere";
    else if (prob >= 0.85) need = "In the box seat — just needs results to hold";
    else if (prob >= 0.5) need = "On the bubble — leaning through";
    else if (prob >= 0.15) need = "On the bubble — leaning out";
    else need = "Long shot — needs plenty of help elsewhere";
    if (detail.length === 0)
      detail.push("Comes down to goal-difference tie-breaks among the thirds.");
    bubbleScenarios[c] = { prob, need, detail };
  }

  const advanceProb = {};
  if (totalProb > 0)
    for (const c in teamAdv) advanceProb[c] = teamAdv[c] / totalProb;
  return { stakes: out, advanceProb, bubbleScenarios };
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
    koByPair[k] = { comp, cs, kickoff: e.date };
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
    let kickoff = null;

    if (home && away) {
      const hit = koByPair[[home.canon, away.canon].sort().join("|")];
      if (hit) {
        const { comp, cs } = hit;
        kickoff = hit.kickoff || null;
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
      kickoff,
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

    // Clinched / eliminated / bubble for every team (group + best-third math).
    const teamStatus = computeTeamStatus(groups, groupEvents);

    // What each upcoming/live group match still decides (1st/2nd, bubble, dead),
    // plus an odds-weighted chance-to-advance for every team.
    const {
      stakes: matchStakes,
      advanceProb,
      bubbleScenarios,
    } = computeMatchStakes(groups, groupEvents, teamStatus);
    schedule.forEach((m) => {
      if (matchStakes[m.id]) m.stakes = matchStakes[m.id];
    });
    // Per-team scenario lookup so e.g. the Bubble Boys table can show what a
    // team needs to advance (first remaining match a team appears in).
    const stakesByCanon = {};
    for (const mid in matchStakes) {
      const teams = matchStakes[mid].teams || {};
      for (const c in teams) {
        if (!stakesByCanon[c]) stakesByCanon[c] = teams[c];
      }
    }
    const probFor = (canonKey, statusVal) =>
      advanceProb[canonKey] ??
      (statusVal === "in" ? 1 : statusVal === "out" ? 0 : null);

    // Teams knocked out in the bracket (loser of any completed KO match). Group
    // status alone can't tell us this, so the squad "remaining" count needs it.
    const koEliminated = new Set();
    for (const e of koEvents) {
      const comp = e.competitions?.[0];
      if (!comp || comp.status?.type?.state !== "post") continue;
      const cs = comp.competitors || [];
      if (!cs.some((c) => c.winner === true)) continue; // skip until a winner is set
      for (const c of cs) {
        if (c.winner !== true && c.team?.displayName) {
          koEliminated.add(canon(c.team.displayName));
        }
      }
    }

    // Who advances: top 2 per group + the best 8 third-placed teams.
    const thirdInfo = computeThirdPlace(groups, teamStatus);
    const qualifyingThirds = new Set(thirdInfo.qualifierGroups);
    groups.forEach((g) => {
      g.teams.forEach((t) => {
        if (t.pos === 1) t.advance = "W";
        else if (t.pos === 2) t.advance = "RU";
        else if (t.pos === 3 && qualifyingThirds.has(g.group)) t.advance = "3Q";
        else t.advance = null;
        const o = teamStatus[t.canon];
        const koOut = koEliminated.has(t.canon);
        t.status = koOut ? "out" : o?.status || "bubble";
        t.posBest = o?.posBest ?? null;
        t.posWorst = o?.posWorst ?? null;
        t.eliminated = t.status === "out" || koOut;
        t.koEliminated = koOut;
        t.prob = koOut ? 0 : probFor(t.canon, t.status);
      });
    });
    thirdInfo.ranking.forEach((t) => {
      const o = teamStatus[t.canon];
      t.status = o?.status || "bubble";
      t.posBest = o?.posBest ?? null;
      t.posWorst = o?.posWorst ?? null;
      t.prob = probFor(t.canon, t.status);
      const sb = stakesByCanon[t.canon] || bubbleScenarios?.[t.canon];
      if (sb) {
        t.need = sb.need;
        t.detail = sb.detail;
      }
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
        const koOut = koEliminated.has(canon(teamName));
        const status = koOut
          ? "out"
          : teamStatus[canon(teamName)]?.status || "bubble";
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
          status,
          koEliminated: koOut,
          alive: status !== "out",
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
        advanced: teams.filter((t) => t.status === "in").length,
        bubble: teams.filter((t) => t.status === "bubble").length,
        eliminated: teams.filter((t) => t.status === "out").length,
        teamCount: teams.length,
        teamsLeft: teams.filter((t) => t.alive).length,
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
    const cacheTime = anyLive ? 15 : 120;
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
