import * as THREE from 'three';
import { createBox, createRod } from './mesh-primitives';

export const WORKBENCH_WIDTH = 5;
export const WORKBENCH_DEPTH = 3.6;
export const WORKBENCH_SURFACE_Y = 1.8;
export const BITCOIN_TRAY_POSITION: [number, number, number] = [1.6, 1.87, 1.04];

const FRAME_COLOR = 0x36504b;
const DARK_COLOR = 0x202d2e;
const STEEL_COLOR = 0xa3b6af;
const TOOL_COLOR = 0xd99446;

export function createElectronicsWorkbench(): THREE.Group {
  const bench = new THREE.Group();
  bench.name = 'electronics-workbench';
  addFrame(bench);
  addDrawers(bench);

  const desktop = new THREE.Group();
  desktop.position.y = WORKBENCH_SURFACE_Y;
  desktop.add(createBox([WORKBENCH_WIDTH, 0.2, WORKBENCH_DEPTH], 0xa87a4c, [0, -0.1, 0], true));
  desktop.add(createBox([3.65, 0.025, 2.05], 0x376963, [-0.35, 0.014, -0.02], true));
  addPegboard(desktop);
  addOscilloscope(desktop);
  addSolderingStation(desktop);
  addDeskLamp(desktop);
  addLooseComponents(desktop);
  addBitcoinTray(desktop);
  bench.add(desktop);
  return bench;
}

function addFrame(bench: THREE.Group): void {
  for (const x of [-2.22, 2.22]) {
    for (const z of [-1.52, 1.52]) {
      bench.add(createBox([0.2, 2.04, 0.2], FRAME_COLOR, [x, 0.59, z]));
      bench.add(createBox([0.32, 0.1, 0.32], DARK_COLOR, [x, -0.45, z], true));
    }
    bench.add(createBox([0.16, 0.15, 3.12], FRAME_COLOR, [x, 0.02, 0]));
    bench.add(createBox([0.17, 0.25, 3.12], FRAME_COLOR, [x, 1.48, 0]));
  }
  bench.add(createBox([4.5, 0.3, 0.12], FRAME_COLOR, [0, 1.46, 1.54]));
  bench.add(createBox([4.5, 0.3, 0.12], FRAME_COLOR, [0, 1.46, -1.54]));
  bench.add(createBox([4.5, 0.15, 0.15], FRAME_COLOR, [0, 0.02, -1.52]));
  bench.add(createBox([4.35, 0.09, 0.65], 0x52625a, [0, 0.15, -1.2]));
  const storageBox = createBox([0.95, 0.48, 0.58], 0x8d7552, [0.7, 0.44, -1.2], true);
  bench.add(storageBox, createBox([0.25, 0.15, 0.01], 0xc1b798, [0.7, 0.48, -0.904]));
}

function addDrawers(bench: THREE.Group): void {
  bench.add(createBox([1.1, 0.88, 2.55], DARK_COLOR, [-1.52, 1.12, 0], true));
  for (const y of [0.83, 1.1, 1.37]) {
    bench.add(createBox([1.02, 0.23, 0.07], 0x557269, [-1.52, y, 1.31], true));
    bench.add(createBox([0.42, 0.045, 0.085], STEEL_COLOR, [-1.52, y + 0.02, 1.39], true));
  }
}

function addPegboard(desktop: THREE.Group): void {
  for (const x of [-2.23, 2.23]) {
    desktop.add(createBox([0.11, 1.4, 0.12], FRAME_COLOR, [x, 0.67, -1.65]));
  }
  desktop.add(createBox([4.46, 1.05, 0.1], 0x53635b, [0, 0.8, -1.65]));
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#53635b';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#263d37';
  for (let x = 12; x < canvas.width; x += 20) {
    for (let y = 12; y < canvas.height; y += 20) {
      context.beginPath();
      context.arc(x, y, 2.5, 0, Math.PI * 2);
      context.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(4.35, 0.96),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
  );
  face.position.set(0, 0.8, -1.595);
  desktop.add(face);
  for (const [index, x] of [-0.52, -0.22, 0.08].entries()) {
    const top = 1.14 - index * 0.05;
    desktop.add(createRod([x, top, -1.47], [x, top - 0.25, -1.47], 0.055, TOOL_COLOR));
    desktop.add(createRod([x, top - 0.25, -1.47], [x, top - 0.52, -1.47], 0.022, STEEL_COLOR));
  }
  desktop.add(createBox([1.03, 0.12, 0.37], FRAME_COLOR, [1.17, 0.39, -1.44]));
  for (const x of [0.87, 1.19, 1.51]) {
    desktop.add(createBox([0.26, 0.17, 0.29], 0x7c9b9a, [x, 0.53, -1.45]));
    desktop.add(createBox([0.18, 0.015, 0.2], DARK_COLOR, [x, 0.62, -1.43]));
  }
}

function addOscilloscope(desktop: THREE.Group): void {
  const scope = new THREE.Group();
  scope.position.set(-1.34, 0.22, -1.09);
  desktop.add(createBox([1.6, 0.06, 0.85], FRAME_COLOR, [-1.34, 0.19, -1.09]));
  for (const x of [-1.95, -0.73]) {
    desktop.add(createBox([0.08, 0.16, 0.7], FRAME_COLOR, [x, 0.08, -1.09]));
  }
  scope.add(createBox([1.4, 0.69, 0.72], 0xa6b5ab, [0, 0.415, 0], true));
  scope.add(createBox([1.27, 0.56, 0.04], 0x697e73, [0, 0.415, 0.374], true));
  scope.add(createBox([0.85, 0.48, 0.035], DARK_COLOR, [-0.16, 0.43, 0.4], true));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.73, 0.36),
    new THREE.MeshBasicMaterial({ map: createOscilloscopeTexture() }),
  );
  screen.position.set(-0.16, 0.43, 0.42);
  scope.add(screen);
  for (const y of [0.3, 0.55]) {
    scope.add(createRod([0.48, y, 0.39], [0.48, y, 0.48], 0.071, DARK_COLOR));
  }
  for (const x of [-0.5, 0.5]) {
    scope.add(createBox([0.2, 0.08, 0.52], DARK_COLOR, [x, 0.04, 0]));
  }
  scope.add(createBox([0.7, 0.065, 0.08], DARK_COLOR, [0, 0.83, 0]));
  for (const x of [-0.31, 0.31]) {
    scope.add(createBox([0.06, 0.12, 0.08], DARK_COLOR, [x, 0.77, 0]));
  }
  desktop.add(scope);
}

function createOscilloscopeTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#102f2b';
  context.fillRect(0, 0, 256, 128);
  context.strokeStyle = '#28534a';
  context.lineWidth = 1;
  context.beginPath();
  for (let x = 16; x < 256; x += 24) {
    context.moveTo(x, 0);
    context.lineTo(x, 128);
  }
  for (let y = 16; y < 128; y += 24) {
    context.moveTo(0, y);
    context.lineTo(256, y);
  }
  context.stroke();
  context.strokeStyle = '#b8f575';
  context.lineWidth = 3;
  context.beginPath();
  for (let x = 0; x < 256; x++) {
    const y = 65 - Math.sin(x * 0.065) * 30;
    if (x === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.stroke();
  context.fillStyle = '#b8f575';
  context.font = '12px monospace';
  context.fillText('CH1  2.0V', 12, 16);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function addSolderingStation(desktop: THREE.Group): void {
  const station = new THREE.Group();
  station.position.set(1.63, 0, -0.66);
  station.add(createBox([0.62, 0.3, 0.65], 0x415c63, [0, 0.17, 0], true));
  station.add(createBox([0.3, 0.11, 0.016], DARK_COLOR, [-0.09, 0.23, 0.335]));
  const indicator = createBox([0.21, 0.025, 0.02], 0xb8f575, [-0.09, 0.235, 0.35]);
  indicator.material.emissive.set(0xb8f575);
  indicator.material.emissiveIntensity = 0.5;
  station.add(indicator);
  station.add(createRod([0.19, 0.15, 0.32], [0.19, 0.15, 0.4], 0.065, DARK_COLOR));
  station.add(createBox([0.32, 0.045, 0.59], DARK_COLOR, [-0.62, 0.04, 0.02], true));
  station.add(createRod([-0.62, 0.075, -0.08], [-0.62, 0.32, -0.13], 0.07, STEEL_COLOR));
  station.add(createRod([-0.62, 0.09, 0.18], [-0.62, 0.35, -0.18], 0.025, STEEL_COLOR));
  station.add(createRod([-0.62, 0.35, -0.18], [-0.62, 0.53, -0.43], 0.065, TOOL_COLOR));
  const cablePath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, 0.53, -0.43),
    new THREE.Vector3(-0.82, 0.16, -0.49),
    new THREE.Vector3(-0.81, 0.055, 0.42),
    new THREE.Vector3(-0.3, 0.05, 0.59),
    new THREE.Vector3(0, 0.1, 0.34),
  ]);
  station.add(
    new THREE.Mesh(
      new THREE.TubeGeometry(cablePath, 18, 0.019, 5, false),
      new THREE.MeshStandardMaterial({ color: DARK_COLOR, roughness: 0.9 }),
    ),
  );
  desktop.add(station);
}

function addDeskLamp(desktop: THREE.Group): void {
  desktop.add(createBox([0.38, 0.07, 0.35], DARK_COLOR, [2.14, 0.04, -1.3], true));
  desktop.add(createRod([2.14, 0.08, -1.3], [2.23, 1.5, -1.3], 0.045, FRAME_COLOR));
  desktop.add(createRod([2.23, 1.5, -1.3], [1.12, 1.85, -0.98], 0.045, FRAME_COLOR));
  const shade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.32, 0.27, 8),
    new THREE.MeshStandardMaterial({ color: 0xd5ae58, flatShading: true, roughness: 0.7 }),
  );
  shade.position.set(1.12, 1.72, -0.98);
  const bulb = new THREE.Mesh(
    new THREE.CircleGeometry(0.275, 8),
    new THREE.MeshBasicMaterial({ color: 0xffecc0, side: THREE.DoubleSide }),
  );
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(1.12, 1.582, -0.98);
  shade.castShadow = true;
  desktop.add(shade, bulb);
}

function addLooseComponents(desktop: THREE.Group): void {
  desktop.add(createBox([0.61, 0.045, 0.39], 0x397d57, [-1.65, 0.03, 1.2]));
  desktop.add(createBox([0.2, 0.07, 0.18], DARK_COLOR, [-1.69, 0.085, 1.2]));
  for (const x of [-1.85, -1.49]) {
    desktop.add(createBox([0.06, 0.065, 0.14], 0xc3ac65, [x, 0.065, 1.2]));
  }
  desktop.add(createRod([-0.95, 0.07, 1.1], [-0.52, 0.07, 1.26], 0.06, TOOL_COLOR));
  desktop.add(createRod([-0.52, 0.07, 1.26], [-0.12, 0.07, 1.41], 0.02, STEEL_COLOR));
  for (const side of [-1, 1]) {
    desktop.add(
      createRod([0.38, 0.055, 1.15], [0.38 + side * 0.13, 0.055, 1.47], 0.045, TOOL_COLOR),
    );
    desktop.add(
      createRod([0.38, 0.055, 1.15], [0.38 + side * 0.06, 0.055, 0.95], 0.025, STEEL_COLOR),
    );
  }
}

function addBitcoinTray(desktop: THREE.Group): void {
  const [x, y, z] = BITCOIN_TRAY_POSITION;
  const tray = new THREE.Group();
  tray.position.set(x, y - WORKBENCH_SURFACE_Y, z);
  tray.add(createBox([1.18, 0.07, 1.12], 0x495a52, [0, -0.035, 0], true));
  for (const side of [-1, 1]) {
    tray.add(createBox([1.18, 0.1, 0.035], 0x77867a, [0, 0.02, side * 0.54]));
    tray.add(createBox([0.035, 0.1, 1.12], 0x77867a, [side * 0.575, 0.02, 0]));
  }
  desktop.add(tray);
}
