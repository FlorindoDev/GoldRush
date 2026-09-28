import { withUnlockedGpus } from './world-fixture';
import { describe, expect, it } from 'vitest';
import { GameService } from '../game.service';
import { installStockGpu, storeGpu } from '../inventory';
import { createWorld, getGpu } from '../mining-world';

describe('Exact inventory slot integration', () => {
  it.each([3, 5, 0, -1, NaN, Infinity])(
    'rejects occupied, foreign or invalid slot %s without consuming stock',
    (slotId) => {
      const world = storeGpu(storeGpu(withUnlockedGpus(createWorld(), 3), 1), 2);
      const before = structuredClone(world);

      expect(() => installStockGpu(world, 1, 1, slotId)).toThrow('slot libero');
      expect(world).toEqual(before);
    },
  );

  it('preserves wear and slot identity while consuming only the selected copy', () => {
    const stored = storeGpu(storeGpu(withUnlockedGpus(createWorld(), 3), 1), 2);
    const world = {
      ...stored,
      inventory: {
        ...stored.inventory,
        items: stored.inventory.items.map((item) =>
          item.id === 1
            ? { ...item, gpu: { ...item.gpu!, wearPercent: 37, dustPercent: 19 } }
            : item,
        ),
      },
    };
    const target = getGpu(world, 2);
    const mounted = installStockGpu(world, 1, 1, 2);

    expect(getGpu(mounted, 2)).toMatchObject({
      id: target.id,
      rigId: target.rigId,
      plotId: target.plotId,
      cryptoId: target.cryptoId,
      wearPercent: 37,
      dustPercent: 19,
      unlocked: true,
      onWorkbench: false,
    });
    expect(getGpu(mounted, 1).unlocked).toBe(false);
    expect(mounted.inventory.items).toEqual([world.inventory.items[1]]);
    expect(world.inventory.items).toHaveLength(2);
  });

  it('passes the selected slot through the service while another GPU in the RIG mines', () => {
    const game = new GameService();
    game.world.set(storeGpu(storeGpu(withUnlockedGpus(createWorld(), 3), 1), 2));
    game.running.set(true);
    game.miningActions.set([{ gpuId: 3, startedAt: 0, durationMs: 1000, pauseDurationAtStart: 0 }]);

    game.mountStockGpu(1, 1, 2);
    expect(getGpu(game.world(), 1).unlocked).toBe(false);
    expect(getGpu(game.world(), 2).unlocked).toBe(true);
    expect(getGpu(game.world(), 3).unlocked).toBe(true);
    expect(game.isGpuMining(3)).toBe(true);
    expect(game.world().inventory.items.map((item) => item.id)).toEqual([2]);
  });
});
