// World Cup Pool API
// - Draft rosters + knockout scoring values come from the Google Sheet (the pool config).
// - All match RESULTS come live from ESPN's FIFA World Cup feed and points are computed here.

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

// Group-stage schedule grouped by group letter (A–L), each match distilled for the UI.
function buildSchedule(groupEvents) {
  const groups = {};
  for (const e of groupEvents) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const note = comp.altGameNote || "";
    const m = note.match(/Group\s+([A-Z])/i);
    const letter = m ? m[1].toUpperCase() : "?";
    const cs = comp.competitors || [];
    if (cs.length < 2) continue;
    const home = cs.find((c) => c.homeAway === "home") || cs[0];
    const away = cs.find((c) => c.homeAway === "away") || cs[1];
    const state = comp.status?.type?.state || "pre";
    (groups[letter] = groups[letter] || []).push({
      date: e.date,
      state,
      detail: comp.status?.type?.shortDetail || "",
      home: home.team.displayName,
      homeAbbr: home.team.abbreviation || "",
      away: away.team.displayName,
      awayAbbr: away.team.abbreviation || "",
      homeScore: state !== "pre" ? Number(home.score) || 0 : null,
      awayScore: state !== "pre" ? Number(away.score) || 0 : null,
    });
  }
  return Object.keys(groups)
    .sort()
    .map((letter) => ({
      group: letter,
      matches: groups[letter].sort((a, b) => new Date(a.date) - new Date(b.date)),
    }));
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
    const teamResults = buildTeamResults(groupEvents, koEvents, koScoring);
    const schedule = buildSchedule(groupEvents);

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
