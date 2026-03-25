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

/** Pull a numeric GHIN / golfer id from login-related objects if the API includes it. */
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

  if (!res.ok) return { golfers: [], error: null };
  const data = await res.json();
  return { golfers: data?.golfers ?? [], error: null };
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
      limit: limit.toString(),
      offset: offset.toString(),
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { email, password, ghinNumber } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const sessionToken = await getFirebaseSessionToken();
    const { token: authToken, golferIdHint } = await loginToGhin(
      email,
      password,
      sessionToken
    );

    const resolvedId = await resolveGolferId(
      authToken,
      email,
      ghinNumber,
      golferIdHint
    );

    const golferInfo = await fetchGolfer(authToken, resolvedId);
    const scores = await fetchAllScores(authToken, resolvedId);

    const withHoleDetail = scores.filter(
      (s) => Array.isArray(s.hole_details) && s.hole_details.length > 0
    ).length;

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      exported_at: new Date().toISOString(),
      golfer: golferInfo
        ? {
            first_name: golferInfo.first_name,
            last_name: golferInfo.last_name,
            ghin_number: golferInfo.ghin_number ?? resolvedId,
            handicap_index: golferInfo.handicap_index,
            club_name: golferInfo.club_name,
          }
        : { ghin_number: resolvedId },
      total_scores: scores.length,
      scores_with_hole_detail: withHoleDetail,
      scores,
    });
  } catch (err) {
    console.error("GHIN API error:", err);
    const message = err instanceof Error ? err.message : "Unexpected error";
    return res.status(500).json({ error: message });
  }
}
