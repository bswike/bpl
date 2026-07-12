// Suntree Country Club (ClubEssential / Axis / NetCaddy) tee-sheet client.
//
// The member portal has no JSON API. Login is a 3-step RC4 handshake against
// login.asmx (reverse-engineered from the site's own axisScripts.js), and the
// tee sheet is an ASP.NET AJAX UpdatePanel that re-renders one day per async
// postback. This module logs in server-side and scrapes a given day into a
// normalized list of { course, time, player } rows.
//
// Credentials come from env vars the site owner sets in Vercel; nothing is
// hardcoded and no password ever passes through the browser:
//   SUNTREE_USERNAME, SUNTREE_PASSWORD
//
// The RC4/hex port is byte-for-byte verified against the site's own
// $j.rc4EncryptStr output (see scripts — three known vectors match exactly).

const ORIGIN = "https://www.suntree.com";
const LOGIN_PAGE = `${ORIGIN}/login`;
const TEESHEET_URL = `${ORIGIN}/Default.aspx?p=dynamicmodule&pageid=278&tt=booking&ssid=100372&vnf=1`;
const LOGIN_ASMX = `${ORIGIN}/a_master/net/net_advancedlogin/login.asmx`;

/* ------------------------------ crypto (RC4) ------------------------------ */

function rc4Encrypt(key, pt) {
  const s = [];
  for (let i = 0; i < 256; i++) s[i] = i;
  let j = 0, x;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
  }
  let i = 0; j = 0; let ct = "";
  for (let y = 0; y < pt.length; y++) {
    i = (i + 1) % 256; j = (j + s[i]) % 256;
    x = s[i]; s[i] = s[j]; s[j] = x;
    ct += String.fromCharCode(pt.charCodeAt(y) ^ s[(s[i] + s[j]) % 256]);
  }
  return ct;
}
function hexEncode(data) {
  let out = "";
  for (let i = 0; i < data.length; i++) out += (data.charCodeAt(i) & 0xff).toString(16).padStart(2, "0");
  return out;
}
// $j.rc4EncryptStr: hexEncode(rc4Encrypt(key, unescape(encodeURIComponent(str))))
function rc4EncryptStr(str, key) {
  const utf8Latin1 = Buffer.from(str, "utf8").toString("latin1");
  return hexEncode(rc4Encrypt(key, utf8Latin1));
}
// Mirrors the site's URLEncode (space -> '+', RFC2396 marks kept literal).
function urlEncode(val) {
  const SAFE = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_.!~*'()";
  let out = "";
  for (const ch of String(val)) {
    if (ch === " ") out += "+";
    else if (SAFE.indexOf(ch) !== -1) out += ch;
    else out += "%" + ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0");
  }
  return out;
}
// Mirrors the site's URLDecode ('+' -> space, %XX -> latin1 byte).
function urlDecode(val) {
  let out = "";
  for (let i = 0; i < val.length; ) {
    const ch = val[i];
    if (ch === "+") { out += " "; i++; }
    else if (ch === "%" && /^[0-9A-Fa-f]{2}$/.test(val.substr(i + 1, 2))) {
      out += String.fromCharCode(parseInt(val.substr(i + 1, 2), 16));
      i += 3;
    } else { out += ch; i++; }
  }
  return out;
}

/* ------------------------------ cookie jar -------------------------------- */

function makeJar() {
  const jar = new Map();
  return {
    seed(cookieHeader) {
      for (const pair of String(cookieHeader || "").split(";")) {
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name) jar.set(name, value);
      }
    },
    absorb(res) {
      const raw =
        typeof res.headers.getSetCookie === "function"
          ? res.headers.getSetCookie()
          : [res.headers.get("set-cookie")].filter(Boolean);
      for (const line of raw) {
        const pair = line.split(";")[0];
        const eq = pair.indexOf("=");
        if (eq === -1) continue;
        const name = pair.slice(0, eq).trim();
        const value = pair.slice(eq + 1).trim();
        if (name) jar.set(name, value);
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    get size() { return jar.size; },
  };
}

/* ------------------------------ login flow -------------------------------- */

function parseAsmxArray(text) {
  // asmx returns {"d":"[{key:'..',cip:'..'}]"} or the array string directly.
  let d = text;
  try { const j = JSON.parse(text); d = typeof j.d === "string" ? j.d : text; } catch { /* not json-wrapped */ }
  const out = {};
  for (const field of ["key", "cip", "token"]) {
    const m = d.match(new RegExp(`${field}\\s*:\\s*['"]([^'"]*)['"]`)) ||
              d.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`));
    if (m) out[field] = urlDecode(m[1]);
  }
  return out;
}

async function login(jar, username, password) {
  // 0. Prime session cookies from the login page.
  const p = await fetch(LOGIN_PAGE, { headers: { "User-Agent": UA } });
  jar.absorb(p);

  // 1. loginStep1 -> RC4 key + cip.
  const s1 = await fetch(`${LOGIN_ASMX}/loginStep1?r=${Math.floor(Math.random() * 1000)}`, {
    method: "POST",
    headers: asmxHeaders(jar),
    body: JSON.stringify({ lstep: 1 }),
  });
  jar.absorb(s1);
  if (!s1.ok) throw new Error(`Suntree loginStep1 failed (HTTP ${s1.status})`);
  const { key, cip } = parseAsmxArray(await s1.text());
  if (!key) throw new Error("Suntree loginStep1 returned no key (login flow may have changed)");

  // 2. loginStep2 -> session token (credentials RC4-encrypted under key).
  const body = {
    id: urlEncode(rc4EncryptStr(username, key)),
    pw: urlEncode(rc4EncryptStr(password, key)),
    url: "",
    cip: urlEncode(rc4EncryptStr(cip || "", key)),
  };
  const s2 = await fetch(`${LOGIN_ASMX}/loginStep2?r=${Math.floor(Math.random() * 1000)}`, {
    method: "POST",
    headers: asmxHeaders(jar),
    // The site sends id/pw/url/cip already-URLEncoded inside a JSON string.
    body: `{'id': '${body.id}', 'pw': '${body.pw}', 'url': '${body.url}', 'cip': '${body.cip}'}`,
  });
  jar.absorb(s2);
  if (!s2.ok) throw new Error(`Suntree loginStep2 failed (HTTP ${s2.status})`);
  const { token } = parseAsmxArray(await s2.text());
  if (!token) throw new Error("Suntree login rejected — check SUNTREE_USERNAME / SUNTREE_PASSWORD");

  // 3. Exchange the token for the authenticated ASP.NET session cookie.
  const s3 = await fetch(
    `${ORIGIN}/default.aspx?login=true&sessionToken=${urlEncode(token)}&gotopage=${urlEncode("p=MembersDefault")}`,
    { headers: { "User-Agent": UA, Cookie: jar.header() }, redirect: "manual" }
  );
  jar.absorb(s3);
  // Follow one redirect if present, to settle any additional auth cookies.
  const loc = s3.headers.get("location");
  if (loc) {
    const follow = await fetch(loc.startsWith("http") ? loc : ORIGIN + loc, {
      headers: { "User-Agent": UA, Cookie: jar.header() },
      redirect: "manual",
    });
    jar.absorb(follow);
  }
  return jar;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

function asmxHeaders(jar) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "X-Requested-With": "XMLHttpRequest",
    "User-Agent": UA,
    Cookie: jar.header(),
  };
}

/* --------------------------- tee-sheet scraping --------------------------- */

// Pull the hidden-field state we need to replay the day-change async postback.
function extractFormState(html) {
  const val = (name) => {
    const re = new RegExp(`name="${name.replace(/[$]/g, "\\$")}"[^>]*value="([^"]*)"`);
    const m = html.match(re);
    return m ? m[1] : "";
  };
  const findName = (suffix) => {
    const m = html.match(new RegExp(`name="([^"]*\\$${suffix})"`));
    return m ? m[1] : null;
  };
  const txtDateName = findName("txtDate");
  const autoRefreshName = findName("autoRefresh");
  return {
    ceViewState: val("__CEVIEWSTATE"),
    viewState: val("__VIEWSTATE"),
    tssm: val("ctl00_TSSM"),
    txtDateName,
    autoRefreshName,
    // Grab every hidden input so ClientState / dropdown defaults ride along.
    hidden: collectInputs(html),
  };
}

function collectInputs(html) {
  const out = {};
  const re = /<input\b[^>]*\bname="([^"]+)"[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const name = m[1];
    const vm = tag.match(/\bvalue="([^"]*)"/);
    out[name] = vm ? vm[1] : "";
  }
  // Selects: keep the option marked selected (fallback: first option).
  const sre = /<select\b[^>]*\bname="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g;
  while ((m = sre.exec(html))) {
    const name = m[1];
    const sel = m[2].match(/<option[^>]*\bselected\b[^>]*value="([^"]*)"/) ||
                m[2].match(/<option[^>]*value="([^"]*)"/);
    out[name] = sel ? sel[1] : "";
  }
  return out;
}

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
}

// Parse a rendered tee sheet (full page or async delta) into normalized rows.
// Walks course-headers, time slots and player-name spans in document order.
function parseSheet(html, isoDate) {
  const token = /class="courseName">((?:Classic|Challenge) Course)<\/span><span class="sep"> - <\/span><span class="date">\w+, ([A-Za-z]+ \d{1,2}, \d{4})|class="timeText">(\d{1,2}:\d{2}\s?[AP]M)|class="fullName">([^<]+?)\s*<\/span>/g;
  const rows = [];
  let course = null, time = null;
  let m;
  while ((m = token.exec(html))) {
    if (m[1]) { course = m[1]; }
    else if (m[3]) { time = m[3].replace(/\s+/g, " ").trim(); }
    else if (m[4]) {
      const player = decodeHtml(m[4]).trim();
      if (player) rows.push({ course, time, player });
    }
  }
  // Dedupe identical (course,time,player) tuples within the day.
  const seen = new Set();
  return rows.filter((r) => {
    const k = `${r.course}|${r.time}|${r.player.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map((r) => ({ ...r, date: isoDate }));
}

function isoToMdy(iso) {
  const [y, mo, d] = iso.split("-").map(Number);
  return `${mo}/${d}/${y}`;
}
function mdyLongContains(html, iso) {
  // Confirm the response actually rendered the requested day.
  const [y, mo, d] = iso.split("-").map(Number);
  const month = ["January","February","March","April","May","June","July","August","September","October","November","December"][mo - 1];
  return html.includes(`${month} ${d}, ${y}`);
}

// SESSION_EXPIRED is thrown when a resumed cookie no longer authenticates, so
// callers (the scan endpoint) can answer 401 and prompt a fresh login.
export const SESSION_EXPIRED = "SESSION_EXPIRED";

// Given an authenticated cookie jar, load the tee sheet once to capture the
// form state, then return a day scraper. Shared by login and resume paths.
async function attachTeeSheet(jar) {
  const pageRes = await fetch(TEESHEET_URL, { headers: { "User-Agent": UA, Cookie: jar.header() } });
  jar.absorb(pageRes);
  const page = await pageRes.text();
  if (/txtUsername|You Must Login/i.test(page)) {
    const err = new Error("Suntree session is not authenticated");
    err.code = SESSION_EXPIRED;
    throw err;
  }
  const state = extractFormState(page);
  if (!state.txtDateName || !state.autoRefreshName) {
    throw new Error("Could not locate tee-sheet controls (page layout may have changed)");
  }

  async function scrapeDay(iso, { retries = 3 } = {}) {
    const mdy = isoToMdy(iso);
    for (let attempt = 1; attempt <= retries; attempt++) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(state.hidden)) params.set(k, v);
      params.set("defaultSM", `defaultSM|${state.autoRefreshName}`);
      params.set("__EVENTTARGET", state.autoRefreshName);
      params.set("__EVENTARGUMENT", "");
      params.set("__ASYNCPOST", "true");
      params.set("RadAJAXControlID", "");
      params.set(state.txtDateName, mdy);
      params.set("txtDate", mdy);

      const res = await fetch(TEESHEET_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
          "X-MicrosoftAjax": "Delta=true",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": UA,
          Cookie: jar.header(),
        },
        body: params.toString(),
      });
      jar.absorb(res);
      const html = await res.text();
      if (res.ok && mdyLongContains(html, iso)) return parseSheet(html, iso);
      if (attempt === retries) {
        if (!res.ok) throw new Error(`Suntree scrape ${iso} failed (HTTP ${res.status})`);
        return []; // rendered a day but not the one asked for; treat as empty
      }
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    return [];
  }

  return { scrapeDay, jar, cookieHeader: () => jar.header() };
}

/**
 * Log in with username/password and return a scraping session PLUS the cookie
 * header to persist (so the session can be resumed later without the password).
 */
export async function loginSession({ username, password }) {
  if (!username || !password) throw new Error("Suntree username and password are required");
  const jar = makeJar();
  await login(jar, username, password);
  const session = await attachTeeSheet(jar);
  return session; // { scrapeDay, jar, cookieHeader }
}

/** Resume a previously logged-in session from its stored cookie header. */
export async function resumeSession(cookieHeader) {
  const jar = makeJar();
  jar.seed(cookieHeader);
  return attachTeeSheet(jar); // throws SESSION_EXPIRED if the cookie is dead
}

/** Env-var convenience (local backfill / scripts). */
export async function openSession({ username = process.env.SUNTREE_USERNAME, password = process.env.SUNTREE_PASSWORD } = {}) {
  return loginSession({ username, password });
}

export const _internals = { rc4EncryptStr, urlEncode, urlDecode, parseSheet, extractFormState };
