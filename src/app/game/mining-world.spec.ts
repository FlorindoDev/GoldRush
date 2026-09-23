import { describe, expect, it } from 'vitest';
import { BLOCK_REWARD, canExpand, createWorld, expandWorld, mineSelected } from './mining-world';

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

  it('unlocks sequentially and finishes after four blocks', () => {
    let world = createWorld();
    expect(expandWorld(world)).toBe(world);
    for (let id = 1; id <= 4; id++) {
      for (let step = 0; step < 5; step++) {
        world = mineSelected(world);
      }
      expect(world.selectedId).toBe(id);
      if (id < 4) {
        expect(canExpand(world)).toBe(true);
        world = expandWorld(world);
        expect(world.blocks[id]).toEqual({ id: id + 1, progress: 0 });
      }
    }
    expect(world.blocks).toHaveLength(4);
    expect(world.satoshis).toBe(BLOCK_REWARD * 4);
    expect(canExpand(world)).toBe(false);
    expect(expandWorld(world)).toBe(world);
  });

  it('does not mutate a previous world snapshot', () => {
    const original = createWorld();
    const next = mineSelected(original);
    expect(original.blocks[0].progress).toBe(0);
    expect(next.blocks[0].progress).toBe(20);
  });
});
