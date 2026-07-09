// Shared GHIN client: logs in and fetches a golfer's scores. Used by the
// interactive /api/ghin handler and the background sync cron.
const API_BASE = "https://api2.ghin.com/api/v1";
const SOURCE = "GHINcom";

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
// The single-score endpoint returns those same rounds in full, so hydrate
// redacted rows one by one (newest first, bounded). Best-effort.
const isRedacted = (s) =>
  !s.course_name &&
  !s.facility_name &&
  !s.course_display_value &&
  !s.ghin_course_name_display;

export async function hydrateRedactedScores(
  token,
  scores,
  { max = 300, concurrency = 8 } = {}
) {
  const targets = scores
    .filter((s) => s && s.id != null && isRedacted(s))
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
const courseCache = new Map(); // courseId -> { courseName, facilityName, tees }

async function fetchCourseDetails(token, courseId) {
  const params = new URLSearchParams({ course_id: courseId, source: SOURCE });
  const res = await fetch(
    `${API_BASE}/crsCourseMethods.asmx/GetCourseDetails.json?${params}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const tees = {}; // teeSetId -> { total, front, back }
  for (const ts of data?.TeeSets || []) {
    const holes = Array.isArray(ts.Holes) ? ts.Holes : [];
    const sum = (from, to) =>
      holes
        .filter((h) => h.Number >= from && h.Number <= to)
        .reduce((acc, h) => acc + (h.Length || 0), 0);
    tees[String(ts.TeeSetRatingId)] = {
      total: ts.TotalYardage || sum(1, 18) || null,
      front: sum(1, 9) || null,
      back: sum(10, 18) || null,
    };
  }
  return {
    courseName: data?.CourseName || null,
    facilityName: data?.Facility?.FacilityName || null,
    tees,
  };
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
  for (const s of scores) {
    const info = courseCache.get(String(s.course_id));
    if (!info) continue;
    if (!s.course_name && info.courseName) s.course_name = info.courseName;
    if (!s.facility_name && info.facilityName)
      s.facility_name = info.facilityName;
    const y = info.tees[String(s.tee_set_id)];
    if (!y) continue;
    const yards =
      s.tee_set_side === "F9"
        ? y.front
        : s.tee_set_side === "B9"
          ? y.back
          : y.total;
    if (yards) s.tee_yardage = yards;
  }
}

/** Full login + fetch. Returns the shape /api/ghin and the cron both need. */
export async function fetchGhinData({ email, password, ghinNumber }) {
  const sessionToken = await getFirebaseSessionToken();
  const { token, golferIdHint } = await loginToGhin(email, password, sessionToken);
  const resolvedId = await resolveGolferId(token, email, ghinNumber, golferIdHint);
  const golferInfo = await fetchGolfer(token, resolvedId);
  const scores = await fetchAllScores(token, resolvedId);
  await attachCourseData(token, scores);

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
