import { describe, expect, it } from 'vitest';
import { GameService } from '../game.service';
import { installStockGpu, storeGpu } from '../inventory';
import { createWorld, getGpu } from '../mining-world';

describe('Exact inventory slot integration', () => {
  it.each([3, 5, 0, -1, NaN, Infinity])(
    'rejects occupied, foreign or invalid slot %s without consuming stock',
    (slotId) => {
      const world = storeGpu(storeGpu(createWorld(), 1), 2);
      const before = structuredClone(world);

      expect(() => installStockGpu(world, 1, 1, slotId)).toThrow('slot libero');
      expect(world).toEqual(before);
    },
  );

  it('preserves wear and slot identity while consuming only the selected copy', () => {
    const stored = storeGpu(storeGpu(createWorld(), 1), 2);
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

  it('passes the selected slot through the service and blocks changes while running', () => {
    const game = new GameService();
    game.world.set(storeGpu(storeGpu(createWorld(), 1), 2));
    const before = game.world();
    game.running.set(true);

    expect(() => game.mountStockGpu(1, 1, 2)).toThrow('Ferma');
    expect(game.world()).toBe(before);

    game.running.set(false);
    game.mountStockGpu(1, 1, 2);
    expect(getGpu(game.world(), 1).unlocked).toBe(false);
    expect(getGpu(game.world(), 2).unlocked).toBe(true);
    expect(game.world().inventory.items.map((item) => item.id)).toEqual([2]);
  });
});
