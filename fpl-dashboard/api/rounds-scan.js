// POST /api/rounds-scan  { from, to }   (bounded window, <= MAX_SPAN days)
// Uses the logged-in session (rounds_sid cookie) to scrape the given day range
// and fold it into the shared cache. The browser calls this repeatedly in
// chunks to refresh a longer span behind a progress bar, keeping each request
// under the serverless timeout. Returns which days were scraped.
import { resumeSession, SESSION_EXPIRED } from "./_suntree.js";
import { loadSession, refreshSession, deleteSession, upsertDays } from "./_roundsStore.js";

export const maxDuration = 60;

const COOKIE = "rounds_sid";
const MAX_SPAN = 10; // days attempted per request; the client resumes via nextFrom
const TIME_BUDGET_MS = 50_000;

const isISO = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function readCookie(req, name) {
  const m = (req.headers.cookie || "").match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m ? m[1] : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const sid = readCookie(req, COOKIE);
  if (!sid) return res.status(401).json({ error: "not_logged_in" });

  let { from, to } = req.body || {};
  if (!isISO(from) || !isISO(to)) return res.status(400).json({ error: "from/to must be YYYY-MM-DD" });
  if (from > to) [from, to] = [to, from];

  const session = await loadSession(sid);
  if (!session) return res.status(401).json({ error: "session_expired" });

  let scraper;
  try {
    scraper = await resumeSession(session.cookieHeader);
  } catch (err) {
    if (err.code === SESSION_EXPIRED) {
      await deleteSession(sid);
      res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
      return res.status(401).json({ error: "session_expired" });
    }
    throw err;
  }

  // Build the (capped) day list for this chunk.
  const days = [];
  for (let d = from; d <= to && days.length < MAX_SPAN; d = addDays(d, 1)) days.push(d);

  const started = Date.now();
  const dayMap = {};
  const scraped = [];
  let failed = null;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (Date.now() - started > TIME_BUDGET_MS) break;
    try {
      dayMap[day] = await scraper.scrapeDay(day);
      scraped.push(day);
    } catch (err) {
      // Stop at the FIRST failure so `scraped` stays a contiguous run from
      // `from`. That way nextFrom points exactly at the failed day and it gets
      // retried, instead of the whole failing block being leapt over.
      failed = { day, error: err.message };
      break;
    }
    // Space out requests a little — hammering Suntree back-to-back gets a burst
    // of days throttled, which is what caused whole stretches to drop out.
    if (i < days.length - 1) await new Promise((r) => setTimeout(r, 300));
  }

  if (scraped.length) await upsertDays(dayMap);
  // Persist any refreshed cookies so the session stays alive across chunks.
  try { await refreshSession(sid, scraper.cookieHeader()); } catch { /* non-fatal */ }

  // Resume point for the client. `scraped` is a contiguous run from `from`, so:
  // - a failure  -> resume AT the failed day (retry it)
  // - budget/cap -> resume after the last finished day
  // - reached to -> null (done)
  let nextFrom;
  if (failed) nextFrom = failed.day;
  else if (scraped.length && scraped[scraped.length - 1] < to) nextFrom = addDays(scraped[scraped.length - 1], 1);
  else nextFrom = null;
  return res.status(200).json({ scraped, failed, nextFrom });
}
