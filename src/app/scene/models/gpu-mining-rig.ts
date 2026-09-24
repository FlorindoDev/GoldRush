import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
import { GPUS_PER_RIG } from '../../game/mining-world';
import { createBox, createLabelTexture, createRod } from '../geometry/mesh-primitives';
import { RIG_PLOT_DEPTH, RIG_PLOT_WIDTH } from '../environment/scene-layout';

export interface RigSlot {
  readonly position: THREE.Vector3;
  readonly orientation: THREE.Quaternion;
  readonly outline: THREE.LineSegments;
  readonly indicator: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly cable: THREE.Group;
}

export interface GpuMiningRig {
  readonly root: THREE.Group;
  readonly slots: readonly RigSlot[];
  readonly fans: readonly THREE.Group[];
}

interface DashedOutlineOptions {
  readonly size: [width: number, height: number, depth: number];
  readonly color: number;
  readonly dashSize: number;
  readonly gapSize: number;
  readonly opacity: number;
}

const FRAME = 0x526560;
const DARK = 0x202b2b;
const STEEL = 0x9cac9f;
const ACCENT = 0xb8f575;
const SLOT_SPACING = GAME_BALANCE.layout.plots.rigSlotSpacing;
const RIG_WIDTH = GPUS_PER_RIG * SLOT_SPACING + 0.6;

export function createGpuMiningRig(id: number): GpuMiningRig {
  const root = new THREE.Group();
  root.name = 'gpu-mining-rig';
  root.userData['rigId'] = id;
  addFrame(root);
  addPowerSupply(root);
  addMotherboard(root);
  const fans = [-1.45, 0, 1.45].map((x) => addCoolingFan(root, x));
  const slots = Array.from({ length: GPUS_PER_RIG }, (_, index) => createSlot(root, id, index));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.3),
    new THREE.MeshBasicMaterial({
      map: createLabelTexture(`MINING RIG ${String(id).padStart(2, '0')}`),
    }),
  );
  label.position.set(0, 0.37, 1.72);
  root.add(label);
  return { root, slots, fans };
}

export function createRigPlot(id: number): THREE.Group {
  const plot = new THREE.Group();
  plot.name = 'rig-plot';
  plot.userData['plotId'] = id;

  const surface = new THREE.Mesh(
    new THREE.BoxGeometry(RIG_PLOT_WIDTH, 0.035, RIG_PLOT_DEPTH),
    new THREE.MeshStandardMaterial({
      color: 0x24342a,
      roughness: 1,
      transparent: true,
      opacity: 0.72,
    }),
  );
  surface.position.y = -0.48;
  surface.receiveShadow = true;
  plot.add(surface);

  const outline = createDashedBoxOutline({
    size: [RIG_PLOT_WIDTH, 0.04, RIG_PLOT_DEPTH],
    color: 0x76906f,
    dashSize: 0.28,
    gapSize: 0.16,
    opacity: 0.7,
  });
  outline.position.y = -0.44;
  plot.add(outline);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.3),
    new THREE.MeshBasicMaterial({ map: createLabelTexture(`PLOT ${String(id).padStart(2, '0')}`) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, -0.44, RIG_PLOT_DEPTH / 2 - 0.5);
  plot.add(label);
  return plot;
}

function addFrame(root: THREE.Group): void {
  const halfWidth = RIG_WIDTH / 2;
  for (const x of [-halfWidth, halfWidth]) {
    for (const z of [-1.6, 1.6]) {
      root.add(createBox([0.16, 3.35, 0.16], FRAME, [x, 1.225, z]));
      root.add(createBox([0.32, 0.12, 0.32], DARK, [x, -0.44, z], true));
      root.add(createBox([0.23, 0.26, 0.23], STEEL, [x, 2.77, z]));
    }
    for (const y of [-0.22, 1.44, 2.88]) {
      root.add(createBox([0.16, 0.14, 3.36], FRAME, [x, y, 0]));
    }
    root.add(createRod([x, -0.14, -1.5], [x, 1.37, 1.5], 0.045, STEEL));
  }
  for (const z of [-1.6, 1.6]) {
    for (const y of [-0.22, 1.44, 2.88]) {
      root.add(createBox([RIG_WIDTH, 0.14, 0.14], FRAME, [0, y, z]));
    }
    root.add(createBox([RIG_WIDTH, 0.02, 0.025], ACCENT, [0, 1.49, z + 0.08]));
  }
  root.add(createBox([RIG_WIDTH - 0.2, 0.09, 3.1], DARK, [0, -0.16, 0]));
  root.add(createBox([RIG_WIDTH, 0.45, 0.1], DARK, [0, 0.35, 1.65]));
}

function addPowerSupply(root: THREE.Group): void {
  root.add(createBox([1.05, 0.72, 1.7], 0x354345, [1.72, 0.24, -0.24], true));
  for (let index = 0; index < 7; index++) {
    root.add(createBox([0.74, 0.035, 0.025], DARK, [1.72, 0.02 + index * 0.075, 0.62]));
  }
  root.add(createBox([0.46, 0.02, 0.8], 0xc69b50, [1.72, 0.61, -0.25]));
  root.add(createBox([0.22, 0.14, 0.04], ACCENT, [2.3, 0.13, 1.72]));
}

function addMotherboard(root: THREE.Group): void {
  root.add(createBox([2.7, 0.06, 2.05], 0x38735c, [-0.63, -0.04, -0.1]));
  root.add(createBox([0.78, 0.13, 0.78], DARK, [-0.83, 0.06, -0.28]));
  for (let index = 0; index < 9; index++) {
    root.add(createBox([0.66, 0.29, 0.035], STEEL, [-0.83, 0.25, -0.57 + index * 0.075]));
  }
  for (const x of [0.2, 0.45]) {
    root.add(createBox([0.09, 0.36, 1.25], DARK, [x, 0.14, -0.15]));
    root.add(createBox([0.095, 0.05, 1.25], ACCENT, [x, 0.34, -0.15]));
  }
  for (const x of [-1.72, -1.42, -1.12]) {
    root.add(createBox([0.14, 0.13, 0.2], 0xc3ab68, [x, 0.07, 0.57]));
  }
}

function addCoolingFan(root: THREE.Group, x: number): THREE.Group {
  root.add(createBox([1.05, 1.05, 0.14], DARK, [x, 0.85, -1.6], true));
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.43, 0.045, 4, 12),
    new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.7, flatShading: true }),
  );
  rim.position.set(x, 0.85, -1.49);
  root.add(rim);
  const fan = new THREE.Group();
  fan.position.copy(rim.position);
  for (let index = 0; index < 6; index++) {
    const angle = (index * Math.PI) / 3;
    const blade = createBox([0.29, 0.13, 0.035], 0x708c78, [
      Math.cos(angle) * 0.23,
      Math.sin(angle) * 0.23,
      0,
    ]);
    blade.rotation.z = angle + 0.5;
    fan.add(blade);
  }
  fan.add(createRod([0, 0, -0.01], [0, 0, 0.07], 0.12, DARK));
  root.add(fan);
  return fan;
}

function createSlot(root: THREE.Group, rigId: number, index: number): RigSlot {
  const x = (index - (GPUS_PER_RIG - 1) / 2) * SLOT_SPACING;
  root.add(createBox([0.65, 0.07, 2.75], DARK, [x, 1.54, 0]));
  root.add(createBox([0.11, 0.11, 1.75], 0x3f8366, [x, 1.61, 0]));
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(0.58, 0.22),
    new THREE.MeshBasicMaterial({
      map: createLabelTexture(
        String((rigId - 1) * GPUS_PER_RIG + index + 1).padStart(3, '0'),
        '#d2dcc8',
      ),
    }),
  );
  label.position.set(x, 1.22, 1.685);
  root.add(label);
  const indicator = createBox([0.13, 0.05, 0.03], DARK, [x, 1.02, 1.7]);
  root.add(indicator);
  const box = new THREE.BoxGeometry(0.78, 1.2, 2.58);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(box),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.75 }),
  );
  box.dispose();
  outline.position.set(x, 2.2, 0);
  outline.visible = false;
  root.add(outline);
  const cable = new THREE.Group();
  for (const offset of [-0.05, 0.05]) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(x + offset, 2.48, -0.85),
      new THREE.Vector3(x + offset, 2.7, -1.42),
      new THREE.Vector3(x + offset, 1.2, -1.38),
      new THREE.Vector3(1.7, 0.58, -0.85),
    ]);
    cable.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(curve, 12, 0.025, 5, false),
        new THREE.MeshStandardMaterial({ color: offset > 0 ? 0xc69b50 : DARK, roughness: 0.85 }),
      ),
    );
  }
  cable.visible = false;
  root.add(cable);
  return {
    position: new THREE.Vector3(x - 0.2, 2.25, 0),
    orientation: new THREE.Quaternion().setFromEuler(
      new THREE.Euler(-Math.PI / 2, 0, -Math.PI / 2),
    ),
    outline,
    indicator,
    cable,
  };
}

function createDashedBoxOutline({
  size,
  color,
  dashSize,
  gapSize,
  opacity,
}: DashedOutlineOptions): THREE.LineSegments {
  const geometry = new THREE.BoxGeometry(...size);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineDashedMaterial({ color, dashSize, gapSize, transparent: true, opacity }),
  );
  geometry.dispose();
  outline.computeLineDistances();
  return outline;
}
