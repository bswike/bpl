// Shared GHIN client: logs in and fetches a golfer's scores. Used by the
// interactive /api/ghin handler and the background sync cron.
const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";

/** Live peer/background GHIN calls (refresh, lookup, search, cron, enrichment). */
export function isGhinLiveEnabled() {
  const v = String(process.env.GHIN_LIVE || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export const GHIN_LIVE_OFF_MSG =
  "Live GHIN lookups are paused — showing published scores only.";

function ghinSignInBlocklist() {
  const raw = process.env.GHIN_SIGNIN_BLOCKLIST || "11514629";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function ghinSignInBlockedEmails() {
  const raw = process.env.GHIN_SIGNIN_BLOCKED_EMAILS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isGhinSignInBlocked(ghin) {
  const g = String(ghin || "").trim();
  return g && ghinSignInBlocklist().has(g);
}

export function isGhinSignInEmailBlocked(email) {
  const e = String(email || "").trim().toLowerCase();
  return e && ghinSignInBlockedEmails().has(e);
}

export const GHIN_SIGNIN_BLOCKED_MSG =
  "GHIN sign-in is paused for this account. Use saved scores or upload a JSON export.";

async function getFirebaseSessionToken() {
  try {
    const res = await fetch(
      "https://firebaseinstallations.googleapis.com/v1/projects/ghin-mobile-app/installations",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": "AIzaSyBxgTOAWxiud0HuaE5tN-5NTlzFnrtyz-I",
        },
        body: JSON.stringify({
          appId: "1:884417644529:web:47fb315bc6c70242f72650",
          authVersion: "FIS_v2",
          fid: "fg6JfS0U01YmrelthLX9Iz",
          sdkVersion: "w:0.5.7",
        }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.authToken?.token ?? null;
  } catch {
    return null;
  }
}

function extractGolferIdFromObject(obj) {
  if (!obj || typeof obj !== "object") return null;
  const candidates = [
    obj.ghin_number,
    obj.ghin,
    obj.golfer_id,
    obj.id,
    obj.golfer?.ghin_number,
    obj.golfer?.ghin,
    obj.golfer?.golfer_id,
  ];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    const s = String(c).trim();
    if (/^\d+$/.test(s)) return s;
  }
  return null;
}

async function loginToGhin(username, password, sessionToken) {
  const loginRes = await fetch(`${API_BASE}/golfer_login.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { email_or_ghin: username, password, remember_me: true },
      token: sessionToken,
    }),
  });

  if (loginRes.ok) {
    const data = await loginRes.json();
    const token = data?.golfer_user?.golfer_user_token ?? data?.token;
    if (token) {
      const hint =
        extractGolferIdFromObject(data.golfer_user) ??
        extractGolferIdFromObject(data);
      return { token, golferIdHint: hint };
    }
  }

  const loginRes2 = await fetch(`${API_BASE}/users/login.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: { email: username, password },
      token: sessionToken,
    }),
  });

  if (!loginRes2.ok) {
    throw new Error("Invalid credentials. Check your email and password.");
  }

  const data2 = await loginRes2.json();
  if (!data2.token) throw new Error("Login succeeded but no token returned.");
  const hint =
    extractGolferIdFromObject(data2.user) ?? extractGolferIdFromObject(data2);
  return { token: data2.token, golferIdHint: hint };
}

async function fetchGolfer(token, ghinNumber) {
  const params = new URLSearchParams({
    golfer_id: ghinNumber,
    source: SOURCE,
    from_ghin: "true",
    per_page: "1",
    page: "1",
  });
  const res = await fetch(`${API_BASE}/golfers.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.golfers?.[0] ?? null;
}

async function fetchGolferIdByEmail(token, email) {
  const params = new URLSearchParams({
    source: SOURCE,
    page: "1",
    per_page: "100",
    sorting_criteria: "last_name_first_name",
    status: "Active",
    order: "asc",
    email: email.trim(),
  });
  const res = await fetch(`${API_BASE}/golfers/search.json?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return { golfers: [] };
  const data = await res.json();
  return { golfers: data?.golfers ?? [] };
}

async function fetchGolferIdsFromAccesses(token) {
  const res = await fetch(`${API_BASE}/users/accesses.json`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const raw = data?.gpa_accesses ?? data?.accesses ?? [];
  return Array.isArray(raw) ? raw : [];
}

async function resolveGolferId(token, email, explicitGhin, golferIdHint) {
  const manual = explicitGhin?.trim() || "";
  if (manual) {
    if (!/^\d+$/.test(manual)) {
      throw new Error("GHIN number should contain digits only.");
    }
    return manual;
  }
  if (golferIdHint) return golferIdHint;

  const { golfers } = await fetchGolferIdByEmail(token, email);
  if (golfers.length === 1 && golfers[0].ghin != null) {
    return String(golfers[0].ghin);
  }
  if (golfers.length > 1) {
    throw new Error(
      "Multiple golfers match this email. Enter your GHIN number in the optional field."
    );
  }

  const accesses = await fetchGolferIdsFromAccesses(token);
  const ids = accesses
    .map((a) => a?.golfer_id)
    .filter((id) => id != null && String(id).match(/^\d+$/));
  if (ids.length === 1) return String(ids[0]);
  if (ids.length > 1) {
    throw new Error(
      "Multiple golfers on this account. Enter the GHIN number for the golfer you want."
    );
  }

  throw new Error(
    "Could not find your GHIN number automatically. Enter it in the optional field below."
  );
}

async function fetchAllScores(token, golferId) {
  const allScores = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const params = new URLSearchParams({
      golfer_id: golferId,
      source: SOURCE,
      limit: String(limit),
      offset: String(offset),
    });
    const res = await fetch(`${API_BASE}/scores.json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) break;
    const data = await res.json();
    const scores = data?.scores ?? [];
    allScores.push(...scores);
    if (scores.length < limit || allScores.length > 5000) break;
    offset += limit;
  }
  return allScores;
}

// GHIN redacts bulk score history for golfers outside your own club: rows
// arrive with no course name/id and truncated played_at dates ("2026-07").
// Some rows keep a display name but still have a truncated date. The
// single-score endpoint returns those same rounds in full, so hydrate
// them one by one (newest first, bounded). Best-effort.
const isRedacted = (s) =>
  !s.course_name &&
  !s.facility_name &&
  !s.course_display_value &&
  !s.ghin_course_name_display;

const hasTruncatedDate = (s) => {
  const d = String(s?.played_at || "");
  return d.length > 0 && d.length < 10;
};

export async function hydrateRedactedScores(
  token,
  scores,
  { max = 300, concurrency = 8 } = {}
) {
  const targets = scores
    .filter((s) => s && s.id != null && (isRedacted(s) || hasTruncatedDate(s)))
    .slice(0, max);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
      while (i < targets.length) {
        const s = targets[i++];
        try {
          const res = await fetch(
            `${API_BASE}/scores/${s.id}.json?source=${SOURCE}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          if (!res.ok) continue;
          const full = (await res.json())?.scores;
          if (full && String(full.id) === String(s.id)) {
            for (const [k, v] of Object.entries(full)) {
              if (v != null) s[k] = v;
            }
          }
        } catch {
          /* leave the redacted row as-is */
        }
      }
    })
  );
}

// Course names and yardage live on the course record, not reliably on scores
// (peer score histories often omit course/facility names entirely). Fetch
// details for each unique course played, then stamp missing names and a
// `tee_yardage` onto every score, respecting nine-hole sides (F9/B9).
// Best-effort: failures just mean that course keeps whatever the score had.
// Course data barely changes, so keep a warm-instance cache across requests.
const courseCache = new Map(); // courseId -> { courseName, facilityName, tees, teeSets }
const teeSetCache = new Map(); // teeSetId -> { total, front, back } | null

function teeYardsFromHoles(holes, totalYardage) {
  const list = Array.isArray(holes) ? holes : [];
  const sum = (from, to) =>
    list
      .filter((h) => h.Number >= from && h.Number <= to)
      .reduce((acc, h) => acc + (h.Length || 0), 0);
  return {
    total: totalYardage || sum(1, 18) || null,
    front: sum(1, 9) || null,
    back: sum(10, 18) || null,
  };
}

function yardsForSide(y, side) {
  if (!y) return null;
  const s = String(side || "")
    .toUpperCase()
    .replace(/\s+/g, "");
  if (s === "F9" || s === "FRONT9") return y.front || y.total;
  if (s === "B9" || s === "BACK9") return y.back || y.total;
  return y.total;
}

function stampYardage(score, yards) {
  const y = yardsForSide(yards, score.tee_set_side);
  if (y) score.tee_yardage = y;
}

function indexTeeSet(tees, ts) {
  const y = teeYardsFromHoles(ts.Holes, ts.TotalYardage);
  tees[String(ts.TeeSetRatingId)] = y;
  if (ts.LegacyCRPTeeId != null) tees[String(ts.LegacyCRPTeeId)] = y;
}

function matchTeeSet(teeSets, score) {
  const teeId = score.tee_set_id != null ? String(score.tee_set_id) : null;
  const teeName = String(score.tee_name || "")
    .toUpperCase()
    .trim();
  const cr = score.course_rating != null ? Number(score.course_rating) : null;
  const slope = score.slope_rating != null ? Number(score.slope_rating) : null;

  for (const ts of teeSets) {
    if (
      teeId &&
      (String(ts.TeeSetRatingId) === teeId ||
        String(ts.LegacyCRPTeeId) === teeId)
    ) {
      return teeYardsFromHoles(ts.Holes, ts.TotalYardage);
    }
  }
  if (teeName) {
    for (const ts of teeSets) {
      const name = String(ts.TeeSetRatingName || "").toUpperCase();
      if (name === teeName || name.includes(teeName) || teeName.includes(name)) {
        return teeYardsFromHoles(ts.Holes, ts.TotalYardage);
      }
    }
  }
  if (cr != null && slope != null) {
    for (const ts of teeSets) {
      const ratings = Array.isArray(ts.Ratings) ? ts.Ratings : [];
      if (
        ratings.some(
          (r) =>
            Math.abs(Number(r.CourseRating) - cr) < 0.15 &&
            Number(r.SlopeRating) === slope
        )
      ) {
        return teeYardsFromHoles(ts.Holes, ts.TotalYardage);
      }
    }
  }
  return null;
}

async function fetchCourseDetails(token, courseId) {
  const params = new URLSearchParams({ course_id: courseId, source: SOURCE });
  const res = await fetch(
    `${API_BASE}/crsCourseMethods.asmx/GetCourseDetails.json?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const tees = {};
  const teeSets = Array.isArray(data?.TeeSets) ? data.TeeSets : [];
  for (const ts of teeSets) indexTeeSet(tees, ts);
  return {
    courseName: data?.CourseName || null,
    facilityName: data?.Facility?.FacilityName || null,
    tees,
    teeSets,
  };
}

async function fetchTeeSetYardage(token, teeSetId) {
  const key = String(teeSetId);
  if (teeSetCache.has(key)) return teeSetCache.get(key);
  const params = new URLSearchParams({
    source: SOURCE,
    include_altered_tees: "true",
  });
  try {
    const res = await fetch(`${API_BASE}/TeeSetRatings/${key}.json?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      teeSetCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const y = teeYardsFromHoles(data?.Holes, data?.TotalYardage);
    teeSetCache.set(key, y);
    return y;
  } catch {
    teeSetCache.set(key, null);
    return null;
  }
}

export async function attachCourseData(token, scores, { maxCourses = 100 } = {}) {
  // Scores arrive newest-first, so the cap keeps recently played courses.
  const courseIds = [
    ...new Set(scores.map((s) => s.course_id).filter(Boolean).map(String)),
  ].slice(0, maxCourses);
  const toFetch = courseIds.filter((id) => !courseCache.has(id));
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(5, toFetch.length) }, async () => {
      while (i < toFetch.length) {
        const courseId = toFetch[i++];
        try {
          const details = await fetchCourseDetails(token, courseId);
          if (details) courseCache.set(courseId, details);
        } catch {
          /* course data is a nice-to-have */
        }
      }
    })
  );

  const needDirect = [];
  for (const s of scores) {
    const info = courseCache.get(String(s.course_id));
    if (info) {
      if (!s.course_name && info.courseName) s.course_name = info.courseName;
      if (!s.facility_name && info.facilityName)
        s.facility_name = info.facilityName;
      const byId = info.tees[String(s.tee_set_id)];
      const yards = byId || matchTeeSet(info.teeSets, s);
      if (yards) stampYardage(s, yards);
    }
    if (!s.tee_yardage && s.tee_set_id != null) needDirect.push(s);
  }

  const teeIds = [
    ...new Set(needDirect.map((s) => String(s.tee_set_id))),
  ].slice(0, 120);
  let j = 0;
  await Promise.all(
    Array.from({ length: Math.min(6, teeIds.length) }, async () => {
      while (j < teeIds.length) {
        const teeSetId = teeIds[j++];
        const yards = await fetchTeeSetYardage(token, teeSetId);
        if (!yards) continue;
        for (const s of needDirect) {
          if (String(s.tee_set_id) === teeSetId && !s.tee_yardage) {
            stampYardage(s, yards);
          }
        }
      }
    })
  );
}

/** Full login + fetch. Returns the shape /api/ghin and the cron both need. */
export async function fetchGhinData({ email, password, ghinNumber }) {
  const explicit = String(ghinNumber || "").trim();
  if (isGhinSignInBlocked(explicit) || isGhinSignInEmailBlocked(email)) {
    throw new Error(GHIN_SIGNIN_BLOCKED_MSG);
  }
  const sessionToken = await getFirebaseSessionToken();
  const { token, golferIdHint } = await loginToGhin(email, password, sessionToken);
  const resolvedId = await resolveGolferId(token, email, ghinNumber, golferIdHint);
  if (isGhinSignInBlocked(resolvedId)) {
    throw new Error(GHIN_SIGNIN_BLOCKED_MSG);
  }
  const golferInfo = await fetchGolfer(token, resolvedId);
  const scores = await fetchAllScores(token, resolvedId);
  if (isGhinLiveEnabled()) {
    await attachCourseData(token, scores);
  }

  return {
    token,
    resolvedId,
    golfer: golferInfo
      ? {
          first_name: golferInfo.first_name,
          last_name: golferInfo.last_name,
          ghin_number: golferInfo.ghin_number ?? resolvedId,
          handicap_index: golferInfo.handicap_index,
          club_name: golferInfo.club_name,
        }
      : { ghin_number: resolvedId },
    scores,
  };
}
