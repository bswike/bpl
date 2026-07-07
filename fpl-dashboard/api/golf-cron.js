// GET /api/golf-cron — daily auto-sync. For each golfer in the encrypted vault,
// logs into GHIN, fetches fresh scores, and republishes their public feed.
// Triggered by Vercel Cron (see vercel.json). Guarded by CRON_SECRET so it
// can't be run by outsiders.
import { publishGolfer } from "./_golf.js";
import { fetchGhinData } from "./_ghinClient.js";
import { listVaultCredentials, vaultConfigured } from "./_vault.js";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // if unset, rely on Vercel's cron-only routing
  const auth = req.headers.authorization || "";
  const q = req.query?.secret;
  return auth === `Bearer ${secret}` || q === secret;
}

export default async function handler(req, res) {
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  if (!vaultConfigured()) {
    return res.status(200).json({ ok: true, synced: 0, note: "vault not configured" });
  }

  const creds = await listVaultCredentials();
  const results = [];
  for (const c of creds) {
    try {
      const { golfer, scores } = await fetchGhinData({
        email: c.email,
        password: c.password,
        ghinNumber: c.ghin,
      });
      if (scores.length) {
        await publishGolfer({ golfer, scores });
        results.push({ ghin: c.ghin, ok: true, scores: scores.length });
      } else {
        results.push({ ghin: c.ghin, ok: false, reason: "no scores" });
      }
    } catch (err) {
      // A single golfer's failure (e.g. changed password) must not stop the run.
      results.push({ ghin: c.ghin, ok: false, reason: err.message });
    }
  }

  const synced = results.filter((r) => r.ok).length;
  console.log(`golf-cron: synced ${synced}/${creds.length}`, results);
  return res.status(200).json({ ok: true, synced, total: creds.length, results });
}
