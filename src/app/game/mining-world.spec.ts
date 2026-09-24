import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from '../config/game-balance';
import {
  BLOCK_REWARD,
  canExpand,
  countUnlockedGpus,
  createWorld,
  expandWorld,
  GPU_COUNT,
  GPUS_PER_RIG,
  isGpuUnlocked,
  mineGpu,
  MINE_PROGRESS_PER_GPU,
  PLOT_COUNT,
  plotCount,
  plotIdForGpu,
  plotIdForRig,
  rigCount,
  rigIdForGpu,
  RIGS_PER_PLOT,
  RIG_COUNT,
  STARTING_GPU_COUNT,
} from './mining-world';

const MINES_PER_BLOCK = Math.ceil(100 / MINE_PROGRESS_PER_GPU);

describe('Mining world', () => {
  it('starts with the configured farm capacity and unlocked hardware', () => {
    const world = createWorld();
    expect(world.blocks).toEqual([{ id: 1, progress: 0 }]);
    expect(world.selectedId).toBe(1);
    expect(world.satoshis).toBe(0);
    expect(world.plots).toHaveLength(PLOT_COUNT);
    expect(PLOT_COUNT).toBe(GAME_BALANCE.world.plotCount);
    expect(RIGS_PER_PLOT).toBe(GAME_BALANCE.world.rigsPerPlot);
    expect(GPUS_PER_RIG).toBe(GAME_BALANCE.world.gpusPerRig);
    expect(world.plots.every((plot) => plot.rigs.length === RIGS_PER_PLOT)).toBe(true);
    expect(
      world.plots.every((plot) => plot.rigs.every((rig) => rig.gpus.length === GPUS_PER_RIG)),
    ).toBe(true);
    expect(GPU_COUNT).toBe(PLOT_COUNT * RIGS_PER_PLOT * GPUS_PER_RIG);
    expect(countUnlockedGpus(world)).toBe(STARTING_GPU_COUNT);
    expect(isGpuUnlocked(world, 1)).toBe(true);
    if (STARTING_GPU_COUNT < GPU_COUNT) {
      expect(isGpuUnlocked(world, STARTING_GPU_COUNT + 1)).toBe(false);
    }
    expect(canExpand(world)).toBe(false);
  });

  it('awards a block exactly once, and never before completion', () => {
    let world = createWorld();
    world = mineGpu(world, 1);
    expect(world.satoshis).toBe(0);
    expect(world.blocks[0].progress).toBeCloseTo(MINE_PROGRESS_PER_GPU);
    for (let call = 1; call < MINES_PER_BLOCK; call++) {
      world = mineGpu(world, 1);
    }
    expect(world.blocks[0].progress).toBe(100);
    expect(world.satoshis).toBe(BLOCK_REWARD);
    expect(() => mineGpu(world, 1)).toThrow('completato');
  });

  it('adds blocks without changing the fixed farm', () => {
    let world = createWorld();
    expect(expandWorld(world)).toBe(world);
    for (let id = 1; id <= 12; id++) {
      for (let step = 0; step < MINES_PER_BLOCK; step++) {
        world = mineGpu(world, 1);
      }
      expect(world.selectedId).toBe(id);
      expect(canExpand(world)).toBe(true);
      world = expandWorld(world);
      expect(world.blocks[id]).toEqual({ id: id + 1, progress: 0 });
      expect(world.selectedId).toBe(id + 1);
      expect(expandWorld(world)).toBe(world);
    }
    expect(world.blocks).toHaveLength(13);
    expect(rigCount(world)).toBe(RIG_COUNT);
    expect(plotCount(world)).toBe(PLOT_COUNT);
    expect(world.satoshis).toBe(BLOCK_REWARD * 12);
    expect(canExpand(world)).toBe(false);
    expect(expandWorld(world)).toBe(world);
  });

  it('keeps all rigs and GPUs when a new block is added', () => {
    expect(rigCount(createWorld())).toBe(RIG_COUNT);
    expect([1, GPUS_PER_RIG, GPUS_PER_RIG + 1, GPUS_PER_RIG * 2].map(rigIdForGpu)).toEqual([
      1, 1, 2, 2,
    ]);
    const fullRig = {
      ...createWorld(),
      blocks: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, progress: 100 })),
      selectedId: 4,
    };
    expect(rigCount(fullRig)).toBe(RIG_COUNT);
    const nextRig = expandWorld(fullRig);
    expect(rigCount(nextRig)).toBe(RIG_COUNT);
    expect(nextRig.blocks[4]).toEqual({ id: 5, progress: 0 });
    expect(fullRig.blocks).toHaveLength(4);
  });

  it('groups configured rigs and GPUs into matching plots', () => {
    const gpusPerPlot = RIGS_PER_PLOT * GPUS_PER_RIG;
    expect([1, RIGS_PER_PLOT, RIGS_PER_PLOT + 1].map(plotIdForRig)).toEqual([1, 1, 2]);
    expect([1, gpusPerPlot, gpusPerPlot + 1].map(plotIdForGpu)).toEqual([1, 1, 2]);
    const world = createWorld();
    expect(plotCount(world)).toBe(PLOT_COUNT);
    expect(plotIdForGpu(GPU_COUNT)).toBe(PLOT_COUNT);
  });

  it('does not mutate a previous world snapshot', () => {
    const original = createWorld();
    const next = mineGpu(original, 1);
    expect(original.blocks[0].progress).toBe(0);
    expect(next.blocks[0].progress).toBeCloseTo(MINE_PROGRESS_PER_GPU);
  });
});
