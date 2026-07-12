// Cache of scraped Suntree tee sheets, stored one JSON bundle per month in
// Vercel Blob. The public /api/rounds endpoint reads only from here (so member
// lookups never hit Suntree); /api/rounds-cron keeps it fresh and backfills.
//
// Shape per bundle at rounds/sheets/YYYY-MM.json:
//   { month: "2026-06", days: { "2026-06-05": [ {course,time,player}, ... ] },
//     updated_at: ISO }
// A day present with an empty array means "scraped, nobody on the sheet" — it
// is still "covered", so we don't rescrape it during backfill.
import { put, list, del } from "@vercel/blob";
import { randomBytes } from "node:crypto";

const PREFIX = "rounds/sheets/";
const SESSION_PREFIX = "rounds/sessions/";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // Suntree logins last ~12h

export function monthKey(iso) { return iso.slice(0, 7); }

function pathFor(month) { return `${PREFIX}${month}.json`; }

export async function loadMonth(month) {
  const { blobs } = await list({ prefix: pathFor(month) });
  const blob = blobs.find((b) => b.pathname === pathFor(month));
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export async function saveMonth(bundle) {
  bundle.updated_at = new Date().toISOString();
  await put(pathFor(bundle.month), JSON.stringify(bundle), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

/** Merge scraped days (map of iso -> rows[]) into the month bundles. */
export async function upsertDays(dayMap) {
  const byMonth = {};
  for (const iso of Object.keys(dayMap)) (byMonth[monthKey(iso)] ||= []).push(iso);
  for (const month of Object.keys(byMonth)) {
    const bundle = (await loadMonth(month)) || { month, days: {}, updated_at: null };
    for (const iso of byMonth[month]) bundle.days[iso] = dayMap[iso];
    await saveMonth(bundle);
  }
}

/** Which months exist, and the earliest/latest covered day. */
export async function coverage() {
  const { blobs } = await list({ prefix: PREFIX });
  const months = blobs
    .map((b) => b.pathname.slice(PREFIX.length).replace(/\.json$/, ""))
    .filter((m) => /^\d{4}-\d{2}$/.test(m))
    .sort();
  if (!months.length) return { months: [], minDay: null, maxDay: null, dayCount: 0 };
  const first = await loadMonth(months[0]);
  const last = await loadMonth(months[months.length - 1]);
  const firstDays = Object.keys(first?.days || {}).sort();
  const lastDays = Object.keys(last?.days || {}).sort();
  let dayCount = 0;
  for (const m of months) {
    const b = m === months[0] ? first : m === months[months.length - 1] ? last : await loadMonth(m);
    dayCount += Object.keys(b?.days || {}).length;
  }
  return { months, minDay: firstDays[0] || null, maxDay: lastDays[lastDays.length - 1] || null, dayCount };
}

/** All rows within [from, to] (inclusive ISO dates), plus which days were covered. */
export async function queryRange(from, to) {
  const rows = [];
  const coveredDays = [];
  const startM = monthKey(from), endM = monthKey(to);
  for (let m = startM; m <= endM; m = nextMonth(m)) {
    const bundle = await loadMonth(m);
    if (!bundle) continue;
    for (const iso of Object.keys(bundle.days)) {
      if (iso < from || iso > to) continue;
      coveredDays.push(iso);
      for (const r of bundle.days[iso]) rows.push({ ...r, date: iso });
    }
  }
  return { rows, coveredDays: coveredDays.sort() };
}

function nextMonth(m) {
  let [y, mo] = m.split("-").map(Number);
  mo++; if (mo > 12) { mo = 1; y++; }
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/* ------------------------------- sessions --------------------------------- */
// A logged-in Suntree session is the member's cookie jar (NOT their password),
// held server-side in Blob under an unguessable id. The browser only gets that
// id in an httpOnly cookie, and only for the ~12h the Suntree login lasts.

function sessionPath(id) { return `${SESSION_PREFIX}${id}.json`; }

async function writeSession(id, cookieHeader) {
  await put(sessionPath(id), JSON.stringify({ cookieHeader, createdAt: Date.now() }), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

export async function saveSession(cookieHeader) {
  const id = randomBytes(24).toString("hex");
  await writeSession(id, cookieHeader);
  return id;
}

/** Refresh an existing session's cookies in place (keeps the same id/cookie). */
export async function refreshSession(id, cookieHeader) {
  if (!id || !/^[a-f0-9]{48}$/.test(id)) return;
  await writeSession(id, cookieHeader);
}

export async function loadSession(id) {
  if (!id || !/^[a-f0-9]{48}$/.test(id)) return null;
  const { blobs } = await list({ prefix: sessionPath(id) });
  const blob = blobs.find((b) => b.pathname === sessionPath(id));
  if (!blob) return null;
  const res = await fetch(blob.url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.createdAt || Date.now() - data.createdAt > SESSION_TTL_MS) {
    await deleteSession(id);
    return null;
  }
  return data;
}

export async function deleteSession(id) {
  if (!id || !/^[a-f0-9]{48}$/.test(id)) return;
  try {
    const { blobs } = await list({ prefix: sessionPath(id) });
    await Promise.all(blobs.map((b) => del(b.url)));
  } catch { /* best effort */ }
}
