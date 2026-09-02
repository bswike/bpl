// The live club bag and the sweet-spot carry shared by physics, picker and preview.
// The shot-by-shot bag: each club is a real distance choice. Full-swing carry
// at sweet power is roughly carry * 1.06 (times the player's carry boost).
// Sweet-spot carry multiplier shared by the physics, the club picker and the preview.
export const LIVE_CARRY_SWEET = 0.7 + 0.87 * 0.4;

export const LIVE_CLUBS = [
  // ids must not collide with the tee-shot CLUBS ids ("wood"/"iron") — the
  // tee ball resolves carry from the engine bag, approaches from this one.
  { id: "wood3", short: "3W", carry: 222, speed: 0.92, zone: 1.12, lateral: 27 },
  { id: "iron4", short: "4I", carry: 195, speed: 0.88, zone: 1.2, lateral: 22 },
  { id: "iron7", short: "7I", carry: 160, speed: 0.84, zone: 1.3, lateral: 18 },
  { id: "iron9", short: "9I", carry: 130, speed: 0.82, zone: 1.36, lateral: 14 },
  { id: "wedge", short: "PW", carry: 105, speed: 0.8, zone: 1.42, lateral: 10 },
  { id: "sandwedge", short: "SW", carry: 75, speed: 0.78, zone: 1.48, lateral: 8 },
  { id: "chip", short: "CHP", carry: 42, speed: 0.74, zone: 1.55, lateral: 5 },
];

export function liveClubOf(clubId) {
  return LIVE_CLUBS.find((club) => club.id === clubId) || null;
}

/** Default club for the lie/distance; the player can cycle from here. */
export function defaultLiveClub(remainingYards, lie) {
  if (lie === "Bunker") return remainingYards > 90 ? "wedge" : "sandwedge";
  let best = LIVE_CLUBS[0];
  let bestCost = Infinity;
  for (const club of LIVE_CLUBS) {
    // Club up: coming up short costs more than having a little extra.
    const gap = club.carry * LIVE_CARRY_SWEET - remainingYards;
    const cost = gap >= 0 ? gap : -gap * 1.6;
    if (cost < bestCost) {
      bestCost = cost;
      best = club;
    }
  }
  return best.id;
}
