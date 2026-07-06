// Shared helpers for the golf public feed (session cookies + blob storage).
// Published golfer exports live in Vercel Blob under golf/golfers/<ghin>.json;
// existence of the blob is what makes a golfer public.
import { createHmac, timingSafeEqual } from "node:crypto";
import { put, list, del } from "@vercel/blob";

export const GOLFERS_PREFIX = "golf/golfers/";
const SESSION_COOKIE = "golf_session";
const SESSION_TTL_S = 90 * 24 * 60 * 60; // 90 days

// Blob token always exists where blob storage works, so it doubles as a
// zero-config HMAC secret; override with GOLF_SESSION_SECRET if desired.
const SECRET =
  process.env.GOLF_SESSION_SECRET ||
  process.env.BLOB_READ_WRITE_TOKEN ||
  "golf-dev-secret";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

function hmac(payload) {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

/** Signed session token proving ownership of a GHIN number. */
export function signSession(ghin) {
  const payload = b64u(
    JSON.stringify({ g: String(ghin), exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S })
  );
  return `${payload}.${hmac(payload)}`;
}

/** Returns the GHIN number for a valid token, else null. */
export function verifySession(token) {
  if (!token || !token.includes(".")) return null;
  const [payload, sig] = token.split(".");
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { g, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!g || !exp || exp < Date.now() / 1000) return null;
    return String(g);
  } catch {
    return null;
  }
}

export function sessionFromReq(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match ? verifySession(decodeURIComponent(match[1])) : null;
}

export function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_TTL_S}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

/* ---------- publishing ---------- */

const SCORE_FIELDS = [
  "id",
  "played_at",
  "number_of_holes",
  "number_of_played_holes",
  "adjusted_gross_score",
  "differential",
  "scaled_up_differential",
  "adjusted_scaled_up_differential",
  "to_par_display_value",
  "used",
  "course_name",
  "facility_name",
  "course_display_value",
  "tee_name",
  "course_rating",
  "slope_rating",
];

const HOLE_FIELDS = [
  "hole_number",
  "par",
  "raw_score",
  "adjusted_gross_score",
  "stroke_allocation",
  "x_hole",
];

const pick = (obj, fields) => {
  const out = {};
  for (const f of fields) if (obj[f] != null) out[f] = obj[f];
  return out;
};

/** Strip an export down to the fields the feed UI needs (~70% smaller). */
export function slimExport(data) {
  const g = data.golfer || {};
  return {
    golfer: {
      first_name: g.first_name,
      last_name: g.last_name,
      ghin_number: g.ghin_number,
      handicap_index: g.handicap_index,
      club_name: g.club_name,
    },
    scores: (data.scores || []).map((s) => {
      const slim = pick(s, SCORE_FIELDS);
      if (Array.isArray(s.hole_details) && s.hole_details.length) {
        slim.hole_details = s.hole_details.map((h) => pick(h, HOLE_FIELDS));
      }
      return slim;
    }),
  };
}

export function golferPath(ghin) {
  const clean = String(ghin).replace(/[^0-9]/g, "");
  if (!clean) throw new Error("Invalid GHIN number");
  return `${GOLFERS_PREFIX}${clean}.json`;
}

export async function publishGolfer(data) {
  const ghin = data?.golfer?.ghin_number;
  if (!ghin) throw new Error("Export has no GHIN number");
  if (!data?.scores?.length) throw new Error("Export has no scores");
  const body = JSON.stringify({
    ...slimExport(data),
    published_at: new Date().toISOString(),
  });
  await put(golferPath(ghin), body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

export async function unpublishGolfer(ghin) {
  const { blobs } = await list({ prefix: golferPath(ghin) });
  await Promise.all(blobs.map((b) => del(b.url)));
}
