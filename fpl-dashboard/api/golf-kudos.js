// GET  /api/golf-kudos — all kudos: { kudos: { [roundId]: [{ghin, name}] } }
// POST /api/golf-kudos — give/remove kudos on a round (requires golf_session
// cookie from a GHIN sign-in; the giver's name is shown publicly).
import { sessionFromReq, readAllKudos, setKudos } from "./_golf.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=120");
      return res.status(200).json({ kudos: await readAllKudos() });
    }

    if (req.method === "POST") {
      const ghin = sessionFromReq(req);
      if (!ghin) {
        return res
          .status(401)
          .json({ error: "Sign in with your GHIN account to give kudos." });
      }
      const { roundId, give, name } = req.body || {};
      if (roundId == null || typeof give !== "boolean") {
        return res.status(400).json({ error: "roundId and give are required." });
      }
      await setKudos(ghin, roundId, give, name);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "GET or POST only" });
  } catch (err) {
    console.error("golf-kudos error:", err);
    return res.status(500).json({ error: err.message || "Kudos failed" });
  }
}
