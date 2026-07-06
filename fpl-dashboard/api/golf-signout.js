// POST /api/golf-signout — expire the golf_session cookie.
import { clearedSessionCookie } from "./_golf.js";

export default function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  res.setHeader("Set-Cookie", clearedSessionCookie());
  return res.status(200).json({ ok: true });
}
