import * as THREE from 'three';
import { plotIdForRig, RIGS_PER_PLOT } from '../../game/mining-world';

const RIG_COLUMN_SPACING = 6.8;
const RIG_ROW_SPACING = 5.6;
export const PLOT_GRID_COLUMNS = 3;
export const PLOT_GAP = 2.4;

export const RIG_PLOT_WIDTH = 14.2;
export const RIG_PLOT_DEPTH = 17.2;
export const PLOT_SPACING_X = RIG_PLOT_WIDTH + PLOT_GAP;
export const PLOT_SPACING_Z = RIG_PLOT_DEPTH + PLOT_GAP;
export const TOOL_AREA_WIDTH = 16;
export const TOOL_AREA_DEPTH = 18;
export const TOOL_AREA_POSITION = new THREE.Vector3(50.5, 0, -25.2);

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
  return new THREE.Vector3(column * PLOT_SPACING_X, 0, -RIG_ROW_SPACING - row * PLOT_SPACING_Z);
}
