// api/upload-csv.js  (ESM)
import { put } from "@vercel/blob";

export default async function handler(req, res) {
  // Set CORS headers to allow requests from any origin
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-vercel-filename"); // Allow the custom header

  // Respond to preflight requests
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed. Use POST." });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({ error: "Blob storage is not connected to this project." });
    }

    // --- FIX ---
    // Read the desired filename from the 'x-vercel-filename' header
    // sent by the Python script. Fallback to a default name if not provided.
    const name = req.headers['x-vercel-filename'] || "default_upload.csv";
    const contentType = req.headers['content-type'] || 'text/plain';

    // Read the raw body from the request
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    if (!body.length) {
      return res.status(400).json({ error: "Request body cannot be empty." });
    }

    // Upload the file to Vercel Blob storage
    const { url } = await put(name, body, {
      access: "public",
      contentType,
      addRandomSuffix: false, // Ensure the filename is exactly as specified
      allowOverwrite: true,   // Allow overwriting files like latest_urls.json
    });

    return res.status(200).json({ url });
  } catch (e) {
    console.error("upload-csv error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: errorMessage });
  }
}
