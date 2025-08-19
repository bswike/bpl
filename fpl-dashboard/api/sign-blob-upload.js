import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Use GET" });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Blob not connected. In Vercel → Storage → Blob → Projects → Connect this project (Prod + Preview).",
      });
    }

    // Stable filename so your public URL never changes
    const name = (req.query?.name && String(req.query.name)) || "fpl_latest.csv";

    // IMPORTANT: give put() a real (even empty) body
    const emptyBody = Buffer.alloc(0); // Node global Buffer works in serverless functions

    const { url } = await put(name, emptyBody, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/csv",
      // cache control optional:
      // cacheControlMaxAge: 10,
    });

    return res.status(200).json({ uploadUrl: url });
  } catch (err) {
    console.error("sign-blob-upload error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
