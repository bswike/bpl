// POST /api/golf-search — find golfers by name (and optional state) using the
// caller's own short-lived GHIN token (passed from the browser, never stored).
// Read-only and private: results are only shown to the signed-in user so they
// can pick the right person to look up. Requires a golf_session cookie so
// this can't be used as an open GHIN proxy.
import { sessionFromReq } from "./_golf.js";
import { GHIN_LIVE_OFF_MSG, isGhinLiveEnabled } from "./_ghinClient.js";

const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";

async function searchGolfers(token, { firstName, lastName, state }) {
  const params = new URLSearchParams({
    source: SOURCE,
    page: "1",
    per_page: "25",
    sorting_criteria: "full_name",
    order: "asc",
    status: "Active",
  });
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  if (state) params.set("state", state);
  const res = await fetch(`${API_BASE}/golfers/search.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) return { unauthorized: true };
  if (!res.ok) return { golfers: [] };
  const data = await res.json();
  return { golfers: data?.golfers ?? [] };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  if (!sessionFromReq(req)) {
    return res.status(401).json({ error: "Sign in to search for golfers." });
  }
  if (!isGhinLiveEnabled()) {
    return res.status(503).json({ error: GHIN_LIVE_OFF_MSG });
  }
  const { token, query, state } = req.body || {};
  if (!token) {
    return res
      .status(401)
      .json({ error: "Your GHIN session expired — sign in again." });
  }
  const words = String(query || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) {
    return res.status(400).json({ error: "Enter a name to search for." });
  }
  const st = /^[A-Za-z]{2}$/.test(String(state || "").trim())
    ? String(state).trim().toUpperCase()
    : undefined;

  // "Swikle" → last name only; "Todd Swikle" → first + last.
  const primary =
    words.length === 1
      ? { lastName: words[0], state: st }
      : { firstName: words[0], lastName: words.slice(1).join(" "), state: st };

  try {
    let r = await searchGolfers(token, primary);
    if (r.unauthorized) {
      return res
        .status(401)
        .json({ error: "Your GHIN session expired — sign in again." });
    }
    // Nothing? Try the names the other way around ("Swikle Todd").
    if (!r.golfers.length && words.length >= 2) {
      r = await searchGolfers(token, {
        firstName: words[words.length - 1],
        lastName: words.slice(0, -1).join(" "),
        state: st,
      });
      if (r.unauthorized) {
        return res
          .status(401)
          .json({ error: "Your GHIN session expired — sign in again." });
      }
    }

    // GHIN returns one row per club membership — collapse to one per golfer.
    const seen = new Set();
    const golfers = [];
    for (const g of r.golfers) {
      const ghin = String(g.ghin ?? g.ghin_number ?? "");
      if (!ghin || seen.has(ghin)) continue;
      seen.add(ghin);
      golfers.push({
        ghin,
        first_name: g.first_name,
        last_name: g.last_name,
        club_name: g.club_name ?? g.club_affiliation ?? null,
        state: g.state ?? null,
        handicap_index: g.handicap_index ?? g.hi_display ?? null,
      });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ golfers });
  } catch (err) {
    console.error("golf-search error:", err);
    return res.status(500).json({ error: "Search failed. Try again." });
  }
}
