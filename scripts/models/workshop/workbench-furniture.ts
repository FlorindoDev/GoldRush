import * as THREE from 'three';
import { createBox } from './mesh-primitives';
import { WORKBENCH_COLORS } from './workbench-palette';

export function addWorkbenchFurniture(workbench: THREE.Group): void {
  addWorkbenchFrame(workbench);
  addDrawers(workbench);
}
function addWorkbenchFrame(workbench: THREE.Group): void {
  for (const x of [-2.22, 2.22]) {
    for (const z of [-1.52, 1.52]) {
      workbench.add(createBox([0.2, 2.04, 0.2], WORKBENCH_COLORS.frame, [x, 0.59, z]));
      workbench.add(createBox([0.32, 0.1, 0.32], WORKBENCH_COLORS.dark, [x, -0.45, z], true));
    }
    workbench.add(createBox([0.16, 0.15, 3.12], WORKBENCH_COLORS.frame, [x, 0.02, 0]));
    workbench.add(createBox([0.17, 0.25, 3.12], WORKBENCH_COLORS.frame, [x, 1.48, 0]));
  }
  workbench.add(createBox([4.5, 0.3, 0.12], WORKBENCH_COLORS.frame, [0, 1.46, 1.54]));
  workbench.add(createBox([4.5, 0.3, 0.12], WORKBENCH_COLORS.frame, [0, 1.46, -1.54]));
  workbench.add(createBox([4.5, 0.15, 0.15], WORKBENCH_COLORS.frame, [0, 0.02, -1.52]));
  workbench.add(createBox([4.35, 0.09, 0.65], 0x52625a, [0, 0.15, -1.2]));
  const storageBox = createBox([0.95, 0.48, 0.58], 0x8d7552, [0.7, 0.44, -1.2], true);
  workbench.add(storageBox, createBox([0.25, 0.15, 0.01], 0xc1b798, [0.7, 0.48, -0.904]));
}

function addDrawers(workbench: THREE.Group): void {
  workbench.add(createBox([1.1, 0.88, 2.55], WORKBENCH_COLORS.dark, [-1.52, 1.12, 0], true));
  for (const y of [0.83, 1.1, 1.37]) {
    workbench.add(createBox([1.02, 0.23, 0.07], 0x557269, [-1.52, y, 1.31], true));
    workbench.add(
      createBox([0.42, 0.045, 0.085], WORKBENCH_COLORS.steel, [-1.52, y + 0.02, 1.39], true),
    );
  }
}
