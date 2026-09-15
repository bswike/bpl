import { createCartoonGolfer } from "./cartoonGolfer.js";
import { useEffect, useRef, useState } from "react";
import { mappedWoodland } from "./woodland.js";
import { createNaturalWoodland } from "./woodlandRenderer.js";
import terrainData from "./data/blackBearTerrain.json";
import { createTerrainSampler } from "./elevationTerrain.js";
import ElevationProfile from "./ElevationProfile.jsx";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { buildCourseWoodland, buildTreeSprites } from "./projection.js";
import { seededUnit } from "./geometry.js";
import {
  GROUND_FLIGHT_FRAME_MS,
  groundCameraFrame,
  flightCameraFrame,
  groundShotPoint,
  groundShotShape,
} from "./groundView.js";
import "./css/25-ground-view.css";
import { nameplateOf } from "./playerLook.js";

function courseTexture(projection) {
  const extent = Math.max(projection.width, projection.height) + 240;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2048;
  const ctx = canvas.getContext("2d");
  const scale = canvas.width / extent;
  const ox = (extent - projection.width) / 2,
    oz = (extent - projection.height) / 2;
  ctx.fillStyle = "#517338";
  ctx.fillRect(0, 0, 2048, 2048);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.translate(ox, oz);
  const tracePath = (ring) => {
    ring.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    ctx.closePath();
  };
  // Forest floor under the surveyed and OSM woods, with clearings cut out.
  for (const wood of projection.woods || []) {
    ctx.beginPath();
    [wood.outer, ...wood.inners].forEach(tracePath);
    ctx.fillStyle = "#3c5a2c";
    ctx.fill("evenodd");
  }
  // Neighbouring holes read as mown ground, a shade duller than this hole.
  for (const feature of projection.context || []) {
    if (feature.points.length < 3) continue;
    ctx.beginPath();
    tracePath(feature.points);
    ctx.fillStyle =
      { fairway: "#6f8e45", green: "#8fab5d", tee: "#7f9b4f" }[feature.type] ||
      "#517338";
    ctx.fill();
  }
  for (const feature of projection.features) {
    if (feature.points.length < 3) continue;
    ctx.save();
    ctx.beginPath();
    feature.points.forEach(([x, z], i) =>
      i ? ctx.lineTo(x, z) : ctx.moveTo(x, z),
    );
    ctx.closePath();
    ctx.fillStyle =
      {
        fairway: "#7b9c4a",
        green: "#a0bc65",
        bunker: "#e8d6a3",
        water: "#497f89",
        tee: "#8daa55",
      }[feature.type] || "#517338";
    ctx.strokeStyle = feature.type === "bunker" ? "#8d8c50" : "#63863e";
    ctx.lineWidth = feature.type === "green" ? 3 : 1.2;
    ctx.stroke();
    ctx.fill();
    ctx.clip();
    if (["green", "fairway", "tee"].includes(feature.type)) {
      ctx.rotate(-0.4);
      ctx.fillStyle = "#ffffff0c";
      for (let z = -extent; z < extent * 2; z += 12)
        ctx.fillRect(-extent, z, extent * 3, 6);
    }
    if (feature.type === "water") {
      ctx.strokeStyle = "#b9dadd50";
      ctx.lineWidth = 0.3;
      for (let z = 0; z < extent; z += 3) {
        ctx.beginPath();
        ctx.moveTo(0, z);
        ctx.lineTo(extent, z - 8);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // Cart paths sit on top of everything, as poured concrete does.
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const line of projection.paths || []) {
    ctx.beginPath();
    line.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z)));
    ctx.strokeStyle = "#8f8b7b";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#cfc9b8";
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
  ctx.restore();
  for (let i = 0; i < 85000; i++) {
    ctx.fillStyle = i % 2 ? "#17381a0b" : "#e4ecb610";
    ctx.fillRect(
      seededUnit(i * 3 + 1) * 2048,
      seededUnit(i * 3 + 2) * 2048,
      1,
      2,
    );
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, extent };
}

function createCourse(scene, projection, holeNumber, heightAt, surveyed) {
  const { texture, extent } = courseTexture(projection);
  const segments = surveyed ? Math.ceil(extent / 3) : 1;
  const surface = new THREE.PlaneGeometry(extent, extent, segments, segments);
  surface.rotateX(-Math.PI / 2);
  const positions = surface.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    positions.setY(
      i,
      heightAt(
        positions.getX(i) + projection.width / 2,
        positions.getZ(i) + projection.height / 2,
      ),
    );
  }
  surface.computeVertexNormals();
  const turf = new THREE.Mesh(
    surface,
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
  );
  turf.position.set(projection.width / 2, 0, projection.height / 2);
  turf.receiveShadow = true;
  scene.add(turf);
  let disposeWoodland = () => {};
  if (surveyed) {
    disposeWoodland = createNaturalWoodland(
      scene,
      mappedWoodland(projection, holeNumber),
      heightAt,
      projection.tee,
    );
  } else {
    const trees = [
      ...(projection.trees || buildTreeSprites(projection, holeNumber)),
      ...buildCourseWoodland(projection, holeNumber),
    ];
    const trunk = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.28, 0.48, 1, 5),
      new THREE.MeshStandardMaterial({ color: "#675444", roughness: 1 }),
      trees.length,
    );
    const crowns = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({
        color: "#ffffff",
        roughness: 1,
        flatShading: true,
      }),
      trees.length * 3,
    );
    const matrix = new THREE.Object3D();
    trees.forEach((tree, i) => {
      const height = tree.size * 1.8;
      const ground = heightAt(tree.x, tree.y);
      matrix.position.set(tree.x, ground + height * 0.3, tree.y);
      matrix.scale.set(1, height * 0.6, 1);
      matrix.updateMatrix();
      trunk.setMatrixAt(i, matrix.matrix);
      for (let j = 0; j < 3; j++) {
        matrix.position.set(
          tree.x + (j - 1) * tree.size * 0.28,
          ground + height * (0.65 + j * 0.08),
          tree.y + Math.sin(i + j) * tree.size * 0.25,
        );
        matrix.scale.set(tree.size * 0.55, height * 0.33, tree.size * 0.52);
        matrix.rotation.y = i * 2.1 + j;
        matrix.updateMatrix();
        crowns.setMatrixAt(i * 3 + j, matrix.matrix);
        crowns.setColorAt(
          i * 3 + j,
          new THREE.Color().setHSL(
            0.23 + seededUnit(i + holeNumber) * 0.06,
            0.32,
            0.22 + seededUnit(i * 7 + j) * 0.13,
          ),
        );
      }
    });
    crowns.castShadow = true;
    trunk.castShadow = true;
    scene.add(trunk, crowns);
  }
  // Distant wooded ridges are scenery, never gameplay or surveyed topography.
  for (let i = 0; i < (surveyed ? 0 : 26); i++) {
    const a = (i / 26) * Math.PI * 2,
      radius = extent * 0.85;
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.25, 0.2, 0.37 + seededUnit(i) * 0.08),
        roughness: 1,
      }),
    );
    hill.position.set(
      projection.width / 2 + Math.cos(a) * radius,
      -14,
      projection.height / 2 + Math.sin(a) * radius,
    );
    hill.scale.set(110, 35 + seededUnit(i + holeNumber) * 55, 100);
    scene.add(hill);
  }
  const pin = new THREE.Group();
  pin.position.set(
    projection.pin[0],
    heightAt(...projection.pin),
    projection.pin[1],
  );
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.045, 3.4, 6),
    new THREE.MeshStandardMaterial({ color: "#fff7de" }),
  );
  pole.position.y = 1.7;
  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.65),
    new THREE.MeshStandardMaterial({
      color: "#e7a643",
      side: THREE.DoubleSide,
    }),
  );
  flag.position.set(0.6, 3.05, 0);
  pin.add(pole, flag);
  scene.add(pin);
  return { texture, disposeWoodland };
}

export default function GroundShotView({
  projection,
  hole,
  shot,
  phase,
  frame = 0,
  visible,
  origin,
  shape = "straight",
  plan = null,
  names = null,
  looks = null,
  onCycleGolfer = null,
  onUnavailable,
}) {
  const holeNumber = hole.number;
  const plate = useRef(null);
  const host = useRef(null),
    state = useRef(null),
    current = useRef(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    current.current = {
      shot,
      phase,
      frame,
      visible,
      origin,
      shape,
      plan,
      looks,
      stamp: performance.now(),
    };
  }, [shot, phase, frame, visible, origin, shape, plan, looks]);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      onUnavailable?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#a8d4e0");
    scene.fog = new THREE.FogExp2("#b3ced1", 0.0018);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(1800, 24, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        vertexShader:
          "varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec3 vDirection; void main(){float h=max(0.,normalize(vDirection).y);vec3 color=mix(vec3(.83,.89,.83),vec3(.30,.61,.79),pow(h,.45));gl_FragColor=vec4(color,1.);}",
      }),
    );
    sky.position.set(projection.width / 2, 0, projection.height / 2);
    scene.add(sky);
    for (let i = 0; i < 12; i++) {
      const cloud = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 8),
        new THREE.MeshBasicMaterial({
          color: "#f2f4e8",
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
        }),
      );
      const a = (i / 12) * Math.PI * 2;
      cloud.position.set(
        projection.width / 2 + Math.cos(a) * 550,
        95 + seededUnit(i) * 85,
        projection.height / 2 + Math.sin(a) * 550,
      );
      cloud.scale.set(
        55 + seededUnit(i + 2) * 65,
        7 + seededUnit(i + 3) * 9,
        22,
      );
      scene.add(cloud);
    }
    scene.add(new THREE.HemisphereLight("#d8edff", "#6e753f", 2.3));
    const sun = new THREE.DirectionalLight("#fff0c9", 2.5);
    sun.position.set(projection.tee[0] - 65, 120, projection.tee[1] - 80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, {
      left: -150,
      right: 150,
      top: 150,
      bottom: -150,
      far: 450,
    });
    sun.shadow.bias = -0.001;
    sun.target.position.set(projection.width / 2, 0, projection.height / 2);
    scene.add(sun, sun.target);
    const grid = terrainData.holes.find((entry) => entry.number === holeNumber);
    const heightAt = createTerrainSampler(projection, grid);
    const { texture, disposeWoodland } = createCourse(
      scene,
      projection,
      holeNumber,
      heightAt,
      Boolean(grid),
    );
    const golfer = createCartoonGolfer(scene);
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#ffffff" }),
    );
    scene.add(ball);
    const tracerGeometry = new LineGeometry();
    const tracer = new Line2(
      tracerGeometry,
      new LineMaterial({
        color: "#fff1a5",
        linewidth: 3,
        transparent: true,
        opacity: 0.92,
        depthTest: Boolean(grid),
      }),
    );
    tracer.renderOrder = 5;
    scene.add(tracer);
    const ghostGeometry = new THREE.BufferGeometry();
    const ghost = new THREE.Line(
      ghostGeometry,
      new THREE.LineDashedMaterial({
        color: "#eff8e2",
        transparent: true,
        opacity: 0.28,
        dashSize: 2,
        gapSize: 2,
      }),
    );
    scene.add(ghost);
    // Where the planned shot comes down: a ring that breathes on the turf.
    const landingRing = new THREE.Mesh(
      new THREE.RingGeometry(1.5, 2.1, 40),
      new THREE.MeshBasicMaterial({
        color: "#fff1a5",
        transparent: true,
        opacity: 0.85,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    landingRing.rotation.x = -Math.PI / 2;
    landingRing.renderOrder = 6;
    landingRing.visible = false;
    scene.add(landingRing);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2200);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const headPoint = new THREE.Vector3();
    let raf = 0,
      previousShot = null,
      previousPlanKey = "",
      base = null,
      previousOrigin = null,
      previousTime = 0,
      launchFov = 55,
      posePhase = null,
      poseShot = null,
      poseStarted = 0;
    const chaseTarget = new THREE.Vector3();
    const chaseEye = new THREE.Vector3();
    const desiredRotation = new THREE.Quaternion();
    const lookMatrix = new THREE.Matrix4();
    const resize = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width && height) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        tracer.material.resolution.set(width, height);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
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
      const from = s.shot?.from || s.origin || projection.tee;
      const plan = !s.shot && s.plan?.to ? s.plan : null;
      const planKey = plan ? plan.to.join(",") : "";
      if (
        previousShot !== s.shot ||
        previousOrigin !== from ||
        previousPlanKey !== planKey ||
        !base
      ) {
        // A new lie or shot cuts to its framing; an aim change only re-targets
        // and the camera eases over below.
        const cut = previousShot !== s.shot || previousOrigin !== from || !base;
        previousShot = s.shot;
        previousOrigin = from;
        previousPlanKey = planKey;
        base = groundCameraFrame(
          from,
          s.shot?.carryTo || s.shot?.to || plan?.to || projection.pin,
          heightAt,
        );
        if (cut) camera.position.fromArray(base.eye);
        const peakAngle = Math.max(
          0,
          ...(s.shot?.frames || []).map((f, index) =>
            Math.atan2(
              groundShotPoint(s.shot, index, heightAt)[1] - base.eye[1],
              Math.hypot(f.gx - base.eye[0], f.gy - base.eye[2]),
            ),
          ),
          // The planned arc's apex, so the preview tracer fits the frame too.
          ...(plan
            ? [
                Math.atan2(
                  (heightAt(...from) + heightAt(...plan.to)) / 2 +
                    (plan.apex || 0) * 0.55 -
                    base.eye[1],
                  Math.hypot(
                    (from[0] + plan.to[0]) / 2 - base.eye[0],
                    (from[1] + plan.to[1]) / 2 - base.eye[2],
                  ),
                ),
              ]
            : []),
        );
        const terrainPitch = Math.atan2(
          heightAt(...(s.shot?.carryTo || projection.pin)) + 3 - base.eye[1],
          Math.hypot(
            (s.shot?.carryTo || projection.pin)[0] - from[0],
            (s.shot?.carryTo || projection.pin)[1] - from[1],
          ),
        );
        const pitch = grid
          ? Math.max(terrainPitch, s.shot || plan ? peakAngle * 0.35 : terrainPitch)
          : Math.max(0.06, peakAngle * 0.35);
        base.target[1] = base.eye[1] + Math.tan(pitch) * 74;
        camera.fov = Math.max(
          55,
          Math.min(
            85,
            Math.max(
              ((peakAngle - pitch) * 360) / Math.PI + 12,
              ((pitch + 0.34) * 360) / Math.PI + 8,
            ),
          ),
        );
        launchFov = camera.fov;
        camera.updateProjectionMatrix();
        if (cut) camera.lookAt(...base.target);
        golfer.group.position.set(
          from[0] + base.direction[1] * 0.9,
          heightAt(
            from[0] + base.direction[1] * 0.9,
            from[1] - base.direction[0] * 0.9,
          ),
          from[1] - base.direction[0] * 0.9,
        );
        golfer.group.rotation.y = Math.atan2(
          -base.direction[0],
          -base.direction[1],
        );
        golfer.dress(s.shot?.side === "cpu" ? s.looks?.cpu : s.looks?.human, s.shot?.side === "cpu" ? "#3973a6" : "#b94836");
        golfer.group.scale.y = (s.shot?.side === "cpu" ? s.looks?.cpu : s.looks?.human)?.tall ? 1.06 : 1;
        const end = s.shot?.carryTo || projection.pin;
        ghostGeometry.setFromPoints(
          Array.from({ length: 81 }, (_, i) => {
            const x = from[0] + ((end[0] - from[0]) * i) / 80;
            const z = from[1] + ((end[1] - from[1]) * i) / 80;
            return new THREE.Vector3(x, heightAt(x, z) + 0.18, z);
          }),
        );
        ghost.computeLineDistances();
      }
      const last = Math.max(0, (s.shot?.frames?.length || 1) - 1);
      const progress =
        s.phase === "settle"
          ? last
          : s.phase === "flight"
            ? Math.min(
                last,
                s.frame +
                  (reduced.matches
                    ? 0
                    : Math.min(1, (now - s.stamp) / GROUND_FLIGHT_FRAME_MS)),
              )
            : 0;
      const point = s.shot
        ? groundShotPoint(s.shot, progress, heightAt)
        : [from[0], heightAt(...from) + 0.12, from[1]];
      ball.position.fromArray(point);
      if (
        s.shot?.air &&
        (s.phase === "flight" || s.phase === "settle") &&
        !reduced.matches
      ) {
        const follow = flightCameraFrame(s.shot, progress, base, heightAt);
        chaseEye.fromArray(follow.eye);
        camera.position.lerp(chaseEye, 1 - Math.exp(-5 * delta));
        camera.position.y = Math.max(
          camera.position.y,
          heightAt(camera.position.x, camera.position.z) + 3.1,
        );
        chaseTarget.fromArray(follow.target);
        lookMatrix.lookAt(camera.position, chaseTarget, camera.up);
        desiredRotation.setFromRotationMatrix(lookMatrix);
        camera.quaternion.slerp(desiredRotation, 1 - Math.exp(-9 * delta));
        const fov = launchFov + (58 - launchFov) * follow.blend;
        camera.fov += (fov - camera.fov) * (1 - Math.exp(-4 * delta));
        camera.updateProjectionMatrix();
      }
      if (!s.shot && base && !reduced.matches) {
        chaseEye.fromArray(base.eye);
        camera.position.lerp(chaseEye, 1 - Math.exp(-6 * delta));
        chaseTarget.fromArray(base.target);
        lookMatrix.lookAt(camera.position, chaseTarget, camera.up);
        desiredRotation.setFromRotationMatrix(lookMatrix);
        camera.quaternion.slerp(desiredRotation, 1 - Math.exp(-8 * delta));
      } else if (!s.shot && base) {
        camera.position.fromArray(base.eye);
        camera.lookAt(...base.target);
      }
      const apparent = Math.max(
        1,
        camera.position.distanceTo(ball.position) / 14,
      );
      ball.scale.setScalar(apparent);
      ball.position.y += (apparent - 1) * 0.085;
      const trail = [];
      if (s.shot && progress > 0) {
        for (let t = 0; t < progress; t += 0.2)
          trail.push(...groundShotPoint(s.shot, t, heightAt));
        trail.push(...point);
      } else if (plan) {
        // The planned arc: the map's curve with the theater's lift on top.
        const to = plan.to,
          dx = to[0] - from[0],
          dz = to[1] - from[1],
          len = Math.hypot(dx, dz) || 1,
          bend = plan.bend || 0,
          control = [
            (from[0] + to[0]) / 2 + (-dz / len) * bend,
            (from[1] + to[1]) / 2 + (dx / len) * bend,
          ],
          y0 = heightAt(...from),
          y1 = heightAt(...to);
        for (let i = 0; i <= 48; i++) {
          const t = i / 48,
            u = 1 - t,
            x = u * u * from[0] + 2 * u * t * control[0] + t * t * to[0],
            z = u * u * from[1] + 2 * u * t * control[1] + t * t * to[1],
            lift = 4 * t * u * (plan.apex || 0) * 0.55;
          trail.push(x, 0.12 + Math.max(heightAt(x, z), y0 + (y1 - y0) * t + lift), z);
        }
      }
      landingRing.visible = Boolean(plan);
      if (plan) {
        landingRing.position.set(plan.to[0], heightAt(...plan.to) + 0.15, plan.to[1]);
        const breathe = 1 + 0.12 * Math.sin(now / 420);
        landingRing.scale.setScalar(breathe);
      }
      tracer.material.linewidth = plan ? 2.2 : 3;
      tracer.material.opacity = plan ? 0.62 : 0.92;
      tracer.visible = trail.length >= 6;
      if (tracer.visible) {
        if (!tracerGeometry.attributes.instanceStart)
          tracerGeometry.setPositions(new Float32Array(1800));
        const starts = tracerGeometry.attributes.instanceStart,
          ends = tracerGeometry.attributes.instanceEnd;
        for (let i = 0; i < trail.length / 3 - 1; i++) {
          starts.setXYZ(i, ...trail.slice(i * 3, i * 3 + 3));
          ends.setXYZ(i, ...trail.slice(i * 3 + 3, i * 3 + 6));
        }
        starts.data.needsUpdate = true;
        tracerGeometry.instanceCount = trail.length / 3 - 1;
        tracer.frustumCulled = false;
      }
      const shotShape = s.shot ? groundShotShape(s.shot) : s.shape;
      landingRing.material.color.set(
        shotShape === "draw"
          ? "#ffc36b"
          : shotShape === "cut"
            ? "#8deaff"
            : "#fff1a5",
      );
      tracer.material.color.set(
        shotShape === "draw"
          ? "#ffc36b"
          : shotShape === "cut"
            ? "#8deaff"
            : "#fff1a5",
      );
      if (posePhase !== s.phase || poseShot !== s.shot) {
        posePhase = s.phase;
        poseShot = s.shot;
        poseStarted = now;
      }
      const poseElapsed = (now - poseStarted) / 700;
      const poseTime =
        s.phase === "swing"
          ? Math.min(1, poseElapsed)
          : s.phase === "flight"
            ? 1 + poseElapsed
            : s.phase === "settle"
              ? 2.25
              : 0;
      golfer.pose(
        reduced.matches ? (poseTime >= 1 ? 2.25 : 0) : poseTime,
        !s.shot && !reduced.matches ? Math.sin(now * 0.0018) * 0.008 : 0,
      );
      // The nameplate rides above the golfer's head.
      if (plate.current) {
        headPoint.set(golfer.group.position.x, golfer.group.position.y + 1.9, golfer.group.position.z).project(camera);
        const onScreen = headPoint.z < 1 && Math.abs(headPoint.x) < 1.2 && Math.abs(headPoint.y) < 1.2;
        plate.current.hidden = !onScreen || !golfer.group.visible;
        if (onScreen) {
          const px = Math.min(node.clientWidth - 76, Math.max(76, ((headPoint.x + 1) / 2) * node.clientWidth)),
            py = Math.max(52, ((1 - headPoint.y) / 2) * node.clientHeight);
          plate.current.style.transform = `translate(-50%, -100%) translate(${px.toFixed(1)}px, ${(py - 6).toFixed(1)}px)`;
        }
      }
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(draw);
    state.current = { renderer };
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      scene.traverse((obj) => {
        if (obj.isInstancedMesh) obj.dispose();
        obj.geometry?.dispose();
        const materials = Array.isArray(obj.material)
          ? obj.material
          : [obj.material];
        materials.forEach((m) => m?.dispose());
      });
      disposeWoodland();
      texture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      state.current = null;
    };
  }, [projection, holeNumber, onUnavailable]);
  const flightShape = shot ? groundShotShape(shot) : shape;
  const plannedShape = shot ? shot.plannedShape : shape;
  if (failed) return null;
  const cpuSide = shot?.side === "cpu";
  const plateName = cpuSide ? names?.cpu : names?.human;
  const plateClickable = !cpuSide && !shot && Boolean(onCycleGolfer);
  return (
    <div
      className={`trip-ground-view${visible ? " is-live" : ""}`}
      aria-hidden={!visible}
      aria-label={`Black Bear hole ${hole.number}, ground-level shot camera`}
    >
      <div className="trip-ground-render" ref={host} />
      {plateName && (
        <button
          ref={plate}
          type="button"
          hidden
          className={`trip-ground-nameplate${cpuSide ? " is-cpu" : ""}${plateClickable ? " is-clickable" : ""}`}
          onClick={plateClickable ? onCycleGolfer : undefined}
          tabIndex={plateClickable ? 0 : -1}
          aria-label={plateClickable ? `${plateName}: tap for the next golfer` : plateName}
        >
          <span>{nameplateOf(plateName)}</span>
          <small>{cpuSide ? "OPPONENT" : plateClickable ? "TAP TO SWAP" : "YOUR PICK"}</small>
        </button>
      )}
      <div className="trip-ground-heading">
        <span>BLACK BEAR / {String(hole.number).padStart(2, "0")}</span>
        <b>
          {shot?.air && (phase === "flight" || phase === "settle")
            ? "Ride the flight"
            : "From the fairway"}
        </b>
        <small>
          {shot?.air && (phase === "flight" || phase === "settle")
            ? "FLIGHT CAMERA"
            : "GROUND CAMERA"}{" "}
          · PAR {hole.par}
          {hole.number <= 3 ? " · LIDAR TERRAIN" : ""}
        </small>
      </div>
      {!shot && (
        <ElevationProfile holeNumber={hole.number} teeYards={hole.yards} />
      )}
      <div className={`trip-ground-shape is-${flightShape}`}>
        <span>
          {shot?.side === "cpu" ? "OPPONENT" : "YOUR SHOT"}
          {shot && plannedShape && plannedShape !== flightShape
            ? ` · ${plannedShape.toUpperCase()} SELECTED`
            : ""}
        </span>
        <b>
          {flightShape === "draw"
            ? "↶ DRAW"
            : flightShape === "cut"
              ? "CUT ↷"
              : "↑ STRAIGHT"}
        </b>
        <small>
          {flightShape === "draw"
            ? "Bending right to left"
            : flightShape === "cut"
              ? "Bending left to right"
              : "Holding the line"}
        </small>
      </div>
      <div className="trip-ground-footer">
        <span>
          {phase === "swing"
            ? "ON THE TEE"
            : phase === "flight"
              ? "BALL IN FLIGHT"
              : phase === "settle"
                ? "BALL DOWN"
                : "BEHIND THE GOLFER"}
        </span>
        <b>
          {shot?.yards
            ? `${shot.yards} YDS`
            : `${hole.yards || ""} YDS TO PLAY`}
        </b>
      </div>
    </div>
  );
}
