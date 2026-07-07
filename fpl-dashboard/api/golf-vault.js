// GET    /api/golf-vault — is the signed-in golfer enrolled in auto-sync?
// DELETE /api/golf-vault — stop auto-sync (delete stored credentials).
// Both require the golf_session cookie and only touch the caller's own record.
import { sessionFromReq } from "./_golf.js";
import { isVaulted, removeVault, vaultConfigured } from "./_vault.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const ghin = sessionFromReq(req);
  if (!ghin) return res.status(401).json({ error: "Sign in first." });

  try {
    if (req.method === "GET") {
      const enrolled = vaultConfigured() ? await isVaulted(ghin) : false;
      return res.status(200).json({ available: vaultConfigured(), enrolled });
    }
    if (req.method === "DELETE") {
      if (vaultConfigured()) await removeVault(ghin);
      return res.status(200).json({ enrolled: false });
    }
    return res.status(405).json({ error: "GET or DELETE only" });
  } catch (err) {
    console.error("golf-vault error:", err);
    return res.status(500).json({ error: err.message || "Vault error" });
  }
}
