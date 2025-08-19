import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed. Use GET." });
    }

    // If Blob isn’t connected to the project yet, this will be undefined
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Missing Blob credentials. In Vercel, go to Project → Storage → select your Blob → Projects → Connect this project.",
      });
    }

    // Stable filename keeps a stable public URL
    const filename = (req.query?.name) || "fpl_rosters_points_gw1.csv";

    // Create/overwrite and return the public URL
    const { url } = await put(filename, "", {
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