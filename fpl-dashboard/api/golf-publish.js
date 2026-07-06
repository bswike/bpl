// POST   /api/golf-publish — publish your export to the public feed
// DELETE /api/golf-publish — remove yourself from the public feed
// Both require the golf_session cookie set by a successful /api/ghin login,
// and only act on the GHIN number that cookie was issued for.
import { sessionFromReq, publishGolfer, unpublishGolfer } from "./_golf.js";

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const ghin = sessionFromReq(req);
  if (!ghin) {
    return res.status(401).json({
      error: "Sign in with your GHIN account first (file uploads can't publish).",
    });
  }

  try {
    if (req.method === "POST") {
      const data = req.body?.data;
      if (!data?.scores?.length) {
        return res.status(400).json({ error: "No scores to publish." });
      }
      if (String(data.golfer?.ghin_number ?? "") !== ghin) {
        return res.status(403).json({ error: "You can only publish your own scores." });
      }
      await publishGolfer(data);
      return res.status(200).json({ published: true });
    }

    if (req.method === "DELETE") {
      await unpublishGolfer(ghin);
      return res.status(200).json({ published: false });
    }

    return res.status(405).json({ error: "POST or DELETE only" });
  } catch (err) {
    console.error("golf-publish error:", err);
    return res.status(500).json({ error: err.message || "Publish failed" });
  }
}
