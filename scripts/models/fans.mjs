import * as THREE from 'three';
import {
  materials as m,
  group,
  box,
  mesh,
  cylinder,
  ring,
  bolt,
  panelFrame,
} from './primitives.mjs';
import { FAN_MODELS } from '../../src/app/config/fan-config.ts';
export { FAN_MODELS };

export function createRotor(radius, bladeCount, mat) {
  const rotor = group('fan-rotor');
  rotor.userData = { animationAxis: 'z' };
  const hub = cylinder(rotor, radius * 0.23, 0.09, m.black);
  hub.rotation.x = Math.PI / 2;
  for (let index = 0; index < bladeCount; index++) {
    const shape = new THREE.Shape();
    shape.moveTo(radius * 0.16, -radius * 0.09);
    shape.quadraticCurveTo(radius * 0.7, -radius * 0.54, radius * 0.95, -radius * 0.18);
    shape.quadraticCurveTo(radius, radius * 0.1, radius * 0.83, radius * 0.27);
    shape.quadraticCurveTo(radius * 0.48, radius * 0.04, radius * 0.16, radius * 0.11);
    shape.closePath();
    const blade = mesh(
      rotor,
      new THREE.ExtrudeGeometry(shape, { depth: 0.026, bevelEnabled: false, curveSegments: 4 }),
      mat,
    );
    blade.rotation.z = (index * Math.PI * 2) / bladeCount;
  }
  const cap = cylinder(rotor, radius * 0.14, 0.025, m.steel, [0, 0, 0.06]);
  cap.rotation.x = Math.PI / 2;
  return rotor;
}

export function createFan(spec) {
  const root = group(spec.id);
  root.userData = { modelId: spec.id, tier: spec.tier, rpm: spec.rpm };
  const { size: s, depth, blades } = spec;
  panelFrame(root, s, s, depth, m.black, [0, 0, 0], s * 0.085);
  ring(root, s * 0.418, s * 0.034, m[spec.accent], [0, 0, depth / 2]);
  ring(root, s * 0.418, s * 0.022, m.frame, [0, 0, -depth / 2]);
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      box(root, [s * 0.17, s * 0.17, depth + 0.02], m[spec.accent], [x * s * 0.4, y * s * 0.4, 0]);
      bolt(root, [x * s * 0.4, y * s * 0.4, depth / 2 + 0.025]);
    }
  }
  for (let i = 0; i < 4; i++) {
    const strut = box(root, [s * 0.4, s * 0.04, 0.04], m.black, [0, 0, -depth / 2]);
    strut.geometry.translate(s * 0.21, 0, 0);
    strut.rotation.z = (i * Math.PI) / 2 + 0.6;
  }
  const rotor = createRotor(s * 0.385, blades, m.frame);
  rotor.position.z = depth / 2 - 0.045;
  root.add(rotor);
  if (spec.dualRotor) {
    const rear = createRotor(s * 0.385, blades - 2, m.steel);
    rear.position.z = -depth / 2 + 0.08;
    rear.userData['animationDirection'] = -1;
    root.add(rear);
  }
  if (spec.lighting) {
    for (const side of [-1, 1]) {
      ring(root, s * 0.46, 0.018, m.blue, [0, 0, (side * depth) / 2]);
    }
  }
  if (spec.duct) {
    for (let z = -depth / 2; z <= depth / 2; z += 0.12) {
      ring(root, s * 0.46, 0.045, m.steel, [0, 0, z]);
    }
  }
  if (spec.tier >= 3) {
    for (const r of [0.24, 0.34, 0.42]) {
      ring(root, s * r, 0.012, m.steel, [0, 0, depth / 2 + 0.1]);
    }
    for (const angle of [0, Math.PI / 2]) {
      const guard = box(root, [s * 0.86, 0.022, 0.025], m.steel, [0, 0, depth / 2 + 0.1]);
      guard.rotation.z = angle;
    }
  }
  return root;
}
