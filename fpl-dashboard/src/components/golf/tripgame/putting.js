// Green speed, putt reads and deterministic putt resolution.

import { clamp, seededUnit } from "./geometry.js";
export const STIMP_TIERS = {
  SLOW: { label: "SLOW", stimp: 8, breakMult: 0.8, bandWidth: 0.2, needle: 1, runout: 1.6 },
  MEDIUM: { label: "MEDIUM", stimp: 10, breakMult: 1, bandWidth: 0.15, needle: 1.08, runout: 2.2 },
  FAST: { label: "FAST", stimp: 12, breakMult: 1.3, bandWidth: 0.11, needle: 1.16, runout: 3 },
};

/** Green speed is a per-hole condition, announced and deterministic. */
export function stimpOf(hole) {
  const roll = seededUnit(hole.number * 17 + 3 + (Number(hole.stimpSalt) || 0));
  return roll < 0.34 ? "SLOW" : roll < 0.72 ? "MEDIUM" : "FAST";
}

/**
 * One putt's full read: break, slope, green speed, distances, and the aim
 * (in cup-width ticks) that would hole it at good pace. Everything the
 * outcome depends on is visible to the player — no hidden rolls.
 */
export function makePuttRead({ hole, puttCount, feet, sceneCarry }) {
  const salt = hole.number * 29 + puttCount * 11 + 5;
  const breakDir = (seededUnit(salt) - 0.5) * 1.8;
  const slope = (seededUnit(salt + 1) - 0.5) * 1.6;
  const stimpKey = stimpOf(hole);
  const tier = STIMP_TIERS[stimpKey];
  // Uphill plays longer, downhill shorter; fast greens roll out farther.
  const effFeet = Math.max(
    1,
    Math.round(feet * (1 + slope * 0.28) * (stimpKey === "FAST" ? 0.88 : stimpKey === "SLOW" ? 1.14 : 1)),
  );
  // Aim required to hole it at dying pace, in ticks (positive = aim right).
  const requiredTicks = -breakDir * tier.breakMult * clamp(feet, 2, 30) * 0.16;
  const start = sceneCarry || [
    85 - breakDir * clamp(feet * 0.9, 4, 22),
    36 + clamp(26 + feet * 1.3, 34, 78),
  ];
  // Pace band on the power bar: farther/faster putts need more fill.
  const paceCenter = clamp(0.42 + effFeet * 0.012, 0.45, 0.98);
  const paceBand = { min: Math.max(0.2, paceCenter - tier.bandWidth / 2), max: Math.min(1.06, paceCenter + tier.bandWidth / 2) };
  return { feet, effFeet, breakDir, slope, stimp: stimpKey, requiredTicks, start, paceBand, needle: tier.needle };
}

/**
 * Deterministic putt resolution: outcome is a pure function of the player's
 * aim ticks, pace error, and line error against the visible read. Hot putts
 * shrink the capture width; centered-but-hot earns the horseshoe lip-out.
 */
export function resolveLivePutt({ read, aimTicks, meter, puttCount }) {
  const tier = STIMP_TIERS[read.stimp] || STIMP_TIERS.MEDIUM;
  const paceCenter = (read.paceBand.min + read.paceBand.max) / 2;
  const paceErr = meter.power - paceCenter;
  const bandHalf = (read.paceBand.max - read.paceBand.min) / 2;
  // Firm putts take the break out (Mario Golf rule) but risk the lip.
  const firm = paceErr > bandHalf * 0.6;
  const effRequired = read.requiredTicks * (firm ? 0.68 : 1);
  const lineErr = aimTicks - effRequired + meter.accuracy * 3.4;
  const hot = paceErr > bandHalf + 0.05;
  const short = paceErr < -bandHalf - 0.03;
  const capture = hot ? 0.55 : 1.15;
  let made = false;
  let lip = false;
  if (!short && !hot && Math.abs(lineErr) <= capture) made = true;
  else if (!short && hot && paceErr < bandHalf + 0.14 && Math.abs(lineErr) <= capture * 0.6) lip = true;
  if (!made && !lip && puttCount >= 3) made = true; // arcade mercy on the 4th
  let leaveFeet = 0;
  if (!made) {
    if (lip) leaveFeet = 1.5;
    else if (short) leaveFeet = clamp(read.feet * Math.min(0.75, -paceErr * 2.4), 1.5, read.feet * 0.8);
    else if (hot) leaveFeet = clamp(2 + paceErr * read.effFeet * tier.runout * 0.4, 2, 14);
    else leaveFeet = clamp(1 + Math.abs(lineErr) * 1.4, 1.2, 6);
  }
  const missSide = Math.abs(lineErr) > 0.1 ? Math.sign(lineErr) : read.breakDir >= 0 ? 1 : -1;
  return { made, lip, leaveFeet, missSide, paceErr, lineErr, effRequired };
}

/**
 * Dedicated arcade putting view: a green close-up with a visible cup, a ball
 * you can actually watch roll and drop, plus Mario-Golf-style break arrows
 * that drift downslope and an uphill/downhill + break readout.
 */
export const PUTT_TICK_UNITS = 2.4;

/** Broadcast-style stakes label for a putt: what dropping it would score. */
export function forLabelOf(rel) {
  if (rel <= -2) return { text: "FOR EAGLE", tone: "eagle" };
  if (rel === -1) return { text: "FOR BIRDIE", tone: "birdie" };
  if (rel === 0) return { text: "FOR PAR", tone: "par" };
  if (rel === 1) return { text: "FOR BOGEY", tone: "bogey" };
  return { text: "FOR DOUBLE+", tone: "double" };
}
