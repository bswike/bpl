// api/draft.js  (ESM)
// Persists user-built draft brackets as JSON in Vercel Blob.
//   POST /api/draft           -> save a bracket, returns { id }
//   GET  /api/draft           -> list all saved brackets (summaries)
//   GET  /api/draft?id=<id>   -> fetch one full bracket
import { put, list } from "@vercel/blob";

const PREFIX = "drafts/";
const MAX_LIST = 200;

function makeId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

// Light validation / normalization of an incoming bracket payload.
function normalizeBracket(body) {
  const name = String(body?.name || "").trim().slice(0, 60);
  const b = body?.bracket || {};
  const rounds = Array.isArray(b.rounds) ? b.rounds : null;
  // rounds must be [32,16,8,4,2,1] arrays of strings/null
  const SIZES = [32, 16, 8, 4, 2, 1];
  if (!rounds || rounds.length !== 6) return null;
  const clean = SIZES.map((size, lvl) => {
    const arr = Array.isArray(rounds[lvl]) ? rounds[lvl] : [];
    const out = [];
    for (let i = 0; i < size; i++) {
      const v = arr[i];
      out.push(v == null ? null : String(v).trim().slice(0, 40) || null);
    }
    return out;
  });
  const third = {
    winner:
      b.third?.winner == null
        ? null
        : String(b.third.winner).trim().slice(0, 40) || null,
  };
  const champion = clean[5][0] || null;
  return { name, bracket: { rounds: clean, third }, champion };
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Storage not connected." });
  }

  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body) return res.status(400).json({ error: "Invalid JSON body." });
      const norm = normalizeBracket(body);
      if (!norm) return res.status(400).json({ error: "Invalid bracket shape." });
      if (!norm.name) return res.status(400).json({ error: "A name is required." });

      const id = makeId();
      const record = {
        id,
        name: norm.name,
        champion: norm.champion,
        bracket: norm.bracket,
        createdAt: new Date().toISOString(),
      };
      await put(`${PREFIX}${id}.json`, JSON.stringify(record), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ id });
    }

    if (req.method === "GET") {
      const id = req.query?.id ? String(req.query.id) : null;

      if (id) {
        const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
        const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
        if (!blob) return res.status(404).json({ error: "Not found." });
        const r = await fetch(blob.url, { cache: "no-store" });
        const json = await r.json();
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(json);
      }

      // List summaries (no full rounds) for the gallery.
      const { blobs } = await list({ prefix: PREFIX, limit: MAX_LIST });
      const records = await Promise.all(
        blobs.map(async (b) => {
          try {
            const r = await fetch(b.url, { cache: "no-store" });
            const j = await r.json();
            return {
              id: j.id,
              name: j.name,
              champion: j.champion || null,
              createdAt: j.createdAt || b.uploadedAt,
            };
          } catch {
            return null;
          }
        })
      );
      const summaries = records
        .filter(Boolean)
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ brackets: summaries });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    console.error("draft api error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
