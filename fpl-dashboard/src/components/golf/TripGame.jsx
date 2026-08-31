import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLUBS,
  SCORE_BUCKETS,
  SHAPES,
  aimOffsetOf,
  buildHoleOdds,
  buildTripGameModel,
  chooseCpuPlayer,
  courseHandicap,
  defaultDecision,
  holePops,
  findBestDecision,
  formatOdds,
  makeSeededRandom,
  matchCloseout,
  resolveMatchHole,
  skillOf,
} from "./tripGameEngine.js";
import {
  contactSound,
  crowdSwell,
  holeWinSound,
  holeoutSound,
  lockPowerSound,
  nearMissSound,
  riskArmedSound,
  setMeterAudioEnabled,
  splashSound,
  startHeartbeat,
  startPowerSweep,
  stopHeartbeat,
  stopPowerSweep,
  swingJudgmentSound,
  unlockMeterAudio,
  updatePowerSweep,
  yardRollTick,
  yardRollFinal,
  zoneTick,
} from "./meterAudio";
import "./TripGame.css";

const ARCHIVE_FILES = ["/data/golftrip-nj26.json", "/data/golftrip-2025.json"];
const FIREBALL_HOLES = new Set([4, 8, 12, 16]);
const CART_GIRL_HOLES = new Set([6, 14]);
const PLAYBACK_SAFETY_MS = 28000;
const FLIGHT_FRAME_MS = 78;
const FEATURE_ORDER = { water: 0, fairway: 1, bunker: 2, green: 3, tee: 4 };
const DEFAULT_PLAYER_STATE = Object.freeze({ buzz: 0, morale: 50 });

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

const AIM_STEP = 0.155;
const AIM_MAX = 0.93;

function aimText(aim) {
  const offset = aimOffsetOf(aim);
  const yards = Math.round((offset / AIM_MAX) * 25);
  if (yards === 0) return "CENTER";
  return `${Math.abs(yards)}Y ${yards < 0 ? "LEFT" : "RIGHT"}`;
}

function lastName(name) {
  return String(name || "").trim().split(/\s+/).at(-1) || name;
}

function pathFromPoints(points, close = true) {
  if (!points?.length) return "";
  const commands = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  return `${commands.join(" ")}${close ? " Z" : ""}`;
}

function polylineLength(points) {
  let total = 0;
  for (let index = 1; index < (points?.length || 0); index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
  }
  return total;
}

function pointAlongPolyline(points, distance) {
  if (!points?.length) return { point: [0, 0], tangent: [0, -1] };
  if (points.length === 1) return { point: points[0], tangent: [0, -1] };
  let remaining = Math.max(0, distance);
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    if (remaining <= length) {
      const ratio = remaining / length;
      return {
        point: [start[0] + dx * ratio, start[1] + dy * ratio],
        tangent: [dx / length, dy / length],
      };
    }
    remaining -= length;
  }
  const end = points.at(-1);
  const previous = points.at(-2);
  const dx = end[0] - previous[0];
  const dy = end[1] - previous[1];
  const length = Math.hypot(dx, dy) || 1;
  return { point: end, tangent: [dx / length, dy / length] };
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function buildTreeSprites(projection, holeNumber) {
  const length = polylineLength(projection.line);
  if (!length) return [];
  const rows = clamp(Math.round(projection.height / 44), 6, 13);
  const trees = [];
  for (let row = 0; row < rows; row += 1) {
    const progress = 0.08 + (row / Math.max(1, rows - 1)) * 0.82;
    const axis = pointAlongPolyline(projection.line, length * progress);
    const perpendicular = [-axis.tangent[1], axis.tangent[0]];
    for (const side of [-1, 1]) {
      const seed = holeNumber * 101 + row * 17 + (side > 0 ? 7 : 3);
      if (seededUnit(seed) < 0.13) continue;
      const corridor = clamp(projection.width * 0.22, 18, 43);
      const offset = corridor + seededUnit(seed + 1) * 13;
      const along = (seededUnit(seed + 2) - 0.5) * 12;
      const x = axis.point[0] + perpendicular[0] * offset * side + axis.tangent[0] * along;
      const y = axis.point[1] + perpendicular[1] * offset * side + axis.tangent[1] * along;
      if (x < 5 || x > projection.width - 5 || y < 8 || y > projection.height - 8) continue;
      trees.push({
        x,
        y,
        size: 4.2 + seededUnit(seed + 3) * 3.6,
        variant: Math.floor(seededUnit(seed + 4) * 3),
      });
    }
  }
  return trees;
}

function routeShapeProfile(line, tee, pin) {
  const length = polylineLength(line);
  if (!length) return { preferredShape: "straight", shapeSeverity: 0 };
  const samples = [
    { progress: 0.3, weight: 0.2 },
    { progress: 0.5, weight: 0.5 },
    { progress: 0.68, weight: 0.3 },
  ];
  const deviation = samples.reduce((total, sample) => {
    const point = pointAlongPolyline(line, length * sample.progress).point;
    const directX = tee[0] + (pin[0] - tee[0]) * sample.progress;
    return total + (point[0] - directX) * sample.weight;
  }, 0);
  const shapeSeverity = clamp((Math.abs(deviation) - 3) / 28, 0, 1);
  return {
    preferredShape: shapeSeverity < 0.12 ? "straight" : deviation < 0 ? "cut" : "draw",
    shapeSeverity,
  };
}

function polygonCentroid(points) {
  let x = 0;
  let y = 0;
  for (const point of points) {
    x += point[0];
    y += point[1];
  }
  return [x / points.length, y / points.length];
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current[0] * next[1] - next[0] * current[1];
  }
  return Math.abs(area) / 2;
}

function interpolate(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function curvedPath(from, to, bend) {
  const mid = interpolate(from, to, 0.5);
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const perpendicular = [-dy / length, dx / length];
  const control = [mid[0] + perpendicular[0] * bend, mid[1] + perpendicular[1] * bend];
  return `M${from[0].toFixed(1)},${from[1].toFixed(1)} Q${control[0].toFixed(1)},${control[1].toFixed(1)} ${to[0].toFixed(
    1,
  )},${to[1].toFixed(1)}`;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function featureBounds(features, type) {
  const points = features.filter((feature) => feature.type === type).flatMap((feature) => feature.points);
  if (!points.length) return null;
  return {
    minX: Math.min(...points.map((point) => point[0])),
    maxX: Math.max(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxY: Math.max(...points.map((point) => point[1])),
    cx: points.reduce((total, point) => total + point[0], 0) / points.length,
    cy: points.reduce((total, point) => total + point[1], 0) / points.length,
  };
}

function clampCamera(camera, worldW, worldH) {
  const w = clamp(camera.w, 12, worldW);
  const h = clamp(camera.h, 12, worldH);
  return {
    x: clamp(camera.x, 0, Math.max(0, worldW - w)),
    y: clamp(camera.y, 0, Math.max(0, worldH - h)),
    w,
    h,
  };
}

function fullCamera(projection) {
  return { x: 0, y: 0, w: projection.width, h: projection.height };
}

function cameraWindow(cx, cy, height, worldW, worldH, aspect = 0.82) {
  const h = clamp(height, 80, worldH);
  let w = h * aspect;
  if (w > worldW) w = worldW;
  const finalH = Math.min(Math.max(w / aspect, 80), worldH);
  return clampCamera({ x: cx - w / 2, y: cy - finalH / 2, w, h: finalH }, worldW, worldH);
}

function lookAheadPoint(from, to, distance) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const t = clamp(distance / length, 0, 1);
  return [from[0] + dx * t, from[1] + dy * t];
}

function cameraContains(camera, point, margin = 14) {
  return (
    point[0] >= camera.x + margin &&
    point[0] <= camera.x + camera.w - margin &&
    point[1] >= camera.y + margin &&
    point[1] <= camera.y + camera.h - margin
  );
}

function trackShotCamera({ projection, ballAir, ballGround, destination, kind, onGreen }) {
  const worldW = projection.width;
  const worldH = projection.height;
  const look = lookAheadPoint(ballGround, destination, onGreen || kind === "putt" ? 42 : 110);
  const cx = ballAir[0] * 0.48 + look[0] * 0.52;
  const cy = ballAir[1] * 0.42 + look[1] * 0.48 + ballGround[1] * 0.1;
  const coverH = Math.abs(look[1] - ballAir[1]) + Math.abs(ballGround[1] - ballAir[1]) + 58;
  const coverW = Math.abs(look[0] - ballAir[0]) + 46;
  const minH = onGreen || kind === "putt" ? 128 : 168;
  const maxH = onGreen || kind === "putt" ? 168 : kind === "drive" || kind === "tee" ? 236 : 200;
  return cameraWindow(cx, cy, clamp(Math.max(coverH, coverW / 0.78, minH), minH, maxH), worldW, worldH, 0.78);
}

function usableGreen(projection) {
  const green = featureBounds(projection.features, "green");
  if (!green) return null;
  const wide = green.maxX - green.minX;
  const tall = green.maxY - green.minY;
  if (wide > projection.width * 0.62 || tall > projection.height * 0.32) return null;
  return green;
}

function greenCamera(projection) {
  const green = usableGreen(projection);
  const pin = projection.pin;
  const span = projection.height * 0.4;
  if (green) {
    const cx = lerp(green.cx, pin[0], 0.3);
    const cy = lerp(green.cy, pin[1], 0.3);
    return cameraWindow(cx, cy, Math.max(span, (green.maxY - green.minY) * 2.8), projection.width, projection.height);
  }
  return cameraWindow(pin[0], pin[1], span, projection.width, projection.height);
}

function pointNearGreen(point, projection) {
  if (Math.hypot(point[0] - projection.pin[0], point[1] - projection.pin[1]) < 22) return true;
  const green = usableGreen(projection);
  if (!green) return false;
  return (
    point[0] >= green.minX - 6 &&
    point[0] <= green.maxX + 6 &&
    point[1] >= green.minY - 6 &&
    point[1] <= green.maxY + 6
  );
}

function blendCamera(from, to, t) {
  if (!from) return to;
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  };
}

function computeMapCamera({ projection, playback, landing, activeShot, flightFrame }) {
  const overview = fullCamera(projection);
  const pin = projection.pin;
  const greenCam = greenCamera(projection);

  if (playback && activeShot) {
    const ground = flightFrame
      ? [flightFrame.gx, flightFrame.gy]
      : playback.phase === "settle"
        ? activeShot.to
        : activeShot.from;
    const air = flightFrame ? [flightFrame.x, flightFrame.y] : ground;
    const openingTee = playback.index === 0 && (activeShot.kind === "drive" || activeShot.kind === "tee" || activeShot.kind === "splash");
    const onGreenNow =
      activeShot.kind === "putt" ||
      activeShot.final ||
      (pointNearGreen(ground, projection) && !openingTee);

    if (openingTee && playback.phase === "swing") {
      return cameraWindow(activeShot.from[0], activeShot.from[1] - 2, 84, projection.width, projection.height, 1.15);
    }

    const follow = trackShotCamera({
      projection,
      ballAir: air,
      ballGround: ground,
      destination: activeShot.to,
      kind: activeShot.kind,
      onGreen: onGreenNow,
    });

    if (onGreenNow) return blendCamera(follow, greenCam, 0.55);

    return follow;
  }

  if (landing) {
    return trackShotCamera({
      projection,
      ballAir: landing,
      ballGround: landing,
      destination: pin,
      kind: "approach",
      onGreen: pointNearGreen(landing, projection),
    });
  }

  return overview;
}

function computeShotTarget(projection, hole, decision) {
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

function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, prior = polygon.length - 1; index < polygon.length; prior = index, index += 1) {
    const current = polygon[index];
    const previous = polygon[prior];
    const crosses =
      current[1] > point[1] !== previous[1] > point[1] &&
      point[0] < ((previous[0] - current[0]) * (point[1] - current[1])) / ((previous[1] - current[1]) || 1e-6) + current[0];
    if (crosses) inside = !inside;
  }
  return inside;
}

function classifyTerrain(features, point) {
  const hit = (type) =>
    (features || []).some((feature) => feature.type === type && feature.points?.length >= 3 && pointInPolygon(point, feature.points));
  if (hit("water")) return "Penalty area";
  if (hit("bunker")) return "Bunker";
  if (hit("green") || hit("fairway") || hit("tee")) return "Fairway";
  return "Rough";
}

function pointInsideFeature(feature, target) {
  if (pointInPolygon(target, feature.points)) return target;
  const centroid = polygonCentroid(feature.points);
  if (pointInPolygon(centroid, feature.points)) return centroid;
  for (const vertex of feature.points) {
    const inward = [vertex[0] * 0.72 + centroid[0] * 0.28, vertex[1] * 0.72 + centroid[1] * 0.28];
    if (pointInPolygon(inward, feature.points)) return inward;
  }
  return centroid;
}

function nearestFeaturePoint(features, types, target, maxDist) {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  let best = null;
  for (const feature of features || []) {
    if (!wanted.has(feature.type) || !feature.points || feature.points.length < 3) continue;
    const point = pointInsideFeature(feature, target);
    const distance = Math.hypot(point[0] - target[0], point[1] - target[1]);
    if (distance > maxDist) continue;
    if (!best || distance < best.distance) best = { point, distance };
  }
  return best;
}

function shapeBend(projection, shape) {
  return (shape?.bias || 0) * clamp(projection.width * 0.62, 40, 96);
}

function shapeDrift(projection, shape) {
  return (shape?.bias || 0) * clamp(projection.width * 0.24, 18, 44);
}

function flightControl(from, to, bend) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  return [(from[0] + to[0]) / 2 + (-dy / length) * bend, (from[1] + to[1]) / 2 + (dx / length) * bend];
}

function firstWaterOnPath(features, from, to, bend) {
  const control = flightControl(from, to, bend);
  for (let index = 12; index <= 20; index += 1) {
    const point = quadPoint(from, control, to, index / 20);
    if (classifyTerrain(features, point) === "Penalty area") return point;
  }
  return null;
}

function placeInRough(projection, seed, perpendicular) {
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

function treeCollision(projection, holeNumber, point) {
  for (const tree of buildTreeSprites(projection, holeNumber)) {
    if (Math.hypot(point[0] - tree.x, point[1] - tree.y) <= tree.size * 1.15) return tree;
  }
  return null;
}

function outOfBounds(projection, point) {
  return point[0] < 2 || point[0] > projection.width - 2 || point[1] < 2 || point[1] > projection.height - 2;
}

function placeTeeLanding(projection, hole, decision, wantedType) {
  const { target, perpendicular } = computeShotTarget(projection, hole, decision);
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const drift = shapeDrift(projection, shape);
  const aimed = [target[0] + perpendicular[0] * drift, target[1] + perpendicular[1] * drift];
  const bend = shapeBend(projection, shape);
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

  const waterHit = firstWaterOnPath(projection.features, projection.tee, point, bend);
  if (waterHit) return { point: waterHit, type: "Penalty area" };

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

const SHOT_CAPTIONS = {
  drive: "CRUSHED OFF THE TEE!",
  tee: "TEE SHOT AWAY!",
  splash: "OH NO... SPLASH!",
  ob: "OB! STROKE AND DISTANCE!",
  sand: "OUT OF THE SAND!",
  punch: "PUNCHES FROM THE ROUGH!",
  approach: "APPROACH SHOT...",
  putt: "ROLLING...",
};

function quadPoint(from, control, to, t) {
  const inverse = 1 - t;
  return [
    inverse * inverse * from[0] + 2 * inverse * t * control[0] + t * t * to[0],
    inverse * inverse * from[1] + 2 * inverse * t * control[1] + t * t * to[1],
  ];
}

function framesToPath(frames, lifted = true) {
  if (!frames.length) return "";
  return frames
    .map((frame, index) => {
      const x = lifted ? frame.x : frame.gx;
      const y = lifted ? frame.y : frame.gy;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function buildFlightFrames({ from, to, control, apex, air }) {
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

function makeShot({ from, to, kind, bend = 0, final = false, yardsScale = 0, caption = null }) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const air = kind !== "putt";
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
function buildShotSequence({ projection, hole, decision, gross, landingLabel, side = "human", seedSalt = 0 }) {
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
    current = interpolate(landing, projection.tee, 0.24);
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

  let putts;
  if (hole.par === 3 && (landingType === "Fairway" || landingType === "Rough") && remaining <= 2) {
    putts = remaining; // par-3 tee ball is greenside; just putt out
  } else {
    putts = remaining >= 3 ? 2 : remaining === 2 ? (hole.par === 3 ? 2 : 1) : 1;
  }
  putts = clamp(putts, 1, 2);
  let approaches = remaining - putts;
  if (approaches < 0) {
    approaches = 0;
    putts = remaining;
  }

  const greenEntry = [pin[0] + jitter(1, 10), pin[1] + 5 + jitter(2, 4)];
  for (let index = 0; index < approaches; index += 1) {
    const last = index === approaches - 1;
    const destination = last
      ? greenEntry
      : [
          interpolate(current, greenEntry, (index + 1) / approaches)[0] + jitter(index + 3, 14),
          interpolate(current, greenEntry, (index + 1) / approaches)[1] + jitter(index + 7, 8),
        ];
    const kind =
      index === 0 && landingType === "Bunker"
        ? "sand"
        : index === 0 && landingType === "Rough"
          ? "punch"
          : "approach";
    shots.push(makeShot({ from: current, to: destination, kind, bend: jitter(index + 11, 12), yardsScale }));
    current = destination;
  }

  if (putts === 2) {
    const lagSpot = [pin[0] + jitter(13, 3), pin[1] + 1.6 + jitter(14, 1.5)];
    shots.push(makeShot({ from: current, to: lagSpot, kind: "putt", yardsScale }));
    current = lagSpot;
  }
  shots.push(makeShot({ from: current, to: pin, kind: "putt", final: true, yardsScale }));
  return shots.map((shot) => ({ ...shot, side }));
}

function fallbackProjection(hole) {
  const bend = hole.number % 2 ? -18 : 18;
  const waterSide = hole.number % 3 === 0 ? "right" : hole.number % 4 === 0 ? "left" : null;
  const features = [
    {
      type: "fairway",
      points: [
        [70, 216],
        [103, 172],
        [90 + bend, 116],
        [92, 48],
        [69, 42],
        [58 + bend, 112],
        [48, 176],
      ],
    },
    { type: "green", points: [[63, 43], [73, 29], [93, 32], [101, 47], [92, 58], [73, 57]] },
    { type: "tee", points: [[65, 216], [96, 216], [94, 229], [66, 229]] },
    { type: "bunker", points: [[51, 61], [62, 50], [67, 65], [56, 73]] },
  ];
  if (waterSide) {
    const left = waterSide === "left";
    features.push({
      type: "water",
      points: left
        ? [[0, 118], [39, 110], [47, 150], [24, 180], [0, 173]]
        : [[119, 103], [160, 91], [160, 174], [132, 165], [112, 132]],
    });
  }
  return {
    width: 160,
    height: 240,
    features,
    line: [[80, 222], [80 + bend, 125], [82, 43]],
    tee: [80, 222],
    pin: [82, 43],
    dangerSide: waterSide,
    primaryHazard: waterSide ? "water" : "bunker",
    hasWater: Boolean(waterSide),
    hazardLabel: waterSide ? `WATER ${waterSide.toUpperCase()}` : "BUNKERS LEFT",
    preferredShape: bend < 0 ? "cut" : "draw",
    shapeSeverity: 0.58,
    hazardSeverity: waterSide ? 0.68 : 0.32,
    official: null,
    elevation: null,
    source: "prototype",
  };
}

function projectHole(geometry, hole) {
  const sourceHole = geometry?.holes?.find((entry) => Number(entry.num) === hole.number);
  if (!sourceHole?.line?.length) return fallbackProjection(hole);
  const teeRaw = sourceHole.tees?.[0]?.pos || sourceHole.line[0];
  const pinRaw = sourceHole.pin || sourceHole.line.at(-1);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = metersPerDegreeLat * Math.cos((teeRaw[0] * Math.PI) / 180);
  const toMeters = ([lat, lng]) => [(lng - teeRaw[1]) * metersPerDegreeLng, (lat - teeRaw[0]) * metersPerDegreeLat];
  const pinMeters = toMeters(pinRaw);
  const angle = Math.PI / 2 - Math.atan2(pinMeters[1], pinMeters[0]);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = ([x, y]) => [x * cos - y * sin, x * sin + y * cos];
  const transformRaw = (point) => rotate(toMeters(point));
  const rawFeatures = (geometry.features || [])
    .filter((feature) => Number(feature.hole) === hole.number && Array.isArray(feature.coords) && feature.coords.length >= 3)
    .map((feature) => ({
      type: feature.type,
      points: feature.coords.map(transformRaw).filter((point) => point.every(Number.isFinite)),
    }))
    .filter((feature) => feature.points.length >= 3);
  const rawLine = sourceHole.line.map(transformRaw).filter((point) => point.every(Number.isFinite));
  const rawTee = transformRaw(teeRaw);
  const rawPin = transformRaw(pinRaw);
  const allPoints = [...rawFeatures.flatMap((feature) => feature.points), ...rawLine, rawTee, rawPin];
  if (!allPoints.length) return fallbackProjection(hole);
  const pad = 14;
  const minX = Math.min(...allPoints.map((point) => point[0])) - pad;
  const maxX = Math.max(...allPoints.map((point) => point[0])) + pad;
  const minY = Math.min(...allPoints.map((point) => point[1])) - pad;
  const maxY = Math.max(...allPoints.map((point) => point[1])) + pad;
  const width = Math.max(50, maxX - minX);
  const height = Math.max(80, maxY - minY);
  const toSvg = ([x, y]) => [x - minX, maxY - y];

  const hazards = rawFeatures.filter((feature) => feature.type === "water" || feature.type === "bunker");
  let hazardPull = 0;
  for (const feature of hazards) {
    const centerX = feature.points.reduce((total, point) => total + point[0], 0) / feature.points.length;
    hazardPull += centerX * (feature.type === "water" ? 2.5 : 1);
  }
  const dangerSide = Math.abs(hazardPull) < 2 ? null : hazardPull < 0 ? "left" : "right";
  const hasWater = hazards.some((feature) => feature.type === "water");
  const primaryHazard = hasWater ? "water" : hazards.length ? "bunker" : null;
  const hazardArea = hazards.reduce((total, feature) => total + polygonArea(feature.points), 0) / (width * height || 1);
  const hazardSeverity = clamp(hazards.length * 0.055 + hazardArea * 2.8 + (hasWater ? 0.16 : 0), 0.08, 1);
  const routeShape = routeShapeProfile(rawLine, rawTee, rawPin);
  const hazardLabel = primaryHazard
    ? `${primaryHazard === "water" ? "WATER" : "BUNKERS"}${dangerSide ? ` ${dangerSide.toUpperCase()}` : ""}`
    : "NO MAJOR HAZARD";

  return {
    width,
    height,
    features: rawFeatures
      .map((feature) => ({ ...feature, points: feature.points.map(toSvg) }))
      .sort((a, b) => (FEATURE_ORDER[a.type] ?? 9) - (FEATURE_ORDER[b.type] ?? 9)),
    line: rawLine.map(toSvg),
    tee: toSvg(rawTee),
    pin: toSvg(rawPin),
    dangerSide,
    primaryHazard,
    hasWater,
    hazardLabel,
    hazardSeverity,
    ...routeShape,
    official: sourceHole,
    elevation: Number(sourceHole.elevM) || null,
    source: "OpenStreetMap / ODbL",
  };
}

function ScoreOdds({ odds }) {
  if (!odds) return null;
  return (
    <div className="trip-game-odds">
      <div className="trip-game-section-label">
        <span>MODEL</span>
        <span>EXP {odds.expectedGross.toFixed(1)}</span>
      </div>
      <div
        className="trip-game-odds-bar"
        role="img"
        aria-label={SCORE_BUCKETS.map((bucket, index) => `${bucket.label} ${formatOdds(odds.probs[index])}`).join(", ")}
      >
        {SCORE_BUCKETS.map((bucket, index) => (
          <div
            key={bucket.id}
            className={`trip-game-odds-segment trip-game-odds-segment--${bucket.tone}`}
            style={{ flexGrow: Math.max(odds.probs[index], 0.025) }}
            title={`${bucket.label}: ${formatOdds(odds.probs[index])}`}
          >
            <span>{bucket.short}</span>
            <b>{formatOdds(odds.probs[index])}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function signedPercent(value) {
  const points = Math.round((Number(value) || 0) * 100);
  return `${points > 0 ? "+" : ""}${points}%`;
}

function CaptainRead({ read }) {
  if (!read) return null;
  const bestClub = CLUBS.find((club) => club.id === read.bestDecision.club);
  const bestShape = SHAPES.find((shape) => shape.id === read.bestDecision.shape);
  return (
    <div
      key={read.planKey}
      className={`trip-game-captain-read is-${read.tone}`}
      aria-label={`${read.label}. Player fit rank ${read.playerRank} of ${read.rosterSize}.`}
    >
      <div className="trip-game-read-call">
        <small>CAPTAIN READ</small>
        <b>{read.label}</b>
        <span>
          PICK #{read.playerRank}/{read.rosterSize}
        </span>
      </div>
      <div className="trip-game-read-metrics">
        <span>
          <b>{signedPercent(read.scoringDelta)}</b>
          SCORING
        </span>
        <span>
          <b>{signedPercent(read.bigNumberDelta)}</b>
          BIG NO.
        </span>
        <span>
          <b>{read.quality}%</b>
          PLAN FIT
        </span>
      </div>
      <div className="trip-game-caddie-tip">
        {read.quality >= 94 && !read.fireball
          ? "★ BEST LINE"
          : read.fireball
            ? "🔥 UP SIDE / RISK"
            : `${bestClub?.short || bestClub?.label} · ${bestShape?.label.toUpperCase()} · ${aimText(read.bestDecision.aim)}`}
      </div>
    </div>
  );
}

function sidePoint(from, toward, offset) {
  const dx = toward[0] - from[0];
  const dy = toward[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [from[0] + (-dy / len) * offset, from[1] + (dx / len) * offset];
}

function GolferSprite({ at, toward, hat = "red", pose = "idle", putting = false, scale = 1.25 }) {
  const flipped = toward ? toward[0] < at[0] : false;
  return (
    <g
      className={`trip-game-golfer is-${hat}${pose !== "idle" ? ` trip-game-swinger ${pose === "swing" ? "is-swinging" : "is-through"}${putting ? " is-putting" : ""}` : ""}`}
      transform={`translate(${at[0]} ${at[1]}) scale(${flipped ? -scale : scale} ${scale})`}
    >
      <ellipse className="trip-game-swinger-shadow" cx="0" cy="1.4" rx="5.4" ry="1.7" />
      <g transform="translate(-4.8 -15)">
        <rect className="trip-game-golfer-legs" x="1" y="10" width="3" height="5.5" />
        <rect className="trip-game-golfer-legs" x="5.8" y="10" width="3" height="5.5" />
        <rect className="trip-game-golfer-shirt" x="0.4" y="4.6" width="9" height="5.8" />
        <rect className="trip-game-golfer-skin" x="2.4" y="0.2" width="5" height="4.6" />
        <rect className={`trip-game-golfer-cap${hat === "blue" ? " is-blue" : ""}`} x="1.8" y="-1.8" width="6.2" height="2.4" />
        {hat === "blue" && <rect className="trip-game-golfer-cap is-blue" x="7.2" y="-0.2" width="2.2" height="1.1" />}
        <g className="trip-game-swing-arm">
          <rect className="trip-game-golfer-club" x="8.2" y="4.8" width="1.4" height="10.5" />
          <rect className="trip-game-club-head" x="7.4" y="14.4" width="3.2" height="2" />
        </g>
      </g>
    </g>
  );
}

function HoleMap({
  projection,
  hole,
  decision,
  result,
  playback,
  intro,
  onIntroDismiss,
  odds,
  canAct,
  intelLeft,
  intelRight,
  kickMeter,
  popCall,
  swingFx,
  shake,
  soundControl,
  kickTier,
  clutch,
  onAimStep,
  onCycle,
}) {
  const aimOffset = aimOffsetOf(decision.aim);
  const aimHoldRef = useRef(null);
  const cameraRef = useRef(null);

  function stopAimHold() {
    if (!aimHoldRef.current) return;
    window.clearTimeout(aimHoldRef.current.delay);
    if (aimHoldRef.current.repeat) window.clearInterval(aimHoldRef.current.repeat);
    aimHoldRef.current = null;
  }

  function startAimHold(direction) {
    stopAimHold();
    onAimStep(direction);
    const delay = window.setTimeout(() => {
      if (aimHoldRef.current) aimHoldRef.current.repeat = window.setInterval(() => onAimStep(direction), 85);
    }, 300);
    aimHoldRef.current = { delay, repeat: null };
    window.addEventListener("pointerup", stopAimHold, { once: true });
  }

  useEffect(() => () => stopAimHold(), []);
  useEffect(() => {
    cameraRef.current = null;
  }, [hole.number]);

  const shotDecision = result?.shotDecision || decision;
  const shape = SHAPES.find((item) => item.id === shotDecision.shape) || SHAPES[1];
  const { club, targetYards, targetDistance, perpendicular, target } = computeShotTarget(projection, hole, shotDecision);
  const drift = shapeDrift(projection, shape);
  const previewTarget = [target[0] + perpendicular[0] * drift, target[1] + perpendicular[1] * drift];
  const bend = shapeBend(projection, shape);
  const shotPath = curvedPath(projection.tee, previewTarget, bend);
  const landing = result ? placeTeeLanding(projection, hole, shotDecision, result.humanLanding).point : null;
  const planning = !playback && !result;
  const activeShot = playback ? playback.shots[Math.min(playback.index, playback.shots.length - 1)] : null;
  const shotFlipped = activeShot ? activeShot.to[0] < activeShot.from[0] : false;
  const flightFrames = activeShot?.frames || [];
  const flightFrameIndex = playback ? clamp(playback.frame || 0, 0, Math.max(0, flightFrames.length - 1)) : 0;
  const flightFrame = flightFrames[flightFrameIndex] || null;
  const flownFrames = playback?.phase === "flight" ? flightFrames.slice(0, flightFrameIndex + 1) : [];
  // Comet trail on the metered tee shot: gold for PURE, green for GREAT,
  // flames for a red-band bet that paid off. Human shots only — the CPU
  // never swings your meter.
  const trailTier =
    playback?.index === 0 && (kickTier === "pure" || kickTier === "great" || kickTier === "fire") ? kickTier : null;
  const firstCpuIndex = playback ? playback.shots.findIndex((shot) => shot.side === "cpu") : -1;
  const firstOfSide = playback ? playback.index === 0 || playback.index === firstCpuIndex : false;
  const sideShotNumber =
    playback && activeShot
      ? playback.shots.slice(0, playback.index + 1).filter((shot) => shot.side === activeShot.side).length
      : 0;
  const remainingYards = hole.yards ? Math.max(0, Math.round(hole.yards - targetYards)) : null;
  const trees = buildTreeSprites(projection, hole.number);
  const mapId = `trip-hole-${hole.number}`;
  const ballPoint = flightFrame ? [flightFrame.gx, flightFrame.gy] : activeShot ? (playback.phase === "settle" ? activeShot.to : activeShot.from) : null;
  const onGreenCam = Boolean(
    activeShot &&
      (activeShot.kind === "putt" ||
        activeShot.final ||
        (ballPoint &&
          pointNearGreen(ballPoint, projection) &&
          activeShot.kind !== "drive" &&
          activeShot.kind !== "tee" &&
          activeShot.kind !== "splash")),
  );
  const targetCam = computeMapCamera({
    projection,
    playback,
    landing,
    activeShot,
    flightFrame,
  });
  const firstFlightFrame = playback?.phase === "flight" && (playback.frame || 0) === 0;
  const ballAir = flightFrame ? [flightFrame.x, flightFrame.y] : null;
  const ballEscaping = Boolean(
    playback?.phase === "flight" && ballAir && cameraRef.current && !cameraContains(cameraRef.current, ballAir, 18),
  );
  const cameraEase = !playback
    ? 0.4
    : firstFlightFrame || ballEscaping
      ? 1
      : playback.phase === "flight"
        ? 0.84
        : playback.phase === "swing" && playback.index === 0
          ? 1
          : 0.5;
  cameraRef.current = blendCamera(cameraRef.current, targetCam, cameraRef.current ? cameraEase : 1);
  const camera = cameraRef.current;
  const fullFramed = camera.w > projection.width * 0.9 && camera.h > projection.height * 0.9;

  return (
    <div
      className={`trip-game-map-wrap ${playback ? "is-resolving is-flyover" : ""} ${onGreenCam ? "is-green-zoom" : ""}${shake ? " is-shaking" : ""}${clutch ? " is-clutch" : ""}`}
      style={shake ? { "--shake-amp": `${shake.amp}px` } : undefined}
    >
      <div className="trip-game-map-hud">
        <span className={`trip-game-par-pill is-par-${hole.par}`}>PAR {hole.par}</span>
        <span>{projection.hazardLabel}</span>
        <span>
          {onGreenCam
            ? "ON THE GREEN"
            : playback
              ? "FLYOVER"
              : `${club.short} ${targetYards}Y · ${remainingYards != null ? `${remainingYards}Y LEFT` : "TEE PLAN"}`}
        </span>
        {soundControl}
      </div>
      {popCall}
      {playback && activeShot && (
        <div className={`trip-game-playcap${activeShot.side === "cpu" ? " is-cpu" : ""}`} aria-live="polite">
          <small>
            {activeShot.side === "cpu" ? "THEM" : "YOU"} · SHOT {sideShotNumber}
            {activeShot.yards ? ` · ${activeShot.yards}Y` : ""}
          </small>
          <b>{activeShot.caption}</b>
        </div>
      )}
      {odds && (
        <div className="trip-game-map-landing" aria-label="Landing odds for this exact aim">
          <span>
            FRWY <b>{formatOdds(odds.landing.fairway)}</b>
          </span>
          <span>
            RGH <b>{formatOdds(odds.landing.rough)}</b>
          </span>
          <span>
            BNKR <b>{formatOdds(odds.landing.bunker)}</b>
          </span>
          <span className={odds.landing.penalty >= 0.12 ? "is-danger" : ""}>
            PNLTY <b>{formatOdds(odds.landing.penalty)}</b>
          </span>
        </div>
      )}
      <svg
        className="trip-game-map"
        viewBox={`${camera.x.toFixed(2)} ${camera.y.toFixed(2)} ${camera.w.toFixed(2)} ${camera.h.toFixed(2)}`}
        preserveAspectRatio={fullFramed ? "xMidYMid meet" : "xMidYMid slice"}
        aria-label={`Top-down map of hole ${hole.number}`}
        role="img"
      >
        <defs>
          <pattern id={`${mapId}-rough`} width="13" height="13" patternUnits="userSpaceOnUse">
            <rect width="13" height="13" fill="transparent" />
            <rect x="2" y="3" width="2" height="2" className="trip-game-rough-pixel" />
            <rect x="9" y="8" width="1.5" height="1.5" className="trip-game-rough-pixel trip-game-rough-pixel--light" />
          </pattern>
          <pattern id={`${mapId}-fairway`} width="18" height="18" patternUnits="userSpaceOnUse">
            <rect width="9" height="18" className="trip-game-fairway-stripe" />
            <rect x="9" width="9" height="18" className="trip-game-fairway-stripe trip-game-fairway-stripe--light" />
          </pattern>
          <pattern id={`${mapId}-green`} width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M0 8 L8 0 M-2 2 L2 -2 M6 10 L10 6" className="trip-game-green-cut" />
          </pattern>
          <pattern id={`${mapId}-sand`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="3" r="0.8" className="trip-game-sand-grain" />
            <circle cx="7" cy="6" r="0.55" className="trip-game-sand-grain" />
          </pattern>
          <pattern id={`${mapId}-water`} width="16" height="10" patternUnits="userSpaceOnUse">
            <path d="M-2 3 Q2 0 6 3 T14 3 T22 3 M3 8 Q7 5 11 8 T19 8" className="trip-game-water-ripple" />
          </pattern>
          <filter id={`game-pixel-shadow-${hole.number}`} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="2" dy="2" stdDeviation="0" floodColor="#07180f" />
          </filter>
        </defs>
        <rect width={projection.width} height={projection.height} className="trip-game-map-rough" />
        <rect width={projection.width} height={projection.height} fill={`url(#${mapId}-rough)`} />
        {planning && (
          <circle
            cx={projection.tee[0]}
            cy={projection.tee[1]}
            r={Math.max(0, targetDistance)}
            className="trip-game-carry-arc"
          />
        )}
        <g className="trip-game-tree-layer" aria-hidden="true">
          {trees.map((tree, index) => (
            <g
              key={`${tree.x.toFixed(1)}-${tree.y.toFixed(1)}-${index}`}
              className={`trip-game-tree trip-game-tree--${tree.variant}`}
              transform={`translate(${tree.x.toFixed(1)} ${tree.y.toFixed(1)}) scale(${(tree.size / 6).toFixed(2)})`}
            >
              {tree.variant === 1 ? (
                <>
                  <ellipse className="trip-game-tree-shadow" cx="1.5" cy="5" rx="5" ry="1.8" />
                  <rect className="trip-game-tree-trunk" x="-1" y="1" width="2" height="4.5" />
                  <circle className="trip-game-tree-back" cx="0" cy="-2.5" r="5.2" />
                  <circle className="trip-game-tree-front" cx="-1.4" cy="-3.6" r="3.4" />
                </>
              ) : (
                <>
                  <ellipse className="trip-game-tree-shadow" cx="1.5" cy="5.5" rx="4.6" ry="1.7" />
                  <rect className="trip-game-tree-trunk" x="-0.9" y="2" width="1.8" height="3.8" />
                  <path className="trip-game-tree-back" d="M0,-11 L-5,-4.5 L-2.6,-4.5 L-6,1.5 L6,1.5 L2.6,-4.5 L5,-4.5 Z" />
                  <path className="trip-game-tree-front" d="M0,-9 L-3.4,-3.5 L-1.8,-3.5 L-4.2,1.5 L0,1.5 Z" />
                </>
              )}
            </g>
          ))}
        </g>
        {projection.features.map((feature, index) => (
          <g key={`${feature.type}-${index}`}>
            <path
              d={pathFromPoints(feature.points)}
              className={`trip-game-map-feature trip-game-map-feature--${feature.type}`}
            />
            {["fairway", "green", "bunker", "water"].includes(feature.type) && (
              <path
                d={pathFromPoints(feature.points)}
                className={`trip-game-map-texture trip-game-map-texture--${feature.type}`}
                fill={`url(#${mapId}-${feature.type === "bunker" ? "sand" : feature.type})`}
              />
            )}
          </g>
        ))}
        <path d={pathFromPoints(projection.line, false)} className="trip-game-centerline" />
        {planning && (
          <>
            <path d={shotPath} className="trip-game-shot-line" />
            <g className="trip-game-target" transform={`translate(${previewTarget[0]} ${previewTarget[1]})`}>
              <circle r="5.5" />
              <path d="M-8 0 H8 M0 -8 V8" />
            </g>
            <text
              x={clamp(previewTarget[0] + 7, 8, projection.width - 44)}
              y={clamp(previewTarget[1] - 7, 10, projection.height - 8)}
              className="trip-game-carry-label"
            >
              {targetYards}Y
            </text>
          </>
        )}
        {!playback && (
          <>
            <GolferSprite at={sidePoint(projection.tee, projection.pin, -8)} toward={projection.pin} hat="red" scale={1.15} />
            <GolferSprite at={sidePoint(projection.tee, projection.pin, 8)} toward={projection.pin} hat="blue" scale={1.15} />
          </>
        )}
        <g className="trip-game-flag" transform={`translate(${projection.pin[0]} ${projection.pin[1]})`}>
          <rect className="trip-game-flag-base" x="-3" y="0" width="6" height="2" />
          <rect className="trip-game-flag-pole" x="-1" y="-14" width="2" height="15" />
          <path className="trip-game-flag-cloth" d="M1,-14 L11,-10 L1,-6 Z" />
        </g>
        {playback && activeShot && (
          <g className="trip-game-theater">
            {playback.shots
              .slice(0, playback.index)
              .filter((shot) => shot.side === activeShot.side)
              .map((shot, index) => (
                <circle key={index} cx={shot.to[0]} cy={shot.to[1]} r="1.5" className="trip-game-crumb" />
              ))}
            <GolferSprite
              at={
                firstOfSide
                  ? sidePoint(projection.tee, projection.pin, 8)
                  : sidePoint(activeShot.from, activeShot.to, 10)
              }
              toward={firstOfSide ? projection.pin : activeShot.to}
              hat={activeShot.side === "cpu" ? "red" : "blue"}
              scale={1.2}
            />
            <GolferSprite
              at={activeShot.from}
              toward={activeShot.to}
              hat={activeShot.side === "cpu" ? "blue" : "red"}
              pose={playback.phase === "swing" ? "swing" : "through"}
              putting={activeShot.kind === "putt"}
              scale={1.3}
            />
            {playback.phase === "flight" && (
              <g className="trip-game-impact" transform={`translate(${activeShot.from[0] + (shotFlipped ? -6 : 6)} ${activeShot.from[1] - 4})`}>
                <path d="M0,-5 L1.6,-1.6 L5,0 L1.6,1.6 L0,5 L-1.6,1.6 L-5,0 L-1.6,-1.6 Z" />
              </g>
            )}
            {playback.phase === "swing" && (
              <g className="trip-game-theater-ball-wrap" transform={`translate(${activeShot.from[0]} ${activeShot.from[1]})`}>
                <ellipse className="trip-game-theater-shadow" cx="0" cy="1.2" rx="3" ry="1.4" />
                <circle r="2.6" className="trip-game-theater-ball" />
                <circle className="trip-game-theater-ball-shine" cx="-0.7" cy="-0.8" r="0.8" />
              </g>
            )}
            {playback.phase === "flight" && flightFrame && (
              <>
                {activeShot.air && activeShot.airPath && (
                  <path d={activeShot.airPath} className="trip-game-air-arc" />
                )}
                <path
                  d={curvedPath([flightFrame.gx, flightFrame.gy], activeShot.to, 0)}
                  className="trip-game-aim-ahead"
                />
                <g className="trip-game-target trip-game-shot-ahead" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                  <circle r="5.2" />
                  <path d="M-7 0 H7 M0 -7 V7" />
                </g>
                {flownFrames.length > 1 && (
                  <path
                    d={framesToPath(flownFrames, activeShot.air)}
                    className={`trip-game-air-trail-line${trailTier ? ` is-${trailTier}` : ""}`}
                  />
                )}
                {flownFrames.slice(0, -1).map((frame, index) => (
                  <circle
                    key={`trail-${index}`}
                    cx={frame.x}
                    cy={frame.y}
                    r={
                      (activeShot.air ? 1.35 : 1.05) *
                      (trailTier === "pure" || trailTier === "fire" ? 1.5 : trailTier === "great" ? 1.2 : 1)
                    }
                    className={`trip-game-air-trail${trailTier ? ` is-${trailTier}` : ""}`}
                  />
                ))}
                <ellipse
                  className="trip-game-theater-shadow"
                  cx={flightFrame.gx}
                  cy={flightFrame.gy}
                  rx={flightFrame.shadow}
                  ry={flightFrame.shadow * 0.52}
                />
                {activeShot.air && flightFrame.lift > 6 && (
                  <line
                    className="trip-game-drop-line"
                    x1={flightFrame.x}
                    y1={flightFrame.y + flightFrame.size + 1}
                    x2={flightFrame.gx}
                    y2={flightFrame.gy}
                  />
                )}
                <g className="trip-game-theater-ball-wrap" transform={`translate(${flightFrame.x} ${flightFrame.y})`}>
                  {activeShot.air && flightFrame.lift > 8 && (
                    <g className="trip-game-motion-ticks" transform={`rotate(${shotFlipped ? 30 : -30})`}>
                      <rect x={-flightFrame.size - 7} y="-0.6" width="4.2" height="1.2" />
                      <rect x={-flightFrame.size - 11} y="-3.1" width="3.4" height="1.1" />
                      <rect x={-flightFrame.size - 11} y="1.8" width="3.4" height="1.1" />
                    </g>
                  )}
                  <circle r={flightFrame.size} className="trip-game-theater-ball" />
                  <circle
                    className="trip-game-theater-ball-shine"
                    cx={-flightFrame.size * 0.28}
                    cy={-flightFrame.size * 0.32}
                    r={Math.max(0.7, flightFrame.size * 0.32)}
                  />
                </g>
              </>
            )}
            {playback.phase === "settle" && activeShot.kind === "splash" && (
              <g className="trip-game-splash" transform={`translate(${activeShot.to[0]} ${activeShot.to[1]})`}>
                <circle r="3" />
                <circle r="6" />
                <circle r="9" />
              </g>
            )}
            {playback.phase === "settle" && activeShot.kind !== "splash" && !activeShot.final && (
              <circle cx={activeShot.to[0]} cy={activeShot.to[1]} r="2.3" className="trip-game-theater-ball is-settled" />
            )}
            {playback.phase === "settle" && activeShot.final && (
              <g className="trip-game-holeout" transform={`translate(${activeShot.to[0]} ${activeShot.to[1] - 4})`}>
                <path d="M0,-8 L2.3,-2.4 L8,-2.4 L3.4,1.2 L5.4,7 L0,3.4 L-5.4,7 L-3.4,1.2 L-8,-2.4 L-2.3,-2.4 Z" />
              </g>
            )}
          </g>
        )}
        {result && (
          <g
            className="trip-game-ball-marker"
            transform={`translate(${clamp(landing[0], 5, projection.width - 5)} ${clamp(landing[1], 5, projection.height - 5)})`}
            filter={`url(#game-pixel-shadow-${hole.number})`}
          >
            <circle r="4.5" className="trip-game-ball-halo" />
            <rect x="-2.5" y="-2.5" width="5" height="5" className="trip-game-ball" />
          </g>
        )}
      </svg>
      {intro && (
        <button type="button" className="trip-game-hole-intro" onClick={onIntroDismiss} aria-label="Dismiss hole intro">
          <small>HOLE {hole.number}</small>
          <b className={`is-par-${hole.par}`}>PAR {hole.par}</b>
          <span>
            {hole.yards ? `${hole.yards} YDS · ` : ""}SI {hole.si}
          </span>
        </button>
      )}
      {(intelLeft || intelRight) && (
        <div className="trip-game-map-intel">
          <div className="trip-game-map-intel-left">{intelLeft}</div>
          <div className="trip-game-map-intel-right">{intelRight}</div>
        </div>
      )}
      {kickMeter}
      {swingFx && (
        <div
          key={swingFx.id}
          className={`trip-game-judgment is-${swingFx.tier}${swingFx.nearMiss ? " is-near-miss" : ""}${swingFx.redBet && swingFx.tier === "pure" ? " is-fire" : ""}`}
          aria-hidden="true"
        >
          <b>{swingFx.label}</b>
          <small>{swingFx.sub}</small>
          {swingFx.streak >= 2 && <em>STRIPING ×{swingFx.streak}</em>}
        </div>
      )}
      {swingFx?.tier === "pure" && <div key={`flash-${swingFx.id}`} className="trip-game-pure-flash" aria-hidden="true" />}
      {playback &&
        activeShot &&
        firstOfSide &&
        activeShot.kind !== "putt" &&
        (playback.phase === "flight" || playback.phase === "settle") &&
        Number.isFinite(activeShot.yards) && (
          <YardageTicker
            key={activeShot.side}
            yards={activeShot.yards}
            rollMs={Math.max(0, (activeShot.frames?.length || 8) - 1) * FLIGHT_FRAME_MS}
          />
        )}
      {canAct && (
        <div className="trip-game-pad">
          <div className="trip-game-pad-aim">
            <button
              type="button"
              className={aimOffset <= -AIM_MAX + 0.01 ? "is-maxed" : ""}
              onPointerDown={(event) => {
                event.preventDefault();
                startAimHold(-1);
              }}
              onPointerUp={stopAimHold}
              onPointerLeave={stopAimHold}
              onPointerCancel={stopAimHold}
              onContextMenu={(event) => event.preventDefault()}
              aria-label="Aim left (hold to sweep)"
            >
              ◀
            </button>
            <span>
              <small>AIM</small>
              <b>{aimText(aimOffset)}</b>
            </span>
            <button
              type="button"
              className={aimOffset >= AIM_MAX - 0.01 ? "is-maxed" : ""}
              onPointerDown={(event) => {
                event.preventDefault();
                startAimHold(1);
              }}
              onPointerUp={stopAimHold}
              onPointerLeave={stopAimHold}
              onPointerCancel={stopAimHold}
              onContextMenu={(event) => event.preventDefault()}
              aria-label="Aim right (hold to sweep)"
            >
              ▶
            </button>
          </div>
          <div className="trip-game-pad-menus">
            <button type="button" onClick={() => onCycle("club")} aria-label="Next club">
              <small>CLUB</small>
              <b>{club.short}</b>
            </button>
            <button type="button" onClick={() => onCycle("shape")} aria-label="Next shape">
              <small>SHAPE</small>
              <b>{shape.label.toUpperCase()}</b>
            </button>
          </div>
        </div>
      )}
      <div className="trip-game-map-foot">
        <span>
          PAR {hole.par} · {hole.yards ? `${hole.yards} YDS` : "YARDAGE N/A"}
        </span>
        <span>{projection.elevation ? `ELEV ${projection.elevation}M` : ""}</span>
        <span>{projection.source}</span>
      </div>
    </div>
  );
}

// Swing judgment tiers. Accuracy is in [-1, 1]; the engine's sweet power band
// is 0.78–0.96 with overswing punished past 0.96 (see tripGameEngine).
const ACC_PURE = 0.05;
const ACC_GREAT = 0.16;
const ACC_GOOD = 0.34;
const POWER_SWEET_MIN = 0.78;
const POWER_SWEET_MAX = 0.96;
const POWER_METER_MAX = 1.12;

// The red-band bet: locking power in the overswing band shrinks every accuracy
// zone and speeds the needle up — more distance, on your own dare.
const RED_BET_ZONE_SCALE = 0.6;
const RED_BET_SPEED = 1.25;
const CLUTCH_SPEED = 0.7;
const CLUB_METER_SPEED = { driver: 1, wood: 0.92, iron: 0.84 };
// Laying up is a real choice: shorter clubs also get wider judgment zones.
const CLUB_ZONE_SCALE = { driver: 1, wood: 1.12, iron: 1.3 };
const BASE_ACC_SPEED = 2.6;
const BASE_POWER_SPEED = 1.08;
// Skill scaling (from handicap): scratch players get up to 22% wider zones,
// while high handicaps swing a meter up to 55% faster on both phases.
const SKILL_ZONE_BONUS = 0.22;
const SKILL_SPEED_PENALTY = 0.55;

function judgeSwing(power, accuracy, mods = {}) {
  const zoneScale = mods.zoneScale || 1;
  const pureZone = ACC_PURE * zoneScale;
  const greatZone = ACC_GREAT * zoneScale;
  const goodZone = ACC_GOOD * zoneScale;
  const off = Math.abs(accuracy);
  const overswung = power > POWER_SWEET_MAX;
  const eased = power < 0.72;
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
  return { tier, label, sub, hold, overswung, nearMiss, redBet: Boolean(mods.redBet) };
}

function zoneStyle(threshold, zoneScale) {
  const half = threshold * zoneScale * 46;
  return { left: `${50 - half}%`, width: `${half * 2}%` };
}

function KickMeter({ phase, power, accuracy, onTap, judgment, streak, mods }) {
  const powerPct = clamp(power / POWER_METER_MAX, 0, 1);
  const powerLocked = phase !== "power";
  const accLive = phase === "accuracy";
  const locked = phase === "locked";
  const zoneScale = mods?.zoneScale || 1;
  const redBet = Boolean(mods?.redBet);
  const clutch = Boolean(mods?.clutch);
  const off = Math.abs(accuracy);
  const heat = !accLive
    ? ""
    : off <= ACC_PURE * zoneScale * 1.2
      ? " is-burning"
      : off <= ACC_GREAT * zoneScale
        ? " is-hot"
        : off <= ACC_GOOD * zoneScale
          ? " is-near"
          : "";
  const inSweet = !powerLocked && power >= POWER_SWEET_MIN && power <= POWER_SWEET_MAX;
  const inRed = power > POWER_SWEET_MAX;
  const streakClass = streak >= 4 ? " is-streak-fire" : streak >= 2 ? " is-streak-hot" : "";
  return (
    <>
      {!locked && <button type="button" className="trip-game-kick-catch" onClick={onTap} aria-label="Tap kick meter" />}
      <div
        className={`trip-game-kick is-${phase}${judgment ? ` is-judged is-${judgment.tier}` : ""}${streakClass}${redBet ? " is-red-bet" : ""}`}
        aria-hidden="true"
      >
        {clutch && <div className="trip-game-kick-clutch">♥ CLUTCH TIME</div>}
        {redBet && <div className="trip-game-kick-bet">🔥 RISK ON</div>}
        {streak >= 2 && (
          <div className="trip-game-kick-streak">
            {streak >= 4 ? "🔥" : "●"} STRIPING ×{streak}
          </div>
        )}
        <div className={`trip-game-kick-col ${powerLocked ? "is-locked" : ""}`}>
          <small>PWR</small>
          <div className={`trip-game-kick-track${inSweet ? " is-charged" : ""}`}>
            <i className="trip-game-kick-redzone" />
            <i className="trip-game-kick-goodzone" />
            <b
              className={`trip-game-kick-fill${inRed && (!powerLocked || redBet) ? " is-red" : ""}`}
              style={{ height: `${powerPct * 100}%` }}
            />
            <em style={{ bottom: `${powerPct * 100}%` }} />
          </div>
        </div>
        <div className={`trip-game-kick-acc ${accLive || locked ? "is-live" : ""}`}>
          <small>ACC</small>
          <div className="trip-game-kick-acc-track">
            <i className="trip-game-kick-zone-good" style={zoneStyle(ACC_GOOD, zoneScale)} />
            <i className="trip-game-kick-zone-great" style={zoneStyle(ACC_GREAT, zoneScale)} />
            <i className="trip-game-kick-zone-pure" style={zoneStyle(ACC_PURE, zoneScale)} />
            <s className="trip-game-kick-acc-center" />
            <b className={heat} style={{ left: `${50 + accuracy * 46}%` }} />
          </div>
          <span>
            <em>L</em>
            <em>R</em>
          </span>
        </div>
        <strong>
          {locked
            ? judgment?.label || "..."
            : phase === "power"
              ? "TAP POWER"
              : redBet
                ? "TAP ACCURACY · RISK ON"
                : "TAP ACCURACY"}
        </strong>
      </div>
    </>
  );
}

// Casino-style odometer that rolls up the drive distance during ball flight.
// The color heats up live as the number climbs through the distance tiers.
function yardTierOf(yards) {
  if (yards >= 300) return "bomb";
  if (yards >= 270) return "hot";
  if (yards >= 240) return "long";
  if (yards >= 200) return "solid";
  return "base";
}

function YardageTicker({ yards, rollMs }) {
  const [shown, setShown] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!Number.isFinite(yards) || yards <= 0) return undefined;
    let frame = 0;
    let lastTick = 0;
    const start = performance.now();
    const duration = Math.max(600, rollMs || 900);
    const loop = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 2.1);
      setShown(Math.round(yards * eased));
      if (t < 1) {
        if (now - lastTick > 64) {
          lastTick = now;
          yardRollTick();
        }
        frame = requestAnimationFrame(loop);
      } else {
        setDone(true);
        yardRollFinal(yardTierOf(yards));
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [yards, rollMs]);
  if (!Number.isFinite(yards) || yards <= 0) return null;
  const tier = yardTierOf(shown);
  const digits = String(clamp(shown, 0, 999)).padStart(3, "0").split("");
  return (
    <div className={`trip-game-yardage is-${tier}${done ? " is-done" : ""}`} aria-hidden="true">
      <div className="trip-game-yardage-digits">
        {digits.map((digit, index) => (
          <span key={index}>{digit}</span>
        ))}
        <small>YDS</small>
      </div>
      {done && tier === "bomb" && <b className="trip-game-yardage-tag">BOMB!</b>}
    </div>
  );
}

// Ryder-Cup-style hole ladder: one pip per hole, filled in the winning
// team's color as the match unfolds.
function HoleLadder({ history, humanTeam, cpuTeam, currentHole }) {
  const byHole = Object.fromEntries(history.map((row) => [row.hole, row]));
  return (
    <div className="trip-game-hole-ladder" aria-label="Hole-by-hole match ladder">
      {Array.from({ length: 18 }, (_, index) => {
        const number = index + 1;
        const row = byHole[number];
        const tone = !row
          ? number === currentHole
            ? "live"
            : "open"
          : row.winner === "tie"
            ? "halved"
            : (row.winner === "human" ? humanTeam : cpuTeam).toLowerCase();
        return <i key={number} className={`is-${tone}`} />;
      })}
    </div>
  );
}

function PopDots({ count }) {
  const pops = Math.max(0, Number(count) || 0);
  if (!pops) return null;
  return (
    <i className={`trip-game-pop-dot${pops > 1 ? " is-double" : ""}`} aria-hidden="true">
      {pops > 1 ? <em /> : null}
    </i>
  );
}

function PopCall({ pops }) {
  if (!pops) return null;
  if (pops.human > 0) {
    return (
      <div className="trip-game-pop-chip is-pop" title="You get a handicap stroke on this hole">
        <i className="trip-game-pop-dot" />
        <b>POP</b>
        {pops.human > 1 ? <em>×{pops.human}</em> : null}
      </div>
    );
  }
  if (pops.cpu > 0) {
    return (
      <div className="trip-game-pop-chip is-give" title="You give a handicap stroke on this hole">
        <b>GIVE</b>
      </div>
    );
  }
  return (
    <div className="trip-game-pop-chip is-even" title="No handicap stroke on this hole">
      <b>EVEN</b>
    </div>
  );
}

function OpponentCard({ opponent, course, team }) {
  if (!opponent?.profile) {
    return (
      <div className="trip-game-vs-card">
        <small>VS {team}</small>
        <b>…</b>
      </div>
    );
  }
  const player = opponent.profile;
  return (
    <div className="trip-game-vs-card">
      <small>VS {team}</small>
      <b>{lastName(player.name)}</b>
      <span>CH {courseHandicap(player.hi, course)}</span>
    </div>
  );
}

function CaptainWheel({ players, selectedKey, usage, maxUses, disabled, onPick, course, team }) {
  const ranked = [...players]
    .filter((player) => (usage[player.key] || 0) < maxUses)
    .sort((left, right) => left.hi - right.hi);
  const list = ranked.length ? ranked : [...players].sort((left, right) => left.hi - right.hi);
  const index = Math.max(0, list.findIndex((player) => player.key === selectedKey));
  const selected = list[index] || null;
  const wheelRef = useRef(null);
  const dragRef = useRef(null);
  const lastTickRef = useRef(0);

  function step(direction) {
    if (disabled || list.length < 2) return;
    const player = list[(index + direction + list.length) % list.length];
    if (player) onPick(player);
  }

  useEffect(() => {
    const node = wheelRef.current;
    if (!node) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      const now = performance.now();
      if (now - lastTickRef.current < 90) return;
      lastTickRef.current = now;
      step(event.deltaY > 0 ? 1 : -1);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  });

  return (
    <div
      ref={wheelRef}
      className={`trip-game-vs-card is-you ${disabled ? "is-locked" : ""}`}
      onPointerDown={(event) => {
        dragRef.current = event.clientY;
      }}
      onPointerUp={(event) => {
        if (dragRef.current == null) return;
        const delta = event.clientY - dragRef.current;
        dragRef.current = null;
        if (Math.abs(delta) < 14) return;
        step(delta > 0 ? 1 : -1);
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <small>YOU {String(team || "").toUpperCase()}</small>
      <b>{selected ? lastName(selected.name) : "…"}</b>
      <span>CH {selected && course ? courseHandicap(selected.hi, course) : "—"}</span>
      <div className="trip-game-wheel-controls">
        <button
          type="button"
          disabled={disabled || list.length < 2}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(-1)}
          aria-label="Previous golfer"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={disabled || list.length < 2}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => step(1)}
          aria-label="Next golfer"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

function PlaybackPanel({ result, shots, shotIndex, onSkip }) {
  const shot = shots[Math.min(shotIndex, shots.length - 1)];
  const cpuSide = shot?.side === "cpu";
  // Only count this side's shots so far — the total would spoil the score.
  const sideShotCount = shots.slice(0, shotIndex + 1).filter((item) => item.side === shot?.side).length;
  return (
    <div className={`trip-game-playback${cpuSide ? " is-cpu" : ""}`} role="status" aria-live="polite">
      <small>{cpuSide ? `${result.cpu ? lastName(result.cpu.name).toUpperCase() : "CPU"} ANSWERS` : "NOW ON THE TEE"}</small>
      <b>{lastName((cpuSide ? result.cpu : result.human).name).toUpperCase()}</b>
      <div className="trip-game-playback-pips" aria-hidden="true">
        {Array.from({ length: sideShotCount }, (_, index) => (
          <span key={index} className={index === sideShotCount - 1 ? "is-live" : "is-done"}>
            {index + 1}
          </span>
        ))}
      </div>
      <p>{shot?.caption || "..."}</p>
      {result.kick && !cpuSide && (
        <em className="trip-game-kick-read">
          PWR {Math.round(result.kick.power * 100)} · ACC{" "}
          {result.kick.accuracy > 0.12 ? "RIGHT" : result.kick.accuracy < -0.12 ? "LEFT" : "CENTER"}
        </em>
      )}
      <button type="button" onClick={onSkip}>
        SKIP ▶▶
      </button>
    </div>
  );
}

function celebrationFor(result) {
  if (result.humanBucket.id === "birdie") return { label: "BIRDIE BLAST!", icon: "★", tone: "birdie" };
  if (result.winner === "human" && result.humanBucket.id === "par") return { label: "CLUTCH PAR!", icon: "!", tone: "win" };
  if (result.winner === "human") return { label: "HOLE STOLEN!", icon: "▲", tone: "win" };
  if (result.winner === "tie") return { label: "CLUTCH HALF!", icon: "=", tone: "tie" };
  if (result.humanBucket.id === "triple") return { label: "BLOW-UP HOLE!", icon: "×", tone: "bust" };
  return { label: "CPU STRIKES!", icon: "▼", tone: "loss" };
}

function courseCardHoles(course) {
  const holes = course?.holes || [];
  return Array.from({ length: 18 }, (_, index) => {
    const hole = holes.find((item) => item.number === index + 1) || holes[index];
    return { number: index + 1, par: Number(hole?.par) || 4 };
  });
}

function scoreMark(gross, par) {
  if (gross == null || !Number.isFinite(gross)) return "empty";
  const rel = gross - par;
  if (rel <= -2) return "eagle";
  if (rel === -1) return "birdie";
  if (rel === 0) return "par";
  if (rel === 1) return "bogey";
  return "blow";
}

function ScorecardNine({ holes, historyByHole, liveHole, sideKey, sideGross, sidePops }) {
  return (
    <div className="trip-game-scorecard-nine" role="table">
      <div className="trip-game-scorecard-row is-hole">
        <span>HOLE</span>
        {holes.map((hole) => (
          <b key={hole.number} className={hole.number === liveHole ? "is-live" : ""}>
            {hole.number}
          </b>
        ))}
      </div>
      <div className="trip-game-scorecard-row is-par">
        <span>PAR</span>
        {holes.map((hole) => (
          <b key={hole.number}>{hole.par}</b>
        ))}
      </div>
      {["human", "cpu"].map((side) => (
        <div key={side} className={`trip-game-scorecard-row is-score is-${side}`}>
          <span>{side === "human" ? sideKey.human : sideKey.cpu}</span>
          {holes.map((hole) => {
            const row = historyByHole[hole.number];
            const gross = row ? sideGross(row, side) : null;
            const pops = row ? sidePops(row, side) : 0;
            const mark = scoreMark(gross, hole.par);
            const won = row && ((side === "human" && row.winner === "human") || (side === "cpu" && row.winner === "cpu"));
            return (
              <b
                key={hole.number}
                className={`is-${mark}${won ? " is-won" : ""}${pops ? " has-pop" : ""}${hole.number === liveHole ? " is-live" : ""}`}
              >
                {gross == null ? "—" : gross}
                <PopDots count={pops} />
              </b>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function ScorecardModal({
  course,
  history,
  match,
  result,
  holeNumber,
  humanTeam,
  cpuTeam,
  onContinue,
  finalHole,
  closeout,
}) {
  const holes = courseCardHoles(course);
  const historyByHole = Object.fromEntries(history.map((row) => [row.hole, row]));
  const celebration = celebrationFor(result);
  const diff = match.human - match.cpu;
  const matchCall = diff === 0 ? "AS" : `${Math.abs(diff)} UP`;
  const leading = diff > 0 ? humanTeam : diff < 0 ? cpuTeam : null;
  const sideKey = {
    human: humanTeam.toLowerCase() === "south" ? "STH" : "NTH",
    cpu: cpuTeam.toLowerCase() === "south" ? "STH" : "NTH",
  };
  return (
    <div className="trip-game-scorecard-backdrop" role="presentation">
      <div className="trip-game-scorecard" role="dialog" aria-modal="true" aria-labelledby="scorecard-title">
        <div className="trip-game-scorecard-head">
          <small>{course?.label || "CAPTAIN'S CUP"}</small>
          <b className={leading ? `is-${leading.toLowerCase()}` : "is-square"}>{leading ? `${leading.toUpperCase()} ${matchCall}` : matchCall}</b>
          <span>
            THRU {history.length}
            {match.ties ? ` · ${match.ties} HALVED` : ""}
          </span>
        </div>
        <h3 id="scorecard-title">SCORECARD</h3>
        <div className={`trip-game-scorecard-call is-${celebration.tone}`}>
          <strong>{celebration.label}</strong>
          <span>
            {lastName(result.human.name).toUpperCase()} {result.humanGross}
            {result.humanStroke ? "●" : ""} · {lastName(result.cpu.name).toUpperCase()} {result.cpuGross}
            {result.cpuStroke ? "●" : ""}
          </span>
        </div>
        <ScorecardNine
          holes={holes.slice(0, 9)}
          historyByHole={historyByHole}
          liveHole={holeNumber}
          sideKey={sideKey}
          sideGross={(row, side) => (side === "human" ? row.humanGross : row.cpuGross)}
          sidePops={(row, side) => (side === "human" ? row.humanStroke : row.cpuStroke)}
        />
        <ScorecardNine
          holes={holes.slice(9)}
          historyByHole={historyByHole}
          liveHole={holeNumber}
          sideKey={sideKey}
          sideGross={(row, side) => (side === "human" ? row.humanGross : row.cpuGross)}
          sidePops={(row, side) => (side === "human" ? row.humanStroke : row.cpuStroke)}
        />
        <div className="trip-game-scorecard-board">
          <div className={`is-${humanTeam.toLowerCase()} ${diff > 0 ? "is-leading" : ""}`}>
            <small>{humanTeam.toUpperCase()}</small>
            <b>{diff > 0 ? `${diff} UP` : diff < 0 ? `${Math.abs(diff)} DN` : "AS"}</b>
            <span>THRU {history.length}</span>
          </div>
          <em>VS</em>
          <div className={`is-${cpuTeam.toLowerCase()} ${diff < 0 ? "is-leading" : ""}`}>
            <small>{cpuTeam.toUpperCase()}</small>
            <b>{diff < 0 ? `${Math.abs(diff)} UP` : diff > 0 ? `${diff} DN` : "AS"}</b>
            <span>THRU {history.length}</span>
          </div>
        </div>
        {closeout?.decided && <div className="trip-game-scorecard-closeout">MATCH DECIDED · {closeout.label}</div>}
        <button type="button" className="trip-game-primary-button" onClick={onContinue}>
          {finalHole ? "FINAL RESULTS" : "CONTINUE"}
        </button>
      </div>
    </div>
  );
}

function FireballOffer({ player, onAccept, onDecline }) {
  return (
    <div className="trip-game-modal-backdrop" role="presentation">
      <div className="trip-game-modal" role="dialog" aria-modal="true" aria-labelledby="fireball-title">
        <div className="trip-game-modal-sprite" aria-hidden="true">
          <span>🔥</span>
        </div>
        <p className="trip-game-modal-kicker">WILD EVENT</p>
        <h3 id="fireball-title">SEAN OFFERS A FIREBALL</h3>
        <p>
          {lastName(player.name)}, one shot? A little buzz can help. Pass the tipping point and the model turns sharply against you.
        </p>
        <div className="trip-game-modal-options">
          <button type="button" onClick={onAccept}>
            <b>ACCEPT</b>
            <span>Buzz +22 · morale +5</span>
          </button>
          <button type="button" onClick={onDecline}>
            <b>DECLINE</b>
            <span>Your morale -5 · Sean heats up</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function CartGirlOffer({ player, onDrink, onHydrate }) {
  return (
    <div className="trip-game-modal-backdrop" role="presentation">
      <div className="trip-game-modal trip-game-modal--cart" role="dialog" aria-modal="true" aria-labelledby="cart-girl-title">
        <div className="trip-game-modal-sprite" aria-hidden="true">
          <span>🛺</span>
        </div>
        <p className="trip-game-modal-kicker">COURSE ENCOUNTER</p>
        <h3 id="cart-girl-title">THE CART GIRL APPEARS!</h3>
        <p>
          {lastName(player.name)} has a choice. Take the short morale pop now, or hydrate and lower the chance of a late-round
          meltdown.
        </p>
        <div className="trip-game-modal-options">
          <button type="button" onClick={onDrink}>
            <b>GRAB A COLD ONE</b>
            <span>Buzz +14 · morale +8</span>
          </button>
          <button type="button" onClick={onHydrate}>
            <b>HYDRATE</b>
            <span>Buzz -12 · morale +5</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function SetupScreen({ model, courseId, setCourseId, team, setTeam, archiveState, onStart }) {
  return (
    <div className="trip-game-setup">
      <div className="trip-game-title-screen">
        <div className="trip-game-title-flag">★</div>
        <p>CRYSTAL SPRINGS PRESENTS</p>
        <h2>CAPTAIN&apos;S CUP</h2>
        <span>PIXEL GOLF // DATA ENGINE</span>
      </div>
      <div className="trip-game-story">
        You are the captain. Secretly pick one golfer per hole, choose a shot plan, then let the trip model roll it against the
        other side.
      </div>
      <div className="trip-game-setup-block">
        <div className="trip-game-section-label">
          <span>1. SELECT COURSE</span>
          <span>{model.courses.length} READY</span>
        </div>
        <div className="trip-game-course-grid">
          {model.courses.map((course) => (
            <button
              type="button"
              key={course.id}
              className={course.id === courseId ? "is-selected" : ""}
              onClick={() => setCourseId(course.id)}
            >
              <b>{course.label}</b>
              <span>{course.coverage} PLAYER-HOLE SAMPLES</span>
              <small>
                PAR {course.par} · {course.geometry ? "REAL MAP" : "PROTOTYPE MAP"}
              </small>
            </button>
          ))}
        </div>
      </div>
      <div className="trip-game-setup-block">
        <div className="trip-game-section-label">
          <span>2. CAPTAIN A SIDE</span>
          <span>CPU TAKES THE OTHER</span>
        </div>
        <div className="trip-game-team-grid">
          {model.teams.map((name) => (
            <button
              type="button"
              key={name}
              className={`${name === team ? "is-selected" : ""} is-${name.toLowerCase()}`}
              onClick={() => setTeam(name)}
            >
              <b>{name.toUpperCase()}</b>
              <span>{model.players.filter((player) => player.team === name).length} GOLFERS</span>
            </button>
          ))}
        </div>
      </div>
      <div className="trip-game-model-status">
        <span className={`trip-game-status-light is-${archiveState}`} />
        {archiveState === "loading"
          ? "LOADING 2025 + 2026 PLAYER HISTORY..."
          : `${model.dataSummary.trips} TRIPS · ${model.dataSummary.historicalPlayers} PROFILES · ODDS READY`}
      </div>
      <button
        type="button"
        className="trip-game-primary-button trip-game-start-button"
        disabled={!courseId || !team || !model.courses.length}
        onClick={onStart}
      >
        START CAPTAIN ROUND ▶
      </button>
      <p className="trip-game-disclaimer">
        Turf and hazard shapes use OpenStreetMap geometry. Trees and mowing texture are illustrative; unscouted shot shapes remain
        modeled until player profiles are entered.
      </p>
    </div>
  );
}

function FinishScreen({ match, history, team, cpuTeam, closeout, onRematch, onSetup }) {
  const winner = match.human > match.cpu ? team : match.cpu > match.human ? cpuTeam : null;
  const diff = match.human - match.cpu;
  return (
    <div className="trip-game-finish">
      <p className="trip-game-modal-kicker">
        {closeout?.decided ? `MATCH CLOSED OUT AFTER ${closeout.holesPlayed} HOLES` : "ROUND COMPLETE"}
      </p>
      <h2 className={winner ? `is-${winner.toLowerCase()}` : ""}>
        {winner ? `${winner.toUpperCase()} WINS${closeout?.label ? ` ${closeout.label}` : ` ${Math.abs(diff)} UP`}` : "MATCH HALVED"}
      </h2>
      <div className="trip-game-final-score">
        <div className={`is-${team.toLowerCase()} ${diff > 0 ? "is-leading" : ""}`}>
          <span>{team.toUpperCase()}</span>
          <b>{diff > 0 ? `${diff} UP` : diff < 0 ? `${Math.abs(diff)} DN` : "AS"}</b>
        </div>
        <em>FINAL</em>
        <div className={`is-${cpuTeam.toLowerCase()} ${diff < 0 ? "is-leading" : ""}`}>
          <span>{cpuTeam.toUpperCase()}</span>
          <b>{diff < 0 ? `${Math.abs(diff)} UP` : diff > 0 ? `${diff} DN` : "AS"}</b>
        </div>
      </div>
      <HoleLadder history={history} humanTeam={team} cpuTeam={cpuTeam} currentHole={0} />
      <div className="trip-game-mini-card">
        {history.map((row) => (
          <div key={row.hole} className={`is-${row.winner}`}>
            <span>{String(row.hole).padStart(2, "0")}</span>
            <span>{lastName(row.human)}</span>
            <b>{row.humanGross}</b>
            <em>{row.winner === "tie" ? "AS" : row.winner === "human" ? "W" : "L"}</em>
            <b>{row.cpuGross}</b>
            <span>{lastName(row.cpu)}</span>
          </div>
        ))}
      </div>
      <div className="trip-game-finish-actions">
        <button type="button" className="trip-game-primary-button" onClick={onRematch}>
          REMATCH
        </button>
        <button type="button" className="trip-game-secondary-button" onClick={onSetup}>
          CHANGE SETUP
        </button>
      </div>
    </div>
  );
}

export default function TripGame({ data }) {
  const [archive, setArchive] = useState([]);
  const [archiveState, setArchiveState] = useState("loading");
  const [courseId, setCourseId] = useState(null);
  const [captainTeam, setCaptainTeam] = useState(null);
  const [screen, setScreen] = useState("setup");
  const [holeIndex, setHoleIndex] = useState(0);
  const [selectedKey, setSelectedKey] = useState(null);
  const [decision, setDecision] = useState({ club: "driver", aim: 0, shape: "straight", fireball: false });
  const [usage, setUsage] = useState({});
  const [cpuUsage, setCpuUsage] = useState({});
  const [playerState, setPlayerState] = useState({});
  const [match, setMatch] = useState({ human: 0, cpu: 0, ties: 0 });
  const [history, setHistory] = useState([]);
  const [result, setResult] = useState(null);
  const [closeout, setCloseout] = useState(null);
  const [resolutionPhase, setResolutionPhase] = useState("idle");
  const [playbackShots, setPlaybackShots] = useState(null);
  const [playbackStep, setPlaybackStep] = useState({ index: 0, phase: "swing", frame: 0 });
  const [holeIntro, setHoleIntro] = useState(false);
  const [hype, setHype] = useState(0);
  const [streak, setStreak] = useState(0);
  const [geometryBySlug, setGeometryBySlug] = useState({});
  const [inventory, setInventory] = useState({ fireball: 1 });
  const [eventOffer, setEventOffer] = useState(null);
  const [eventHandled, setEventHandled] = useState({});
  const [pickLocked, setPickLocked] = useState(false);
  const [eventNote, setEventNote] = useState(null);
  const [cpuOpponent, setCpuOpponent] = useState(null);
  const [meterPhase, setMeterPhase] = useState(null);
  const [meterTick, setMeterTick] = useState({ power: 0, accuracy: 0 });
  const [swingFx, setSwingFx] = useState(null);
  const [shakeFx, setShakeFx] = useState(null);
  const [swingStreak, setSwingStreak] = useState(0);
  const [meterMods, setMeterMods] = useState({ zoneScale: 1, redBet: false, clutch: false });
  const meterModsRef = useRef({ speed: BASE_ACC_SPEED, clubSpeed: 1, zoneScale: 1, redBet: false, clutch: false });
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return window.localStorage.getItem("tripGameSound") !== "off";
    } catch {
      return true;
    }
  });
  const meterLiveRef = useRef({ power: 0, accuracy: 0, powerDir: 1, accDir: 1 });
  const meterLockRef = useRef(null);
  const meterTapAtRef = useRef(0);
  const resolvingRef = useRef(false);
  const randomRef = useRef(makeSeededRandom(Date.now()));
  const resolutionTimerRef = useRef(null);
  const pendingCommitRef = useRef(null);

  useEffect(() => {
    let live = true;
    Promise.allSettled(
      ARCHIVE_FILES.map((file) =>
        fetch(file).then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        }),
      ),
    ).then((results) => {
      if (!live) return;
      const loaded = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
      setArchive(loaded);
      setArchiveState(loaded.length === ARCHIVE_FILES.length ? "ready" : "partial");
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
      stopPowerSweep();
      stopHeartbeat();
    },
    [],
  );

  useEffect(() => {
    setMeterAudioEnabled(soundOn);
    try {
      window.localStorage.setItem("tripGameSound", soundOn ? "on" : "off");
    } catch {
      // best effort
    }
  }, [soundOn]);

  // Game Boy style keyboard aiming on desktop; Space/Enter lock the kick meter.
  useEffect(() => {
    if (screen !== "play") return undefined;
    const onKey = (event) => {
      if (meterPhase && (event.key === " " || event.key === "Enter")) {
        if (event.repeat) return;
        event.preventDefault();
        tapMeter();
        return;
      }
      if (meterPhase) return;
      if (resolutionPhase === "result" && (event.key === " " || event.key === "Enter")) {
        if (event.repeat) return;
        event.preventDefault();
        nextHole();
        return;
      }
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      stepAim(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    // "locked" is the hit-stop phase: the needle stays frozen where it was tapped.
    if (meterPhase !== "power" && meterPhase !== "accuracy") return undefined;
    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.04, (now - last) / 1000);
      last = now;
      const live = meterLiveRef.current;
      if (meterPhase === "power") {
        const before = live.power;
        live.power += dt * (meterModsRef.current.powerSpeed || BASE_POWER_SPEED);
        updatePowerSweep(live.power / POWER_METER_MAX);
        if (before < POWER_SWEET_MIN && live.power >= POWER_SWEET_MIN) zoneTick("good");
        if (before < POWER_SWEET_MAX && live.power >= POWER_SWEET_MAX) zoneTick("warn");
        if (live.power >= POWER_METER_MAX) {
          live.power = POWER_METER_MAX;
          live.accuracy = -1;
          live.accDir = 1;
          meterLockRef.current = { power: POWER_METER_MAX };
          stopPowerSweep();
          lockPowerSound(true);
          armAccuracyPhase(POWER_METER_MAX);
          setMeterTick({ power: POWER_METER_MAX, accuracy: -1 });
          setMeterPhase("accuracy");
          return;
        }
      } else if (meterPhase === "accuracy") {
        const beforeOff = Math.abs(live.accuracy);
        live.accuracy += live.accDir * dt * meterModsRef.current.speed;
        if (live.accuracy >= 1) {
          live.accuracy = 1;
          live.accDir = -1;
        } else if (live.accuracy <= -1) {
          live.accuracy = -1;
          live.accDir = 1;
        }
        const offNow = Math.abs(live.accuracy);
        const zoneScale = meterModsRef.current.zoneScale || 1;
        if (offNow <= ACC_PURE * zoneScale && beforeOff > ACC_PURE * zoneScale) zoneTick("pure");
        else if (offNow <= ACC_GREAT * zoneScale && beforeOff > ACC_GREAT * zoneScale) zoneTick("good");
      }
      setMeterTick({ power: live.power, accuracy: live.accuracy });
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [meterPhase]);

  // Advance the cartoon shot playback: swing -> frame-by-frame flight -> settle.
  useEffect(() => {
    if (resolutionPhase !== "playback" || !playbackShots) return undefined;
    const shot = playbackShots[playbackStep.index];
    if (!shot) {
      finishPlayback();
      return undefined;
    }
    const lastFrame = Math.max(0, (shot.frames?.length || 1) - 1);
    const duration =
      playbackStep.phase === "swing"
        ? shot.kind === "putt"
          ? 320
          : 420
        : playbackStep.phase === "flight"
          ? FLIGHT_FRAME_MS
          : shot.kind === "splash"
            ? 700
            : shot.final
              ? 640
              : 300;
    const timer = window.setTimeout(() => {
      if (playbackStep.phase === "swing") {
        // Club meets ball: crack + screenshake, scaled by how hard they swung.
        const kickPower = playbackStep.index === 0 ? result?.kick?.power ?? 0.9 : 0.62;
        contactSound({
          power: kickPower,
          putt: shot.kind === "putt",
          pure: playbackStep.index === 0 && swingFx?.tier === "pure",
        });
        if (playbackStep.index === 0 && shot.kind !== "putt") {
          setShakeFx({ amp: Math.round(3 + clamp(kickPower, 0, 1.15) * 5), id: Date.now() });
          window.setTimeout(() => setShakeFx(null), 320);
          // A flushed drive gets the gallery murmuring while it hangs up there.
          if (swingFx?.tier === "pure" || swingFx?.tier === "great") {
            crowdSwell(swingFx.tier === "pure" ? 1 : 0.55);
          }
        }
      }
      if (playbackStep.phase === "flight" && (playbackStep.frame || 0) >= lastFrame) {
        // Ball is about to land.
        if (shot.kind === "splash") splashSound();
        else if (shot.kind === "ob") zoneTick("warn");
        else if (shot.final) holeoutSound();
      }
      setPlaybackStep((current) => {
        if (current.phase === "swing") return { ...current, phase: "flight", frame: 0 };
        if (current.phase === "flight") {
          if ((current.frame || 0) < lastFrame) return { ...current, frame: (current.frame || 0) + 1 };
          return { ...current, phase: "settle" };
        }
        return { index: current.index + 1, phase: "swing", frame: 0 };
      });
    }, duration);
    return () => window.clearTimeout(timer);
  });

  // Hole intro card auto-dismisses after a beat.
  useEffect(() => {
    if (!holeIntro) return undefined;
    const timer = window.setTimeout(() => setHoleIntro(false), 2100);
    return () => window.clearTimeout(timer);
  }, [holeIntro]);

  const historicalData = useMemo(
    () => archive.filter((dataset) => dataset.trip?.id !== data.trip?.id),
    [archive, data.trip?.id],
  );
  const model = useMemo(() => buildTripGameModel(data, historicalData), [data, historicalData]);

  useEffect(() => {
    if (!model.courses.length) return;
    if (!model.courses.some((course) => course.id === courseId)) setCourseId(model.courses[0].id);
    if (!model.teams.includes(captainTeam)) setCaptainTeam(model.teams[0] || null);
  }, [captainTeam, courseId, model.courses, model.teams]);

  const course = model.courses.find((entry) => entry.id === courseId) || model.courses[0] || null;
  useEffect(() => {
    if (!course?.geometry || Object.prototype.hasOwnProperty.call(geometryBySlug, course.slug)) return;
    let live = true;
    fetch(course.geometry)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((geometry) => {
        if (live) setGeometryBySlug((current) => ({ ...current, [course.slug]: geometry }));
      })
      .catch(() => {
        if (live) setGeometryBySlug((current) => ({ ...current, [course.slug]: null }));
      });
    return () => {
      live = false;
    };
  }, [course, geometryBySlug]);

  const baseHole = course?.holes?.[holeIndex] || null;
  const geometry = course ? geometryBySlug[course.slug] : null;
  const projection = useMemo(() => (baseHole ? projectHole(geometry, baseHole) : null), [baseHole, geometry]);
  const hole = useMemo(() => {
    if (!baseHole || !projection) return baseHole;
    return {
      ...baseHole,
      par: Number(projection.official?.par) || baseHole.par,
      si: Number(projection.official?.hcp) || baseHole.si,
      yards: Number(projection.official?.yards) || null,
      dangerSide: projection.dangerSide,
      primaryHazard: projection.primaryHazard,
      hasWater: projection.hasWater,
      hazardSeverity: projection.hazardSeverity,
      preferredShape: projection.preferredShape,
      shapeSeverity: projection.shapeSeverity,
    };
  }, [baseHole, projection]);

  const cpuTeam = captainTeam === "South" ? "North" : "South";
  const humanRoster = model.players.filter((player) => player.team === captainTeam);
  const cpuRoster = model.players.filter((player) => player.team === cpuTeam);
  const maxUses = Math.max(2, Math.ceil(18 / Math.max(1, humanRoster.length)));
  const cpuMaxUses = Math.max(2, Math.ceil(18 / Math.max(1, cpuRoster.length)));

  useEffect(() => {
    if (screen !== "play" || !course || !hole || !cpuRoster.length) return;
    const pick = chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
      random: randomRef.current,
    });
    setCpuOpponent(pick || null);
    // Lock once per hole so the matchup is visible before the captain picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hole change only
  }, [screen, holeIndex, course?.id, hole?.number]);

  const selected = humanRoster.find((player) => player.key === selectedKey) || null;
  const selectedState = selected ? playerState[selected.key] || DEFAULT_PLAYER_STATE : DEFAULT_PLAYER_STATE;

  useEffect(() => {
    if (screen !== "play" || selectedKey || !hole || result || resolutionPhase !== "idle") return;
    const available = humanRoster
      .filter((player) => (usage[player.key] || 0) < maxUses)
      .sort((left, right) => left.hi - right.hi);
    const player = available[0];
    if (!player) return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
  }, [screen, holeIndex, hole, selectedKey, humanRoster, usage, maxUses, result, resolutionPhase]);
  const odds = useMemo(
    () => (selected && course && hole ? buildHoleOdds({ profile: selected, course, hole, decision, state: selectedState }) : null),
    [course, decision, hole, selected, selectedState],
  );
  const livePops = useMemo(
    () => (selected && cpuOpponent?.profile && course && hole ? holePops(selected, cpuOpponent.profile, course, hole) : null),
    [selected, cpuOpponent, course, hole],
  );
  const holeRanking = useMemo(() => {
    if (!course || !hole) return [];
    return model.players
      .filter((player) => player.team === captainTeam)
      .map((player) => {
        const playerCondition = playerState[player.key] || DEFAULT_PLAYER_STATE;
        const plan = findBestDecision({ profile: player, course, hole, state: playerCondition });
        return { key: player.key, expected: plan.best.odds.expectedGross };
      })
      .sort((left, right) => left.expected - right.expected);
  }, [captainTeam, course, hole, model.players, playerState]);
  const captainRead = useMemo(() => {
    if (!selected || !course || !hole || !odds) return null;
    const baselineDecision = defaultDecision(selected, hole);
    const baselineOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision: baselineDecision,
      state: selectedState,
    });
    const { best, worst } = findBestDecision({ profile: selected, course, hole, state: selectedState });
    const range = Math.max(0.01, worst.odds.expectedGross - best.odds.expectedGross);
    const rawQuality = 1 - clamp((odds.expectedGross - best.odds.expectedGross) / range, 0, 1);
    const quality = Math.round(rawQuality * 100);
    const scoring = odds.probs[0] + odds.probs[1];
    const baselineScoring = baselineOdds.probs[0] + baselineOdds.probs[1];
    const bigNumber = odds.probs[3] + odds.probs[4];
    const baselineBigNumber = baselineOdds.probs[3] + baselineOdds.probs[4];
    const playerRank = Math.max(1, holeRanking.findIndex((player) => player.key === selected.key) + 1);
    const fireball = Boolean(decision.fireball);
    const label = fireball
      ? "CHAOS MODE!"
      : quality >= 94
        ? "PERFECT READ!"
        : quality >= 76
          ? "SMART PLAY!"
          : quality >= 52
            ? "LIVE OPTION"
            : "DANGER ZONE!";
    const tone = fireball ? "chaos" : quality >= 94 ? "perfect" : quality >= 76 ? "smart" : quality >= 52 ? "live" : "danger";
    return {
      label,
      tone,
      quality,
      scoringDelta: scoring - baselineScoring,
      bigNumberDelta: bigNumber - baselineBigNumber,
      expectedSaved: baselineOdds.expectedGross - odds.expectedGross,
      bestDecision: best.decision,
      playerRank,
      rosterSize: holeRanking.length,
      fireball,
      planKey: `${decision.club}-${decision.shape}-${decision.aim}-${fireball ? "fireball" : "normal"}`,
    };
  }, [course, decision, hole, holeRanking, odds, selected, selectedState]);
  const scoreDifference = match.human - match.cpu;
  const holesRemaining = 18 - history.length;
  const dormie = scoreDifference !== 0 && Math.abs(scoreDifference) === holesRemaining;
  const leadingTeam = scoreDifference > 0 ? captainTeam : scoreDifference < 0 ? cpuTeam : null;
  const matchCall = leadingTeam ? `${leadingTeam.toUpperCase()} ${Math.abs(scoreDifference)} UP` : "AS";

  function initializePlayerState() {
    return Object.fromEntries(model.players.map((player) => [player.key, { buzz: 0, morale: 50 }]));
  }

  function startRound() {
    if (!course || !captainTeam) return;
    if (resolutionTimerRef.current) {
      window.clearTimeout(resolutionTimerRef.current);
      resolutionTimerRef.current = null;
    }
    setScreen("play");
    setHoleIndex(0);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: 0, shape: "straight", fireball: false });
    setUsage({});
    setCpuUsage({});
    setPlayerState(initializePlayerState());
    setMatch({ human: 0, cpu: 0, ties: 0 });
    setHistory([]);
    setResult(null);
    setCloseout(null);
    setResolutionPhase("idle");
    setPlaybackShots(null);
    setHoleIntro(true);
    pendingCommitRef.current = null;
    setHype(0);
    setStreak(0);
    setSwingStreak(0);
    setInventory({ fireball: 1 });
    setEventOffer(null);
    setEventHandled({});
    setPickLocked(false);
    setEventNote(null);
    setCpuOpponent(null);
    setMeterPhase(null);
    resolvingRef.current = false;
    meterLockRef.current = null;
    randomRef.current = makeSeededRandom(Date.now());
  }

  function pickPlayer(player) {
    if (result || pickLocked || resolutionPhase !== "idle") return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
    setEventNote(null);
    setMeterPhase(null);
    resolvingRef.current = false;
    meterLockRef.current = null;
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  function stepAim(direction) {
    if (!selected || result || resolutionPhase !== "idle" || meterPhase) return;
    setDecision((current) => ({
      ...current,
      aim: clamp(aimOffsetOf(current.aim) + direction * AIM_STEP, -AIM_MAX, AIM_MAX),
    }));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(4);
  }

  function cycleDecision(type) {
    if (!selected || result || resolutionPhase !== "idle" || meterPhase) return;
    setDecision((current) => {
      const options = type === "club" ? CLUBS.filter((item) => item.minPar <= (hole?.par || 3)) : SHAPES;
      if (!options.length) return current;
      const index = Math.max(0, options.findIndex((item) => item.id === current[type]));
      return { ...current, [type]: options[(index + 1) % options.length].id };
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(4);
  }

  function updateCondition(playerKey, update) {
    setPlayerState((current) => {
      const previous = current[playerKey] || { buzz: 0, morale: 50 };
      return {
        ...current,
        [playerKey]: {
          buzz: clamp(previous.buzz + (update.buzz || 0), 0, 100),
          morale: clamp(previous.morale + (update.morale || 0), 0, 100),
        },
      };
    });
  }

  function acceptFireball() {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, { buzz: 22, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote("FIREBALL ACCEPTED · EARLY BOOST / TIPPING RISK");
    setEventOffer(null);
  }

  function declineFireball() {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, { morale: -5 });
    const sean = humanRoster.find((player) => player.key === "sean wilson");
    if (sean) updateCondition(sean.key, { buzz: 12, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote("SHOT DECLINED · YOUR MORALE DIPS / SEAN HEATS UP");
    setEventOffer(null);
  }

  function chooseCartGirl(drink) {
    if (!eventOffer) return;
    updateCondition(eventOffer.playerKey, drink ? { buzz: 14, morale: 8 } : { buzz: -12, morale: 5 });
    setEventHandled((current) => ({ ...current, [holeIndex]: true }));
    setPickLocked(true);
    setEventNote(
      drink ? "COLD ONE ACQUIRED · SHORT MORALE POP / MORE BUZZ" : "HYDRATION PLAY · BUZZ DOWN / CONTROL RESTORED",
    );
    setEventOffer(null);
  }

  function startKickMeter() {
    setHoleIntro(false);
    resolvingRef.current = false;
    meterLiveRef.current = { power: 0, accuracy: -1, powerDir: 1, accDir: 1 };
    meterLockRef.current = null;
    meterTapAtRef.current = 0;
    // Contextual meter: shorter clubs swing an easier (slower, wider) needle,
    // better players get wider zones, higher handicaps get a faster meter, and
    // a match-deciding hole drops into clutch time — slow-mo needle, heartbeat.
    const skill = skillOf(selected?.hi);
    const skillSpeed = 1 + (1 - skill) * SKILL_SPEED_PENALTY;
    const baseZone = (CLUB_ZONE_SCALE[decision.club] ?? 1) * (1 + skill * SKILL_ZONE_BONUS);
    const clubSpeed = CLUB_METER_SPEED[decision.club] ?? 1;
    const clutch = dormie || hole?.number === 18;
    meterModsRef.current = {
      speed: BASE_ACC_SPEED * clubSpeed * skillSpeed * (clutch ? CLUTCH_SPEED : 1),
      powerSpeed: BASE_POWER_SPEED * skillSpeed * (clutch ? 0.85 : 1),
      clubSpeed,
      skillSpeed,
      baseZone,
      zoneScale: baseZone,
      redBet: false,
      clutch,
    };
    setMeterMods({ zoneScale: baseZone, redBet: false, clutch });
    setMeterTick({ power: 0, accuracy: -1 });
    setSwingFx(null);
    setMeterPhase("power");
    unlockMeterAudio();
    startPowerSweep();
    if (clutch) startHeartbeat();
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  // Called the instant power locks: if it landed in the red band, the bet is
  // on — zones shrink and the needle speeds up, visibly, before the second tap.
  function armAccuracyPhase(lockedPower) {
    const live = meterModsRef.current;
    const redBet = lockedPower > POWER_SWEET_MAX;
    live.redBet = redBet;
    live.zoneScale = (live.baseZone ?? 1) * (redBet ? RED_BET_ZONE_SCALE : 1);
    live.speed =
      BASE_ACC_SPEED *
      (live.clubSpeed ?? 1) *
      (live.skillSpeed ?? 1) *
      (live.clutch ? CLUTCH_SPEED : 1) *
      (redBet ? RED_BET_SPEED : 1);
    setMeterMods({ zoneScale: live.zoneScale, redBet, clutch: live.clutch });
    if (redBet) riskArmedSound();
  }

  function tapMeter() {
    if (!meterPhase || meterPhase === "locked" || resolvingRef.current) return;
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - meterTapAtRef.current < 220) return;
    meterTapAtRef.current = now;
    if (meterPhase === "power") {
      const live = meterLiveRef.current;
      live.accuracy = -1;
      live.accDir = 1;
      meterLockRef.current = { power: live.power };
      stopPowerSweep();
      lockPowerSound(live.power > POWER_SWEET_MAX);
      armAccuracyPhase(live.power);
      setMeterPhase("accuracy");
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
      return;
    }
    const power = meterLockRef.current?.power ?? meterLiveRef.current.power;
    const accuracy = meterLiveRef.current.accuracy;
    meterLockRef.current = { power, accuracy };
    resolvingRef.current = true;
    stopHeartbeat();
    // Hit-stop: freeze the needle where it was tapped, flash the judgment,
    // then release into the swing after a tier-scaled beat.
    const judgment = judgeSwing(power, accuracy, meterModsRef.current);
    // Striping streak: consecutive GREAT-or-better swings. PUREs climb the
    // chord up the scale; any lesser strike resets it.
    const nextStreak = judgment.tier === "pure" || judgment.tier === "great" ? swingStreak + 1 : 0;
    setSwingStreak(nextStreak);
    setSwingFx({ ...judgment, power, accuracy, streak: nextStreak, id: now });
    setMeterPhase("locked");
    swingJudgmentSound(judgment.tier, judgment.tier === "pure" ? nextStreak - 1 : 0);
    if (judgment.nearMiss) nearMissSound();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(
        judgment.tier === "pure" ? [18, 26, 46] : judgment.tier === "great" ? 26 : judgment.tier === "wild" ? [8, 36] : 12,
      );
    }
    window.setTimeout(() => {
      setMeterPhase(null);
      resolveHole({ power, accuracy });
    }, judgment.hold);
  }

  function playHole() {
    if (meterPhase) {
      tapMeter();
      return;
    }
    if (!selected || !odds || !hole || !course || result || resolutionPhase !== "idle") return;
    if (CART_GIRL_HOLES.has(hole.number) && !eventHandled[holeIndex]) {
      setEventOffer({ type: "cart-girl", playerKey: selected.key, player: selected });
      return;
    }
    const seanInGroup = humanRoster.some((player) => player.key === "sean wilson");
    if (
      seanInGroup &&
      selected.key !== "sean wilson" &&
      FIREBALL_HOLES.has(hole.number) &&
      !eventHandled[holeIndex]
    ) {
      setEventOffer({ type: "fireball", playerKey: selected.key, player: selected });
      return;
    }
    startKickMeter();
  }

  function resolveHole(meter) {
    if (!selected || !hole || !course || result || resolutionPhase !== "idle") return;
    const swung = {
      ...decision,
      power: meter.power,
      accuracy: meter.accuracy,
    };
    const visualDecision = {
      ...swung,
      aim: clamp(aimOffsetOf(decision.aim) + meter.accuracy * 0.45, -AIM_MAX, AIM_MAX),
    };
    const currentHumanOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision: swung,
      state: playerState[selected.key],
    });
    const cpuPick = cpuOpponent || chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
      random: randomRef.current,
    });
    if (!cpuPick) return;
    const cpuOdds = buildHoleOdds({
      profile: cpuPick.profile,
      course,
      hole,
      decision: cpuPick.decision || defaultDecision(cpuPick.profile, hole),
      state: playerState[cpuPick.profile.key],
    });
    const resolved = resolveMatchHole({
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds,
      course,
      hole,
      random: randomRef.current,
      remapHumanLanding: projection
        ? (wanted) => placeTeeLanding(projection, hole, visualDecision, wanted).type
        : undefined,
    });
    const completeResult = {
      ...resolved,
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds,
      decisionRead: captainRead,
      kick: { power: meter.power, accuracy: meter.accuracy },
    };
    const nextStreak = resolved.winner === "human" ? streak + 1 : resolved.winner === "tie" ? streak : 0;
    const qualityBonus = Math.round(((captainRead?.quality || 50) / 100) * 12);
    const resultBonus = resolved.winner === "human" ? 14 : resolved.winner === "tie" ? 7 : 2;
    const scoreBonus = resolved.humanBucket.id === "birdie" ? 12 : resolved.humanBucket.id === "par" ? 5 : 0;
    const streakBonus = Math.min(8, Math.max(0, nextStreak - 1) * 3);
    const hypeGain = clamp(4 + qualityBonus + resultBonus + scoreBonus + streakBonus, 6, 40);
    const powerUpEarned = hype + hypeGain >= 100;
    const nextHype = powerUpEarned ? hype + hypeGain - 100 : hype + hypeGain;
    completeResult.hypeGain = hypeGain;
    completeResult.streak = nextStreak;
    completeResult.powerUpEarned = powerUpEarned;
    completeResult.shotDecision = visualDecision;
    const nextCloseout = matchCloseout({
      humanWins: match.human + (resolved.winner === "human" ? 1 : 0),
      cpuWins: match.cpu + (resolved.winner === "cpu" ? 1 : 0),
      holesPlayed: holeIndex + 1,
    });
    pendingCommitRef.current = {
      resolved,
      cpuPick,
      selectedKey: selected.key,
      selectedName: selected.name,
      holeNumber: hole.number,
      usedFireball: Boolean(decision.fireball),
      nextStreak,
      nextHype,
      powerUpEarned,
      nextCloseout,
    };
    // Your ball first, then the opponent answers shot for shot.
    const humanShots = projection
      ? buildShotSequence({
          projection,
          hole,
          decision: visualDecision,
          gross: resolved.humanGross,
          landingLabel: resolved.humanLanding,
          side: "human",
        })
      : [];
    const cpuShots = projection
      ? buildShotSequence({
          projection,
          hole,
          decision: cpuPick.decision || defaultDecision(cpuPick.profile, hole),
          gross: resolved.cpuGross,
          landingLabel: resolved.cpuLanding,
          side: "cpu",
          seedSalt: 5,
        })
      : [];
    const shots = [...humanShots, ...cpuShots];
    setPlaybackShots(shots);
    setPlaybackStep({ index: 0, phase: "swing", frame: 0 });
    setResult(completeResult);
    setResolutionPhase("playback");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    const safetyMs = Math.max(
      PLAYBACK_SAFETY_MS,
      shots.reduce((total, shot) => total + 420 + (shot.frames?.length || 8) * FLIGHT_FRAME_MS + 700, 4000),
    );
    resolutionTimerRef.current = window.setTimeout(() => finishPlayback(), safetyMs);
  }

  function finishPlayback() {
    const pending = pendingCommitRef.current;
    if (!pending) return;
    pendingCommitRef.current = null;
    if (resolutionTimerRef.current) {
      window.clearTimeout(resolutionTimerRef.current);
      resolutionTimerRef.current = null;
    }
    const { resolved, cpuPick, nextStreak, nextHype, powerUpEarned, nextCloseout } = pending;
    setResolutionPhase("result");
    setPlaybackShots(null);
    setUsage((current) => ({ ...current, [pending.selectedKey]: (current[pending.selectedKey] || 0) + 1 }));
    setCpuUsage((current) => ({ ...current, [cpuPick.profile.key]: (current[cpuPick.profile.key] || 0) + 1 }));
    setMatch((current) => ({
      human: current.human + (resolved.winner === "human" ? 1 : 0),
      cpu: current.cpu + (resolved.winner === "cpu" ? 1 : 0),
      ties: current.ties + (resolved.winner === "tie" ? 1 : 0),
    }));
    setHistory((current) => [
      ...current,
      {
        hole: pending.holeNumber,
        winner: resolved.winner,
        human: pending.selectedName,
        cpu: cpuPick.profile.name,
        humanGross: resolved.humanGross,
        cpuGross: resolved.cpuGross,
        humanStroke: resolved.humanStroke,
        cpuStroke: resolved.cpuStroke,
      },
    ]);
    setHype(nextHype);
    setStreak(nextStreak);
    if (nextCloseout.decided) setCloseout(nextCloseout);
    setInventory((current) => ({
      ...current,
      fireball: Math.max(0, current.fireball - (pending.usedFireball ? 1 : 0)) + (powerUpEarned ? 1 : 0),
    }));
    if (resolved.winner === "human") holeWinSound();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(resolved.winner === "human" ? [35, 30, 65] : 25);
    }
  }

  function nextHole() {
    if (holeIndex >= 17 || closeout?.decided) {
      setScreen("finish");
      return;
    }
    setHoleIndex((current) => current + 1);
    setSelectedKey(null);
    setDecision({ club: "driver", aim: 0, shape: "straight", fireball: false });
    setResult(null);
    setResolutionPhase("idle");
    setPlaybackShots(null);
    setHoleIntro(true);
    pendingCommitRef.current = null;
    setEventOffer(null);
    setPickLocked(false);
    setEventNote(null);
    setCpuOpponent(null);
    setMeterPhase(null);
    setSwingFx(null);
    setShakeFx(null);
    setMeterMods({ zoneScale: 1, redBet: false, clutch: false });
    stopHeartbeat();
    resolvingRef.current = false;
    meterLockRef.current = null;
  }

  if (!model.courses.length && archiveState === "loading") {
    return (
      <section className="trip-game">
        <div className="trip-game-shell trip-game-loading">
          <span className="trip-game-loading-ball" />
          LOADING PIXEL GOLF ENGINE...
        </div>
      </section>
    );
  }

  return (
    <section
      className={`trip-game${screen === "play" ? " trip-game--play" : ""}`}
      aria-label="Captain's Cup pixel golf game"
    >
      <div className="trip-game-shell">
        <header className="trip-game-console-head">
          <span>GG POCKET</span>
          <b>CAPTAIN&apos;S CUP</b>
          <span>DATA PLAY</span>
        </header>
        {screen === "setup" && (
          <SetupScreen
            model={model}
            courseId={courseId}
            setCourseId={setCourseId}
            team={captainTeam}
            setTeam={setCaptainTeam}
            archiveState={archiveState}
            onStart={startRound}
          />
        )}
        {screen === "finish" && (
          <FinishScreen
            match={match}
            history={history}
            team={captainTeam}
            cpuTeam={cpuTeam}
            closeout={closeout}
            onRematch={startRound}
            onSetup={() => setScreen("setup")}
          />
        )}
        {screen === "play" && course && hole && projection && (
          <>
            <div className="trip-game-scorebar">
              <div className={`trip-game-score-team is-${captainTeam.toLowerCase()}${scoreDifference > 0 ? " is-leading" : ""}`}>
                <span>YOU · {captainTeam.toUpperCase()}</span>
                <em className="trip-game-score-pips" aria-label={`${match.human} holes won`}>
                  {Array.from({ length: match.human }, (_, index) => (
                    <i key={index} />
                  ))}
                </em>
              </div>
              <div className="trip-game-hole-box">
                <small>HOLE</small>
                <b>{String(hole.number).padStart(2, "0")}</b>
                <span className={`trip-game-par-pill is-par-${hole.par}`}>PAR {hole.par}</span>
              </div>
              <div className={`trip-game-score-team is-${cpuTeam.toLowerCase()}${scoreDifference < 0 ? " is-leading" : ""}`}>
                <span>CPU · {cpuTeam.toUpperCase()}</span>
                <em className="trip-game-score-pips" aria-label={`${match.cpu} holes won`}>
                  {Array.from({ length: match.cpu }, (_, index) => (
                    <i key={index} />
                  ))}
                </em>
              </div>
            </div>
            <div className="trip-game-match-state">
              <b
                key={matchCall}
                className={`trip-game-match-call ${leadingTeam ? `is-${leadingTeam.toLowerCase()}` : "is-square"}`}
              >
                {matchCall}
              </b>
              <HoleLadder history={history} humanTeam={captainTeam} cpuTeam={cpuTeam} currentHole={hole.number} />
              <span className={`trip-game-match-thru${dormie ? " is-dormie" : ""}`}>
                {dormie ? "DORMIE" : `THRU ${history.length}`}
              </span>
            </div>
            <div className={`trip-game-hype ${resolutionPhase === "rolling" ? "is-charging" : ""}`}>
              <span>HYPE</span>
              <div className="trip-game-hype-track">
                <i style={{ width: `${hype}%` }} />
              </div>
              <b>{hype}/100</b>
              {streak >= 2 && <em>HEAT ×{streak}</em>}
            </div>
            <div className="trip-game-play-grid">
              <HoleMap
                projection={projection}
                hole={hole}
                decision={decision}
                result={resolutionPhase === "result" ? result : null}
                playback={
                  resolutionPhase === "playback" && playbackShots?.length
                    ? { shots: playbackShots, index: playbackStep.index, phase: playbackStep.phase, frame: playbackStep.frame }
                    : null
                }
                intro={holeIntro && resolutionPhase === "idle" && !result && !meterPhase}
                onIntroDismiss={() => setHoleIntro(false)}
                odds={resolutionPhase === "idle" && !result && !meterPhase ? odds : null}
                canAct={Boolean(selected) && resolutionPhase === "idle" && !result && !meterPhase}
                intelLeft={resolutionPhase === "idle" && !result && !meterPhase ? <ScoreOdds odds={odds} /> : null}
                intelRight={resolutionPhase === "idle" && !result && !meterPhase ? <CaptainRead read={captainRead} /> : null}
                kickMeter={
                  meterPhase ? (
                    <KickMeter
                      phase={meterPhase}
                      power={meterTick.power}
                      accuracy={meterTick.accuracy}
                      onTap={tapMeter}
                      judgment={meterPhase === "locked" ? swingFx : null}
                      streak={swingStreak}
                      mods={meterMods}
                    />
                  ) : null
                }
                swingFx={swingFx}
                shake={shakeFx}
                clutch={Boolean(meterPhase) && meterMods.clutch}
                kickTier={
                  swingFx
                    ? swingFx.redBet && (swingFx.tier === "pure" || swingFx.tier === "great")
                      ? "fire"
                      : swingFx.tier
                    : null
                }
                soundControl={
                  <button
                    type="button"
                    className={`trip-game-sound-chip${soundOn ? " is-on" : ""}`}
                    onClick={() => setSoundOn((current) => !current)}
                    aria-label={soundOn ? "Mute game sound" : "Unmute game sound"}
                  >
                    {soundOn ? "♪ ON" : "♪ OFF"}
                  </button>
                }
                popCall={
                  livePops && resolutionPhase === "idle" && !result && !meterPhase ? (
                    <div className={`trip-game-pop-banner is-${livePops.human ? "pop" : livePops.cpu ? "give" : "even"}`}>
                      {livePops.human > 0 ? (
                        <>
                          <i className="trip-game-pop-dot" />
                          <b>YOU GET A POP</b>
                          <span>SI {hole.si} · CH {courseHandicap(selected.hi, course)} vs CH {courseHandicap(cpuOpponent.profile.hi, course)}</span>
                        </>
                      ) : livePops.cpu > 0 ? (
                        <>
                          <b>GIVING A STROKE</b>
                          <span>SI {hole.si} · THEY GET A POP</span>
                        </>
                      ) : (
                        <>
                          <b>NO POP</b>
                          <span>SI {hole.si} · EVEN</span>
                        </>
                      )}
                    </div>
                  ) : null
                }
                onAimStep={stepAim}
                onCycle={cycleDecision}
              />
              {resolutionPhase === "idle" && !result && (
                <div className="trip-game-action-bar">
                  <OpponentCard opponent={cpuOpponent} course={course} team={cpuTeam} />
                  <CaptainWheel
                    players={humanRoster}
                    selectedKey={selectedKey}
                    usage={usage}
                    maxUses={maxUses}
                    disabled={pickLocked || Boolean(meterPhase)}
                    onPick={pickPlayer}
                    course={course}
                    team={captainTeam}
                  />
                  <PopCall pops={livePops} />
                  <button
                    type="button"
                    className={`trip-game-fireball-chip ${decision.fireball ? "is-selected" : ""}`}
                    disabled={!selected || inventory.fireball < 1 || Boolean(meterPhase)}
                    onClick={() => setDecision((current) => ({ ...current, fireball: !current.fireball }))}
                  >
                    🔥 {inventory.fireball}
                  </button>
                  <button
                    type="button"
                    className={`trip-game-primary-button ${meterPhase ? "is-kick" : ""} ${livePops?.human ? "has-pop" : ""}`}
                    disabled={!selected}
                    onClick={meterPhase ? tapMeter : playHole}
                  >
                    {meterPhase === "power"
                      ? "TAP POWER"
                      : meterPhase === "accuracy"
                        ? "TAP ACCURACY"
                        : meterPhase === "locked"
                          ? swingFx?.label || "..."
                          : selected
                          ? `PLAY ${lastName(selected.name).toUpperCase()}${livePops?.human ? " ●" : livePops?.cpu ? " GIVE" : ""} ▶`
                          : "PLAY ▶"}
                  </button>
                </div>
              )}
              {eventNote && resolutionPhase === "idle" && !result && <div className="trip-game-event-note">{eventNote}</div>}
              {resolutionPhase === "playback" && result && !(playbackStep.index === 0 && playbackStep.phase === "swing") && (
                <div className="trip-game-stage-overlay">
                  <PlaybackPanel
                    result={result}
                    shots={playbackShots || []}
                    shotIndex={playbackStep.index}
                    onSkip={finishPlayback}
                  />
                </div>
              )}
              {resolutionPhase === "result" && result && (
                <ScorecardModal
                  course={course}
                  history={history}
                  match={match}
                  result={result}
                  holeNumber={hole.number}
                  humanTeam={captainTeam}
                  cpuTeam={cpuTeam}
                  onContinue={nextHole}
                  finalHole={holeIndex === 17 || Boolean(closeout?.decided)}
                  closeout={closeout}
                />
              )}
            </div>
            <div className="trip-game-bottom-status">
              <span>
                VS{" "}
                {cpuOpponent?.profile
                  ? `${lastName(cpuOpponent.profile.name).toUpperCase()} · CH ${courseHandicap(cpuOpponent.profile.hi, course)}`
                  : "…"}
              </span>
              <span>
                HOLES LEFT {18 - hole.number} · TIES {match.ties}
              </span>
            </div>
          </>
        )}
      </div>
      {eventOffer?.type === "fireball" && (
        <FireballOffer player={eventOffer.player} onAccept={acceptFireball} onDecline={declineFireball} />
      )}
      {eventOffer?.type === "cart-girl" && (
        <CartGirlOffer
          player={eventOffer.player}
          onDrink={() => chooseCartGirl(true)}
          onHydrate={() => chooseCartGirl(false)}
        />
      )}
    </section>
  );
}
