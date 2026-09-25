import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
import { plotIdForRig, RIGS_PER_PLOT } from '../../game/mining-world';

const PLOTS = GAME_BALANCE.layout.plots;
const RIG_COLUMN_SPACING = PLOTS.rigColumnSpacing;
const RIG_ROW_SPACING = PLOTS.rigRowSpacing;
const PLOT_GRID_ORIGIN_X = PLOTS.gridOriginX;
export const PLOT_GRID_COLUMNS = PLOTS.gridColumns;
export const PLOT_GAP = PLOTS.gap;

export const RIG_PLOT_WIDTH = PLOTS.width;
export const RIG_PLOT_DEPTH = PLOTS.depth;
export const PLOT_SPACING_X = RIG_PLOT_WIDTH + PLOT_GAP;
export const PLOT_SPACING_Z = RIG_PLOT_DEPTH + PLOT_GAP;
export const TOOL_AREA_WIDTH = GAME_BALANCE.layout.toolArea.width;
export const TOOL_AREA_DEPTH = GAME_BALANCE.layout.toolArea.depth;
export const TOOL_AREA_POSITION = new THREE.Vector3(...GAME_BALANCE.layout.toolArea.position);
TOOL_AREA_POSITION.x = Math.max(
  TOOL_AREA_POSITION.x,
  PLOT_GRID_ORIGIN_X +
    (PLOT_GRID_COLUMNS - 1) * PLOT_SPACING_X +
    RIG_PLOT_WIDTH / 2 +
    PLOT_GAP +
    TOOL_AREA_WIDTH / 2,
);
export const RIG_SLOT_WIDTH = PLOTS.rigSlotWidth;
export const RIG_SLOT_DEPTH = PLOTS.rigSlotDepth;

/** Center the full assembly, including asymmetric external cooling, inside its slot. */
export function fitRigInSlot(model: THREE.Group): void {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(1, (RIG_SLOT_WIDTH - 0.4) / size.x, (RIG_SLOT_DEPTH - 0.4) / size.z);
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);
  bounds.setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y + 0.4, center.z));
  model.updateMatrixWorld(true);
}

export function rigPosition(rigId: number): THREE.Vector3 {
  const plotId = plotIdForRig(rigId);
  const indexWithinPlot = (rigId - 1) % RIGS_PER_PLOT;
  const plotCenter = rigPlotCenter(plotId);
  return new THREE.Vector3(
    plotCenter.x + RIG_COLUMN_SPACING / 2 - (indexWithinPlot % 2) * RIG_COLUMN_SPACING,
    0,
    plotCenter.z + RIG_ROW_SPACING - Math.floor(indexWithinPlot / 2) * RIG_ROW_SPACING,
  );
}

export function rigPlotCenter(plotId: number): THREE.Vector3 {
  const index = plotId - 1;
  const column = index % PLOT_GRID_COLUMNS;
  const row = Math.floor(index / PLOT_GRID_COLUMNS);
  return new THREE.Vector3(
    PLOT_GRID_ORIGIN_X + column * PLOT_SPACING_X,
    0,
    -RIG_ROW_SPACING - row * PLOT_SPACING_Z,
  );
}
