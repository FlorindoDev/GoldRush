import { describe, expect, it } from 'vitest';
import {
  PLOT_GAP,
  PLOT_GRID_COLUMNS,
  PLOT_SPACING_X,
  PLOT_SPACING_Z,
  RIG_PLOT_DEPTH,
  RIG_PLOT_WIDTH,
  TOOL_AREA_POSITION,
  TOOL_AREA_WIDTH,
  rigPlotCenter,
  rigPosition,
} from '../scene-layout';

describe('scene plot layout', () => {
  it('spaces plots in a three-by-three grid to the left of the tools', () => {
    const positions = Array.from({ length: 9 }, (_, index) => rigPlotCenter(index + 1));
    const firstPlot = positions[0];
    const rightmostPlotEdge = positions[2].x + RIG_PLOT_WIDTH / 2;
    const toolAreaLeftEdge = TOOL_AREA_POSITION.x - TOOL_AREA_WIDTH / 2;

    expect(PLOT_GRID_COLUMNS).toBe(3);
    expect(PLOT_GAP).toBeGreaterThanOrEqual(5);
    expect(PLOT_SPACING_X - RIG_PLOT_WIDTH).toBeCloseTo(PLOT_GAP);
    expect(PLOT_SPACING_Z - RIG_PLOT_DEPTH).toBeCloseTo(PLOT_GAP);
    expect(firstPlot.x).toBeLessThan(0);
    expect(toolAreaLeftEdge - rightmostPlotEdge).toBeGreaterThanOrEqual(5);
    for (let index = 0; index < positions.length; index++) {
      const row = Math.floor(index / PLOT_GRID_COLUMNS);
      const column = index % PLOT_GRID_COLUMNS;
      expect(positions[index].x).toBeCloseTo(firstPlot.x + column * PLOT_SPACING_X);
      expect(positions[index].z).toBeCloseTo(positions[0].z - row * PLOT_SPACING_Z);
    }
  });

  it('keeps all six rigs inside their plot and starts later plots on the next grid row', () => {
    const firstPlot = rigPlotCenter(1);
    const nextGridRow = rigPlotCenter(10);

    expect(nextGridRow.x).toBeCloseTo(firstPlot.x);
    expect(nextGridRow.z).toBeCloseTo(firstPlot.z - PLOT_SPACING_Z * 3);
    for (let rigId = 1; rigId <= 6; rigId++) {
      const position = rigPosition(rigId);
      expect(Math.abs(position.x - firstPlot.x)).toBeLessThan(RIG_PLOT_WIDTH / 2);
      expect(Math.abs(position.z - firstPlot.z)).toBeLessThan(RIG_PLOT_DEPTH / 2);
    }
  });
});
