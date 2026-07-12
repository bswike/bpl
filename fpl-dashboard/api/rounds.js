// GET /api/rounds?name=Everett Kennedy&from=2026-01-01&to=2026-07-12
// Public, read-only. Answers "how many rounds has <name> played" from the
// cached tee sheets (see _roundsStore). Never scrapes live, so it's fast and
// can't be used to hammer Suntree — the daily cron is the only thing that logs
// in. Returns the matching rounds, a monthly breakdown, and cache coverage.
import { queryRange, coverage } from "./_roundsStore.js";

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

function isISO(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const name = norm(req.query.name);
  let from = req.query.from || `${todayISO().slice(0, 4)}-01-01`;
  let to = req.query.to || todayISO();
  if (!isISO(from) || !isISO(to)) return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
  if (from > to) [from, to] = [to, from];

  const cov = await coverage();
  const { rows, coveredDays } = await queryRange(from, to);

  // Filter to the requested player (substring match on normalized full name).
  const matches = name
    ? rows.filter((r) => norm(r.player).includes(name))
    : [];

  matches.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.time || "").localeCompare(b.time || "")));

  const byMonth = {};
  for (const r of matches) byMonth[r.date.slice(0, 7)] = (byMonth[r.date.slice(0, 7)] || 0) + 1;

  const byCourse = {};
  for (const r of matches) byCourse[r.course || "Unknown"] = (byCourse[r.course || "Unknown"] || 0) + 1;

  // Exact display names that matched (nice for confirming who you found).
  const matchedNames = [...new Set(matches.map((m) => m.player))].sort();

  // Helpful when nothing matched: distinct names in range sharing a query token.
  let suggestions = [];
  if (name && matches.length === 0) {
    const tokens = name.split(" ").filter(Boolean);
    const names = new Set();
    for (const r of rows) {
      const p = norm(r.player);
      if (tokens.some((t) => p.includes(t))) names.add(r.player);
    }
    suggestions = [...names].sort().slice(0, 15);
  }

  const partial = coveredDays.length === 0 ? "none" :
    (from < (cov.minDay || from) || to > (cov.maxDay || to)) ? "partial" : "full";

  return res.status(200).json({
    query: { name: req.query.name || null, from, to },
    count: matches.length,
    matchedNames,
    byMonth,
    byCourse,
    rounds: matches,
    suggestions,
    coverage: {
      status: partial,            // full | partial | none
      cacheMinDay: cov.minDay,
      cacheMaxDay: cov.maxDay,
      coveredDaysInRange: coveredDays.length,
    },
  });
}
