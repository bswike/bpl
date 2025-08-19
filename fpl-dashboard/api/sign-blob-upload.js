// api/sign-blob-upload.js  (ESM)
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });
    if (!process.env.BLOB_READ_WRITE_TOKEN)
      return res.status(500).json({ error: "Blob not connected to this project" });

    const name = (req.query?.name && String(req.query.name)) || "fpl_latest.csv";

    // Give a real body (non-empty) and allow overwrites
    const { url } = await put(name, "init", {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,       // <-- important
      contentType: "text/csv",
    });

    return res.status(200).json({ uploadUrl: url });
  } catch (e) {
    console.error("sign-blob-upload error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
