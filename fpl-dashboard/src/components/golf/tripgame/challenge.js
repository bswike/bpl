// Challenge codes: a short string that fixes the course, side, swing style
// and the seed, so two captains can play the same wind, greens and CPU and
// compare. Format: <course>-<side>-<mode>-<seed36>, e.g. CS-S-F-1K7Q2.
const COURSE_TAGS = {
  "crystal-springs": "CS",
  "wild-turkey": "WT",
  "black-bear": "BB",
  ballyowen: "BO",
  "suntree-classic": "SC",
};
export const SEED_SPACE = 36 ** 5;

/** Each hole's luck is a pure function of (seed, hole): a resume or a replay of a code lands on the same streams. */
export function streamSeeds(seed, holeIndex = 0) {
  const base = Math.floor(Math.abs(Number(seed) || 0));
  const hole = Math.max(0, Math.floor(Number(holeIndex) || 0));
  return { human: (base * 17 + 3 + hole * 104729) >>> 0, cpu: (base * 31 + 7 + hole * 7919) >>> 0 };
}

export function randomSeed(now = Date.now()) {
  return Math.floor(now % SEED_SPACE);
}

export function encodeCode({ slug, team, swingMode, seed }) {
  const tag = COURSE_TAGS[slug] || String(slug || "XX").slice(0, 2).toUpperCase();
  const side = team === "North" ? "N" : "S";
  const mode = swingMode === "full" ? "F" : "O";
  return `${tag}-${side}-${mode}-${Math.floor(Math.abs(Number(seed) || 0) % SEED_SPACE).toString(36).toUpperCase().padStart(5, "0")}`;
}

export function decodeCode(text) {
  const match = String(text || "").trim().toUpperCase().match(/^([A-Z]{2})-([NS])-([FO])-([0-9A-Z]{1,5})$/);
  if (!match) return null;
  const slug = Object.keys(COURSE_TAGS).find((key) => COURSE_TAGS[key] === match[1]) || null;
  if (!slug) return null;
  return { slug, team: match[2] === "N" ? "North" : "South", swingMode: match[3] === "F" ? "full" : "single", seed: parseInt(match[4], 36) };
}
