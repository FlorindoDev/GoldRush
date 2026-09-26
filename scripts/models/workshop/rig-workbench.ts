import * as THREE from 'three';
import { materials as m, group, box, cylinder, bolt, pipe } from '../primitives.mjs';
import { COIN_MODELS, createCoin } from '../coins.mjs';
import { createFan, FAN_MODELS } from '../fans.mjs';
import { createCanvasTexture, createLabelTexture } from './mesh-primitives';

const WIDTH = 6.12;
const DEPTH = 4.38;
const SURFACE_Y = 1.18;

/** Low service stand sized for an assembled four-GPU mining rig. */
export function createRigWorkbench(): THREE.Group {
  const root = group('rig-workbench');
  addFrame(root);
  addSurface(root);
  addServicePanel(root);
  addToolTrays(root);
  addTaskLight(root);
  addRigMount(root);
  return root;
}

function addFrame(root: THREE.Group): void {
  for (const x of [-2.82, 2.82]) {
    for (const z of [-1.96, 1.96]) {
      box(root, [0.16, 1.08, 0.16], m.frame, [x, 0.58, z]);
      box(root, [0.28, 0.1, 0.28], m.black, [x, 0.05, z]);
      box(root, [0.21, 0.11, 0.21], m.steel, [x, 1.13, z]);
      bolt(root, [x, 1.02, z + 0.09]);
    }
  }
  for (const y of [0.26, 0.78]) {
    for (const z of [-1.96, 1.96]) {
      box(root, [5.64, 0.12, 0.14], m.frame, [0, y, z]);
    }
    for (const x of [-2.82, 2.82]) {
      box(root, [0.14, 0.12, 3.92], m.frame, [x, y, 0]);
    }
  }
  box(root, [5.58, 0.08, 3.9], m.steel, [0, 0.32, 0]);
  box(root, [5.36, 0.025, 3.65], m.black, [0, 0.373, 0]);
  for (const x of [-2.08, 2.08]) {
    box(root, [1.3, 0.62, 1.08], m.frame, [x, 0.76, 1.27]);
    for (const y of [0.65, 0.91]) {
      box(root, [1.18, 0.2, 0.045], m.black, [x, y, 1.83]);
      box(root, [0.42, 0.035, 0.065], m.steel, [x, y + 0.025, 1.875]);
    }
  }
  for (const x of [-0.6, 0.6]) {
    box(root, [0.95, 0.43, 0.72], m.frame, [x, 0.61, -0.95]);
    box(root, [0.73, 0.03, 0.045], m.orange, [x, 0.7, -0.57]);
  }
  pipe(
    root,
    [
      [-2.78, 0.3, -1.9],
      [-1.9, 0.7, 0],
      [-2.78, 0.3, 1.9],
    ],
    0.035,
    m.steel,
  );
  pipe(
    root,
    [
      [2.78, 0.3, -1.9],
      [1.9, 0.7, 0],
      [2.78, 0.3, 1.9],
    ],
    0.035,
    m.steel,
  );
  box(root, [5.7, 0.08, 4.02], m.black, [0, 1.12, 0]);
}

function addSurface(root: THREE.Group): void {
  box(root, [WIDTH, 0.14, DEPTH], m.frame, [0, SURFACE_Y, 0]);
  box(root, [5.75, 0.035, 4.02], m.steel, [0, 1.267, 0]);
  box(root, [5.05, 0.045, 3.34], m.pcb, [0, 1.308, -0.03]);
  for (const x of [-2.38, 2.38]) {
    box(root, [0.035, 0.018, 3.38], m.lime, [x, 1.34, -0.03]);
  }
  for (const z of [-1.64, 1.58]) {
    box(root, [4.8, 0.018, 0.035], m.lime, [0, 1.34, z]);
  }
  for (const x of [-2.8, 2.8]) {
    for (const z of [-1.98, 1.98]) {
      cylinder(root, 0.075, 0.035, m.orange, [x, 1.35, z], 8);
    }
  }
  for (const x of [-2.65, 2.65]) {
    for (const z of [-0.9, 0.65]) {
      box(root, [0.32, 0.075, 0.54], m.black, [x, 1.38, z]);
      box(root, [0.12, 0.14, 0.08], m.steel, [x, 1.48, z - 0.18]);
      bolt(root, [x, 1.45, z + 0.18], 0.04);
    }
  }
  box(root, [2.2, 0.31, 0.08], m.black, [0, 1.03, 2.18]);
  for (const x of [-0.88, -0.48, -0.08, 0.32]) {
    box(root, [0.21, 0.09, 0.015], m.steel, [x, 1.03, 2.225]);
    box(root, [0.12, 0.048, 0.017], m.black, [x, 1.03, 2.236]);
  }
  for (const x of [0.68, 0.84, 1]) {
    box(root, [0.07, 0.055, 0.017], m.lime, [x, 1.03, 2.23]);
  }
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.22),
    new THREE.MeshBasicMaterial({ map: createLabelTexture('RIG SERVICE') }),
  );
  label.position.set(0, 0.73, 2.16);
  root.add(label);
}

function addServicePanel(root: THREE.Group): void {
  for (const x of [-2.83, 2.83]) {
    box(root, [0.1, 1.15, 0.13], m.frame, [x, 1.87, -2.05]);
    box(root, [0.12, 0.96, 0.15], m.steel, [x, 2.91, -2.05]);
    box(root, [0.2, 0.16, 0.22], m.orange, [x, 3.38, -2.05]);
    bolt(root, [x, 1.43, -1.97]);
  }
  box(root, [5.72, 0.16, 0.19], m.frame, [0, 3.37, -2.05]);
  box(root, [5.22, 0.035, 0.07], m.lime, [0, 3.27, -1.99]);
  for (const x of [-2.43, 2.43]) {
    box(root, [0.18, 0.19, 0.09], m.orange, [x, 3.37, -1.93]);
  }
  box(root, [1.55, 0.34, 0.05], m.black, [0, 3.37, -1.936]);
  const overheadLabel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.42, 0.27),
    new THREE.MeshBasicMaterial({ map: createLabelTexture('RIG LAB') }),
  );
  overheadLabel.position.set(0, 3.37, -1.9);
  root.add(overheadLabel);
  box(root, [5.72, 0.84, 0.11], m.frame, [0, 2.02, -2.05]);
  box(root, [5.46, 0.68, 0.018], m.black, [0, 2.02, -1.985]);
  for (const y of [1.78, 1.92, 2.06, 2.2]) {
    for (const x of [-2.48, -2.27, -2.06, -1.85, -1.64, -1.43, -1.22, -1.01]) {
      cylinder(root, 0.019, 0.024, m.steel, [x, y, -1.965], 6).rotation.x = Math.PI / 2;
    }
  }
  for (const x of [-2.35, -1.86, -1.37]) {
    box(root, [0.05, 0.3, 0.07], m.steel, [x, 2.02, -1.9]);
    box(root, [0.17, 0.06, 0.07], m.orange, [x, 1.85, -1.9]);
  }
  box(root, [1.53, 0.65, 0.035], m.steel, [1.64, 2.02, -1.943]);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(1.39, 0.53),
    new THREE.MeshBasicMaterial({ map: createDisplayTexture() }),
  );
  display.position.set(1.64, 2.02, -1.921);
  root.add(display);
  for (const x of [-0.48, -0.26, -0.04, 0.18]) {
    box(root, [0.11, 0.085, 0.075], m.orange, [x, 2.18, -1.92]);
    box(root, [0.075, 0.24, 0.035], m.steel, [x, 1.99, -1.91]);
  }
  pipe(
    root,
    [
      [2.73, 1.52, -2.06],
      [2.68, 1.11, -2.24],
      [2.18, 0.9, -2.16],
      [1.7, 0.88, -1.89],
    ],
    0.03,
    m.black,
  );
}

function createDisplayTexture(): THREE.CanvasTexture {
  return createCanvasTexture(256, 128, (context) => {
    context.fillStyle = '#102821';
    context.fillRect(0, 0, 256, 128);
    context.strokeStyle = '#315b47';
    context.lineWidth = 1;
    for (let x = 12; x < 256; x += 24) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, 128);
      context.stroke();
    }
    context.strokeStyle = '#b8f575';
    context.lineWidth = 4;
    context.beginPath();
    for (let x = 8; x < 248; x += 3) {
      const y = 64 - Math.sin(x * 0.06) * 22 - Math.sin(x * 0.17) * 7;
      if (x === 8) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.fillStyle = '#ec9450';
    for (const [index, height] of [24, 41, 31, 50].entries()) {
      context.fillRect(18 + index * 18, 113 - height, 9, height);
    }
  });
}

function addToolTrays(root: THREE.Group): void {
  for (const x of [-2.2, 2.2]) {
    box(root, [0.72, 0.13, 0.62], m.black, [x, 1.39, 1.72]);
    for (const z of [1.42, 2.02]) {
      box(root, [0.72, 0.13, 0.045], m.steel, [x, 1.47, z]);
    }
    for (const side of [-1, 1]) {
      box(root, [0.045, 0.13, 0.62], m.steel, [x + side * 0.34, 1.47, 1.72]);
    }
  }
  const fanRack = group('spare-fan-rack', [-2.2, 1.54, 1.69]);
  const fan = createFan(FAN_MODELS[0]);
  fan.name = 'spare-fan-airflow-120';
  fan.scale.setScalar(0.4);
  fan.rotation.x = -Math.PI / 2;
  fan.position.y = -0.05;
  fanRack.add(fan);
  root.add(fanRack);

  const coinTray = group('ethereum-coin-tray', [2.2, 1.48, 1.7]);
  box(coinTray, [0.58, 0.08, 0.48], m.black, [0, 0, 0]);
  for (const z of [-0.22, 0.22]) {
    box(coinTray, [0.58, 0.1, 0.035], m.steel, [0, 0.06, z]);
  }
  for (const x of [-0.27, 0.27]) {
    box(coinTray, [0.035, 0.1, 0.48], m.steel, [x, 0.06, 0]);
  }
  addEthereumStack(coinTray);
  root.add(coinTray);
  box(root, [1.55, 0.46, 0.42], m.frame, [0, 0.83, -2.05]);
  box(root, [0.96, 0.08, 0.06], m.orange, [0, 0.84, -1.82]);
  for (const x of [-0.56, 0, 0.56]) {
    box(root, [0.12, 0.08, 0.04], m.lime, [x, 0.96, -1.82]);
  }
}

function addEthereumStack(target: THREE.Group): void {
  const spec = COIN_MODELS.find((coin) => coin.id === 'ethereum-classic');
  if (!spec) {
    throw new Error('Modello Ethereum Classic non disponibile.');
  }
  const template = createCoin(spec, new THREE.Vector3(0.43, 0.43, 0.075));
  for (let index = 0; index < 5; index++) {
    const coin = template.clone(true);
    coin.rotation.x = -Math.PI / 2;
    coin.rotation.z = (index % 2) * 0.035;
    coin.position.set((index % 2) * 0.025, 0.08 + index * 0.073, 0);
    target.add(coin);
  }
}

function addTaskLight(root: THREE.Group): void {
  box(root, [0.34, 0.08, 0.34], m.black, [-2.66, 1.38, -1.78]);
  pipe(
    root,
    [
      [-2.66, 1.42, -1.78],
      [-2.68, 2.19, -1.78],
      [-2.46, 2.68, -1.69],
      [-2.08, 2.74, -1.42],
    ],
    0.047,
    m.steel,
  );
  for (const [x, y, z] of [
    [-2.68, 2.19, -1.78],
    [-2.46, 2.68, -1.69],
  ]) {
    cylinder(root, 0.09, 0.1, m.orange, [x, y, z], 10).rotation.z = Math.PI / 2;
  }
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.31, 0.27, 10), m.orange);
  shade.name = 'service-lamp-shade';
  shade.position.set(-2.08, 2.58, -1.42);
  shade.castShadow = true;
  root.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.CircleGeometry(0.25, 16),
    new THREE.MeshBasicMaterial({ color: 0xffedbd, side: THREE.DoubleSide }),
  );
  bulb.rotation.x = Math.PI / 2;
  bulb.position.set(-2.08, 2.43, -1.42);
  root.add(bulb);
}

function addRigMount(root: THREE.Group): void {
  const mount = group('rig-mount', [0, 1.36, -0.1]);
  mount.userData = { accepts: 'gpu-mining-rig', snap: true };
  root.add(mount);
}
