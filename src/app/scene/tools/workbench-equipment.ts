import * as THREE from 'three';
import {
  createBox,
  createCanvasTexture,
  createRod,
  GAME_FONT_FAMILY,
} from '../geometry/mesh-primitives';
import { WORKBENCH_COLORS } from './workbench-palette';

export function addWorkbenchEquipment(desktop: THREE.Group): void {
  addPegboard(desktop);
  addOscilloscope(desktop);
  addSolderingStation(desktop);
  addDeskLamp(desktop);
}
function addPegboard(desktop: THREE.Group): void {
  for (const x of [-2.23, 2.23]) {
    desktop.add(createBox([0.11, 1.4, 0.12], WORKBENCH_COLORS.frame, [x, 0.67, -1.65]));
  }
  desktop.add(createBox([4.46, 1.05, 0.1], 0x53635b, [0, 0.8, -1.65]));
  const texture = createCanvasTexture(512, 128, (context) => {
    context.fillStyle = '#53635b';
    context.fillRect(0, 0, 512, 128);
    context.fillStyle = '#263d37';
    for (let x = 12; x < 512; x += 20) {
      for (let y = 12; y < 128; y += 20) {
        context.beginPath();
        context.arc(x, y, 2.5, 0, Math.PI * 2);
        context.fill();
      }
    }
  });
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(4.35, 0.96),
    new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
  );
  face.position.set(0, 0.8, -1.595);
  desktop.add(face);
  for (const [index, x] of [-0.52, -0.22, 0.08].entries()) {
    const top = 1.14 - index * 0.05;
    desktop.add(createRod([x, top, -1.47], [x, top - 0.25, -1.47], 0.055, WORKBENCH_COLORS.tool));
    desktop.add(
      createRod([x, top - 0.25, -1.47], [x, top - 0.52, -1.47], 0.022, WORKBENCH_COLORS.steel),
    );
  }
  desktop.add(createBox([1.03, 0.12, 0.37], WORKBENCH_COLORS.frame, [1.17, 0.39, -1.44]));
  for (const x of [0.87, 1.19, 1.51]) {
    desktop.add(createBox([0.26, 0.17, 0.29], 0x7c9b9a, [x, 0.53, -1.45]));
    desktop.add(createBox([0.18, 0.015, 0.2], WORKBENCH_COLORS.dark, [x, 0.62, -1.43]));
  }
}

function addOscilloscope(desktop: THREE.Group): void {
  const scope = new THREE.Group();
  scope.position.set(-1.34, 0.22, -1.09);
  desktop.add(createBox([1.6, 0.06, 0.85], WORKBENCH_COLORS.frame, [-1.34, 0.19, -1.09]));
  for (const x of [-1.95, -0.73]) {
    desktop.add(createBox([0.08, 0.16, 0.7], WORKBENCH_COLORS.frame, [x, 0.08, -1.09]));
  }
  scope.add(createBox([1.4, 0.69, 0.72], 0xa6b5ab, [0, 0.415, 0], true));
  scope.add(createBox([1.27, 0.56, 0.04], 0x697e73, [0, 0.415, 0.374], true));
  scope.add(createBox([0.85, 0.48, 0.035], WORKBENCH_COLORS.dark, [-0.16, 0.43, 0.4], true));
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.73, 0.36),
    new THREE.MeshBasicMaterial({ map: createOscilloscopeTexture() }),
  );
  screen.position.set(-0.16, 0.43, 0.42);
  scope.add(screen);
  for (const y of [0.3, 0.55]) {
    scope.add(createRod([0.48, y, 0.39], [0.48, y, 0.48], 0.071, WORKBENCH_COLORS.dark));
  }
  for (const x of [-0.5, 0.5]) {
    scope.add(createBox([0.2, 0.08, 0.52], WORKBENCH_COLORS.dark, [x, 0.04, 0]));
  }
  scope.add(createBox([0.7, 0.065, 0.08], WORKBENCH_COLORS.dark, [0, 0.83, 0]));
  for (const x of [-0.31, 0.31]) {
    scope.add(createBox([0.06, 0.12, 0.08], WORKBENCH_COLORS.dark, [x, 0.77, 0]));
  }
  desktop.add(scope);
}

function createOscilloscopeTexture(): THREE.CanvasTexture {
  const screenFont = `12px ${GAME_FONT_FAMILY}`;
  return createCanvasTexture(
    256,
    128,
    (context) => {
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
      context.font = screenFont;
      context.fillText('CH1  2.0V', 12, 16);
    },
    screenFont,
  );
}

function addSolderingStation(desktop: THREE.Group): void {
  const station = new THREE.Group();
  station.position.set(1.63, 0, -0.66);
  station.add(createBox([0.62, 0.3, 0.65], 0x415c63, [0, 0.17, 0], true));
  station.add(createBox([0.3, 0.11, 0.016], WORKBENCH_COLORS.dark, [-0.09, 0.23, 0.335]));
  const indicator = createBox([0.21, 0.025, 0.02], 0xb8f575, [-0.09, 0.235, 0.35]);
  indicator.material.emissive.set(0xb8f575);
  indicator.material.emissiveIntensity = 0.5;
  station.add(indicator);
  station.add(createRod([0.19, 0.15, 0.32], [0.19, 0.15, 0.4], 0.065, WORKBENCH_COLORS.dark));
  station.add(createBox([0.32, 0.045, 0.59], WORKBENCH_COLORS.dark, [-0.62, 0.04, 0.02], true));
  station.add(createRod([-0.62, 0.075, -0.08], [-0.62, 0.32, -0.13], 0.07, WORKBENCH_COLORS.steel));
  station.add(createRod([-0.62, 0.09, 0.18], [-0.62, 0.35, -0.18], 0.025, WORKBENCH_COLORS.steel));
  station.add(createRod([-0.62, 0.35, -0.18], [-0.62, 0.53, -0.43], 0.065, WORKBENCH_COLORS.tool));
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
      new THREE.MeshStandardMaterial({ color: WORKBENCH_COLORS.dark, roughness: 0.9 }),
    ),
  );
  desktop.add(station);
}

function addDeskLamp(desktop: THREE.Group): void {
  desktop.add(createBox([0.38, 0.07, 0.35], WORKBENCH_COLORS.dark, [2.14, 0.04, -1.3], true));
  desktop.add(createRod([2.14, 0.08, -1.3], [2.23, 1.5, -1.3], 0.045, WORKBENCH_COLORS.frame));
  desktop.add(createRod([2.23, 1.5, -1.3], [1.12, 1.85, -0.98], 0.045, WORKBENCH_COLORS.frame));
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
