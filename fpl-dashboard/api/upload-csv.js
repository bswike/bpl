import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    // CORS/preflight support (handy if you ever call from browser)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST with text/csv body" });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Blob not connected. In Vercel: Storage → Blob → Projects → Connect this project.",
      });
    }

    const name = (req.query?.name && String(req.query.name)) || "fpl_latest.csv";

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const csvBuffer = Buffer.concat(chunks);
    if (!csvBuffer.length) return res.status(400).json({ error: "Empty body" });

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
