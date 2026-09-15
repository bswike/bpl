import * as THREE from "three";
import { seededUnit } from "./geometry.js";

function leafTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  // A porous spray of individually shaped leaves, not a solid crown silhouette.
  for (let i = 0; i < 680; i++) {
    const a = seededUnit(i * 7 + 1) * Math.PI * 2,
      r = Math.sqrt(seededUnit(i * 7 + 2));
    const x = 128 + Math.cos(a) * r * 111,
      y = 128 + Math.sin(a) * r * 108;
    const value = Math.floor(150 + seededUnit(i * 7 + 3) * 105);
    c.fillStyle = `rgb(${value},${value},${value})`;
    c.beginPath();
    c.ellipse(
      x,
      y,
      4 + seededUnit(i * 7 + 4) * 6,
      2.2 + seededUnit(i * 7 + 5) * 3.5,
      a,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function barkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = "#81786a";
  c.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 550; i++) {
    c.strokeStyle = i % 3 ? "#413d3470" : "#c1b29d60";
    c.lineWidth = 0.5 + seededUnit(i) * 2;
    const x = seededUnit(i + 1) * 128,
      y = seededUnit(i + 2) * 256;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + seededUnit(i + 3) * 4 - 2, y + 5 + seededUnit(i + 4) * 60);
    c.stroke();
  }
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createNaturalWoodland(scene, trees, heightAt, tee) {
  const leaves = leafTexture(),
    bark = barkTexture();
  const branchParts = [],
    leafParts = [];
  const up = new THREE.Vector3(0, 1, 0),
    matrix = new THREE.Object3D();
  const branch = (a, b, r) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b),
      delta = to.clone().sub(from);
    matrix.position.copy(from).add(to).multiplyScalar(0.5);
    matrix.quaternion.setFromUnitVectors(up, delta.clone().normalize());
    matrix.scale.set(r, delta.length(), r);
    matrix.updateMatrix();
    branchParts.push(matrix.matrix.clone());
  };
  trees.forEach((tree) => {
    const { x, y: z, height: h, radius: r, seed, species } = tree,
      base = heightAt(x, z);
    const tall = species === "poplar" || species === "hickory";
    const crownBase = tall ? 0.48 : species === "oak" ? 0.44 : 0.37,
      crownHeight = tall ? 0.51 : species === "oak" ? 0.53 : 0.6;
    branch(
      [x, base - 0.2, z],
      [x + 0.18, base + h * 0.86, z - 0.15],
      h * 0.021,
    );
    for (let j = 0; j < 8; j++) {
      const angle = j * 2.399 + seededUnit(seed + 21) * 6.28,
        level = 0.38 + j * 0.048;
      const reach =
        r *
        (0.62 + seededUnit(seed + j + 22) * 0.22) *
        Math.sqrt(1 - (j / 9) ** 2);
      const tip = [
        x + Math.cos(angle) * reach,
        base + h * (level + 0.16),
        z + Math.sin(angle) * reach,
      ];
      const start = [x, base + h * level, z];
      branch(start, tip, h * 0.008 * (1 - j * 0.055));
      branch(
        tip,
        [
          tip[0] + Math.cos(angle + 0.6) * r * 0.23,
          tip[1] + h * 0.065,
          tip[2] + Math.sin(angle + 0.6) * r * 0.23,
        ],
        h * 0.003,
      );
    }
    const distance = Math.hypot(x - tee[0], z - tee[1]);
    const clusters = distance < 90 ? 100 : distance < 220 ? 70 : 42;
    for (let j = 0; j < clusters; j++) {
      const a = j * 2.399 + seededUnit(seed + 30) * 6.28;
      const v = (j + 0.5) / clusters;
      const radial =
        Math.sqrt(Math.max(0, 1 - Math.pow(v * 2 - 1, 2))) *
        (0.12 + Math.sqrt(seededUnit(seed + j * 13)) * 0.88);
      const reach = r * radial;
      matrix.position.set(
        x + Math.cos(a) * reach,
        base + h * (crownBase + v * crownHeight),
        z + Math.sin(a) * reach,
      );
      matrix.rotation.set(
        (seededUnit(seed + j * 17) - 0.5) * 1.7,
        a,
        (seededUnit(seed + j * 19) - 0.5) * 0.7,
      );
      const size =
        r *
        (distance < 90 ? 0.56 : 0.75) *
        (0.8 + seededUnit(seed + j * 23) * 0.45);
      matrix.scale.set(size, species === "locust" ? size * 0.78 : size, 1);
      matrix.updateMatrix();
      const hue = {
        oak: 0.255,
        maple: 0.27,
        hickory: 0.235,
        poplar: 0.25,
        basswood: 0.265,
        locust: 0.245,
      }[species];
      const color = new THREE.Color().setHSL(
        hue + seededUnit(seed + 45) * 0.018,
        0.34 + seededUnit(seed + j * 29) * 0.14,
        0.19 + seededUnit(seed + j * 31) * 0.1,
      );
      leafParts.push({ matrix: matrix.matrix.clone(), color });
    }
  });
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28, 1, 1, 7),
    new THREE.MeshStandardMaterial({
      map: bark,
      roughness: 1,
      color: "#c6bcab",
    }),
    branchParts.length,
  );
  branchParts.forEach((m, i) => trunks.setMatrixAt(i, m));
  trunks.castShadow = true;
  trunks.receiveShadow = true;
  const foliage = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshStandardMaterial({
      map: leaves,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 1,
      color: "#ffffff",
    }),
    leafParts.length,
  );
  leafParts.forEach((p, i) => {
    foliage.setMatrixAt(i, p.matrix);
    foliage.setColorAt(i, p.color);
  });
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  foliage.customDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leaves,
    alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  scene.add(trunks, foliage);
  return () => {
    leaves.dispose();
    bark.dispose();
    foliage.customDepthMaterial.dispose();
  };
}
