// api/upload-csv.js  (ESM)
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST with text/csv body" });
    if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(500).json({ error: "Blob not connected" });

    const name = (req.query?.name && String(req.query.name)) || "fpl_latest.csv";

    const chunks = [];
    for await (const c of req) chunks.push(c);
    const csv = Buffer.concat(chunks);
    if (!csv.length) return res.status(400).json({ error: "Empty body" });

    const { url } = await put(name, csv, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,       // <-- important
      contentType: "text/csv",
    });

    return res.status(200).json({ wrote: url, bytes: csv.length });
  } catch (e) {
    console.error("upload-csv error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
