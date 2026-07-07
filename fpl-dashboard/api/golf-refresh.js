// POST /api/golf-refresh — batch live-refresh of the public feed.
// When a signed-in user has a live GHIN token, the client sends the GHIN
// numbers of everyone already on the public feed; we pull each golfer's most
// recent scores straight from GHIN (read-only, using the caller's own token,
// never stored) so the feed shows their latest rounds without waiting for
// them to sign in again or for the daily sync. Nothing is written server-side.
// Requires a golf_session cookie so this can't be used as an open GHIN proxy.
import { sessionFromReq, slimExport } from "./_golf.js";

const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";
const MAX_GOLFERS = 25;
const PAGE_SIZE = 50; // most recent rounds only — plenty for the feed
const CONCURRENCY = 4;

async function fetchRecentScores(token, ghin) {
  const params = new URLSearchParams({
    golfer_id: ghin,
    source: SOURCE,
    limit: String(PAGE_SIZE),
    offset: "0",
  });
  const res = await fetch(`${API_BASE}/scores.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { unauthorized: true };
  if (!res.ok) return null;
  const data = await res.json();
  return { scores: data?.scores ?? [] };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Must be signed in (anti-abuse) and supply a live GHIN token.
  if (!sessionFromReq(req)) {
    return res.status(401).json({ error: "Sign in to refresh the feed." });
  }
  const { token, ghins } = req.body || {};
  if (!token) {
    return res
      .status(401)
      .json({ error: "Your GHIN session expired — sign in again." });
  }
  const targets = [
    ...new Set(
      (Array.isArray(ghins) ? ghins : [])
        .map((g) => String(g).trim())
        .filter((g) => /^\d{2,}$/.test(g))
    ),
  ].slice(0, MAX_GOLFERS);
  if (!targets.length) {
    return res.status(400).json({ error: "No GHIN numbers given." });
  }

  let unauthorized = false;
  const out = {};
  let i = 0;
  const workers = Array.from(
    { length: Math.min(CONCURRENCY, targets.length) },
    async () => {
      while (i < targets.length && !unauthorized) {
        const ghin = targets[i++];
        try {
          const r = await fetchRecentScores(token, ghin);
          if (r?.unauthorized) {
            unauthorized = true;
            return;
          }
          if (r?.scores?.length) {
            out[ghin] = slimExport({ golfer: {}, scores: r.scores }).scores;
          }
        } catch {
          /* skip this golfer; the published snapshot still shows */
        }
      }
    }
  );
  await Promise.all(workers);

  if (unauthorized && Object.keys(out).length === 0) {
    return res
      .status(401)
      .json({ error: "Your GHIN session expired — sign in again." });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ scores: out });
}
