import { materials as m, group, box, cylinder, ring, pipe, bolt } from './primitives.mjs';
import { createRotor } from './fans.mjs';
import { GPU_MODELS } from '../../src/app/config/gpu-config.ts';
export { GPU_MODELS };

export function createGpu(spec) {
  const root = group(spec.id);
  root.userData = { modelId: spec.id, cooling: spec.style, fanCount: spec.fans };
  const l = spec.length;
  box(root, [l, 0.065, 1.12], m.pcb, [0, 0.12, 0]);
  box(root, [l - 0.08, 0.055, 1.12], m.frame, [0, 0.065, 0]);
  box(root, [Math.min(l - 0.4, 1.4), 0.05, 0.14], m.gold, [-0.1, 0.12, 0.59]);
  for (let i = 0; i < 22; i++) {
    box(root, [0.016, 0.008, 0.13], m.black, [-0.72 + i * 0.055, 0.15, 0.59]);
  }
  box(root, [0.06, 0.44, 1.35], m.steel, [-l / 2 - 0.035, 0.24, 0]);
  for (let i = 0; i < 3; i++) {
    box(root, [0.065, 0.12, 0.21], m.black, [-l / 2 - 0.071, 0.23, -0.38 + i * 0.37]);
  }
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const screw = bolt(root, [x * (l / 2 - 0.13), 0.028, z * 0.43]);
      screw.rotation.x = 0;
    }
  }
  if (spec.style === 'liquid') {
    addWaterblock(root, l);
  } else {
    addHeatsink(root, l, spec.style === 'passive');
    if (spec.style === 'blower') {
      addBlower(root, l);
    } else if (spec.fans) {
      addAxialShroud(root, spec);
    }
  }
  box(root, [l - 0.28, 0.065, 0.045], m[spec.accent], [0, 0.34, -0.596]);
  const connectors = spec.style === 'triple' ? 2 : 1;
  for (let i = 0; i < connectors; i++) {
    box(root, [0.22, 0.13, 0.15], m.black, [l / 2 - 0.35 - i * 0.27, 0.22, -0.63]);
    for (let pin = 0; pin < 4; pin++) {
      box(root, [0.026, 0.045, 0.02], m.gold, [l / 2 - 0.43 - i * 0.27 + pin * 0.05, 0.24, -0.711]);
    }
  }
  addVariantDetails(root, spec);
  return root;
}

function addVariantDetails(root, spec) {
  const l = spec.length;
  if (spec.style === 'proart') {
    for (const z of [-0.58, 0.58]) {
      box(root, [l, 0.15, 0.05], m.copper, [0, 0.37, z]);
      for (let i = 0; i < 18; i++) {
        box(root, [0.016, 0.11, 0.058], m.gold, [-l / 2 + 0.12 + (i * (l - 0.24)) / 17, 0.37, z]);
      }
    }
  }
  if (spec.style === 'nitro') {
    for (const z of [-0.61, 0.61]) {
      box(root, [l, 0.11, 0.055], m.steel, [0, 0.3, z]);
      box(root, [l - 0.2, 0.035, 0.07], m.orange, [0, 0.4, z]);
    }
  }
  if (spec.style === 'workstation') {
    for (let i = 0; i < 14; i++) {
      box(root, [0.035, 0.21, 1.06], m.gold, [-0.28 + i * 0.044, 0.5, 0]);
    }
    box(root, [l - 0.1, 0.045, 1.12], m.black, [0, 0.01, 0]);
  }
  if (spec.style === 'hybrid') {
    box(root, [0.9, 0.11, 0.92], m.glass, [-0.77, 0.54, 0]);
    for (const z of [-0.3, 0.3]) {
      pipe(
        root,
        [
          [-0.8, 0.65, z],
          [-1.2, 0.82, z],
          [-1.42, 0.85, z],
        ],
        0.055,
        m.blue,
      );
      const port = cylinder(root, 0.085, 0.12, m.steel, [-1.42, 0.85, z]);
      port.rotation.z = Math.PI / 2;
    }
  }
  if (spec.style === 'low-profile') {
    root.scale.set(1, 0.72, 0.65);
  }
}

function addHeatsink(root, length, passive) {
  for (let i = 0; i < 24; i++) {
    box(root, [0.025, passive ? 0.55 : 0.2, 1.04], m.steel, [
      -length / 2 + 0.12 + (i * (length - 0.24)) / 23,
      passive ? 0.44 : 0.26,
      0,
    ]);
  }
  for (const z of [-0.32, 0.32]) {
    pipe(
      root,
      [
        [-length * 0.4, 0.22, z],
        [-0.4, 0.32, z],
        [0.4, 0.32, z],
        [length * 0.4, 0.22, z],
      ],
      0.038,
      m.copper,
    );
  }
}

function addAxialShroud(root, spec) {
  const l = spec.length;
  for (const z of [-0.55, 0.55]) {
    box(root, [l, 0.22, 0.09], m.black, [0, 0.38, z]);
  }
  for (const x of [-l / 2 + 0.05, l / 2 - 0.05]) {
    box(root, [0.1, 0.22, 1.1], m.black, [x, 0.38, 0]);
  }
  const spacing = (l - 0.2) / spec.fans;
  const radius = Math.min(0.47, spacing * 0.45);
  for (let index = 0; index < spec.fans; index++) {
    const x = (index - (spec.fans - 1) / 2) * spacing;
    const rim = ring(root, radius, 0.036, m[spec.accent], [x, 0.47, 0]);
    rim.rotation.x = -Math.PI / 2;
    const housing = group('fan-mount', [x, 0.45, 0]);
    housing.rotation.x = -Math.PI / 2;
    housing.add(createRotor(radius * 0.92, spec.fans === 3 ? 9 : 7, m.frame));
    root.add(housing);
  }
}

function addBlower(root, length) {
  box(root, [length - 1.06, 0.28, 1.1], m.frame, [-0.5, 0.39, 0]);
  const rim = ring(root, 0.43, 0.07, m.orange, [length / 2 - 0.53, 0.5, 0]);
  rim.rotation.x = -Math.PI / 2;
  const rotor = group('fan-rotor', [length / 2 - 0.53, 0.46, 0]);
  rotor.userData = { animationAxis: 'y' };
  cylinder(rotor, 0.2, 0.13, m.black);
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI) / 12;
    const blade = box(rotor, [0.15, 0.12, 0.025], m.steel, [
      Math.cos(angle) * 0.3,
      0,
      Math.sin(angle) * 0.3,
    ]);
    blade.rotation.y = -angle + 0.4;
  }
  root.add(rotor);
  for (let i = 0; i < 7; i++) {
    box(root, [0.55, 0.013, 0.035], m.black, [-0.75, 0.54, -0.37 + i * 0.12]);
  }
}

function addWaterblock(root, length) {
  box(root, [length - 0.15, 0.16, 1.04], m.copper, [0, 0.25, 0]);
  box(root, [length - 0.2, 0.12, 1.02], m.glass, [0, 0.39, 0]);
  for (const z of [-0.32, -0.1, 0.12, 0.34]) {
    pipe(
      root,
      [
        [-0.94, 0.36, z],
        [-0.45, 0.37, z + 0.04],
        [0.45, 0.37, z - 0.04],
        [0.94, 0.36, z],
      ],
      0.035,
      m.blue,
    );
  }
  for (const x of [-0.3, 0.3]) {
    cylinder(root, 0.095, 0.18, m.steel, [x, 0.52, -0.36]);
    cylinder(root, 0.055, 0.02, m.black, [x, 0.62, -0.36]);
    const port = group(x < 0 ? 'coolant-in' : 'coolant-out', [x, 0.64, -0.36]);
    root.add(port);
  }
}
