import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { clamp } from "./geometry.js";
import { PUTT_TICK_UNITS } from "./putting.js";
import "./css/26-ground-putt.css";

// The 3D green shares the 2D putting scene's coordinates: the cup sits at
// (85, 36) and the ball below it, in scene units (roughly 1.3 per foot).
// World X is scene x - 85, world Z is scene y - 36, so the cup is the origin
// and the player looks up the green toward -Z.
const CUP = [85, 36];
const toWorld = ([x, y]) => [x - CUP[0], y - CUP[1]];
const quadPoint = (a, c, b, t) => [
  (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];

// The read's break and slope become one tilted, gently rolling surface. The
// break tilts the green across the line (positive = falls to the right), the
// slope tilts it along the line (positive = uphill to the cup).
function surfaceFor(breakDir, slope) {
  const tilt = (x, z) => -breakDir * 0.055 * x - slope * 0.045 * z;
  const roll = (x, z) => 0.32 * Math.sin(x / 21 + 0.6) * Math.cos(z / 17 - 0.3);
  return (x, z) => tilt(x, z) + roll(x, z);
}

// Mown stripes plus contour lines drawn from the surface itself, so the eye
// can read the same tilt the beads drift down.
function greenTexture(heightAt) {
  const size = 512,
    extent = 260;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#7fae57";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#8dbb62";
  for (let i = 0; i < size; i += 28) ctx.fillRect(0, i, size, 14);
  const image = ctx.getImageData(0, 0, size, size);
  const data = image.data;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px / size - 0.5) * extent,
        z = (py / size - 0.5) * extent;
      const h = heightAt(x, z) / 0.7;
      const band = h - Math.floor(h);
      if (band < 0.07 || band > 0.93) {
        const i = (py * size + px) * 4;
        data[i] = 232;
        data[i + 1] = 241;
        data[i + 2] = 188;
        data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default function GroundPuttView({
  read = null,
  shot = null,
  phase = null,
  frame = 0,
  aimTicks = 0,
  side = "human",
  visible = false,
  holeNumber = 1,
  onUnavailable,
}) {
  const host = useRef(null),
    current = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    current.current = { read, shot, phase, frame, aimTicks, side, visible, stamp: performance.now() };
  }, [read, shot, phase, frame, aimTicks, side, visible]);
  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setFailed(true);
      onUnavailable?.();
      return undefined;
    }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a9cfe0");
    scene.fog = new THREE.Fog("#b8d5c9", 120, 320);
    scene.add(new THREE.HemisphereLight("#dcefff", "#5f7a3c", 2.1));
    const sun = new THREE.DirectionalLight("#fff1cf", 2.2);
    sun.position.set(-60, 90, 40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, far: 400 });
    scene.add(sun);
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 800);

    // Surface: rebuilt whenever the read changes.
    const extent = 260,
      segments = 120;
    const geometry = new THREE.PlaneGeometry(extent, extent, segments, segments);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
    const turf = new THREE.Mesh(geometry, material);
    turf.receiveShadow = true;
    scene.add(turf);
    // Rough beyond the green, so the edge of the world is not a hard line.
    const fringe = new THREE.Mesh(
      new THREE.CircleGeometry(700, 48),
      new THREE.MeshStandardMaterial({ color: "#5f8a45", roughness: 1 }),
    );
    fringe.rotation.x = -Math.PI / 2;
    fringe.position.y = -6;
    scene.add(fringe);

    // Cup and flag.
    const cup = new THREE.Group();
    const rim = new THREE.Mesh(
      new THREE.RingGeometry(0.72, 0.98, 32),
      new THREE.MeshBasicMaterial({ color: "#dcebac", side: THREE.DoubleSide }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.06;
    const hole = new THREE.Mesh(
      new THREE.CircleGeometry(0.72, 32),
      new THREE.MeshBasicMaterial({ color: "#123a2c" }),
    );
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = 0.05;
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 9.5, 8),
      new THREE.MeshStandardMaterial({ color: "#fff6d1" }),
    );
    pole.position.y = 4.75;
    pole.castShadow = true;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.7),
      new THREE.MeshStandardMaterial({ color: "#f87856", side: THREE.DoubleSide }),
    );
    flag.position.set(1.35, 8.5, 0);
    cup.add(rim, hole, pole, flag);
    scene.add(cup);

    // Ball and its rolling trail.
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 16, 12),
      new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.4 }),
    );
    ball.castShadow = true;
    scene.add(ball);
    const trailGeometry = new LineGeometry();
    trailGeometry.setPositions(new Float32Array(600));
    const trail = new Line2(
      trailGeometry,
      new LineMaterial({ color: "#fffbe1", linewidth: 2.4, transparent: true, opacity: 0.9, depthTest: false }),
    );
    trail.renderOrder = 5;
    trail.frustumCulled = false;
    trail.visible = false;
    scene.add(trail);
    // The player's chosen start line: a straight ray through the aim point.
    const aimGeometry = new THREE.BufferGeometry();
    const aimLine = new THREE.Line(
      aimGeometry,
      new THREE.LineDashedMaterial({ color: "#fffbe1", dashSize: 2.2, gapSize: 1.6, transparent: true, opacity: 0.9, depthTest: false }),
    );
    aimLine.renderOrder = 5;
    scene.add(aimLine);
    const aimMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55),
      new THREE.MeshBasicMaterial({ color: "#ffdc70", depthTest: false }),
    );
    aimMarker.renderOrder = 6;
    scene.add(aimMarker);

    // Break beads: the 2D scene's drifting dots, here sliding downslope on
    // the surface itself. Small at the ends of their run, full in the middle.
    const beadCount = 150;
    const beads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.2, 10, 8),
      new THREE.MeshBasicMaterial({ color: "#fffbd8" }),
      beadCount,
    );
    beads.frustumCulled = false;
    scene.add(beads);
    const beadSeeds = Array.from({ length: beadCount }, (_, i) => {
      const golden = i * 2.399963;
      const radius = 6 + Math.sqrt(i / beadCount) * 96;
      return { x: Math.cos(golden) * radius, z: Math.sin(golden) * radius, phase: (i * 0.618) % 1 };
    });
    const matrix = new THREE.Object3D();

    let heightAt = surfaceFor(0, 0),
      surfaceKey = "",
      raf = 0,
      previousTime = 0,
      previousStart = "";
    const chaseEye = new THREE.Vector3(),
      chaseTarget = new THREE.Vector3(),
      desiredRotation = new THREE.Quaternion(),
      lookMatrix = new THREE.Matrix4();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    function rebuildSurface(breakDir, slope) {
      heightAt = surfaceFor(breakDir, slope);
      const positions = geometry.attributes.position;
      for (let i = 0; i < positions.count; i++)
        positions.setY(i, heightAt(positions.getX(i), positions.getZ(i)));
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      material.map?.dispose();
      material.map = greenTexture(heightAt);
      material.needsUpdate = true;
      cup.position.y = heightAt(0, 0);
    }
    const resize = () => {
      const width = node.clientWidth || 1,
        height = node.clientHeight || 1;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      trail.material.resolution.set(width, height);
    };
    resize();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(node);
    const onLost = (event) => {
      event.preventDefault();
      setFailed(true);
      onUnavailable?.();
    };
    renderer.domElement.addEventListener("webglcontextlost", onLost);

    function draw(now) {
      raf = requestAnimationFrame(draw);
      const delta = Math.min(0.05, Math.max(0, (now - previousTime) / 1000));
      previousTime = now;
      const s = current.current;
      if (!s?.visible || document.hidden) return;
      const preview = !s.shot;
      const info = preview ? s.read : s.shot?.putt;
      if (!info) return;
      const breakDir = clamp(info.breakDir || 0, -1, 1),
        slope = clamp(info.slope || 0, -1, 1);
      const key = `${breakDir.toFixed(3)}|${slope.toFixed(3)}`;
      if (key !== surfaceKey) {
        surfaceKey = key;
        rebuildSurface(breakDir, slope);
      }
      const start = info.start || [85, 96];
      const end = preview ? CUP : info.end || (s.shot?.final ? CUP : [CUP[0] - breakDir * 2.5, CUP[1] + 7]);
      const startDist = Math.hypot(start[0] - CUP[0], start[1] - CUP[1]);
      const control = [
        (start[0] + end[0]) / 2 + breakDir * clamp(startDist * 0.45, 2, 24),
        (start[1] + end[1]) / 2 + 2,
      ];
      const lastFrame = Math.max(1, (s.shot?.frames?.length || 8) - 1);
      const t = preview || s.phase === "swing" ? 0 : s.phase === "flight" ? clamp((s.frame || 0) / lastFrame, 0, 1) : 1;
      const eased = 1 - Math.pow(1 - t, 1.75 + slope * 0.45);
      const scenePos = quadPoint(start, control, end, eased);
      const [bx, bz] = toWorld(scenePos);
      const dropped = !preview && s.shot?.final && s.phase === "settle";
      const sink = dropped ? Math.min(1, (now - s.stamp) / 400) * 1.2 : 0;
      ball.position.set(bx, heightAt(bx, bz) + 0.3 - sink, bz);
      ball.visible = !(dropped && sink >= 1.2);

      // Rolling trail behind the ball.
      trail.visible = !preview && s.phase !== "swing" && eased > 0.02;
      if (trail.visible) {
        const points = [];
        const steps = 40;
        for (let i = 0; i <= steps; i++) {
          const p = quadPoint(start, control, end, (eased * i) / steps);
          const [x, z] = toWorld(p);
          points.push(x, heightAt(x, z) + 0.25, z);
        }
        const starts = trailGeometry.attributes.instanceStart,
          ends = trailGeometry.attributes.instanceEnd;
        for (let i = 0; i < steps; i++) {
          starts.setXYZ(i, points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
          ends.setXYZ(i, points[i * 3 + 3], points[i * 3 + 4], points[i * 3 + 5]);
        }
        starts.data.needsUpdate = true;
        trailGeometry.instanceCount = steps;
      }

      // Aim line from the ball through the aim point, as on the 2D green.
      const ticks = preview ? s.aimTicks : info.aimTicks;
      const aimShown = preview || (info.aimTicks != null && !dropped);
      aimLine.visible = aimShown;
      aimMarker.visible = aimShown;
      if (aimShown) {
        const [sx, sz] = toWorld(start);
        const [ax, az] = toWorld([CUP[0] + (ticks || 0) * PUTT_TICK_UNITS, CUP[1]]);
        const pts = [];
        for (let i = 0; i <= 24; i++) {
          const x = sx + ((ax - sx) * i) / 24,
            z = sz + ((az - sz) * i) / 24;
          pts.push(new THREE.Vector3(x, heightAt(x, z) + 0.3, z));
        }
        aimGeometry.setFromPoints(pts);
        aimLine.computeLineDistances();
        aimMarker.position.set(ax, heightAt(ax, az) + 0.6, az);
        aimMarker.rotation.y = now / 900;
      }

      // Beads drift downslope; the run's length and speed follow the fall.
      const severity = Math.abs(breakDir) + Math.abs(slope) * 0.5;
      beads.material.color.set(severity > 1 ? "#ffbe72" : severity > 0.5 ? "#ffe28b" : "#fffbd8");
      const flowing = Math.hypot(breakDir, slope) > 0.12;
      beads.visible = flowing;
      if (flowing) {
        const [sx, sz] = toWorld(start);
        const duration = 2.8 - clamp(Math.hypot(breakDir, slope), 0, 1.3) * 1.5;
        beadSeeds.forEach((seed, i) => {
              const near = Math.hypot(seed.x, seed.z) < 5 || Math.hypot(seed.x - sx, seed.z - sz) < 4;
          const h = 0.5;
          const gx = -(heightAt(seed.x + h, seed.z) - heightAt(seed.x - h, seed.z)) / (2 * h);
          const gz = -(heightAt(seed.x, seed.z + h) - heightAt(seed.x, seed.z - h)) / (2 * h);
          const g = Math.hypot(gx, gz) || 1;
          const run = reduced.matches ? 0.5 : ((now / 1000 / duration + seed.phase) % 1);
          const along = (run - 0.5) * 12;
          const x = seed.x + (gx / g) * along,
            z = seed.z + (gz / g) * along;
          const size = near ? 0 : clamp(1 - Math.abs(run - 0.5) * 2.2, 0, 1);
          matrix.position.set(x, heightAt(x, z) + 0.18, z);
          matrix.scale.setScalar(size);
          matrix.updateMatrix();
          beads.setMatrixAt(i, matrix.matrix);
        });
        beads.instanceMatrix.needsUpdate = true;
      }

      // Camera: low behind the ball, looking up the line to the cup. It cuts
      // to a new ball position and eases for aim changes and the roll.
      const [sx, sz] = toWorld(start);
      const [ex, ez] = toWorld(end);
      const dx = ex - sx,
        dz = ez - sz,
        len = Math.hypot(dx, dz) || 1;
      const ux = dx / len,
        uz = dz / len;
      const back = clamp(16 + len * 0.3, 20, 46);
      const eyeX = sx - ux * back + uz * 4,
        eyeZ = sz - uz * back - ux * 4;
      chaseEye.set(eyeX, heightAt(eyeX, eyeZ) + 6.5 + len * 0.1, eyeZ);
      const lookX = sx + ux * len * 0.5,
        lookZ = sz + uz * len * 0.5;
      chaseTarget.set(lookX, heightAt(lookX, lookZ) + 0.5, lookZ);
      const startKey = `${sx.toFixed(1)},${sz.toFixed(1)}`;
      if (startKey !== previousStart || reduced.matches) {
        previousStart = startKey;
        camera.position.copy(chaseEye);
        camera.lookAt(chaseTarget);
      } else {
        camera.position.lerp(chaseEye, 1 - Math.exp(-5 * delta));
        lookMatrix.lookAt(camera.position, chaseTarget, camera.up);
        desiredRotation.setFromRotationMatrix(lookMatrix);
        camera.quaternion.slerp(desiredRotation, 1 - Math.exp(-7 * delta));
      }
      flag.rotation.y = Math.sin(now / 700) * 0.25;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      scene.traverse((obj) => {
        obj.geometry?.dispose?.();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        materials.forEach((m) => {
          m?.map?.dispose?.();
          m?.dispose?.();
        });
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [onUnavailable]);

  if (failed) return null;
  const info = shot ? shot.putt : read;
  const breakDir = clamp(info?.breakDir || 0, -1, 1),
    slope = clamp(info?.slope || 0, -1, 1);
  const breakAdvice = breakDir > 0.12 ? "Breaks right · aim left" : breakDir < -0.12 ? "Breaks left · aim right" : "Straight line";
  const slopeAdvice = slope > 0.12 ? "Uphill · give it more" : slope < -0.12 ? "Downhill · a softer touch" : "Level putt";
  const feet = info?.feet ? Math.round(info.feet) : null;
  const dropped = Boolean(shot?.final) && phase === "settle";
  return (
    <div className={`trip-ground-putt${visible ? " is-live" : ""}`} aria-hidden={!visible}>
      <div className="trip-ground-render" ref={host} />
      <div className="trip-ground-heading">
        <span>BLACK BEAR / {String(holeNumber).padStart(2, "0")}</span>
        <b>{shot ? (side === "cpu" ? "Their putt" : "Your putt") : "On the green"}</b>
        <small>GREEN CAMERA{feet ? ` · ${feet} FT` : ""}{info?.stimp ? ` · ${info.stimp} GREEN` : ""}</small>
      </div>
      <div className="trip-ground-putt-read">
        <b>{breakAdvice}</b>
        <span>{slopeAdvice}</span>
      </div>
      {shot && !dropped && side === "cpu" && info?.for && (
        <div className={`trip-game-putt-for is-${info.for.tone}`}>
          <span>{info.for.text}</span>
        </div>
      )}
      {shot?.lip && phase === "settle" && <div className="trip-game-putt-in is-lip">LIP OUT!</div>}
      {dropped && <div className="trip-game-putt-in">DRAINED!</div>}
    </div>
  );
}
