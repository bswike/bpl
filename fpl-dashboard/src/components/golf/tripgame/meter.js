// Swing-meter constants, judgment, buzz and jitters, plus the needle store.
// The meter needle lives outside React state: the rAF loop writes here and
// only KickMeter subscribes, so a frame never re-renders the map or roster.
export const meterStore = {
  value: { power: 0, accuracy: -1 },
  listeners: new Set(),
  get() {
    return meterStore.value;
  },
  set(power, accuracy) {
    meterStore.value = { power, accuracy };
    for (const listener of meterStore.listeners) listener();
  },
  subscribe(listener) {
    meterStore.listeners.add(listener);
    return () => meterStore.listeners.delete(listener);
  },
};

// Swing judgment tiers. Accuracy is in [-1, 1]; the engine's sweet power band
// is 0.78–0.96 with overswing punished past 0.96 (see tripGameEngine).
export const ACC_PURE = 0.05;

export const ACC_GREAT = 0.16;

export const ACC_GOOD = 0.34;

export const POWER_SWEET_MIN = 0.78;

export const POWER_SWEET_MAX = 0.96;

export const POWER_METER_MAX = 1.12;

// The red-band bet: locking power in the overswing band shrinks every accuracy
// zone and speeds the needle up — more distance, on your own dare.
export const RED_BET_ZONE_SCALE = 0.6;

export const RED_BET_SPEED = 1.25;

export const CLUTCH_SPEED = 0.7;

export const CLUB_METER_SPEED = { driver: 1, wood: 0.92, iron: 0.84, wedge: 0.8, putter: 0.72 };

// Laying up is a real choice: shorter clubs also get wider judgment zones.
export const CLUB_ZONE_SCALE = { driver: 1, wood: 1.12, iron: 1.3, wedge: 1.42, putter: 1.5 };

// A bad lie tightens the zones and jitters the needle.
export const LIE_METER_MODS = { Rough: { zone: 0.85, speed: 1.06 }, Bunker: { zone: 0.72, speed: 1.12 } };

export const BASE_ACC_SPEED = 2.6;

export const BASE_POWER_SPEED = 1.08;

// Skill scaling (from handicap) — the gap is meant to be dramatic: a scratch
// player gets zones 1.5x wide at base speed, while the worst hackers fight
// zones 30% tighter with a meter well over 2x faster.
export const SKILL_ZONE_MIN = 0.7;

export const SKILL_ZONE_RANGE = 0.8;

export const SKILL_SPEED_PENALTY = 1.3;

/**
 * Booze tiers: the drunker you are, the faster and tighter the meter — but a
 * flushed shot while buzzed is a SUPER shot with bonus carry. Pulse is the
 * stadium-party intensity level.
 */
export function buzzTierOf(buzz) {
  const level = Number(buzz) || 0;
  if (level >= 60) return { id: "lit", label: "LIT", zone: 0.72, speed: 1.3, wobble: true, bonus: 1.15, pulse: 3 };
  if (level >= 34) return { id: "tipsy", label: "TIPSY", zone: 0.82, speed: 1.18, wobble: true, bonus: 1.1, pulse: 2 };
  if (level >= 12) return { id: "buzzed", label: "BUZZED", zone: 0.92, speed: 1.08, wobble: false, bonus: 1.06, pulse: 1 };
  return { id: "sober", label: "SOBER", zone: 1, speed: 1, wobble: false, bonus: 1, pulse: 0 };
}

/**
 * Nerves: the first tee with everyone watching, and the closing stretch of 18
 * with the whole trip gathered. Jitters tighten and speed the meter — unless
 * you've had enough to drink. Liquid courage is the balancing act.
 */
export function jittersFor(holeNumber, context, buzz) {
  let base = 0;
  let label = null;
  if (holeNumber === 1 && context === "tee") {
    base = 1;
    label = "FIRST TEE JITTERS";
  } else if (holeNumber === 18 && (context === "approach" || context === "putt")) {
    base = 1.2;
    label = "THE TRIP IS WATCHING";
  }
  if (!base) return null;
  const courage = Math.min(base, buzzTierOf(buzz).pulse * 0.6);
  const intensity = Math.max(0, base - courage);
  return { label, intensity, calmed: intensity < 0.15 };
}

export function judgeSwing(power, accuracy, mods = {}) {
  const zoneScale = mods.zoneScale || 1;
  const pureZone = ACC_PURE * zoneScale;
  const greatZone = ACC_GREAT * zoneScale;
  const goodZone = ACC_GOOD * zoneScale;
  const off = Math.abs(accuracy);
  const overswung = mods.paceBand ? power > mods.paceBand.max : power > POWER_SWEET_MAX;
  const eased = mods.paceBand ? power < mods.paceBand.min : power < 0.72;
  const tier = off <= pureZone ? "pure" : off <= greatZone ? "great" : off <= goodZone ? "good" : "wild";
  const label =
    tier === "pure"
      ? mods.redBet
        ? "PURE! FULL SEND!"
        : "PURE!"
      : tier === "great"
        ? "GREAT"
        : tier === "good"
          ? "GOOD"
          : accuracy < 0
            ? "WAY LEFT"
            : "WAY RIGHT";
  // Near-miss: just barely outside the PURE sliver. Neurologically half a win —
  // call it out explicitly so the player knows exactly how close they came.
  const nearMiss = tier !== "pure" && off <= pureZone * 2.4;
  const fromPure = Math.max(1, Math.round((off - pureZone) * 100));
  const sub = nearMiss
    ? `SO CLOSE · ${fromPure} FROM PURE`
    : `PWR ${Math.round(power * 100)}${overswung ? " · OVERSWUNG" : eased ? " · EASED OFF" : ""}`;
  // Hit-stop: the world freezes on the tap, longer for better strikes and a
  // beat longer on near-misses so the ache lands.
  const base = tier === "pure" ? 680 : tier === "great" ? 500 : tier === "wild" ? 460 : 400;
  const hold = nearMiss ? base + 160 : base;
  // Flushing one while buzzed is a SUPER shot.
  const buzzBonus = (mods.buzzBonus || 1) > 1.05 && (tier === "pure" || tier === "great");
  const finalLabel = buzzBonus && tier === "pure" ? "LIQUID GOLD!" : label;
  return { tier, label: finalLabel, sub, hold, overswung, nearMiss, redBet: Boolean(mods.redBet), buzzBonus };
}

export function zoneStyle(threshold, zoneScale) {
  const half = threshold * zoneScale * 46;
  return { left: `${50 - half}%`, width: `${half * 2}%` };
}

// Casino-style odometer that rolls up the drive distance during ball flight.
// The color heats up live as the number climbs through the distance tiers.
export function yardTierOf(yards) {
  if (yards >= 300) return "bomb";
  if (yards >= 270) return "hot";
  if (yards >= 240) return "long";
  if (yards >= 200) return "solid";
  return "base";
}
