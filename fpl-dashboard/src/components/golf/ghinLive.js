// Live GHIN peer calls (feed refresh, friend lookup, league member fetch, search).
// Off by default to limit GHIN API load. Set VITE_GHIN_LIVE=1 at build time to re-enable.
const v = String(import.meta.env.VITE_GHIN_LIVE || "").toLowerCase();
export const GHIN_LIVE_ENABLED = v === "1" || v === "true" || v === "yes";

export const GHIN_LIVE_OFF_MSG =
  "Live GHIN lookups are paused — showing published scores only.";

// GHIN numbers that must never hit the GHIN API on sign-in (use saved/uploaded data).
export const GHIN_SIGNIN_BLOCKED = new Set(["11514629"]);

export function isGhinSignInBlocked(ghin) {
  const g = String(ghin || "").trim();
  return g && GHIN_SIGNIN_BLOCKED.has(g);
}

export const GHIN_SIGNIN_BLOCKED_MSG =
  "GHIN sign-in is paused for your account. Use scores already saved in this browser or upload a JSON export.";
