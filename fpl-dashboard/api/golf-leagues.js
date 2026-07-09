// /api/golf-leagues — private mini-leagues (golf trips, groups).
// v1 is owner-only: leagues live under the owner's GHIN and every action
// requires their signed golf_session cookie, so a league is invisible to
// everyone but its creator. Member round data never passes through here —
// the client loads it live with the owner's own GHIN token.
//
//   GET            → { leagues: [...] } (mine only)
//   POST create    → { action: "create", name, start?, end?, members? }
//   POST update    → { action: "update", id, name?, start?, end?,
//                      addMembers?: [{ghin,...}], removeGhins?: [...] }
//   DELETE         → { id }
import { randomUUID } from "node:crypto";
import { put, list, del } from "@vercel/blob";
import { sessionFromReq } from "./_golf.js";

const PREFIX = "golf/leagues/";
const MAX_LEAGUES = 20;
const MAX_MEMBERS = 40;

const leaguePath = (ghin, id) => `${PREFIX}${ghin}/${id}.json`;

function cleanMember(m) {
  const ghin = String(m?.ghin ?? "").replace(/[^0-9]/g, "");
  if (!ghin) return null;
  const out = {
    ghin,
    first_name: String(m.first_name || "").slice(0, 40),
    last_name: String(m.last_name || "").slice(0, 40),
    club_name: m.club_name ? String(m.club_name).slice(0, 80) : null,
  };
  if (m.team === "a" || m.team === "b") out.team = m.team;
  return out;
}

// Trip mode: exactly two named teams. Returns undefined when input is
// malformed (leave unchanged), null to clear, or {a,b} to set.
function cleanTeams(v) {
  if (v === null) return null;
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const name = (t, i) =>
    String(t?.name || "").trim().slice(0, 30) || `Team ${i + 1}`;
  return { a: { name: name(v[0], 0) }, b: { name: name(v[1], 1) } };
}

const cleanDate = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : null;

async function readLeague(ghin, id) {
  const { blobs } = await list({ prefix: leaguePath(ghin, id) });
  if (!blobs[0]) return null;
  try {
    const r = await fetch(
      `${blobs[0].url}?v=${Date.parse(blobs[0].uploadedAt) || 0}`
    );
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

async function writeLeague(league) {
  await put(leaguePath(league.owner, league.id), JSON.stringify(league), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 0,
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();

  const ghin = sessionFromReq(req);
  if (!ghin) {
    return res.status(401).json({ error: "Sign in to manage leagues." });
  }
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      const { blobs } = await list({ prefix: `${PREFIX}${ghin}/`, limit: 100 });
      const leagues = (
        await Promise.all(
          blobs.map(async (b) => {
            try {
              const r = await fetch(
                `${b.url}?v=${Date.parse(b.uploadedAt) || 0}`
              );
              return r.ok ? await r.json() : null;
            } catch {
              return null;
            }
          })
        )
      )
        .filter((l) => l?.id)
        .sort((a, b) =>
          String(b.created_at || "").localeCompare(String(a.created_at || ""))
        );
      return res.status(200).json({ leagues });
    }

    if (req.method === "POST") {
      const body = req.body || {};

      if (body.action === "create") {
        const name = String(body.name || "").trim().slice(0, 60);
        if (!name) return res.status(400).json({ error: "Give the league a name." });
        const { blobs } = await list({ prefix: `${PREFIX}${ghin}/`, limit: 100 });
        if (blobs.length >= MAX_LEAGUES) {
          return res.status(400).json({ error: `Max ${MAX_LEAGUES} leagues.` });
        }
        const members = (Array.isArray(body.members) ? body.members : [])
          .map(cleanMember)
          .filter(Boolean)
          .slice(0, MAX_MEMBERS);
        const league = {
          id: randomUUID().slice(0, 8),
          owner: ghin,
          name,
          start: cleanDate(body.start),
          end: cleanDate(body.end),
          members,
          created_at: new Date().toISOString(),
        };
        const teams = cleanTeams(body.teams);
        if (teams) league.teams = teams;
        await writeLeague(league);
        return res.status(200).json({ league });
      }

      if (body.action === "update") {
        const league = await readLeague(ghin, String(body.id || ""));
        if (!league) return res.status(404).json({ error: "League not found." });
        if (body.name !== undefined) {
          const name = String(body.name || "").trim().slice(0, 60);
          if (name) league.name = name;
        }
        if (body.start !== undefined) league.start = cleanDate(body.start);
        if (body.end !== undefined) league.end = cleanDate(body.end);
        if (Array.isArray(body.addMembers)) {
          const have = new Set(league.members.map((m) => m.ghin));
          for (const raw of body.addMembers) {
            const m = cleanMember(raw);
            if (m && !have.has(m.ghin) && league.members.length < MAX_MEMBERS) {
              league.members.push(m);
              have.add(m.ghin);
            }
          }
        }
        if (Array.isArray(body.removeGhins)) {
          const drop = new Set(body.removeGhins.map((g) => String(g)));
          league.members = league.members.filter((m) => !drop.has(m.ghin));
        }
        if (body.teams !== undefined) {
          const t = cleanTeams(body.teams);
          if (t === null) {
            delete league.teams;
            for (const m of league.members) delete m.team;
          } else if (t) {
            league.teams = t;
          }
        }
        if (body.assignments && typeof body.assignments === "object") {
          for (const m of league.members) {
            if (!(m.ghin in body.assignments)) continue;
            const a = body.assignments[m.ghin];
            if (a === "a" || a === "b") m.team = a;
            else delete m.team;
          }
        }
        await writeLeague(league);
        return res.status(200).json({ league });
      }

      return res.status(400).json({ error: "Unknown action." });
    }

    if (req.method === "DELETE") {
      const id = String(req.body?.id || "");
      if (!id) return res.status(400).json({ error: "Missing league id." });
      const { blobs } = await list({ prefix: leaguePath(ghin, id) });
      await Promise.all(blobs.map((b) => del(b.url)));
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: "Unsupported method" });
  } catch (err) {
    console.error("golf-leagues error:", err);
    return res.status(500).json({ error: "League operation failed. Try again." });
  }
}
