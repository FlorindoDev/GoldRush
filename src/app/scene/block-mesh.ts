import * as THREE from 'three';
import {
  BITCOIN_TRAY_POSITION,
  createElectronicsWorkbench,
  WORKBENCH_DEPTH,
  WORKBENCH_SURFACE_Y,
  WORKBENCH_WIDTH,
} from './electronics-workbench';
import { createBox } from './mesh-primitives';

export interface BlockMesh {
  root: THREE.Group;
  gpuMount: THREE.Group;
  outline: THREE.LineSegments;
  ore: THREE.Group;
  beam: THREE.Mesh;
  light: THREE.PointLight;
}

function createLabelTexture(text: string, color = '#b8f575'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#202c25';
  context.fillRect(0, 0, 512, 128);
  context.fillStyle = color;
  context.font = 'bold 52px monospace';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 256, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createBlock(id: number): BlockMesh {
  const root = new THREE.Group();
  root.userData['blockId'] = id;

  root.add(createElectronicsWorkbench(), createBlockLabel(id));

  const gpuMount = addGpuMount(root);
  const ore = new THREE.Group();
  ore.position.set(...BITCOIN_TRAY_POSITION);
  const beam = createMiningBeam();
  const light = new THREE.PointLight(0xb2ff77, 0, 7);
  light.position.set(0, WORKBENCH_SURFACE_Y + 1.2, 0);
  const outline = createSelectionOutline();
  root.add(ore, beam, light, outline);
  return { root, gpuMount, outline, ore, beam, light };
}

function createBlockLabel(id: number): THREE.Mesh {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.23),
    new THREE.MeshBasicMaterial({ map: createLabelTexture(`BANCO 00${id}`) }),
  );
  plate.position.set(0.15, WORKBENCH_SURFACE_Y - 0.34, WORKBENCH_DEPTH / 2 - 0.19);
  return plate;
}

function addGpuMount(root: THREE.Group): THREE.Group {
  const gpuMount = new THREE.Group();
  gpuMount.position.set(-0.55, WORKBENCH_SURFACE_Y + 0.11, 0.14);
  gpuMount.rotation.y = -0.12;
  root.add(gpuMount);
  const gpuStand = createBox(
    [2.55, 0.08, 1.4],
    0x1b2824,
    [-0.55, WORKBENCH_SURFACE_Y + 0.07, 0.14],
    true,
  );
  gpuStand.rotation.y = gpuMount.rotation.y;
  root.add(gpuStand);
  return gpuMount;
}

function createMiningBeam(): THREE.Mesh {
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 1.0, 3.2, 6, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xb8f575,
      transparent: true,
      opacity: 0.055,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.set(0, WORKBENCH_SURFACE_Y + 1.65, 0);
  beam.visible = false;
  return beam;
}

function createSelectionOutline(): THREE.LineSegments {
  const outlineGeometry = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(WORKBENCH_WIDTH + 0.06, 0.025, WORKBENCH_DEPTH + 0.06),
  );
  const outline = new THREE.LineSegments(
    outlineGeometry,
    new THREE.LineBasicMaterial({ color: 0xb8f575, transparent: true, opacity: 0.8 }),
  );
  outline.position.y = WORKBENCH_SURFACE_Y + 0.015;
  return outline;
}

export function createFallbackGpu(width: number): THREE.Group {
  const gpu = new THREE.Group();
  gpu.scale.setScalar(width / 3);
  gpu.add(createBox([3.0, 0.35, 1.45], 0x232b29, [0, 0.25, 0], true));
  gpu.add(createBox([2.8, 0.07, 1.52], 0xa5d877, [0, 0.08, 0]));
  for (const fanX of [-0.75, 0.75]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x101715 }),
    );
    rim.position.set(fanX, 0.46, 0);
    gpu.add(rim);
    for (let bladeIndex = 0; bladeIndex < 8; bladeIndex++) {
      const angle = (bladeIndex * Math.PI) / 4;
      const blade = createBox([0.42, 0.05, 0.15], 0x68736e, [
        fanX + Math.cos(angle) * 0.24,
        0.52,
        Math.sin(angle) * 0.24,
      ]);
      blade.rotation.y = -angle + 0.4;
      gpu.add(blade);
    }
  }
  return gpu;
}

export function createLockedTile(): THREE.Group {
  const group = new THREE.Group();
  const geometry = new THREE.EdgesGeometry(
    new THREE.BoxGeometry(WORKBENCH_WIDTH, 0.06, WORKBENCH_DEPTH),
  );
  const edges = new THREE.LineSegments(
    geometry,
    new THREE.LineDashedMaterial({
      color: 0x597363,
      dashSize: 0.13,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.24,
    }),
  );
  edges.computeLineDistances();
  group.add(edges);
  const lock = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.035, 4, 8, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x45594c }),
  );
  lock.rotation.x = -Math.PI / 2;
  lock.position.z = -0.12;
  const body = createBox([0.42, 0.035, 0.3], 0x38493f, [0, 0, 0.1]);
  group.add(lock, body);
  return group;
}
