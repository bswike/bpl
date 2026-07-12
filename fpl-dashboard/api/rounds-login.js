// POST /api/rounds-login  { username, password }
// Logs into Suntree with the member's own credentials and stores ONLY the
// resulting session cookies server-side (under an unguessable id handed back in
// an httpOnly cookie). The password is used once for the handshake and never
// stored or logged. The browser then drives /api/rounds-scan to refresh the
// shared cache. Session lasts as long as Suntree keeps it alive (~12h).
import { loginSession } from "./_suntree.js";
import { saveSession } from "./_roundsStore.js";

const COOKIE = "rounds_sid";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password required" });

  let session;
  try {
    session = await loginSession({ username, password });
  } catch (err) {
    // Don't leak whether it was a bad password vs. a flow change to callers.
    console.error("rounds-login failed:", err.message);
    return res.status(401).json({ error: "Suntree login failed — check your username and password." });
  }

  const id = await saveSession(session.cookieHeader());
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${id}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${12 * 60 * 60}`
  );
  return res.status(200).json({ ok: true });
}
