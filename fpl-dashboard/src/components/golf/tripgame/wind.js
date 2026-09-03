// Wind, Golden Tee style: one reading per hole that you have to play, shown
// on the HUD and applied to every airborne shot from both sides. Seeded by
// hole and round so a shared challenge code gets the same weather.
import { clamp, seededUnit } from "./geometry.js";

export const WIND_CARRY_PER_MPH = 0.0045; // 12 mph straight down = +5.4% carry on a full shot
export const WIND_DRIFT_PER_MPH = 0.55; // yards of drift per mph of crosswind on a 250-yard shot

/**
 * The wind vector in map units: the map is drawn pin-up, so an angle of 0
 * blows straight toward the pin (helping on the tee shot).
 */
export function windFor(hole, roundSalt = 0) {
  const salt = Number(roundSalt) || 0;
  const number = Number(hole?.number) || 1;
  const gust = seededUnit(number * 71 + salt * 3 + 11);
  // Skewed low: most holes breezy, a few honking.
  const mph = Math.round(clamp(Math.pow(gust, 1.6) * 18, 0, 18));
  const angle = seededUnit(number * 53 + salt * 5 + 29) * Math.PI * 2;
  return { mph, angle, vx: Math.sin(angle) * mph, vy: -Math.cos(angle) * mph };
}

/** How a shot heading along `dir` (unit vector, map units) reads the wind. */
export function windRead(wind, dir) {
  if (!wind || !wind.mph) return { along: 0, cross: 0 };
  const perp = [-dir[1], dir[0]];
  return { along: wind.vx * dir[0] + wind.vy * dir[1], cross: wind.vx * perp[0] + wind.vy * perp[1] };
}

/** Carry multiplier and lateral drift (yards) for an airborne shot of `carryYards`. */
export function windEffect(wind, dir, carryYards) {
  const { along, cross } = windRead(wind, dir);
  const air = clamp(carryYards / 250, 0.35, 1);
  return {
    carryMult: 1 + along * WIND_CARRY_PER_MPH * air,
    driftYards: cross * WIND_DRIFT_PER_MPH * air * clamp(carryYards / 250, 0.3, 1.1),
    along,
    cross,
  };
}

/** HUD text for the wind as it bears on a shot toward the pin (dir = toward pin). */
export function windLabel(wind, dir) {
  if (!wind || !wind.mph) return "CALM";
  const { along, cross } = windRead(wind, dir);
  const parts = [];
  if (Math.abs(along) >= wind.mph * 0.35) parts.push(along > 0 ? "HELPING" : "INTO");
  if (Math.abs(cross) >= wind.mph * 0.35) parts.push(cross > 0 ? "L→R" : "R→L");
  return `${wind.mph} MPH${parts.length ? ` ${parts.join(" ")}` : ""}`;
}
