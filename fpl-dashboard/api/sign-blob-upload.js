// api/upload-csv.js
import { put } from "@vercel/blob";

/**
 * POST /api/upload-csv?name=fpl_latest.csv
 * Body: raw CSV (text/csv)
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST with text/csv body" });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Missing Blob credentials. In Vercel: Storage → Blob → Projects → Connect this project.",
      });
    }

    // Decide filename (stable by default)
    const name = (req.query?.name && String(req.query.name)) || "fpl_rosters_points_gw1.csv";

    // Read the raw request body as text (CSV)
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const csvBuffer = Buffer.concat(chunks);

    if (!csvBuffer.length) {
      return res.status(400).json({ error: "Empty body. Send raw CSV bytes." });
    }

    // Upload to Blob (public, stable URL)
    const { url } = await put(name, csvBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/csv",
    });

    return res.status(200).json({ wrote: url, bytes: csvBuffer.length });
  } catch (err) {
    console.error("upload-csv error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
