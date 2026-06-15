// Proxies + parses the World Cup Pool Google Sheet (published as CSV) into clean JSON.
// Avoids browser CORS issues and hides the messy spreadsheet layout from the client.

const SHEET_ID = "1tR5l3b8yPN9xQdfJkSIsgjN7z2gR6Myp9KqWmP4-_6w";
const GID = "0";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

// Managers sit in vertical bands; each occupies 5 columns starting at these offsets.
const MANAGER_OFFSETS = [0, 6, 12, 18];

// Minimal CSV parser (handles quoted fields with embedded commas/quotes).
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
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore; handled by \n
    } else {
      field += c;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

function classifyTeam(w, d, l, pts) {
  if (w === "1") return { result: "W", points: 3 };
  if (d === "1") return { result: "D", points: 1 };
  if (l === "1") return { result: "L", points: 0 };
  return { result: "P", points: Number(pts) || 0 }; // pending / not yet played
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const resp = await fetch(CSV_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (footie-pool)" },
    });
    if (!resp.ok) {
      throw new Error(`Sheet fetch failed: ${resp.status}`);
    }
    const text = await resp.text();
    const rows = parseCSV(text);

    const cell = (r, c) => (rows[r] && rows[r][c] != null ? rows[r][c].trim() : "");

    // ---- Managers + their drafted teams ----
    const managers = [];
    for (let r = 0; r < rows.length; r++) {
      for (const off of MANAGER_OFFSETS) {
        // Header cell pattern: <Name> | W | D | L | Pts
        if (cell(r, off + 1) === "W" && cell(r, off + 2) === "D") {
          const name = cell(r, off);
          if (!name) continue;
          const teams = [];
          let tr = r + 1;
          while (tr < rows.length) {
            const teamName = cell(tr, off);
            if (!teamName || teamName === "Totals") break;
            const info = classifyTeam(
              cell(tr, off + 1),
              cell(tr, off + 2),
              cell(tr, off + 3),
              cell(tr, off + 4)
            );
            teams.push({ team: teamName, ...info });
            tr++;
          }
          const gsPoints = teams.reduce((sum, t) => sum + t.points, 0);
          const wins = teams.filter((t) => t.result === "W").length;
          const draws = teams.filter((t) => t.result === "D").length;
          const losses = teams.filter((t) => t.result === "L").length;
          const pending = teams.filter((t) => t.result === "P").length;
          managers.push({
            name,
            teams,
            gsPoints,
            wins,
            draws,
            losses,
            pending,
          });
        }
      }
    }

    // ---- Knockout scoring rules (left column block) ----
    const koScoring = {};
    const koLabels = {
      "Round of 32 W": "r32",
      "Round of 16 W": "r16",
      "Quarter W": "qf",
      "Semi W": "sf",
      "Champ W": "champ",
      "Third Place W": "third",
    };
    for (let r = 0; r < rows.length; r++) {
      const label = cell(r, 0);
      if (koLabels[label]) {
        koScoring[koLabels[label]] = Number(cell(r, 1)) || 0;
      }
    }

    // ---- Results table (Results | GS | KO | Total) for KO points per manager ----
    const koByName = {};
    let resultsCol = -1;
    let resultsRow = -1;
    for (let r = 0; r < rows.length && resultsCol === -1; r++) {
      for (let c = 0; c < (rows[r] || []).length; c++) {
        if (cell(r, c) === "Results" && cell(r, c + 3) === "Total") {
          resultsCol = c;
          resultsRow = r;
          break;
        }
      }
    }
    if (resultsCol !== -1) {
      for (let r = resultsRow + 1; r < rows.length; r++) {
        const nm = cell(r, resultsCol);
        if (!nm) continue;
        koByName[nm] = Number(cell(r, resultsCol + 2)) || 0;
      }
    }

    // ---- Standings ----
    const standings = managers
      .map((m) => {
        const ko = koByName[m.name] ?? 0;
        return {
          name: m.name,
          gs: m.gsPoints,
          ko,
          total: m.gsPoints + ko,
        };
      })
      .sort((a, b) => b.total - a.total || b.gs - a.gs);

    res.setHeader(
      "Cache-Control",
      "s-maxage=60, stale-while-revalidate=300"
    );
    return res.status(200).json({
      title: "2026 World Cup Pool",
      stage: cell(1, 0) || "Group Stage",
      managers,
      standings,
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
