// api/draft.js  (ESM)
// Persists user-built draft brackets as JSON in Vercel Blob, each protected by
// its OWN password. Before the reveal time (Mon 1:00 PM EDT) a bracket can only
// be viewed/edited by someone who knows its password; after the reveal time the
// picks become publicly viewable (edits/deletes still need the password).
//   POST   /api/draft            -> create (needs password) or edit (needs id+password)
//   GET    /api/draft            -> list summaries (champion hidden until reveal)
//   GET    /api/draft?id=<id>    -> fetch one (password via x-draft-password until reveal)
//   DELETE /api/draft?id=<id>    -> delete one (password via x-draft-password)
import { put, list, del } from "@vercel/blob";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PREFIX = "drafts/";
const MAX_LIST = 200;
const ID_RE = /^[a-z0-9]{1,40}$/;

// Reveal: Monday June 29, 2026 at 1:00 PM EDT (= 17:00 UTC).
const REVEAL_AT = Date.UTC(2026, 5, 29, 17, 0, 0);
const REVEAL_ISO = new Date(REVEAL_AT).toISOString();
const isRevealed = () => Date.now() >= REVEAL_AT;

// Master password that can delete any bracket.
const ADMIN_PASSWORD = process.env.DRAFT_ADMIN_PASSWORD || "admin123";

function makeId() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toLowerCase();
}

function makeAuth(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(String(password), salt, 32).toString("hex");
  return { salt, hash };
}

// Legacy brackets saved before passwords existed have no `auth` — treat them as
// unprotected so the owner can open them and re-save to set a password.
function verifyAuth(password, auth) {
  if (!auth || !auth.salt || !auth.hash) return true;
  if (password == null || password === "") return false;
  const hash = scryptSync(String(password), auth.salt, 32).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(auth.hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- Standings scoring -----------------------------------------------------
// Points awarded for correctly picking the winner of a knockout match.
const ROUND_POINTS = { r32: 1, r16: 2, qf: 3, sf: 4, final: 5 };
// The Sunday 6/28 game is treated like a play-in and does NOT count (the league
// officially starts at Monday 1pm). Third place (round "third") never counts.
const EXCLUDED_DATES = new Set(["2026-06-28"]);

async function fetchFootie(req) {
  try {
    const proto = req.headers?.["x-forwarded-proto"] || "https";
    const host = req.headers?.host;
    if (!host) return null;
    const r = await fetch(`${proto}://${host}/api/footie`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Total goals scored by each team across counted knockout games (tiebreaker).
function goalsByTeamFrom(footie) {
  const goals = {};
  for (const m of footie?.bracket || []) {
    if (EXCLUDED_DATES.has(m.date)) continue;
    if (!m.state || m.state === "pre") continue;
    const h = m.home?.canon;
    const a = m.away?.canon;
    if (h && m.homeScore != null) goals[h] = (goals[h] || 0) + Number(m.homeScore || 0);
    if (a && m.awayScore != null) goals[a] = (goals[a] || 0) + Number(m.awayScore || 0);
  }
  return goals;
}

// Teams knocked out of the real tournament (losers of any decided match).
function eliminatedFrom(footie) {
  const out = new Set();
  for (const m of footie?.bracket || []) {
    if (!m.winnerCanon) continue;
    const h = m.home?.canon;
    const a = m.away?.canon;
    if (h && h !== m.winnerCanon) out.add(h);
    if (a && a !== m.winnerCanon) out.add(a);
  }
  return out;
}

function scorePicks(picks, byNo, goalsByTeam, eliminated) {
  const breakdown = { r32: 0, r16: 0, qf: 0, sf: 0, final: 0 };
  let points = 0;
  let correct = 0;
  let potential = 0; // points still reachable from undecided matches
  for (const [k, pick] of Object.entries(picks || {})) {
    const m = byNo[Number(k)];
    if (!m || EXCLUDED_DATES.has(m.date)) continue;
    const pts = ROUND_POINTS[m.round];
    if (!pts) continue; // third-place / unknown rounds don't count
    if (m.winnerCanon) {
      if (pick === m.winnerCanon) {
        points += pts;
        breakdown[m.round] += pts;
        correct += 1;
      }
      // decided + wrong: those points are gone forever
    } else if (!eliminated || !eliminated.has(pick)) {
      // undecided and the picked team is still alive -> still winnable
      potential += pts;
    }
  }
  // Tiebreaker: total goals by every distinct team you selected.
  let goals = 0;
  for (const t of new Set(Object.values(picks || {}))) goals += goalsByTeam[t] || 0;
  return { points, correct, breakdown, goals, max: points + potential };
}

function passwordFrom(req, body) {
  const h = req.headers?.["x-draft-password"];
  if (h != null && h !== "") return String(h);
  if (body?.password != null) return String(body.password);
  return "";
}

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

async function loadRecord(id) {
  const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
  const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
  if (!blob) return null;
  const r = await fetch(blob.url, { cache: "no-store" });
  return await r.json();
}

async function writeRecord(record) {
  await put(`${PREFIX}${record.id}.json`, JSON.stringify(record), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-draft-password"
  );
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: "Storage not connected." });
  }

  try {
    if (req.method === "POST") {
      const body = await readJsonBody(req);
      if (!body) return res.status(400).json({ error: "Invalid JSON body." });
      const norm = normalizeBracket(body);
      if (!norm.name) return res.status(400).json({ error: "A name is required." });
      const password = passwordFrom(req, body);

      const editing = body?.id && ID_RE.test(String(body.id));
      let record;
      if (editing) {
        const existing = await loadRecord(String(body.id));
        if (!existing) return res.status(404).json({ error: "Not found." });
        if (!verifyAuth(password, existing.auth)) {
          return res.status(403).json({ error: "Wrong password for this bracket." });
        }
        record = {
          ...existing,
          name: norm.name,
          champion: norm.champion,
          picks: norm.picks,
          // Set/keep a password: adopt the supplied one (lets legacy brackets
          // get protected), otherwise keep the existing auth.
          auth: password ? makeAuth(password) : existing.auth || null,
          updatedAt: new Date().toISOString(),
        };
      } else {
        if (!password) {
          return res.status(400).json({ error: "A password is required." });
        }
        record = {
          id: makeId(),
          name: norm.name,
          champion: norm.champion,
          picks: norm.picks,
          auth: makeAuth(password),
          createdAt: new Date().toISOString(),
        };
      }
      await writeRecord(record);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ id: record.id });
    }

    if (req.method === "GET") {
      const revealed = isRevealed();
      const id = req.query?.id ? String(req.query.id) : null;

      if (id) {
        const rec = await loadRecord(id);
        if (!rec) return res.status(404).json({ error: "Not found." });
        if (!revealed) {
          const password = passwordFrom(req, null);
          if (!verifyAuth(password, rec.auth)) {
            return res
              .status(403)
              .json({ error: "This bracket is locked until the reveal.", locked: true });
          }
        }
        const { auth, ...pub } = rec; // never expose the password hash
        void auth;
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ ...pub, revealed, revealAt: REVEAL_ISO });
      }

      const [{ blobs }, footie] = await Promise.all([
        list({ prefix: PREFIX, limit: MAX_LIST }),
        fetchFootie(req),
      ]);
      const byNo = {};
      (footie?.bracket || []).forEach((m) => (byNo[m.no] = m));
      const goalsByTeam = goalsByTeamFrom(footie);
      const eliminated = eliminatedFrom(footie);
      const records = await Promise.all(
        blobs.map(async (b) => {
          try {
            const r = await fetch(b.url, { cache: "no-store" });
            const j = await r.json();
            const sc = scorePicks(j.picks || {}, byNo, goalsByTeam, eliminated);
            return {
              id: j.id,
              name: j.name,
              champion: revealed ? j.champion || null : null,
              locked: !revealed,
              createdAt: j.createdAt || b.uploadedAt,
              points: sc.points,
              correct: sc.correct,
              goals: sc.goals,
              max: sc.max,
              breakdown: sc.breakdown,
              // 31 pickable matches (73-102 + final 104); third place excluded.
              complete: Object.keys(j.picks || {}).length >= 31,
            };
          } catch {
            return null;
          }
        })
      );
      const summaries = records
        .filter(Boolean)
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.goals - a.goals ||
            String(a.name).localeCompare(String(b.name))
        );
      res.setHeader("Cache-Control", "no-store");
      return res
        .status(200)
        .json({ brackets: summaries, revealed, revealAt: REVEAL_ISO });
    }

    if (req.method === "DELETE") {
      const id = req.query?.id ? String(req.query.id) : null;
      if (!id || !ID_RE.test(id)) {
        return res.status(400).json({ error: "A valid id is required." });
      }
      const rec = await loadRecord(id);
      if (!rec) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ deleted: true });
      }
      const password = passwordFrom(req, null);
      const isAdmin = password && password === ADMIN_PASSWORD;
      if (!isAdmin && !verifyAuth(password, rec.auth)) {
        return res.status(403).json({ error: "Wrong password for this bracket." });
      }
      const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
      const blob = blobs.find((b) => b.pathname === `${PREFIX}${id}.json`);
      if (blob) await del(blob.url);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ deleted: true });
    }

    return res.status(405).json({ error: "Method not allowed." });
  } catch (e) {
    console.error("draft api error:", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
