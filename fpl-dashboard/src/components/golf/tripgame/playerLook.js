// Every golfer gets a look of their own, derived from their key so it never
// changes between sessions: skin tone, shirt and trouser colours, and a
// visor or a bare cap. Team colour stays on the cap.
const SKINS = ["#f0c896", "#e0b184", "#c98f62", "#a86f48", "#7a4b2d", "#f6d7b0"];
const SHIRTS = ["#e8ecf2", "#f4d35e", "#7bc4a4", "#f28c6b", "#c7b8ea", "#8fd3f4", "#ffffff", "#9ad57a"];
const LEGS = ["#33556e", "#4c4c4c", "#7c5e42", "#2f6b52", "#8d8d8d", "#5a3d5c"];

function hashOf(text) {
  let hash = 2166136261;
  for (const char of String(text || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
}

export function playerLook(player) {
  const seed = hashOf(player?.key || player?.name || "");
  return {
    skin: SKINS[seed % SKINS.length],
    shirt: SHIRTS[(seed >> 3) % SHIRTS.length],
    legs: LEGS[(seed >> 7) % LEGS.length],
    visor: ((seed >> 11) & 3) === 0,
    tall: ((seed >> 13) & 1) === 1,
  };
}

/** The surname in caps, the way a broadcast nameplate reads. */
export function nameplateOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts[parts.length - 1] : "").toUpperCase();
}
