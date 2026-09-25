import * as THREE from 'three';
import {
  BITCOIN_TRAY_POSITION,
  createElectronicsWorkbench,
  WORKBENCH_DEPTH,
  WORKBENCH_SURFACE_Y,
  WORKBENCH_WIDTH,
} from './electronics-workbench';
import { createBox, createLabelTexture } from './mesh-primitives';

export interface WorkbenchMesh {
  readonly root: THREE.Group;
  readonly gpuMount: THREE.Group;
  readonly outline: THREE.LineSegments;
  readonly ore: THREE.Group;
  readonly beam: THREE.Mesh;
  readonly light: THREE.PointLight;
}

export function createWorkbench(): WorkbenchMesh {
  const workbench = new THREE.Group();
  workbench.name = 'workbench';

  workbench.add(createElectronicsWorkbench(), createWorkbenchLabel());

  const gpuMount = addGpuMount(workbench);
  const ore = new THREE.Group();
  ore.position.set(...BITCOIN_TRAY_POSITION);
  const beam = createMiningBeam();
  const light = new THREE.PointLight(0xb2ff77, 0, 7);
  light.position.set(0, WORKBENCH_SURFACE_Y + 1.2, 0);
  const outline = createSelectionOutline();
  workbench.add(ore, beam, light, outline);
  return { root: workbench, gpuMount, outline, ore, beam, light };
}

function createWorkbenchLabel(): THREE.Mesh {
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(1.16, 0.23),
    new THREE.MeshBasicMaterial({ map: createLabelTexture('WORKBENCH') }),
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
  const box = new THREE.BoxGeometry(WORKBENCH_WIDTH + 0.06, 0.025, WORKBENCH_DEPTH + 0.06);
  const outlineGeometry = new THREE.EdgesGeometry(box);
  box.dispose();
  const outline = new THREE.LineSegments(
    outlineGeometry,
    new THREE.LineBasicMaterial({ color: 0xb8f575, transparent: true, opacity: 0.8 }),
  );
  outline.position.y = WORKBENCH_SURFACE_Y + 0.015;
  outline.visible = false;
  return outline;
}
