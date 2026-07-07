// POST /api/ghin — logs into GHIN, returns the golfer's scores, sets a session
// cookie, and (optionally) enrolls the golfer in the encrypted sync vault.
import { signSession, sessionCookie } from "./_golf.js";
import { fetchGhinData } from "./_ghinClient.js";
import { enrollVault, vaultConfigured } from "./_vault.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { email, password, ghinNumber, keepSynced } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { token, resolvedId, golfer, scores } = await fetchGhinData({
      email,
      password,
      ghinNumber,
    });

    const withHoleDetail = scores.filter(
      (s) => Array.isArray(s.hole_details) && s.hole_details.length > 0
    ).length;

    const payload = {
      exported_at: new Date().toISOString(),
      golfer,
      total_scores: scores.length,
      scores_with_hole_detail: withHoleDetail,
      scores,
    };

    const ghin = String(golfer.ghin_number ?? resolvedId);

    // Session cookie proves ownership of this GHIN for publish/unpublish/kudos.
    res.setHeader("Set-Cookie", sessionCookie(signSession(ghin)));

    // Short-lived (~12h) GHIN token for live "look up a friend" queries.
    // Held only in the browser session, never stored server-side.
    payload.ghinToken = token;

    // Opt-in daily auto-sync: store encrypted credentials so the cron can log
    // in and refresh this golfer's public feed without them opening the site.
    if (keepSynced) {
      if (!vaultConfigured()) {
        payload.syncError = "Auto-sync isn't configured on the server yet.";
      } else {
        try {
          const name = `${golfer.first_name || ""} ${golfer.last_name || ""}`.trim();
          await enrollVault({ ghin, email, password, name });
          payload.synced = true;
        } catch (e) {
          console.error("vault enroll failed:", e);
          payload.syncError = "Could not enable auto-sync.";
        }
      }
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(payload);
  } catch (err) {
    console.error("GHIN API error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return res.status(500).json({ error: message });
  }
}
