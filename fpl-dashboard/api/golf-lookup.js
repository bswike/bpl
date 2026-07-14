// POST /api/golf-lookup — live, read-only "look up a friend" by GHIN number.
// Uses the caller's own short-lived GHIN token (passed from the browser, never
// stored) to do a GHIN peer lookup. Nothing here is published; the result is
// shown privately to the signed-in user only. Requires a valid golf_session
// cookie so this can't be used as an open GHIN proxy.
import { sessionFromReq, slimExport } from "./_golf.js";
import {
  attachCourseData,
  GHIN_LIVE_OFF_MSG,
  hydrateRedactedScores,
  isGhinLiveEnabled,
} from "./_ghinClient.js";

const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";

async function fetchGolfer(token, ghin) {
  const params = new URLSearchParams({
    golfer_id: ghin,
    source: SOURCE,
    from_ghin: "true",
    per_page: "1",
    page: "1",
  });
  const res = await fetch(`${API_BASE}/golfers.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { unauthorized: true };
  if (!res.ok) return { golfer: null };
  const data = await res.json();
  return { golfer: data?.golfers?.[0] ?? null };
}

async function fetchScores(token, ghin) {
  const all = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const params = new URLSearchParams({
      golfer_id: ghin,
      source: SOURCE,
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetch(`${API_BASE}/scores.json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return { unauthorized: true };
    if (!res.ok) break;
    const data = await res.json();
    const scores = data?.scores ?? [];
    all.push(...scores);
    if (scores.length < limit || all.length > 5000) break;
    offset += limit;
  }
  return { scores: all };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  // Must be signed in (anti-abuse) and supply a live GHIN token.
  if (!sessionFromReq(req)) {
    return res.status(401).json({ error: "Sign in to look up other golfers." });
  }
  if (!isGhinLiveEnabled()) {
    return res.status(503).json({ error: GHIN_LIVE_OFF_MSG });
  }
  const { token, ghinNumber } = req.body || {};
  if (!token) {
    return res
      .status(401)
      .json({ error: "Your GHIN session expired — sign in again to look up golfers." });
  }
  const ghin = String(ghinNumber || "").trim();
  if (!/^\d{2,}$/.test(ghin)) {
    return res.status(400).json({ error: "Enter a valid GHIN number (digits only)." });
  }

  try {
    const g = await fetchGolfer(token, ghin);
    if (g.unauthorized) {
      return res
        .status(401)
        .json({ error: "Your GHIN session expired — sign in again to look up golfers." });
    }
    const s = await fetchScores(token, ghin);
    if (s.unauthorized) {
      return res
        .status(401)
        .json({ error: "Your GHIN session expired — sign in again to look up golfers." });
    }
    if (!s.scores?.length) {
      return res.status(404).json({ error: "No scores found for that GHIN number." });
    }
    // GHIN redacts bulk history for out-of-club golfers (no course names or
    // ids, truncated dates). Re-fetch those rounds individually — the
    // single-score endpoint returns them in full — then backfill any still
    // missing names (and tee yardage) from the course records.
    await hydrateRedactedScores(token, s.scores, { max: 400 });
    await attachCourseData(token, s.scores);
    const gi = g.golfer;
    const payload = slimExport({
      golfer: gi
        ? {
            first_name: gi.first_name,
            last_name: gi.last_name,
            ghin_number: gi.ghin_number ?? ghin,
            handicap_index: gi.handicap_index,
            club_name: gi.club_name,
          }
        : { ghin_number: ghin },
      scores: s.scores,
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (err) {
    console.error("golf-lookup error:", err);
    return res.status(500).json({ error: "Lookup failed. Try again." });
  }
}
