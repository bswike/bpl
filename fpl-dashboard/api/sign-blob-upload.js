import { put } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    // Stable filename — the Blob URL will stay the same
    const filename = "fpl_rosters_points_gw1.csv";

    // Create or overwrite the blob (empty body just creates signed URL)
    const { url } = await put(filename, Buffer.alloc(0), {
      access: "public",           // make it publicly readable
      addRandomSuffix: false,     // keep filename stable
      contentType: "text/csv",
    });

    res.status(200).json({ uploadUrl: url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to sign upload" });
  }
}
