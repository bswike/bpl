// Decorative shot sequences and flight frames for playback.

import {
  clamp,
  interpolate,
  quadPoint,
  seededUnit,
} from "./geometry.js";
import { pointNearGreen } from "./camera.js";
import {
  computeShotTarget,
  dryDropPoint,
  dryVisualPoint,
  placeTeeLanding,
  shapeBend,
} from "./shotPhysics.js";
import { forLabelOf, stimpOf } from "./putting.js";
import { SHAPES } from "../tripGameEngine.js";
export const FLIGHT_FRAME_MS = 78;

export const SHOT_CAPTIONS = {
  drive: "CRUSHED OFF THE TEE!",
  tee: "TEE SHOT AWAY!",
  splash: "OH NO... SPLASH!",
  ob: "OB! STROKE AND DISTANCE!",
  sand: "OUT OF THE SAND!",
  punch: "PUNCHES FROM THE ROUGH!",
  approach: "APPROACH SHOT...",
  putt: "ROLLING...",
};

export function framesToPath(frames, lifted = true) {
  if (!frames.length) return "";
  return frames
    .map((frame, index) => {
      const x = lifted ? frame.x : frame.gx;
      const y = lifted ? frame.y : frame.gy;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function buildFlightFrames({ from, to, control, apex, air }) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const count = air ? clamp(Math.round(distance / 10), 10, 18) : clamp(Math.round(distance / 4.5), 6, 10);
  const frames = [];
  for (let index = 0; index <= count; index += 1) {
    const t = index / count;
    const ground = quadPoint(from, control, to, t);
    const lift = air ? 4 * t * (1 - t) * apex : 0;
    frames.push({
      gx: ground[0],
      gy: ground[1],
      x: ground[0],
      y: ground[1] - lift,
      lift,
      size: air ? clamp(3.6 + lift * 0.08, 3.6, 7.2) : 3,
      shadow: Math.max(1.1, 3.1 - lift * 0.045),
    });
  }
  return frames;
}

export function makeShot({ from, to, kind, bend = 0, final = false, yardsScale = 0, caption = null, ground = false }) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const air = kind !== "putt" && !ground;
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const lateral = air ? bend : 0;
  const control = [
    (from[0] + to[0]) / 2 + (-dy / length) * lateral,
    (from[1] + to[1]) / 2 + (dx / length) * lateral,
  ];
  const lowFlight = kind === "sand" || kind === "punch";
  const apex = air ? clamp(distance * (lowFlight ? 0.34 : 0.62), 18, 78) : 0;
  const frames = buildFlightFrames({ from, to, control, apex, air });
  return {
    from,
    to,
    control,
    kind,
    final,
    air,
    apex,
    frames,
    airPath: framesToPath(frames, true),
    groundPath: framesToPath(frames, false),
    yards: yardsScale ? Math.max(1, Math.round(distance / yardsScale)) : null,
    caption: caption || (final ? "FOR THE HOLE..." : SHOT_CAPTIONS[kind] || "SWINGS..."),
    duration: frames.length * FLIGHT_FRAME_MS,
  };
}

/**
 * Turn a sampled hole outcome into a cartoon shot-by-shot sequence:
 * tee ball -> (drop) -> approaches -> putts, ending in the cup.
 * Works for either side — shots are tagged so the theater knows who is hitting.
 */
export function buildShotSequence({ projection, hole, decision, gross, landingLabel, side = "human", seedSalt = 0 }) {
  const { lineLength } = computeShotTarget(projection, hole, decision);
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const yardsScale = hole.yards ? lineLength / hole.yards : 0;
  const pin = projection.pin;
  const placed = placeTeeLanding(projection, hole, decision, landingLabel);
  const landingType = placed.type;
  const landing = placed.point;
  const bend = shapeBend(projection, shape);
  const seed = hole.number * 37 + gross * 11 + seedSalt;
  const jitter = (index, scale) => (seededUnit(seed + index) - 0.5) * scale;

  const shots = [];
  let current = projection.tee;
  let remaining = gross;

  if (landingType === "Penalty area") {
    shots.push(makeShot({ from: current, to: landing, kind: placed.ob ? "ob" : "splash", bend, yardsScale }));
    remaining -= 2; // stroke plus penalty
    current = dryDropPoint(projection, landing, projection.tee);
  } else {
    shots.push(
      makeShot({
        from: current,
        to: landing,
        kind: hole.par <= 3 ? "tee" : "drive",
        bend,
        yardsScale,
        caption: placed.treeHit ? "CLIPS A TREE!" : null,
      }),
    );
    remaining -= 1;
    current = landing;
  }
  remaining = Math.max(1, remaining);

  // On the green already (drove a par 4, reached in regulation, etc.):
  // everything left is putts — nobody chips off the putting surface.
  const teeBallOnGreen = landingType !== "Penalty area" && landingType !== "Bunker" && pointNearGreen(current, projection);
  let putts;
  if (teeBallOnGreen) {
    putts = remaining;
  } else if (hole.par === 3 && (landingType === "Fairway" || landingType === "Rough") && remaining <= 2) {
    putts = remaining; // par-3 tee ball is greenside; just putt out
  } else {
    putts = remaining >= 3 ? 2 : remaining === 2 ? (hole.par === 3 ? 2 : 1) : 1;
  }
  putts = clamp(putts, 1, 3);
  let approaches = remaining - putts;
  if (approaches < 0) {
    approaches = 0;
    putts = remaining;
  }

  const greenEntry = [pin[0] + jitter(1, 10), pin[1] + 5 + jitter(2, 4)];
  for (let index = 0; index < approaches; index += 1) {
    // An earlier shot already found the green — putt out from here instead.
    if (pointNearGreen(current, projection)) {
      putts += approaches - index;
      break;
    }
    const last = index === approaches - 1;
    // Never let a decorative landing rest in water or off the map — the
    // sampled score didn't include a penalty there.
    const destination = dryVisualPoint(
      projection,
      current,
      last
        ? greenEntry
        : [
            interpolate(current, greenEntry, (index + 1) / approaches)[0] + jitter(index + 3, 14),
            interpolate(current, greenEntry, (index + 1) / approaches)[1] + jitter(index + 7, 8),
          ],
    );
    const kind =
      index === 0 && landingType === "Bunker"
        ? "sand"
        : index === 0 && landingType === "Rough"
          ? "punch"
          : "approach";
    shots.push(makeShot({ from: current, to: destination, kind, bend: jitter(index + 11, 12), yardsScale }));
    current = destination;
  }

  // Each putt gets a deterministic read (break + slope) and chained scene
  // geometry: the next putt starts exactly where the last one finished, so a
  // good lag leaves a short one instead of resetting across the green.
  const sceneCup = [85, 36];
  let sceneCarry = null;
  const puttScene = (salt, mapFrom, mapTo, final) => {
    const breakDir = (seededUnit(seed + salt) - 0.5) * 1.8;
    const slope = (seededUnit(seed + salt + 1) - 0.5) * 1.6;
    const yardsFeet = yardsScale
      ? Math.round((Math.hypot(mapTo[0] - mapFrom[0], mapTo[1] - mapFrom[1]) / yardsScale) * 3)
      : 8;
    const start = sceneCarry || [
      sceneCup[0] - breakDir * clamp(yardsFeet * 0.9, 4, 22),
      sceneCup[1] + clamp(26 + yardsFeet * 1.3, 34, 78),
    ];
    const distFromCup = Math.hypot(start[0] - sceneCup[0], start[1] - sceneCup[1]);
    const feet = sceneCarry ? Math.max(1, Math.round(distFromCup / 2.5)) : clamp(Math.max(2, yardsFeet), 2, 48);
    const nearBase = sceneCarry ? 3.2 : 6;
    const end = final
      ? sceneCup
      : [sceneCup[0] - breakDir * 2.5, sceneCup[1] + nearBase + seededUnit(seed + salt + 2) * (sceneCarry ? 1.5 : 3.5)];
    sceneCarry = final ? null : end;
    return { breakDir, slope, start, end, feet, stimp: stimpOf(hole) };
  };
  const lagTotal = Math.min(3, putts) - 1;
  for (let lag = 0; lag < lagTotal; lag += 1) {
    const lagSpot = [pin[0] + jitter(13 + lag, 3), pin[1] + 1.6 + jitter(14 + lag, 1.5)];
    shots.push({
      ...makeShot({ from: current, to: lagSpot, kind: "putt", yardsScale }),
      putt: { ...puttScene(40 + lag * 3, current, lagSpot, false), for: forLabelOf(gross - (lagTotal - lag) - hole.par) },
    });
    current = lagSpot;
  }
  shots.push({
    ...makeShot({ from: current, to: pin, kind: "putt", final: true, yardsScale }),
    putt: { ...puttScene(48, current, pin, true), for: forLabelOf(gross - hole.par) },
  });
  return shots.map((shot) => ({ ...shot, side }));
}

/**
 * Interleave the two sides match-play style: honors off the tee, then the
 * ball farther from the hole plays — and keeps playing while still away.
 */
export function mergeMatchPlayShots(firstSide, secondSide, pin) {
  if (!pin) return [...firstSide, ...secondSide];
  const merged = [];
  let a = 0;
  let b = 0;
  if (firstSide.length) merged.push(firstSide[a++]);
  if (secondSide.length) merged.push(secondSide[b++]);
  const away = (shot) => Math.hypot(shot.from[0] - pin[0], shot.from[1] - pin[1]);
  while (a < firstSide.length || b < secondSide.length) {
    if (a >= firstSide.length) {
      merged.push(secondSide[b++]);
    } else if (b >= secondSide.length) {
      merged.push(firstSide[a++]);
    } else if (away(firstSide[a]) >= away(secondSide[b])) {
      merged.push(firstSide[a++]);
    } else {
      merged.push(secondSide[b++]);
    }
  }
  return merged;
}
