import { describe, expect, it } from 'vitest';
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
  STARTING_GPU_COUNT,
} from './mining-world';

describe('Mining world', () => {
  it('starts with a fixed farm of six plots, six rigs per plot, and four GPUs per rig', () => {
    const world = createWorld();
    expect(world.blocks).toEqual([{ id: 1, progress: 0 }]);
    expect(world.selectedId).toBe(1);
    expect(world.satoshis).toBe(0);
    expect(world.plots).toHaveLength(PLOT_COUNT);
    expect(PLOT_COUNT).toBe(6);
    expect(RIGS_PER_PLOT).toBe(6);
    expect(GPUS_PER_RIG).toBe(4);
    expect(world.plots.every((plot) => plot.rigs.length === RIGS_PER_PLOT)).toBe(true);
    expect(
      world.plots.every((plot) => plot.rigs.every((rig) => rig.gpus.length === GPUS_PER_RIG)),
    ).toBe(true);
    expect(GPU_COUNT).toBe(144);
    expect(STARTING_GPU_COUNT).toBe(1);
    expect(countUnlockedGpus(world)).toBe(1);
    expect(isGpuUnlocked(world, 1)).toBe(true);
    expect(isGpuUnlocked(world, 2)).toBe(false);
    expect(canExpand(world)).toBe(false);
  });

  it('awards a block exactly once, and never before completion', () => {
    let world = createWorld();
    world = mineGpu(world, 1);
    expect(world.satoshis).toBe(0);
    expect(world.blocks[0].progress).toBeCloseTo(MINE_PROGRESS_PER_GPU);
    for (let call = 1; call < 180; call++) {
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
      for (let step = 0; step < 180; step++) {
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
    expect(rigCount(world)).toBe(36);
    expect(plotCount(world)).toBe(6);
    expect(world.satoshis).toBe(BLOCK_REWARD * 12);
    expect(canExpand(world)).toBe(false);
    expect(expandWorld(world)).toBe(world);
  });

  it('keeps all rigs and GPUs when a new block is added', () => {
    expect(rigCount(createWorld())).toBe(36);
    expect([1, 4, 5, 8, 9, 100].map(rigIdForGpu)).toEqual([1, 1, 2, 2, 3, 25]);
    const fullRig = {
      ...createWorld(),
      blocks: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, progress: 100 })),
      selectedId: 4,
    };
    expect(rigCount(fullRig)).toBe(36);
    const nextRig = expandWorld(fullRig);
    expect(rigCount(nextRig)).toBe(36);
    expect(nextRig.blocks[4]).toEqual({ id: 5, progress: 0 });
    expect(fullRig.blocks).toHaveLength(4);
  });

  it('groups six rigs into each plot and places GPU IDs in the matching plot', () => {
    expect([1, 6, 7, 12, 13].map(plotIdForRig)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 24, 25, 48, 49].map(plotIdForGpu)).toEqual([1, 1, 2, 2, 3]);
    const world = createWorld();
    expect(plotCount(world)).toBe(PLOT_COUNT);
    expect([1, 24, 25, 48, 49, GPU_COUNT].map(plotIdForGpu)).toEqual([1, 1, 2, 2, 3, 6]);
  });

  it('does not mutate a previous world snapshot', () => {
    const original = createWorld();
    const next = mineGpu(original, 1);
    expect(original.blocks[0].progress).toBe(0);
    expect(next.blocks[0].progress).toBeCloseTo(MINE_PROGRESS_PER_GPU);
  });
});
