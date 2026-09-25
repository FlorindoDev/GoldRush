import * as THREE from 'three';
import { GAME_BALANCE } from '../../../src/app/config/game-balance';
import { createBox, createRod } from './mesh-primitives';
import { addWorkbenchEquipment } from './workbench-equipment';
import { addWorkbenchFurniture } from './workbench-furniture';
import { WORKBENCH_COLORS } from './workbench-palette';

export const WORKBENCH_WIDTH = GAME_BALANCE.layout.workbench.width;
export const WORKBENCH_DEPTH = GAME_BALANCE.layout.workbench.depth;
export const WORKBENCH_SURFACE_Y = GAME_BALANCE.layout.workbench.surfaceY;
export const BITCOIN_TRAY_POSITION = GAME_BALANCE.layout.workbench.bitcoinTrayPosition;

export function createElectronicsWorkbench(): THREE.Group {
  const workbench = new THREE.Group();
  workbench.name = 'electronics-workbench';
  addWorkbenchFurniture(workbench);

  const desktop = createDesktop();
  addWorkbenchEquipment(desktop);
  addDesktopComponents(desktop);
  addBitcoinTray(desktop);
  workbench.add(desktop);

  return workbench;
}

function createDesktop(): THREE.Group {
  const desktop = new THREE.Group();
  desktop.position.y = WORKBENCH_SURFACE_Y;
  desktop.add(createBox([WORKBENCH_WIDTH, 0.2, WORKBENCH_DEPTH], 0xa87a4c, [0, -0.1, 0], true));
  desktop.add(createBox([3.65, 0.025, 2.05], 0x376963, [-0.35, 0.014, -0.02], true));
  return desktop;
}
function addDesktopComponents(desktop: THREE.Group): void {
  desktop.add(createBox([0.61, 0.045, 0.39], 0x397d57, [-1.65, 0.03, 1.2]));
  desktop.add(createBox([0.2, 0.07, 0.18], WORKBENCH_COLORS.dark, [-1.69, 0.085, 1.2]));
  for (const x of [-1.85, -1.49]) {
    desktop.add(createBox([0.06, 0.065, 0.14], 0xc3ac65, [x, 0.065, 1.2]));
  }
  desktop.add(createRod([-0.95, 0.07, 1.1], [-0.52, 0.07, 1.26], 0.06, WORKBENCH_COLORS.tool));
  desktop.add(createRod([-0.52, 0.07, 1.26], [-0.12, 0.07, 1.41], 0.02, WORKBENCH_COLORS.steel));
  for (const side of [-1, 1]) {
    desktop.add(
      createRod(
        [0.38, 0.055, 1.15],
        [0.38 + side * 0.13, 0.055, 1.47],
        0.045,
        WORKBENCH_COLORS.tool,
      ),
    );
    desktop.add(
      createRod(
        [0.38, 0.055, 1.15],
        [0.38 + side * 0.06, 0.055, 0.95],
        0.025,
        WORKBENCH_COLORS.steel,
      ),
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
