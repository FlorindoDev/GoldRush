import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';

const WORKBENCH_WIDTH = GAME_BALANCE.layout.workbench.width;
const WORKBENCH_DEPTH = GAME_BALANCE.layout.workbench.depth;
const WORKBENCH_SURFACE_Y = GAME_BALANCE.layout.workbench.surfaceY;

export interface WorkbenchMesh {
  readonly root: THREE.Group;
  readonly gpuMount: THREE.Group;
  readonly outline: THREE.LineSegments;
  readonly ore: THREE.Group;
  readonly beam: THREE.Mesh;
  readonly light: THREE.PointLight;
}

export function createWorkbench(workbench: THREE.Group): WorkbenchMesh {
  workbench.name = 'workbench';

  const gpuMount = workbench.getObjectByName('gpu-mount') as THREE.Group;
  const ore = workbench.getObjectByName('coin-tray-mount') as THREE.Group;
  if (!gpuMount || !ore) {
    throw new Error('Banco GLB privo dei punti di montaggio.');
  }
  const beam = createMiningBeam();
  const light = new THREE.PointLight(0xb2ff77, 0, 7);
  light.position.set(0, WORKBENCH_SURFACE_Y + 1.2, 0);
  const outline = createSelectionOutline();
  workbench.add(beam, light, outline);
  return { root: workbench, gpuMount, outline, ore, beam, light };
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
