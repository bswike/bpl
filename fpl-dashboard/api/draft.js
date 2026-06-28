// api/draft.js  (ESM)
// Persists user-built draft brackets as JSON in Vercel Blob.
//   POST   /api/draft            -> save a bracket (pass id to overwrite), { id }
//   GET    /api/draft            -> list all saved brackets (summaries)
//   GET    /api/draft?id=<id>    -> fetch one full bracket
//   DELETE /api/draft?id=<id>    -> delete one saved bracket
import { put, list, del } from "@vercel/blob";

const PREFIX = "drafts/";
const MAX_LIST = 200;
const ID_RE = /^[a-z0-9]{1,40}$/;

function makeId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

// Light validation / normalization of an incoming bracket payload.
// A bracket is a set of match picks: { "<matchNo>": "<teamCanon>" } for the
// World Cup knockout matches (73-104), plus a champion display name.
function normalizeBracket(body) {
  const name = String(body?.name || "").trim().slice(0, 60);
  const rawPicks = body?.picks && typeof body.picks === "object" ? body.picks : {};
  const picks = {};
  for (const [k, v] of Object.entries(rawPicks)) {
    const no = Number(k);
    if (!Number.isInteger(no) || no < 73 || no > 104) continue;
    if (v == null) continue;
    const canon = String(v).trim().slice(0, 40);
    if (canon) picks[no] = canon;
  }
  const champion =
    body?.champion == null ? null : String(body.champion).trim().slice(0, 40) || null;
  return { name, picks, champion };
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
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

      // Overwrite an existing bracket when a valid id is supplied (editing),
      // otherwise create a new one.
      const editing = body?.id && ID_RE.test(String(body.id));
      const id = editing ? String(body.id) : makeId();
      const record = {
        id,
        name: norm.name,
        champion: norm.champion,
        picks: norm.picks,
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

    if (req.method === "DELETE") {
      const id = req.query?.id ? String(req.query.id) : null;
      if (!id || !ID_RE.test(id)) {
        return res.status(400).json({ error: "A valid id is required." });
      }
      const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
      const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
      if (blob) await del(blob.url);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ deleted: true });
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
