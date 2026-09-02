// Hole framing: corridor, tracking, green and blended cameras.

import { clamp, featureBounds, lerp } from "./geometry.js";
export function clampCamera(camera, worldW, worldH) {
  const w = clamp(camera.w, 12, worldW);
  const h = clamp(camera.h, 12, worldH);
  return {
    x: clamp(camera.x, 0, Math.max(0, worldW - w)),
    y: clamp(camera.y, 0, Math.max(0, worldH - h)),
    w,
    h,
  };
}

export function fullCamera(projection) {
  return { x: 0, y: 0, w: projection.width, h: projection.height };
}

/**
 * Tight bounds around the actual hole (line, tee, pin, turf features) — the
 * overview camera frames THIS instead of the whole canvas, so the course
 * fills the screen instead of floating in blank rough.
 */
export const corridorCache = new WeakMap();

export function holeCorridorCamera(projection) {
  const cached = corridorCache.get(projection);
  if (cached) return cached;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const push = (point) => {
    minX = Math.min(minX, point[0]);
    maxX = Math.max(maxX, point[0]);
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  };
  (projection.line || []).forEach(push);
  if (projection.tee) push(projection.tee);
  if (projection.pin) push(projection.pin);
  for (const feature of projection.features || []) {
    if (feature.points && feature.points.length >= 3) feature.points.forEach(push);
  }
  if (!Number.isFinite(minX)) return fullCamera(projection);
  const padX = Math.max(9, (maxX - minX) * 0.07);
  const padY = Math.max(7, (maxY - minY) * 0.045);
  const camera = clampCamera(
    { x: minX - padX, y: minY - padY, w: maxX - minX + padX * 2, h: maxY - minY + padY * 2 },
    projection.width,
    projection.height,
  );
  corridorCache.set(projection, camera);
  return camera;
}

/**
 * Grow a camera rect to match the on-screen container's aspect ratio, so the
 * view fills the frame edge-to-edge with no letterboxing.
 */
export function aspectFitCamera(camera, aspect, worldW, worldH) {
  if (!aspect || !Number.isFinite(aspect)) return camera;
  let { x, y, w, h } = camera;
  const camAspect = w / h;
  if (camAspect < aspect) {
    const nextW = h * aspect;
    x -= (nextW - w) / 2;
    w = nextW;
  } else if (camAspect > aspect) {
    const nextH = w / aspect;
    y -= (nextH - h) / 2;
    h = nextH;
  }
  // Keep the window inside the world when it fits; center it when it can't.
  if (w <= worldW) x = clamp(x, 0, worldW - w);
  else x = (worldW - w) / 2;
  if (h <= worldH) y = clamp(y, 0, worldH - h);
  else y = (worldH - h) / 2;
  return { x, y, w, h };
}

export function cameraWindow(cx, cy, height, worldW, worldH, aspect = 0.82) {
  const h = clamp(height, 80, worldH);
  let w = h * aspect;
  if (w > worldW) w = worldW;
  const finalH = Math.min(Math.max(w / aspect, 80), worldH);
  return clampCamera({ x: cx - w / 2, y: cy - finalH / 2, w, h: finalH }, worldW, worldH);
}

export function lookAheadPoint(from, to, distance) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy) || 1;
  const t = clamp(distance / length, 0, 1);
  return [from[0] + dx * t, from[1] + dy * t];
}

export function cameraContains(camera, point, margin = 14) {
  return (
    point[0] >= camera.x + margin &&
    point[0] <= camera.x + camera.w - margin &&
    point[1] >= camera.y + margin &&
    point[1] <= camera.y + camera.h - margin
  );
}

export function trackShotCamera({ projection, ballAir, ballGround, destination, kind, onGreen }) {
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

export function usableGreen(projection) {
  const green = featureBounds(projection.features, "green");
  if (!green) return null;
  const wide = green.maxX - green.minX;
  const tall = green.maxY - green.minY;
  if (wide > projection.width * 0.62 || tall > projection.height * 0.32) return null;
  return green;
}

export function greenCamera(projection) {
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

export function pointNearGreen(point, projection) {
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

export function blendCamera(from, to, t) {
  if (!from) return to;
  return {
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
    w: lerp(from.w, to.w, t),
    h: lerp(from.h, to.h, t),
  };
}

export function computeMapCamera({ projection, playback, landing, activeShot, flightFrame, liveFocus, aspect }) {
  const overview = aspectFitCamera(holeCorridorCamera(projection), aspect, projection.width, projection.height);
  const pin = projection.pin;
  const greenCam = greenCamera(projection);

  // Shot-by-shot club selection: show the whole hole so the player can judge
  // the club; zoom in only once the ball is on the green.
  if (liveFocus && !playback) {
    if (pointNearGreen(liveFocus, projection)) {
      return blendCamera(
        trackShotCamera({
          projection,
          ballAir: liveFocus,
          ballGround: liveFocus,
          destination: pin,
          kind: "approach",
          onGreen: true,
        }),
        greenCam,
        0.55,
      );
    }
    // The played part of the hole no longer matters: frame only the rest —
    // from the ball to the pin (with a little green past it).
    const rest = {
      x: Math.min(liveFocus[0], pin[0]) - 24,
      y: Math.min(liveFocus[1], pin[1]) - 18,
      w: Math.abs(liveFocus[0] - pin[0]) + 48,
      h: Math.abs(liveFocus[1] - pin[1]) + 34,
    };
    if (rest.h < 76) {
      rest.y -= (76 - rest.h) / 2;
      rest.h = 76;
    }
    if (rest.w < 60) {
      rest.x -= (60 - rest.w) / 2;
      rest.w = 60;
    }
    return aspectFitCamera(
      clampCamera(rest, projection.width, projection.height),
      aspect,
      projection.width,
      projection.height,
    );
  }

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
