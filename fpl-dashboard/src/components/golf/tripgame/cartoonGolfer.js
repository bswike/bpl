import * as THREE from "three";
import { golferPose } from "./golferPose.js";

export function createCartoonGolfer(scene) {
  const group = new THREE.Group();
  const placement = new THREE.Group();
  scene.add(placement);
  placement.add(group);
  group.rotation.y = -Math.PI / 2;
  const material = (color, roughness = 0.8) =>
    new THREE.MeshStandardMaterial({ color, roughness });
  const skin = material("#eab58a"),
    shirt = material("#c9473c"),
    cap = material("#c9473c"),
    pants = material("#e8dbc0"),
    white = material("#fff5e4"),
    dark = material("#293546"),
    hair = material("#49342b"),
    blush = material("#d68870");
  const sphere = new THREE.SphereGeometry(1, 24, 16);
  const capsule = new THREE.CapsuleGeometry(1, 1, 6, 12);
  function blob(parent, mat, position, scale) {
    const m = new THREE.Mesh(sphere, mat);
    m.position.set(...position);
    m.scale.set(...scale);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function limb(mat, radius) {
    const m = new THREE.Mesh(capsule, mat);
    m.userData.radius = radius;
    m.castShadow = true;
    group.add(m);
    return m;
  }
  const up = new THREE.Vector3(0, 1, 0),
    delta = new THREE.Vector3(),
    direction = new THREE.Vector3();
  function link(mesh, a, b) {
    delta.copy(b).sub(a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, direction.copy(delta).normalize());
    mesh.scale.set(
      mesh.userData.radius,
      delta.length() / 3,
      mesh.userData.radius,
    );
  }
  const torso = new THREE.Group();
  group.add(torso);
  blob(torso, shirt, [0, 0, 0], [0.34, 0.43, 0.245]);
  blob(torso, pants, [0, -0.35, 0.015], [0.285, 0.22, 0.24]);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.14, 0.038, 8, 24),
    white,
  );
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.36;
  torso.add(collar);
  for (let i = 0; i < 3; i++)
    blob(torso, white, [0.015, 0.22 - i * 0.1, -0.236], [0.018, 0.018, 0.014]);
  const head = new THREE.Group();
  head.position.set(0, 0.58, -0.04);
  torso.add(head);
  blob(head, skin, [0, 0, 0], [0.285, 0.315, 0.265]);
  blob(head, hair, [0, 0.07, 0.08], [0.286, 0.24, 0.22]);
  blob(head, skin, [0, -0.04, -0.055], [0.26, 0.24, 0.23]);
  for (const side of [-1, 1]) {
    blob(head, skin, [side * 0.283, -0.01, 0], [0.065, 0.085, 0.055]);
    blob(head, white, [side * 0.1, 0.025, -0.244], [0.061, 0.076, 0.025]);
    blob(head, dark, [side * 0.1, 0.022, -0.264], [0.028, 0.042, 0.012]);
    blob(
      head,
      white,
      [side * 0.1 - 0.009, 0.035, -0.276],
      [0.009, 0.012, 0.005],
    );
    const brow = blob(
      head,
      hair,
      [side * 0.1, 0.12, -0.24],
      [0.065, 0.014, 0.017],
    );
    brow.rotation.z = side * 0.12;
    blob(head, blush, [side * 0.17, -0.087, -0.222], [0.047, 0.023, 0.012]);
  }
  blob(head, skin, [0, -0.035, -0.292], [0.053, 0.052, 0.052]);
  const smile = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.067, -0.14, -0.235),
    new THREE.Vector3(0, -0.186, -0.262),
    new THREE.Vector3(0.067, -0.14, -0.235),
  );
  const mouth = new THREE.Mesh(
    new THREE.TubeGeometry(smile, 16, 0.009, 6, false),
    hair,
  );
  head.add(mouth);
  blob(head, cap, [0, 0.225, 0.015], [0.315, 0.155, 0.29]);
  blob(head, cap, [0, 0.19, -0.205], [0.32, 0.038, 0.245]);
  blob(head, white, [0, 0.258, -0.251], [0.048, 0.042, 0.015]);
  const shoes = [],
    legs = [];
  for (const side of [-1, 1]) {
    const shoe = new THREE.Group();
    group.add(shoe);
    shoes.push(shoe);
    blob(shoe, dark, [0, 0.065, -0.055], [0.15, 0.075, 0.255]);
    blob(shoe, white, [0, 0.12, -0.07], [0.15, 0.095, 0.24]);
    blob(shoe, shirt, [0, 0.145, 0.075], [0.143, 0.065, 0.055]);
    for (let i = 0; i < 3; i++)
      blob(shoe, dark, [0, 0.203, -0.04 - i * 0.05], [0.08, 0.012, 0.013]);
    legs.push({
      side,
      thigh: limb(pants, 0.135),
      calf: limb(skin, 0.1),
      sock: blob(group, white, [0, 0, 0], [0.108, 0.115, 0.108]),
      knee: blob(group, skin, [0, 0, 0], [0.11, 0.115, 0.11]),
    });
  }
  const arms = [-1, 1].map((side) => ({
    side,
    upper: limb(shirt, 0.12),
    lower: limb(skin, 0.085),
    elbow: blob(group, skin, [0, 0, 0], [0.09, 0.09, 0.09]),
    hand: blob(group, white, [0, 0, 0], [0.095, 0.1, 0.085]),
  }));
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.014, 0.02, 1, 12),
    new THREE.MeshStandardMaterial({
      color: "#b9c9d1",
      metalness: 0.75,
      roughness: 0.25,
    }),
  );
  group.add(shaft);
  shaft.castShadow = true;
  const grip = limb(dark, 0.032);
  const clubhead = blob(group, dark, [0, 0, 0], [0.135, 0.075, 0.11]);
  clubhead.name = "clubhead";
  const shoulder = new THREE.Vector3(),
    hand = new THREE.Vector3(),
    elbow = new THREE.Vector3(),
    pole = new THREE.Vector3(),
    axis = new THREE.Vector3();
  const hip = new THREE.Vector3(),
    knee = new THREE.Vector3(),
    ankle = new THREE.Vector3(),
    clubEnd = new THREE.Vector3(),
    gripEnd = new THREE.Vector3();
  function pose(time, idle = 0, kind = "drive") {
    const p = golferPose(time, kind);
    torso.position.set(p.shift, 1.16 + idle, 0);
    torso.rotation.set(-p.lean * 1.6, p.turn, 0);
    const watch = Math.max(0, Math.min(1, (time - 1.12) / 0.65));
    head.rotation.set(
      -0.16 + watch * 0.14,
      -p.turn * (0.58 - watch * 0.24),
      -p.shift * 0.3,
    );
    torso.updateMatrix();
    legs.forEach((leg, i) => {
      const side = leg.side,
        heel = side > 0 ? p.heel : 0;
      hip.set(side * 0.18 + p.shift * 0.55, 0.88 + idle, 0.025);
      knee.set(side * 0.22 + p.shift * 0.22, 0.5 + heel * 0.4, -0.065);
      ankle.set(side * 0.24, 0.2 + heel, 0.045);
      link(leg.thigh, hip, knee);
      link(leg.calf, knee, ankle);
      leg.knee.position.copy(knee);
      leg.sock.position.copy(ankle);
      // Pivot around the toe, keeping the planted toe from sliding upward.
      const footAngle = -heel * 2.5;
      shoes[i].position.set(
        side * 0.24,
        -Math.sin(footAngle) * 0.24,
        (Math.cos(footAngle) - 1) * 0.24,
      );
      shoes[i].rotation.x = footAngle;
      shoes[i].rotation.y = p.turn * (side > 0 ? 0.35 : 0.12);
    });
    arms.forEach((a) => {
      shoulder.set(a.side * 0.3, 0.19, 0).applyMatrix4(torso.matrix);
      hand.set(
        p.hands[2] + a.side * 0.028,
        p.hands[1] + (a.side > 0 ? -0.035 : 0.025),
        -p.hands[0],
      );
      axis.copy(hand).sub(shoulder);
      const distance = Math.min(0.8, axis.length());
      axis.normalize();
      pole.set(a.side * 0.7, -0.25, 0.45);
      pole.addScaledVector(axis, -pole.dot(axis)).normalize();
      elbow
        .copy(shoulder)
        .addScaledVector(axis, distance * 0.5)
        .addScaledVector(
          pole,
          Math.sqrt(Math.max(0.003, 0.425 ** 2 - (distance * 0.5) ** 2)),
        );
      link(a.upper, shoulder, elbow);
      link(a.lower, elbow, hand);
      a.elbow.position.copy(elbow);
      a.hand.position.copy(hand);
      a.hand.rotation.set(p.turn, 0, p.turn * 0.5);
    });
    hand.set(p.hands[2], p.hands[1], -p.hands[0]);
    delta.set(p.club[2], p.club[1], -p.club[0]).normalize();
    const end = clubEnd.copy(hand).addScaledVector(delta, 1.05);
    shaft.position.copy(hand).add(end).multiplyScalar(0.5);
    shaft.quaternion.setFromUnitVectors(up, delta);
    shaft.scale.y = 1.05;
    link(grip, hand, gripEnd.copy(hand).addScaledVector(delta, 0.19));
    clubhead.position.copy(end);
    clubhead.quaternion.copy(shaft.quaternion);
    clubhead.scale.set(
      kind === "putt" ? 0.16 : 0.135,
      kind === "putt" ? 0.045 : 0.075,
      kind === "putt" ? 0.06 : 0.11,
    );
  }
  pose(0);
  // Team colour lives on the cap; the rest takes each golfer's own look.
  function dress(look, teamColor) {
    cap.color.set(look?.visor ? "#fff5e4" : teamColor);
    shirt.color.set(look?.shirt || teamColor);
    skin.color.set(look?.skin || "#eab58a");
    pants.color.set(look?.legs || "#e8dbc0");
  }
  return { group: placement, shirt, cap, skin, pants, pose, dress };
}
