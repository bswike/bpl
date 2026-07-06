// GET /api/golf-feed — all published golfer exports (newest publish first)
// plus the public kudos map, so the client loads the feed in one request.
import { list } from "@vercel/blob";
import { GOLFERS_PREFIX, readAllKudos } from "./_golf.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  try {
    const kudosPromise = readAllKudos().catch(() => ({}));
    const { blobs } = await list({ prefix: GOLFERS_PREFIX, limit: 100 });
    const golfers = (
      await Promise.all(
        blobs.map(async (b) => {
          try {
            // uploadedAt in the query string busts the blob CDN cache after republish
            const r = await fetch(`${b.url}?v=${Date.parse(b.uploadedAt) || 0}`);
            return r.ok ? await r.json() : null;
          } catch {
            return null;
          }
        })
      )
    ).filter((g) => g?.golfer?.ghin_number && g?.scores?.length);

    golfers.sort((a, b) =>
      String(b.published_at || "").localeCompare(String(a.published_at || ""))
    );

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    return res.status(200).json({ golfers, kudos: await kudosPromise });
  } catch (err) {
    console.error("golf-feed error:", err);
    return res.status(500).json({ error: "Could not load feed" });
  }
}
