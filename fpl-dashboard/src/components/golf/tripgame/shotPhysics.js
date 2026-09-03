// Live stroke physics and tee-landing placement. Pure functions.

import {
  clamp,
  distanceToPolyline,
  interpolate,
  pointAlongPolyline,
  polylineLength,
  seededUnit,
} from "./geometry.js";
import { buildTreeSprites } from "./projection.js";
import { pointNearGreen } from "./camera.js";
import { LIVE_CARRY_SWEET, liveClubOf } from "./clubs.js";
import { ACC_GOOD } from "./meter.js";
import { windEffect } from "./wind.js";
import { classifyTerrain, nearestFeaturePoint } from "./terrain.js";
import { CLUBS, SHAPES, aimOffsetOf } from "../tripGameEngine.js";
export function computeShotTarget(projection, hole, decision) {
  const club = CLUBS.find((item) => item.id === decision.club) || CLUBS[0];
  const lineLength = polylineLength(projection.line);
  const metered = Number.isFinite(Number(decision.power));
  const power = metered ? clamp(Number(decision.power), 0, 1.18) : 0.9;
  const boost = Number(decision.carryBoost) || 1;
  const carry = (metered ? club.carry * (0.7 + clamp(power, 0, 1.15) * 0.4) : club.carry) * boost;
  const targetYards = hole.yards ? Math.min(Math.round(carry), Math.round(hole.yards * 0.98)) : Math.round(carry);
  const targetDistance = hole.yards ? lineLength * (targetYards / hole.yards) : lineLength * (hole.par <= 3 ? 0.94 : 0.58);
  const centerTarget = pointAlongPolyline(projection.line, targetDistance);
  const perpendicular = [-centerTarget.tangent[1], centerTarget.tangent[0]];
  const lateralAim = aimOffsetOf(decision.aim) * clamp(projection.width * 0.12, 10, 22);
  return {
    club,
    lineLength,
    targetYards,
    targetDistance,
    perpendicular,
    target: [centerTarget.point[0] + perpendicular[0] * lateralAim, centerTarget.point[1] + perpendicular[1] * lateralAim],
  };
}

export function shapeBend(projection, shape) {
  return (shape?.bias || 0) * clamp(projection.width * 0.62, 40, 96);
}

export function shapeDrift(projection, shape) {
  return (shape?.bias || 0) * clamp(projection.width * 0.24, 18, 44);
}

/**
 * Water check for balls rolling ALONG the ground (tops, duffs): the first wet
 * point on the straight ground path stops them. Airborne shots fly over
 * water and only splash where they actually land — that check is the
 * landing-point terrain classification, not this.
 */
export function firstWaterAlongGround(features, from, to) {
  for (let index = 1; index <= 20; index += 1) {
    const point = [from[0] + ((to[0] - from[0]) * index) / 20, from[1] + ((to[1] - from[1]) * index) / 20];
    if (classifyTerrain(features, point) === "Penalty area") return point;
  }
  return null;
}

export function placeInRough(projection, seed, perpendicular) {
  const prefer = projection.dangerSide === "left" ? -1 : 1;
  const sides = prefer < 0 ? [-1, 1] : [1, -1];
  for (const side of sides) {
    for (const distance of [18, 26, 34, 44]) {
      const point = [seed[0] + perpendicular[0] * distance * side, seed[1] + perpendicular[1] * distance * side];
      if (classifyTerrain(projection.features, point) === "Rough") return point;
    }
  }
  return [seed[0] + perpendicular[0] * 24 * prefer, seed[1] + perpendicular[1] * 24 * prefer];
}

export function treeCollision(projection, holeNumber, point) {
  for (const tree of projection.trees || buildTreeSprites(projection, holeNumber)) {
    if (Math.hypot(point[0] - tree.x, point[1] - tree.y) <= tree.size * 1.15) return tree;
  }
  return null;
}

// Out of bounds is a corridor around the hole line, not the edge of the drawn
// map: the map frame is just the bounding box of whatever OSM traced, which
// left 12 m rough strips on some holes and 60 m on others.
const OB_HALF_WIDTH = 48;
const OB_MAP_MARGIN = 24;

export function outOfBounds(projection, point) {
  const offMap =
    point[0] < -OB_MAP_MARGIN ||
    point[0] > projection.width + OB_MAP_MARGIN ||
    point[1] < -OB_MAP_MARGIN ||
    point[1] > projection.height + OB_MAP_MARGIN;
  if (offMap) return true;
  return distanceToPolyline(projection.line, point, true) > OB_HALF_WIDTH;
}

export function placeTeeLanding(projection, hole, decision, wantedType) {
  const { target, perpendicular } = computeShotTarget(projection, hole, decision);
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const drift = shapeDrift(projection, shape);
  const aimed = [target[0] + perpendicular[0] * drift, target[1] + perpendicular[1] * drift];
  let point = aimed;
  let type = wantedType;

  if (type === "Penalty area") {
    const water = nearestFeaturePoint(projection.features, "water", aimed, 72);
    if (water) point = water.point;
    else type = "Rough";
  }
  if (type === "Bunker") {
    const bunker = nearestFeaturePoint(projection.features, "bunker", aimed, 48);
    if (bunker) point = bunker.point;
    else type = "Rough";
  }
  if (type === "Fairway") {
    const fairway = nearestFeaturePoint(projection.features, ["fairway", "green"], aimed, 56);
    if (fairway) point = fairway.point;
  }
  if (type === "Rough") point = placeInRough(projection, aimed, perpendicular);

  // The trees are real now: a ball landing in a canopy kicks out toward the tee.
  let treeHit = false;
  const tree = treeCollision(projection, hole.number, point);
  if (tree) {
    treeHit = true;
    const toTee = [projection.tee[0] - point[0], projection.tee[1] - point[1]];
    const away = Math.hypot(toTee[0], toTee[1]) || 1;
    const kick = tree.size * 1.15 + 5;
    point = [point[0] + (toTee[0] / away) * kick, point[1] + (toTee[1] / away) * kick];
  }

  // Off the mapped corridor entirely = OB, stroke and distance.
  if (outOfBounds(projection, point)) {
    return {
      point: [clamp(point[0], 3, projection.width - 3), clamp(point[1], 3, projection.height - 3)],
      type: "Penalty area",
      ob: true,
      treeHit,
    };
  }
  return { point, type: classifyTerrain(projection.features, point), treeHit };
}

/**
 * Resolve one played full swing in shot-by-shot mode: carry from club/power,
 * scatter from accuracy, then real terrain — trees, water, OB, sand, green.
 */
/**
 * The golfer's carry model for a club from a lie: the sweet-spot carry and
 * the dispersion oval around it. Shared by the physics and by the CPU, which
 * solves it backwards to decide how hard to swing.
 */
export function carryProfile({ clubId, lie, carryBoost = 1, fireball = false, spin = "none", hi = 12 }) {
  const lieMult = lie === "Rough" ? 0.88 : lie === "Bunker" ? 0.8 : 1;
  const liveClub = liveClubOf(clubId);
  const baseCarry = liveClub ? liveClub.carry : (CLUBS.find((club) => club.id === clubId) || CLUBS[2]).carry;
  // Fireball: a little more gas and a lot more spray, in both swing modes.
  // Spin trades a touch of carry (back) or adds a touch (top); the real
  // difference shows up in the rollout.
  const spinCarry = spin === "back" ? 0.97 : spin === "top" ? 1.02 : 1;
  const centerCarry = baseCarry * LIVE_CARRY_SWEET * (carryBoost || 1) * lieMult * (fireball ? 1.06 : 1) * spinCarry;
  const basePattern = shotPatternFor(hi, centerCarry);
  const pattern = fireball
    ? { lateral: basePattern.lateral * 1.4, short: basePattern.short * 1.15, long: basePattern.long * 1.3 }
    : basePattern;
  return { centerCarry, pattern };
}

/** The meter power that carries `yards` with this profile (the sweet spot is 0.87; each 0.09 is one oval depth). */
export function powerForCarry(profile, yards) {
  const gap = yards - profile.centerCarry;
  const depthNorm = clamp(gap / (gap < 0 ? profile.pattern.short : profile.pattern.long), -1.6, 1.6);
  return clamp(0.87 + depthNorm * 0.09, 0.55, 1.1);
}

export function resolveLiveStroke({
  projection,
  hole,
  from,
  lie,
  meter,
  judgment,
  clubId,
  carryBoost,
  yardsScale,
  aimUnits = 0,
  drunk = false,
  hi = 12,
  zoneScale = 1,
  seedSalt = 0,
  lineTarget = null,
  fireball = false,
  rng = null,
  wind = null,
  spin = "none",
}) {
  const pin = projection.pin;
  const scale = yardsScale > 0 ? yardsScale : 1;
  // A tee ball flies at the planned target on the hole line (doglegs bend,
  // the ball does not); every later stroke aims straight at the pin.
  const aimAt = lineTarget || pin;
  const dx = aimAt[0] - from[0];
  const dy = aimAt[1] - from[1];
  const distUnits = Math.hypot(dx, dy) || 1;
  const dir = [dx / distUnits, dy / distUnits];
  // Miss direction matches the meter as the PLAYER sees it: the needle's
  // right is the screen's right, so the lateral axis always points screen-
  // right — even on shots played back toward the tee.
  let perp = [-dir[1], dir[0]];
  // screenFlip converts between the map frame (wind, theater arc) and the
  // player's frame (meter, lateral miss) on shots played back down the map.
  const screenFlip = perp[0] < 0 ? -1 : 1;
  if (perp[0] < 0) perp = [-perp[0], -perp[1]];
  const power = clamp(Number(meter.power) || 0.9, 0, 1.15);
  const { centerCarry, pattern } = carryProfile({ clubId, lie, carryBoost, fireball, spin, hi });
  const wild = judgment.tier === "wild";
  let carryYards;
  let lateralYards;
  let caption = null;
  let groundBall = false;
  if (!wild) {
    // The meter places the ball inside the oval: dead-center taps land dead
    // center; edge-of-good taps ride the oval's edge.
    const lineNorm = clamp(meter.accuracy / (ACC_GOOD * (zoneScale || 1)), -1, 1);
    const depthNorm = clamp((power - 0.87) / 0.09, -1.6, 1.6);
    lateralYards = lineNorm * pattern.lateral;
    carryYards = centerCarry + (depthNorm < 0 ? depthNorm * pattern.short : depthNorm * pattern.long);
  } else {
    // Shank table: a wild tap is a real mishit — top, duff, or the big miss.
    const side = meter.accuracy >= 0 ? 1 : -1;
    const roll = rng ? rng() : seededUnit(seedSalt);
    if (roll < 0.2) {
      carryYards = centerCarry * 0.28;
      lateralYards = side * pattern.lateral * 0.4;
      caption = "TOPPED IT!";
      groundBall = true;
    } else if (roll < 0.4) {
      carryYards = Math.max(6, centerCarry * 0.12);
      lateralYards = side * pattern.lateral * 0.2;
      caption = "CHUNKED IT!";
      groundBall = true;
    } else {
      carryYards = centerCarry * 0.8;
      lateralYards = side * pattern.lateral * 2.8 * (drunk ? 1.3 : 1);
      caption = side > 0 ? "BANANA SLICE!" : "SNAP HOOK!";
    }
  }
  // Wind works on anything in the air: into it costs carry, across it drifts.
  let windDrift = 0;
  if (!groundBall && wind && wind.mph) {
    const effect = windEffect(wind, dir, carryYards);
    carryYards *= effect.carryMult;
    windDrift = effect.driftYards;
    lateralYards += windDrift * screenFlip;
  }
  const land = [
    from[0] + dir[0] * carryYards * scale + perp[0] * (lateralYards * scale + aimUnits),
    from[1] + dir[1] * carryYards * scale + perp[1] * (lateralYards * scale + aimUnits),
  ];
  const kind = lie === "Tee" ? (hole.par <= 3 ? "tee" : "drive") : lie === "Bunker" ? "sand" : lie === "Rough" ? "punch" : "approach";
  // Ground balls stay on the dirt; airborne wild ones visibly banana-slice.
  const bend = groundBall ? 0 : clamp(screenFlip * meter.accuracy * 20 * (wild ? 2.4 : 1) + windDrift * 1.2, -55, 55);
  const shankCaption = caption;
  const yardsOf = (point) => Math.round(Math.hypot(point[0] - from[0], point[1] - from[1]) / scale);
  let rollYards = 0; // signed: negative when backspin pulls the ball back

  const finish = (rest, extra) => ({
    kind,
    to: rest,
    carryTo: land,
    nextPos: rest,
    caption,
    bend,
    ground: groundBall,
    rollYards: Math.round(rollYards),
    totalYards: yardsOf(rest),
    ...extra,
  });
  const splash = (wet, why = null) => ({
    kind: "splash",
    to: wet,
    carryTo: land,
    nextPos: dryDropPoint(projection, wet, from),
    nextLie: "Rough",
    penalty: 1,
    bend,
    ground: groundBall,
    caption: why || (shankCaption ? `${shankCaption} SPLASH!` : null),
    totalYards: yardsOf(wet),
  });
  const outOf = (point, why) => ({
    kind: "ob",
    to: [clamp(point[0], 3, projection.width - 3), clamp(point[1], 3, projection.height - 3)],
    carryTo: land,
    nextPos: from,
    nextLie: lie,
    penalty: 1,
    bend,
    ground: groundBall,
    caption: why || (wild ? `${shankCaption || "WILD ONE"}... OB!` : null),
    totalYards: yardsOf(point),
  });

  // Only ground-scuttling mishits can find water mid-path; a flighted ball
  // splashes only where it lands (checked below).
  const waterHit = groundBall ? firstWaterAlongGround(projection.features, from, land) : null;
  if (waterHit) return splash(waterHit);
  const tree = !groundBall ? treeCollision(projection, hole.number, land) : null;
  if (tree) {
    caption = caption || "CLIPS A TREE!";
    const toTee = [from[0] - land[0], from[1] - land[1]];
    const away = Math.hypot(toTee[0], toTee[1]) || 1;
    const kick = tree.size * 1.15 + 5;
    land[0] += (toTee[0] / away) * kick;
    land[1] += (toTee[1] / away) * kick;
  }
  if (outOfBounds(projection, land)) return outOf(land);
  // Wherever the ball graphic lands decides: water is water, before any
  // green proximity — a pond beside the pin is still a pond.
  const landTerrain = classifyTerrain(projection.features, land);
  if (landTerrain === "Penalty area") return splash(land);
  const landOnGreen = landTerrain === "Fairway" && pointNearGreen(land, projection);
  const pinDistLand = Math.hypot(land[0] - pin[0], land[1] - pin[1]);
  // A flushed short iron can drop right in the bucket.
  const jarWindow = clubId === "wedge" || clubId === "sandwedge" || clubId === "chip" ? 2.4 : 1.3;
  if (!groundBall && judgment.tier === "pure" && pinDistLand <= jarWindow) {
    const jarCaption =
      kind === "tee" ? "HOLE IN ONE!!!" : kind === "drive" ? "HOLED IT FROM THE TEE!" : kind === "sand" ? "HOLES IT FROM THE SAND!" : "SLAM DUNK!";
    return finish(pin, { nextPos: pin, holed: true, ace: kind === "tee", caption: jarCaption });
  }
  // Rollout: the ball keeps going after it lands, more on short grass and
  // with topspin, less on rough, not at all in sand. Backspin holds a green
  // and a flushed one bites back toward the player.
  if (!tree) {
    const lowFlight = kind === "sand" || kind === "punch";
    const base = landTerrain === "Bunker" ? 0 : landTerrain === "Rough" ? 0.02 : landOnGreen ? 0.04 : kind === "drive" ? 0.09 : 0.06;
    const spinMult = spin === "back" ? (landOnGreen ? 0 : 0.5) : spin === "top" ? 2.2 : 1;
    rollYards = carryYards * base * spinMult * (groundBall ? 1.6 : 1) * (lowFlight ? 1.4 : 1);
    if (spin === "back" && landOnGreen && !groundBall && (judgment.tier === "pure" || judgment.tier === "great")) {
      const back = -(judgment.tier === "pure" ? 3 : 1.5);
      const bitTo = [land[0] + dir[0] * back * scale, land[1] + dir[1] * back * scale];
      // A ball only spins back across the green, never off it into a hazard.
      if (pointNearGreen(bitTo, projection) && classifyTerrain(projection.features, bitTo) === "Fairway") {
        rollYards = back;
        caption = caption || "BITES!";
      }
    }
  }
  let rest = [land[0] + dir[0] * rollYards * scale, land[1] + dir[1] * rollYards * scale];
  if (Math.abs(rollYards) > 0.5) {
    const rolledIn = firstWaterAlongGround(projection.features, land, rest);
    if (rolledIn) return splash(rolledIn, "ROLLS INTO THE WATER!");
    if (outOfBounds(projection, rest)) return outOf(rest, "ROLLS OUT OF BOUNDS!");
    if (classifyTerrain(projection.features, rest) === "Penalty area") return splash(rest, "ROLLS INTO THE WATER!");
  }
  const restTerrain = classifyTerrain(projection.features, rest);
  // Sand beside the green is still sand; only then does green proximity count.
  if (restTerrain === "Bunker") return finish(rest, { nextLie: "Bunker" });
  const pinDist = Math.hypot(rest[0] - pin[0], rest[1] - pin[1]);
  if (pointNearGreen(rest, projection)) {
    const feet = clamp(Math.round((pinDist / scale) * 3), 2, 60);
    // Proximity call-outs for anything that flew in from off the green.
    if (!groundBall && kind !== "putt" && !caption) {
      caption = feet <= 3 ? "KICK-IN!" : feet <= 8 ? "STIFF!" : feet <= 15 ? "GREAT LOOK!" : null;
    }
    return finish(rest, { nextLie: "Green", feet, proximityFeet: feet });
  }
  return finish(rest, { nextLie: restTerrain });
}

/** Walk back from a wet spot toward the shot's origin until the drop is dry. */
export function dryDropPoint(projection, wet, from) {
  // Walk back toward where the shot came from in fixed 4 m steps: the drop
  // is next to the hazard, not a fraction of the way back down the hole.
  const span = Math.hypot(wet[0] - from[0], wet[1] - from[1]) || 1;
  for (let back = 4; back <= span * 0.95; back += 4) {
    const candidate = interpolate(wet, from, back / span);
    if (classifyTerrain(projection.features, candidate) !== "Penalty area" && !outOfBounds(projection, candidate)) {
      return candidate;
    }
  }
  return from;
}

/** Keep decorative sequence landings honest: never rest a ball in water/OB. */
export function dryVisualPoint(projection, from, point) {
  if (classifyTerrain(projection.features, point) !== "Penalty area" && !outOfBounds(projection, point)) return point;
  for (let t = 0.85; t >= 0.1; t -= 0.12) {
    const candidate = interpolate(from, point, t);
    if (classifyTerrain(projection.features, candidate) !== "Penalty area" && !outOfBounds(projection, candidate)) {
      return candidate;
    }
  }
  return from;
}

/**
 * Handicap-based dispersion pattern for a full swing: the oval of where this
 * golfer's shots actually finish, per real amateur dispersion data. Radii are
 * "most shots inside" (~1.5 sigma) in yards. lateral = half-width, short/long
 * = depth behind/past the target center.
 */
export function shotPatternFor(hi, carryYards) {
  const hcp = clamp(Number(hi) || 12, 0, 28);
  const driverLike = carryYards >= 180;
  // Real driver spread is nearly flat across handicaps (Arccos/Stagner), but
  // this is an arcade game: we exaggerate the gap so a scratch driver oval is
  // a lane and a 20-capper's is a barn door. Approaches follow proximity
  // data: radius ~ distance * (5.5% + 0.35% per handicap point).
  const lateral = driverLike
    ? (12 + 0.95 * hcp) * 1.25 * clamp(carryYards / 250, 0.8, 1.15)
    : carryYards * (0.055 + 0.0035 * hcp);
  // Drivers spread wider than deep (~1.5:1); irons/wedges run deeper than
  // wide and miss SHORT far more than long (54-75% short misses).
  const depth = driverLike ? lateral / 1.5 : lateral * (1.15 + hcp * 0.01);
  const shortBias = 0.2 + hcp * 0.02;
  const short = depth * (1 + shortBias);
  const long = depth * (1 - shortBias * 0.55);
  return { lateral, short, long };
}
