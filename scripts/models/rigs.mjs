import { materials as m, group, box, cylinder, pipe, bolt, panelFrame } from './primitives.mjs';
import { createFan, FAN_MODELS } from './fans.mjs';
import { createGpu, GPU_MODELS } from './gpus.mjs';
import { COOLING_MODELS, RIG_COOLING_METHODS } from '../../src/app/config/cooling-config.ts';
import { FILTER_MODELS, RIG_DUST_SYSTEMS } from '../../src/app/config/dust-filter-config.ts';
import { GAMEPLAY_RIG_SETUP, MAX_RIG_FANS } from '../../src/app/config/rig-config.ts';
export { COOLING_MODELS, FILTER_MODELS };

export function createFilter(style) {
  const spec = RIG_DUST_SYSTEMS[style];
  if (!('dimensions' in spec)) {
    throw new Error(`Unknown rig dust system: ${style}`);
  }
  const { width, height, depth } = spec.dimensions;
  const root = group(`filter-${style}`);
  panelFrame(root, width, height, depth, style === 'carbon' ? m.frame : m.steel);
  if (style === 'pleated') {
    const count = Math.round(width / 0.13);
    for (let i = 0; i < count; i++) {
      const pleat = box(root, [0.14, height - 0.16, 0.024], m.filter, [
        -width / 2 + 0.13 + (i * (width - 0.26)) / (count - 1),
        0,
        0,
      ]);
      pleat.rotation.y = (i % 2 ? -1 : 1) * 0.65;
    }
  } else {
    if (style === 'carbon') {
      box(root, [width - 0.15, height - 0.15, 0.1], m.black, [0, 0, -0.045]);
    }
    for (let x = -width / 2 + 0.12; x < width / 2 - 0.06; x += 0.12) {
      box(root, [0.012, height - 0.14, 0.015], m.filter, [x, 0, depth / 2]);
    }
    for (let y = -height / 2 + 0.12; y < height / 2 - 0.06; y += 0.12) {
      box(root, [width - 0.14, 0.012, 0.015], m.filter, [0, y, depth / 2 + 0.008]);
    }
  }
  for (const x of [-1, 1]) {
    box(root, [0.1, 0.28, 0.08], m.orange, [x * (width / 2 - 0.07), 0, depth / 2 + 0.05]);
    for (const y of [-1, 1]) {
      bolt(root, [x * (width / 2 - 0.05), y * (height / 2 - 0.05), depth / 2 + 0.02]);
    }
  }
  root.userData = { filterType: style, mounting: 'rig-front-intake' };
  return root;
}

export function createExternalCooling(style) {
  const root = group(`cooling-${style}`);
  for (const x of [-0.76, 0.76]) {
    box(root, [0.16, 0.16, 2.9], m.frame, [x, 0.18, 0]);
    for (const z of [-1.25, 1.25]) {
      box(root, [0.3, 0.13, 0.34], m.black, [x, 0.065, z]);
    }
    box(root, [0.12, 3.15, 0.12], m.steel, [x, 1.74, -0.55]);
  }
  for (const y of [0.4, 1.8, 3.25]) {
    box(root, [1.64, 0.12, 0.12], m.frame, [0, y, -0.55]);
  }
  box(root, [1.65, 0.1, 2.55], m.frame, [0, 0.33, 0]);
  root.add(group('external-module-mount', [0, 1.9, 0]));
  if (style === 'bracket') {
    return root;
  }
  const spec = RIG_COOLING_METHODS[style];
  const radiator = spec.radiator;
  panelFrame(root, radiator.width, radiator.height, radiator.depth, m.black, [0, 1.87, -0.2], 0.12);
  if (style === 'liquid') {
    for (let i = 0; i < 32; i++) {
      box(root, [1.4, 0.022, 0.3], m.steel, [0, 0.57 + i * 0.08, -0.23]);
    }
    cylinder(root, 0.2, 1.3, m.glass, [1.08, 1.42, 0]);
    cylinder(root, 0.145, 1.08, m.blue, [1.08, 1.32, 0]);
    for (const y of [0.75, 2.1]) {
      cylinder(root, 0.23, 0.15, m.black, [1.08, y, 0]);
    }
    box(root, [0.48, 0.32, 0.5], m.black, [1.08, 0.5, 0]);
    pipe(
      root,
      [
        [1.08, 0.6, 0],
        [1.12, 0.4, 0.5],
        [0.65, 0.48, 0.5],
      ],
      0.06,
      m.blue,
    );
  }
  const fanSpec = FAN_MODELS.find((fan) => fan.id === spec.radiatorFanId);
  if (!fanSpec) {
    throw new Error(`Unknown radiator fan: ${spec.radiatorFanId}`);
  }
  for (const y of radiator.fanYPositions) {
    const fan = createFan(fanSpec);
    fan.position.set(0, y, 0.12);
    root.add(fan);
  }
  for (const y of [0.65, 2.95]) {
    const port = cylinder(root, 0.085, 0.16, m.gold, [-0.86, y, -0.2]);
    port.rotation.z = Math.PI / 2;
  }
  root.userData = { coolingType: style, mounting: 'rig-sidecar' };
  return root;
}

export function createRig({
  filter = 'none',
  cooling = 'none',
  populated = true,
  slotCount = 8,
  installedFans = populated,
  fanId,
  fanCount = GAMEPLAY_RIG_SETUP.fanCount,
} = {}) {
  const root = group(`rig-${slotCount}`);
  root.userData = { gpuSlots: slotCount, filter, cooling, populated };
  addFrame(root);
  addElectronics(root);
  const cardSpec = GPU_MODELS.find(
    (spec) =>
      spec.style === (cooling === 'liquid' ? 'liquid' : cooling === 'air' ? 'triple' : 'dual'),
  );
  for (let index = 0; index < slotCount; index++) {
    const x = (index - (slotCount - 1) / 2) * (5.52 / slotCount);
    const socket = group(`gpu-slot-${String(index + 1).padStart(2, '0')}`, [x - 0.25, 2.13, 0]);
    // Long card axis follows rig depth; fan face points along the row.
    socket.rotation.set(Math.PI / 2, 0, -Math.PI / 2);
    socket.userData = { slot: index + 1, accepts: 'gpu', occupied: populated };
    root.add(socket);
    box(root, [0.13, 0.1, 2.68], m.pcb, [x, 1.5, 0]);
    box(root, [0.38, 0.07, 0.3], m.black, [x, 1.43, 1.1]);
    const indicator = group(`slot-indicator-${index + 1}`);
    box(indicator, [0.075, 0.06, 0.03], m.lime, [x, 1.39, 1.75]);
    root.add(indicator);
    const cable = group(`slot-cable-${index + 1}`);
    pipe(
      cable,
      [
        [x, 2.76, -1.12],
        [x, 2.8, -1.5],
        [x, 0.85, -1.42],
        [1.75, 0.55, -0.7],
      ],
      0.022,
      index % 2 ? m.gold : m.black,
    );
    root.add(cable);
    cable.userData['hiddenWhenEmpty'] = true;
    if (populated) {
      socket.add(createGpu(cardSpec));
    }
  }
  const defaultFanId = RIG_COOLING_METHODS[cooling]?.radiatorFanId ?? GAMEPLAY_RIG_SETUP.fanId;
  const fanSpec = FAN_MODELS.find((spec) => spec.id === (fanId ?? defaultFanId));
  if (!fanSpec) {
    throw new Error(`Unknown rig fan: ${fanId}`);
  }
  const activeMounts = new Set(
    Array.from({ length: MAX_RIG_FANS }, (_, i) => i)
      .sort((a, b) => Math.abs(a - 2) - Math.abs(b - 2))
      .slice(0, fanCount),
  );
  for (let i = 0; i < MAX_RIG_FANS; i++) {
    const fanOffset = (i - (MAX_RIG_FANS - 1) / 2) * 1.09;
    const mount = group(`fan-mount-${i + 1}`, [fanOffset, 0.94, 1.65]);
    mount.userData = { accepts: 'fan', animationAxis: 'z' };
    if (installedFans && activeMounts.has(i)) {
      const fan = createFan(fanSpec);
      fan.scale.setScalar(1 / fanSpec.size);
      mount.add(fan);
    }
    root.add(mount);
  }
  const filterMount = group('filter-mount', [0, 0.94, 1.97]);
  filterMount.userData = { accepts: 'filter' };
  if (filter !== 'none') {
    filterMount.add(createFilter(filter));
  }
  root.add(filterMount);
  const coolingMount = group('cooling-mount', [4.08, 0, 0]);
  coolingMount.userData = { accepts: 'external-cooling' };
  if (cooling !== 'none') {
    coolingMount.add(createExternalCooling(cooling));
    for (const z of [-0.9, 0.9]) {
      box(root, [1.65, 0.12, 0.15], m.steel, [3.18, 0.3, z]);
    }
  }
  root.add(coolingMount);
  if (populated && cooling === 'liquid') {
    // Supply and return manifolds connect every waterblock to the external radiator.
    for (const z of [-0.3, 0.3]) {
      pipe(
        root,
        [
          [-2.6, 2.9, z],
          [2.75, 2.9, z],
          [3.05, 2.75, z],
          [3.22, z < 0 ? 2.95 : 0.65, -0.2],
        ],
        0.045,
        z < 0 ? m.blue : m.black,
      );
      for (let i = 0; i < slotCount; i++) {
        const x = (i - (slotCount - 1) / 2) * (5.52 / slotCount);
        pipe(
          root,
          [
            [x + 0.39, 2.49, z],
            [x + 0.42, 2.8, z],
            [x, 2.9, z],
          ],
          0.028,
          m.blue,
        );
      }
    }
  }
  return root;
}

function addFrame(root) {
  for (const x of [-2.88, 2.88]) {
    for (const z of [-1.68, 1.68]) {
      box(root, [0.13, 3.15, 0.13], m.frame, [x, 1.66, z]);
      box(root, [0.3, 0.15, 0.3], m.black, [x, 0.075, z]);
      box(root, [0.19, 0.16, 0.19], m.steel, [x, 3.16, z]);
      for (const y of [0.28, 1.44, 3.14]) {
        bolt(root, [x, y, z + 0.075]);
      }
    }
  }
  for (const y of [0.25, 1.44, 3.14]) {
    for (const z of [-1.68, 1.68]) {
      box(root, [5.76, 0.12, 0.12], m.frame, [0, y, z]);
      box(root, [5.55, 0.025, 0.018], m.steel, [0, y + 0.015, z + 0.066]);
    }
    for (const x of [-2.88, 2.88]) {
      box(root, [0.12, 0.12, 3.36], m.frame, [x, y, 0]);
    }
  }
  box(root, [5.6, 0.08, 3.2], m.black, [0, 0.3, 0]);
  box(root, [5.45, 0.035, 0.045], m.lime, [0, 3.15, 1.76]);
  for (const x of [-2.8, 2.8]) {
    pipe(
      root,
      [
        [x, 0.4, -1.5],
        [x, 0.95, 0],
        [x, 1.4, 1.5],
      ],
      0.033,
      m.steel,
    );
  }
}

function addElectronics(root) {
  box(root, [2.8, 0.07, 2.35], m.pcb, [-0.9, 0.4, -0.15]);
  box(root, [0.72, 0.1, 0.72], m.black, [-1.1, 0.48, -0.4]);
  for (let i = 0; i < 9; i++) {
    box(root, [0.66, 0.3, 0.03], m.steel, [-1.1, 0.65, -0.7 + i * 0.075]);
  }
  for (const x of [-0.2, 0.03]) {
    box(root, [0.065, 0.32, 1.1], m.black, [x, 0.58, -0.2]);
  }
  for (const z of [-0.76, 0.76]) {
    box(root, [1.35, 0.68, 1.25], m.frame, [1.76, 0.68, z]);
    box(root, [0.82, 0.015, 0.55], m.gold, [1.76, 1.03, z]);
    for (let i = 0; i < 7; i++) {
      box(root, [0.92, 0.028, 0.023], m.black, [1.76, 0.44 + i * 0.075, z + 0.633]);
    }
  }
}
