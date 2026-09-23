import { describe, expect, it } from 'vitest';
import {
  BLOCK_REWARD,
  canExpand,
  createWorld,
  expandWorld,
  GPUS_PER_RIG,
  mineSelected,
  plotCount,
  plotIdForGpu,
  plotIdForRig,
  rigCount,
  rigIdForGpu,
  RIGS_PER_PLOT,
} from './mining-world';

describe('Mining world', () => {
  it('starts with one unmined block and no reward', () => {
    expect(createWorld()).toEqual({ blocks: [{ id: 1, progress: 0 }], selectedId: 1, satoshis: 0 });
    expect(canExpand(createWorld())).toBe(false);
  });

  it('awards a block exactly once, and never before completion', () => {
    let world = createWorld();
    for (let step = 0; step < 4; step++) {
      world = mineSelected(world);
    }
    expect(world.satoshis).toBe(0);
    expect(world.blocks[0].progress).toBe(80);
    world = mineSelected(world);
    expect(world.satoshis).toBe(BLOCK_REWARD);
    expect(() => mineSelected(world)).toThrow('completato');
  });

  it('keeps unlocking GPUs and rigs beyond the first four blocks', () => {
    let world = createWorld();
    expect(expandWorld(world)).toBe(world);
    for (let id = 1; id <= GPUS_PER_RIG * 3; id++) {
      for (let step = 0; step < 5; step++) {
        world = mineSelected(world);
      }
      expect(world.selectedId).toBe(id);
      expect(canExpand(world)).toBe(true);
      world = expandWorld(world);
      expect(world.blocks[id]).toEqual({ id: id + 1, progress: 0 });
      expect(world.selectedId).toBe(id + 1);
      expect(expandWorld(world)).toBe(world);
    }
    expect(world.blocks).toHaveLength(13);
    expect(rigCount(world)).toBe(4);
    expect(world.satoshis).toBe(BLOCK_REWARD * 12);
    expect(canExpand(world)).toBe(false);
    expect(expandWorld(world)).toBe(world);
  });

  it('starts a new rig only when a GPU needs the next four-slot frame', () => {
    expect(rigCount(createWorld())).toBe(1);
    expect([1, 4, 5, 8, 9, 100].map(rigIdForGpu)).toEqual([1, 1, 2, 2, 3, 25]);
    const fullRig = {
      ...createWorld(),
      blocks: Array.from({ length: 4 }, (_, index) => ({ id: index + 1, progress: 100 })),
      selectedId: 4,
    };
    expect(rigCount(fullRig)).toBe(1);
    const nextRig = expandWorld(fullRig);
    expect(rigCount(nextRig)).toBe(2);
    expect(nextRig.blocks[4]).toEqual({ id: 5, progress: 0 });
    expect(fullRig.blocks).toHaveLength(4);
  });

  it('groups six rigs into each plot and places GPU IDs in the matching plot', () => {
    expect([1, 6, 7, 12, 13].map(plotIdForRig)).toEqual([1, 1, 2, 2, 3]);
    expect([1, 24, 25, 48, 49].map(plotIdForGpu)).toEqual([1, 1, 2, 2, 3]);
    const world = {
      ...createWorld(),
      blocks: Array.from({ length: RIGS_PER_PLOT * GPUS_PER_RIG }, (_, index) => ({
        id: index + 1,
        progress: 0,
      })),
    };
    expect(plotCount(world)).toBe(1);
    expect(plotCount({ ...world, blocks: [...world.blocks, { id: 25, progress: 0 }] })).toBe(2);
  });

  it('does not mutate a previous world snapshot', () => {
    const original = createWorld();
    const next = mineSelected(original);
    expect(original.blocks[0].progress).toBe(0);
    expect(next.blocks[0].progress).toBe(20);
  });
});
