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
  findBestDecision,
  formatOdds,
  makeSeededRandom,
  matchCloseout,
  resolveMatchHole,
  scoreLabel,
} from "./tripGameEngine.js";
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

function initials(name) {
  return String(name || "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
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
    preferredShape: shapeSeverity < 0.12 ? "straight" : deviation < 0 ? "draw" : "cut",
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

function nearestFeatureCentroid(features, type, reference) {
  let best = null;
  for (const feature of features) {
    if (feature.type !== type) continue;
    const centroid = polygonCentroid(feature.points);
    const distance = Math.hypot(centroid[0] - reference[0], centroid[1] - reference[1]);
    if (!best || distance < best.distance) best = { centroid, distance };
  }
  return best?.centroid || null;
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
  const look = lookAheadPoint(ballGround, destination, onGreen || kind === "putt" ? 34 : 86);
  const cx = ballAir[0] * 0.52 + look[0] * 0.48;
  const cy = ballAir[1] * 0.45 + look[1] * 0.45 + ballGround[1] * 0.1;
  const coverH = Math.abs(look[1] - ballAir[1]) + Math.abs(ballGround[1] - ballAir[1]) + 52;
  const coverW = Math.abs(look[0] - ballAir[0]) + 42;
  const minH = onGreen || kind === "putt" ? 102 : 132;
  const maxH = onGreen || kind === "putt" ? 138 : kind === "drive" || kind === "tee" ? 188 : 158;
  return cameraWindow(cx, cy, clamp(Math.max(coverH, coverW / 0.82, minH), minH, maxH), worldW, worldH, 0.82);
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
  const span = projection.height * 0.34;
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

function computeMapCamera({ projection, playback, landing, activeShot, flightFrame, flightFrameIndex }) {
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

    if (openingTee && playback.phase === "swing") return overview;

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
  const targetYards = hole.yards ? Math.min(club.carry, Math.round(hole.yards * 0.96)) : club.carry;
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

function computeLandingPoint(projection, hole, target, perpendicular, landingType) {
  const dangerDirection = projection.dangerSide === "left" ? -1 : 1;
  const fairwayJitter = (hole.number % 3) - 1;
  if (landingType === "Penalty area") {
    return (
      nearestFeatureCentroid(projection.features, "water", target) || [
        target[0] + perpendicular[0] * 30 * dangerDirection,
        target[1] + perpendicular[1] * 30 * dangerDirection,
      ]
    );
  }
  if (landingType === "Bunker") {
    return (
      nearestFeatureCentroid(projection.features, "bunker", target) || [
        target[0] + perpendicular[0] * 18 * dangerDirection,
        target[1] + perpendicular[1] * 18 * dangerDirection,
      ]
    );
  }
  if (landingType === "Rough") {
    const direction = fairwayJitter || dangerDirection;
    return [target[0] + perpendicular[0] * 13 * direction, target[1] + perpendicular[1] * 13 * direction];
  }
  return [target[0] + perpendicular[0] * 3 * fairwayJitter, target[1] - 2];
}

const SHOT_CAPTIONS = {
  drive: "CRUSHED OFF THE TEE!",
  tee: "TEE SHOT AWAY!",
  splash: "OH NO... SPLASH!",
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

function makeShot({ from, to, kind, bend = 0, final = false, yardsScale = 0 }) {
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
    caption: final ? "FOR THE HOLE..." : SHOT_CAPTIONS[kind] || "SWINGS...",
    duration: frames.length * FLIGHT_FRAME_MS,
  };
}

/**
 * Turn a sampled hole outcome into a cartoon shot-by-shot sequence:
 * tee ball -> (drop) -> approaches -> putts, ending in the cup.
 */
function buildShotSequence({ projection, hole, decision, result }) {
  const { target, perpendicular, lineLength } = computeShotTarget(projection, hole, decision);
  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const yardsScale = hole.yards ? lineLength / hole.yards : 0;
  const pin = projection.pin;
  const landingType = result.humanLanding;
  const landing = computeLandingPoint(projection, hole, target, perpendicular, landingType);
  const bend = shape.bias * clamp(projection.width * 0.3, 16, 42);
  const seed = hole.number * 37 + result.humanGross * 11;
  const jitter = (index, scale) => (seededUnit(seed + index) - 0.5) * scale;

  const shots = [];
  let current = projection.tee;
  let remaining = result.humanGross;

  if (landingType === "Penalty area") {
    shots.push(makeShot({ from: current, to: landing, kind: "splash", bend, yardsScale }));
    remaining -= 2; // stroke plus penalty
    current = interpolate(landing, projection.tee, 0.24);
  } else {
    shots.push(makeShot({ from: current, to: landing, kind: hole.par <= 3 ? "tee" : "drive", bend, yardsScale }));
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
  return shots;
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
    preferredShape: bend < 0 ? "draw" : "cut",
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
  if (!odds) return <div className="trip-game-empty">PICK A GOLFER TO LOAD ODDS</div>;
  return (
    <div className="trip-game-odds">
      <div className="trip-game-section-label">
        <span>HOLE OUTCOME MODEL</span>
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
      {odds.actualGross != null ? (
        <div className="trip-game-memory">
          ACTUAL TRIP MEMORY: <b>{odds.actualGross}</b> ({scoreLabel(odds.actualRelative)}) · CURRENT MODEL CHANCE{" "}
          <b>{formatOdds(odds.actualChance)}</b>
        </div>
      ) : (
        <div className="trip-game-memory trip-game-memory--muted">NO SCORE ON THIS HOLE · INDEX + HISTORY MODEL</div>
      )}
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
          ? "★ BEST LINE FOUND — COMMIT TO IT"
          : read.fireball
            ? "🔥 BIRDIE/PAR UP · DOUBLE/TRIPLE UP"
            : `CADDIE LIKES ${bestClub?.short || bestClub?.label} · ${bestShape?.label.toUpperCase()} · ${aimText(read.bestDecision.aim)}`}
      </div>
    </div>
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
  stockShape,
  menu,
  onAimStep,
  onOpenMenu,
  onMenuSelect,
  onMenuClose,
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

  const shape = SHAPES.find((item) => item.id === decision.shape) || SHAPES[1];
  const { club, targetYards, targetDistance, perpendicular, target } = computeShotTarget(projection, hole, decision);
  const bend = shape.bias * clamp(projection.width * 0.32, 20, 48);
  const shotPath = curvedPath(projection.tee, target, bend);
  const landing = result ? computeLandingPoint(projection, hole, target, perpendicular, result.humanLanding) : null;
  const planning = !playback && !result;
  const activeShot = playback ? playback.shots[Math.min(playback.index, playback.shots.length - 1)] : null;
  const shotFlipped = activeShot ? activeShot.to[0] < activeShot.from[0] : false;
  const flightFrames = activeShot?.frames || [];
  const flightFrameIndex = playback ? clamp(playback.frame || 0, 0, Math.max(0, flightFrames.length - 1)) : 0;
  const flightFrame = flightFrames[flightFrameIndex] || null;
  const flownFrames = playback?.phase === "flight" ? flightFrames.slice(0, flightFrameIndex + 1) : [];
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
          ? 0.12
          : 0.5;
  cameraRef.current = blendCamera(cameraRef.current, targetCam, cameraRef.current ? cameraEase : 1);
  const camera = cameraRef.current;
  const fullFramed = camera.w > projection.width * 0.9 && camera.h > projection.height * 0.9;

  return (
    <div className={`trip-game-map-wrap ${playback ? "is-resolving is-flyover" : ""} ${onGreenCam ? "is-green-zoom" : ""}`}>
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
      </div>
      {playback && activeShot && (
        <div className="trip-game-playcap" aria-live="polite">
          <small>
            SHOT {Math.min(playback.index + 1, playback.shots.length)}/{playback.shots.length}
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
            <g className="trip-game-target" transform={`translate(${target[0]} ${target[1]})`}>
              <circle r="5.5" />
              <path d="M-8 0 H8 M0 -8 V8" />
            </g>
            <text
              x={clamp(target[0] + 7, 8, projection.width - 44)}
              y={clamp(target[1] - 7, 10, projection.height - 8)}
              className="trip-game-carry-label"
            >
              {targetYards}Y
            </text>
          </>
        )}
        {!playback && (
          <g className="trip-game-golfer" transform={`translate(${projection.tee[0] - 5} ${projection.tee[1] - 13})`}>
            <rect className="trip-game-golfer-club" x="10" y="2" width="1.4" height="12" transform="rotate(20 10.7 2)" />
            <rect className="trip-game-golfer-cap" x="2.4" y="-1.6" width="6.2" height="2.2" />
            <rect className="trip-game-golfer-skin" x="3" y="0.6" width="5" height="4.4" />
            <rect className="trip-game-golfer-shirt" x="2" y="5" width="7" height="7" />
            <rect className="trip-game-golfer-legs" x="0" y="12" width="4" height="7" />
            <rect className="trip-game-golfer-legs" x="7" y="12" width="4" height="7" />
          </g>
        )}
        <g className="trip-game-flag" transform={`translate(${projection.pin[0]} ${projection.pin[1]})`}>
          <rect className="trip-game-flag-base" x="-3" y="0" width="6" height="2" />
          <rect className="trip-game-flag-pole" x="-1" y="-14" width="2" height="15" />
          <path className="trip-game-flag-cloth" d="M1,-14 L11,-10 L1,-6 Z" />
        </g>
        {playback && activeShot && (
          <g className="trip-game-theater">
            {playback.shots.slice(0, playback.index).map((shot, index) => (
              <circle key={index} cx={shot.to[0]} cy={shot.to[1]} r="1.5" className="trip-game-crumb" />
            ))}
            <g transform={`translate(${activeShot.from[0]} ${activeShot.from[1]})`}>
              <g
                className={`trip-game-swinger ${playback.phase === "swing" ? "is-swinging" : "is-through"} ${
                  activeShot.kind === "putt" ? "is-putting" : ""
                }`}
                transform={`scale(${shotFlipped ? -1.3 : 1.3} 1.3)`}
              >
                <ellipse className="trip-game-swinger-shadow" cx="0" cy="1.4" rx="5.4" ry="1.7" />
                <g transform="translate(-4.8 -15)">
                  <rect className="trip-game-golfer-legs" x="1" y="10" width="3" height="5.5" />
                  <rect className="trip-game-golfer-legs" x="5.8" y="10" width="3" height="5.5" />
                  <rect className="trip-game-golfer-shirt" x="0.4" y="4.6" width="9" height="5.8" />
                  <rect className="trip-game-golfer-skin" x="2.4" y="0.2" width="5" height="4.6" />
                  <rect className="trip-game-golfer-cap" x="1.8" y="-1.8" width="6.2" height="2.4" />
                  <g className="trip-game-swing-arm">
                    <rect className="trip-game-golfer-club" x="8.2" y="4.8" width="1.4" height="10.5" />
                    <rect className="trip-game-club-head" x="7.4" y="14.4" width="3.2" height="2" />
                  </g>
                </g>
              </g>
              {playback.phase === "flight" && (
                <g className="trip-game-impact" transform={`translate(${shotFlipped ? -6 : 6} -4)`}>
                  <path d="M0,-5 L1.6,-1.6 L5,0 L1.6,1.6 L0,5 L-1.6,1.6 L-5,0 L-1.6,-1.6 Z" />
                </g>
              )}
            </g>
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
                  <path d={framesToPath(flownFrames, activeShot.air)} className="trip-game-air-trail-line" />
                )}
                {flownFrames.slice(0, -1).map((frame, index) => (
                  <circle
                    key={`trail-${index}`}
                    cx={frame.x}
                    cy={frame.y}
                    r={activeShot.air ? 1.35 : 1.05}
                    className="trip-game-air-trail"
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
            <button type="button" className={menu === "club" ? "is-open" : ""} onClick={() => onOpenMenu("club")}>
              <small>CLUB</small>
              <b>{club.short}</b>
            </button>
            <button type="button" className={menu === "shape" ? "is-open" : ""} onClick={() => onOpenMenu("shape")}>
              <small>SHAPE</small>
              <b>{shape.label.toUpperCase()}</b>
            </button>
          </div>
        </div>
      )}
      {menu && (
        <>
          <button type="button" className="trip-game-gb-menu-backdrop" aria-label="Close menu" onClick={onMenuClose} />
          <div className="trip-game-gb-menu" role="menu" aria-label={menu === "club" ? "Select club" : "Select shot shape"}>
            <div className="trip-game-gb-menu-title">{menu === "club" ? "SELECT CLUB" : "SELECT SHAPE"}</div>
            {menu === "club"
              ? CLUBS.filter((item) => item.minPar <= hole.par).map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === decision.club ? "is-selected" : ""}
                    onClick={() => onMenuSelect("club", item.id)}
                  >
                    <i>{item.id === decision.club ? "▶" : ""}</i>
                    <b>{item.label.toUpperCase()}</b>
                    <span>~{item.carry}Y</span>
                  </button>
                ))
              : SHAPES.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === decision.shape ? "is-selected" : ""}
                    onClick={() => onMenuSelect("shape", item.id)}
                  >
                    <i>{item.id === decision.shape ? "▶" : ""}</i>
                    <b>{item.label.toUpperCase()}</b>
                    <span>{item.id === stockShape ? "STOCK" : item.id === hole.preferredShape ? "ROUTE" : ""}</span>
                  </button>
                ))}
            {menu === "shape" && <div className="trip-game-gb-menu-hint">ROUTE FAVORS {String(hole.preferredShape || "straight").toUpperCase()}</div>}
          </div>
        </>
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

function PlayerCard({ player, playerState, course }) {
  if (!player) {
    return (
      <div className="trip-game-player-card trip-game-player-card--empty">
        <span className="trip-game-avatar">?</span>
        <div>
          <b>CAPTAIN, MAKE YOUR PICK</b>
          <small>Each golfer may be used a limited number of times.</small>
        </div>
      </div>
    );
  }
  return (
    <div className="trip-game-player-card">
      <span className="trip-game-avatar">{initials(player.name)}</span>
      <div className="trip-game-player-main">
        <div className="trip-game-player-name">
          <b>{player.name}</b>
          {player.trait && <em>{player.trait}</em>}
        </div>
        <div className="trip-game-player-meta">
          INDEX {player.hi.toFixed(1)} / CH {courseHandicap(player.hi, course)} · {player.profileSource.toUpperCase()} STOCK{" "}
          {player.stockShape.toUpperCase()}
        </div>
      </div>
      <div className="trip-game-ratings">
        <span>
          OVR <b>{player.overall}</b>
        </span>
        <span>
          ATK <b>{player.attack}</b>
        </span>
        <span>
          CTL <b>{player.control}</b>
        </span>
      </div>
      <div className="trip-game-condition">
        <span className={playerState.buzz > 35 ? "is-hot" : ""}>
          {playerState.buzz > 35 ? "🍺 " : ""}BUZZ <b>{Math.round(playerState.buzz)}</b>
        </span>
        <span className={playerState.morale < 40 ? "is-low" : ""}>
          MORALE <b>{Math.round(playerState.morale)}</b>
        </span>
      </div>
    </div>
  );
}

function PlayerPicker({ players, selectedKey, usage, maxUses, disabled, onPick }) {
  return (
    <div className="trip-game-roster">
      <div className="trip-game-section-label">
        <span>CAPTAIN PICK</span>
        <span>MAX {maxUses} USES</span>
      </div>
      <div className="trip-game-roster-grid">
        {players.map((player) => {
          const used = usage[player.key] || 0;
          const spent = used >= maxUses;
          return (
            <button
              key={player.key}
              type="button"
              className={`trip-game-roster-player ${selectedKey === player.key ? "is-selected" : ""}`}
              disabled={disabled || spent}
              onClick={() => onPick(player)}
            >
              <span className="trip-game-roster-avatar">{initials(player.name)}</span>
              <span className="trip-game-roster-name">{lastName(player.name)}</span>
              <span className="trip-game-roster-hi">{player.hi.toFixed(1)}</span>
              <span className="trip-game-use-pips" aria-label={`${used} of ${maxUses} uses`}>
                {Array.from({ length: maxUses }, (_, index) => (
                  <i key={index} className={index < used ? "is-used" : ""} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PlaybackPanel({ result, shots, shotIndex, onSkip }) {
  const shot = shots[Math.min(shotIndex, shots.length - 1)];
  return (
    <div className="trip-game-playback" role="status" aria-live="polite">
      <small>NOW ON THE TEE</small>
      <b>{lastName(result.human.name).toUpperCase()}</b>
      <div className="trip-game-playback-pips" aria-hidden="true">
        {shots.map((item, index) => (
          <span key={index} className={index < shotIndex ? "is-done" : index === shotIndex ? "is-live" : ""}>
            {index + 1}
          </span>
        ))}
      </div>
      <p>{shot?.caption || "..."}</p>
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

function ResultPanel({ result, humanTeam, cpuTeam, onNext, finalHole, closeout }) {
  const humanWon = result.winner === "human";
  const cpuWon = result.winner === "cpu";
  const celebration = celebrationFor(result);
  return (
    <div className="trip-game-result">
      <div className={`trip-game-celebration is-${celebration.tone}`}>
        <div className="trip-game-celebration-particles" aria-hidden="true">
          {Array.from({ length: 14 }, (_, index) => (
            <i key={index} style={{ "--particle-index": index }} />
          ))}
        </div>
        <span>{celebration.icon}</span>
        <strong>{celebration.label}</strong>
        <em>+{result.hypeGain} HYPE</em>
        {result.streak >= 2 && <b>HEAT ×{result.streak}</b>}
      </div>
      <div className={`trip-game-result-call trip-game-result-call--${result.winner}`}>
        {humanWon ? `${humanTeam.toUpperCase()} WINS THE HOLE` : cpuWon ? `${cpuTeam.toUpperCase()} WINS THE HOLE` : "HOLE HALVED"}
      </div>
      <div className="trip-game-result-matchup">
        <div className={humanWon ? "is-winner" : ""}>
          <span>{result.human.name}</span>
          <b>{result.humanGross}</b>
          <small>
            NET {result.humanNet} · {result.humanLanding.toUpperCase()}
          </small>
        </div>
        <span className="trip-game-result-vs">VS</span>
        <div className={cpuWon ? "is-winner" : ""}>
          <span>{result.cpu.name}</span>
          <b>{result.cpuGross}</b>
          <small>
            NET {result.cpuNet} · {result.cpuLanding.toUpperCase()}
          </small>
        </div>
      </div>
      <div className="trip-game-result-log">
        CPU CAPTAIN SENT {lastName(result.cpu.name).toUpperCase()} · {result.cpuBucket.label.toUpperCase()}
      </div>
      {result.decisionRead && (
        <div className={`trip-game-result-impact is-${result.decisionRead.tone}`}>
          <b>{result.decisionRead.label}</b>
          <span>
            {result.decisionRead.expectedSaved >= 0 ? "SAVED" : "COST"}{" "}
            {Math.abs(result.decisionRead.expectedSaved).toFixed(2)} MODELED STROKES VS STOCK
          </span>
        </div>
      )}
      {result.powerUpEarned && <div className="trip-game-power-earned">⚡ HYPE MAXED · +1 FIREBALL SHOT</div>}
      {closeout?.decided && (
        <div className="trip-game-closeout-note">MATCH DECIDED · {closeout.label}</div>
      )}
      <button type="button" className="trip-game-primary-button" onClick={onNext}>
        {finalHole ? "FINAL RESULTS" : "NEXT HOLE ▶"}
      </button>
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
  return (
    <div className="trip-game-finish">
      <p className="trip-game-modal-kicker">
        {closeout?.decided ? `MATCH CLOSED OUT AFTER ${closeout.holesPlayed} HOLES` : "ROUND COMPLETE"}
      </p>
      <h2>{winner ? `${winner.toUpperCase()} WINS${closeout?.label ? ` ${closeout.label}` : ""}` : "MATCH HALVED"}</h2>
      <div className="trip-game-final-score">
        <div>
          <span>{team.toUpperCase()}</span>
          <b>{match.human}</b>
        </div>
        <em>HOLES</em>
        <div>
          <span>{cpuTeam.toUpperCase()}</span>
          <b>{match.cpu}</b>
        </div>
      </div>
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
  const [menu, setMenu] = useState(null);
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
    },
    [],
  );

  // Game Boy style keyboard aiming on desktop.
  useEffect(() => {
    if (screen !== "play") return undefined;
    const onKey = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      stepAim(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
  const selected = humanRoster.find((player) => player.key === selectedKey) || null;
  const selectedState = selected ? playerState[selected.key] || DEFAULT_PLAYER_STATE : DEFAULT_PLAYER_STATE;
  const odds = useMemo(
    () => (selected && course && hole ? buildHoleOdds({ profile: selected, course, hole, decision, state: selectedState }) : null),
    [course, decision, hole, selected, selectedState],
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
  const matchLabel =
    scoreDifference === 0
      ? "ALL SQUARE"
      : `${Math.abs(scoreDifference)} UP · ${scoreDifference > 0 ? captainTeam?.toUpperCase() : cpuTeam.toUpperCase()}${
          dormie ? " · DORMIE" : ""
        }`;

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
    setMenu(null);
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
    setInventory({ fireball: 1 });
    setEventOffer(null);
    setEventHandled({});
    setPickLocked(false);
    setEventNote(null);
    randomRef.current = makeSeededRandom(Date.now());
  }

  function pickPlayer(player) {
    if (result || pickLocked || resolutionPhase !== "idle") return;
    setSelectedKey(player.key);
    setDecision(defaultDecision(player, hole));
    setMenu(null);
    setEventNote(null);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(8);
  }

  function stepAim(direction) {
    if (!selected || result || resolutionPhase !== "idle") return;
    setDecision((current) => ({
      ...current,
      aim: clamp(aimOffsetOf(current.aim) + direction * AIM_STEP, -AIM_MAX, AIM_MAX),
    }));
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(4);
  }

  function chooseFromMenu(type, id) {
    setDecision((current) => ({ ...current, [type]: id }));
    setMenu(null);
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

  function playHole() {
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
    const currentHumanOdds = buildHoleOdds({
      profile: selected,
      course,
      hole,
      decision,
      state: playerState[selected.key],
    });
    const cpuPick = chooseCpuPlayer({
      players: cpuRoster,
      usage: cpuUsage,
      maxUses: cpuMaxUses,
      course,
      hole,
      stateByPlayer: playerState,
      random: randomRef.current,
    });
    if (!cpuPick) return;
    const resolved = resolveMatchHole({
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds: cpuPick.odds,
      course,
      hole,
      random: randomRef.current,
    });
    const completeResult = {
      ...resolved,
      human: selected,
      cpu: cpuPick.profile,
      humanOdds: currentHumanOdds,
      cpuOdds: cpuPick.odds,
      decisionRead: captainRead,
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
    const shots = projection
      ? buildShotSequence({ projection, hole, decision, result: resolved })
      : [];
    setPlaybackShots(shots);
    setPlaybackStep({ index: 0, phase: "swing", frame: 0 });
    setResult(completeResult);
    setResolutionPhase("playback");
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(10);
    if (resolutionTimerRef.current) window.clearTimeout(resolutionTimerRef.current);
    resolutionTimerRef.current = window.setTimeout(() => finishPlayback(), PLAYBACK_SAFETY_MS);
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
      },
    ]);
    setHype(nextHype);
    setStreak(nextStreak);
    if (nextCloseout.decided) setCloseout(nextCloseout);
    setInventory((current) => ({
      ...current,
      fireball: Math.max(0, current.fireball - (pending.usedFireball ? 1 : 0)) + (powerUpEarned ? 1 : 0),
    }));
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
    setMenu(null);
    setResult(null);
    setResolutionPhase("idle");
    setPlaybackShots(null);
    setHoleIntro(true);
    pendingCommitRef.current = null;
    setEventOffer(null);
    setPickLocked(false);
    setEventNote(null);
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
              <div className={`trip-game-score-team is-${captainTeam.toLowerCase()}`}>
                <span>YOU · {captainTeam.toUpperCase()}</span>
                <b>{match.human}</b>
              </div>
              <div className="trip-game-hole-box">
                <small>HOLE</small>
                <b>{String(hole.number).padStart(2, "0")}</b>
                <span className={`trip-game-par-pill is-par-${hole.par}`}>PAR {hole.par}</span>
              </div>
              <div className={`trip-game-score-team is-${cpuTeam.toLowerCase()}`}>
                <span>CPU · {cpuTeam.toUpperCase()}</span>
                <b>{match.cpu}</b>
              </div>
            </div>
            <div className="trip-game-match-state">{matchLabel}</div>
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
                intro={holeIntro && resolutionPhase === "idle" && !result}
                onIntroDismiss={() => setHoleIntro(false)}
                odds={resolutionPhase === "idle" && !result ? odds : null}
                canAct={Boolean(selected) && resolutionPhase === "idle" && !result}
                stockShape={selected?.stockShape}
                menu={menu}
                onAimStep={stepAim}
                onOpenMenu={(type) => setMenu((current) => (current === type ? null : type))}
                onMenuSelect={chooseFromMenu}
                onMenuClose={() => setMenu(null)}
              />
              <div className="trip-game-command-panel">
                <PlayerCard player={selected} playerState={selectedState} course={course} />
                {resolutionPhase === "playback" && result ? (
                  <PlaybackPanel
                    result={result}
                    shots={playbackShots || []}
                    shotIndex={playbackStep.index}
                    onSkip={finishPlayback}
                  />
                ) : resolutionPhase === "result" && result ? (
                  <ResultPanel
                    result={result}
                    humanTeam={captainTeam}
                    cpuTeam={cpuTeam}
                    onNext={nextHole}
                    finalHole={holeIndex === 17 || Boolean(closeout?.decided)}
                    closeout={closeout}
                  />
                ) : (
                  <>
                    <ScoreOdds odds={odds} />
                    <CaptainRead read={captainRead} />
                    <div className="trip-game-items">
                      <button
                        type="button"
                        className={decision.fireball ? "is-selected" : ""}
                        disabled={!selected || inventory.fireball < 1}
                        onClick={() => setDecision((current) => ({ ...current, fireball: !current.fireball }))}
                      >
                        <span>🔥</span>
                        <b>FIREBALL SHOT</b>
                        <small>x{inventory.fireball} · MORE UPSIDE / MORE RISK</small>
                      </button>
                    </div>
                    {eventNote && <div className="trip-game-event-note">{eventNote}</div>}
                    <button type="button" className="trip-game-primary-button" disabled={!selected} onClick={playHole}>
                      {selected ? `PLAY ${lastName(selected.name).toUpperCase()} ▶` : "PICK A GOLFER"}
                    </button>
                  </>
                )}
              </div>
            </div>
            <PlayerPicker
              players={humanRoster}
              selectedKey={selectedKey}
              usage={usage}
              maxUses={maxUses}
              disabled={Boolean(result) || pickLocked || resolutionPhase !== "idle"}
              onPick={pickPlayer}
            />
            <div className="trip-game-bottom-status">
              <span>CPU PICK: {resolutionPhase === "result" && result ? lastName(result.cpu.name).toUpperCase() : "HIDDEN"}</span>
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
