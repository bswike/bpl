import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Use GET" });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Blob not connected. In Vercel: Storage → Blob → Projects → Connect this project.",
      });
    }

    // Stable name so the public URL never changes
    const name = (req.query?.name && String(req.query.name)) || "fpl_latest.csv";

    // Create/overwrite zero-length object to get/confirm the public URL
    const { url } = await put(name, "", {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/csv",
    });

    return res.status(200).json({ uploadUrl: url });
  } catch (err) {
    console.error("sign-blob-upload error:", err);
    return res.status(500).json({ error: String(err?.message || err) });
  }
}
