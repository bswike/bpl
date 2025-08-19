// api/sign-blob-upload.js
const { put } = require("@vercel/blob");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed. Use GET." });
    }

    // Helpful diagnostics if Blob isn’t configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        error:
          "Missing Blob credentials. In Vercel, go to Project → Storage → Add Blob for this project.",
      });
    }

    // Optional: allow ?name=myfile.csv
    const nameFromQuery = (req.query && req.query.name) || "fpl_rosters_points_gw1.csv";

    const { url } = await put(nameFromQuery, Buffer.alloc(0), {
      access: "public",
      addRandomSuffix: false, // keep a stable URL
      contentType: "text/csv",
    });

    return res.status(200).json({ uploadUrl: url });
  } catch (err) {
    console.error("sign-blob-upload error:", err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};
