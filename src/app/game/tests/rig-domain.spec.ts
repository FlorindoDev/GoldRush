import { RIG_COOLING_METHODS } from '../../config/cooling-config';
import { GPU_MODELS_BY_ID } from '../../config/gpu-config';
import { RIG_MODELS } from '../../config/rig-model-config';
import { cryptoValueEur } from '../../config/crypto-config';
import { parseGameSave } from '../game-save';
import { PURCHASED_RIG_SETUP, STARTING_RIG_FAN_COUNT } from '../../config/rig-config';
import { describe, expect, it } from 'vitest';
import {
  createWorld,
  getGpu,
  getRig,
  recordGpuWork,
  farmPowerWatts,
  rigIdForGpu,
  type MiningWorld,
} from '../mining-world';
import { GameService } from '../game.service';
import { inventoryEntries, purchaseCart, resaleValue } from '../inventory';

const fundedWorld = (
  world: MiningWorld = createWorld(),
  unlockedResearchIds: string[] = [],
): MiningWorld => ({ ...world, cashEur: 2000, unlockedResearchIds });

describe('RIG inventory domain', () => {
  it('installs shop RIGs, stores their setup and GPU slots, and remounts without losing identity', () => {
    const purchased = purchaseCart(fundedWorld(createWorld(), ['rig-8-frame-none']), [
      { productId: 'rig-8-frame-none', quantity: 1 },
      { productId: 'gpu-passive', quantity: 2 },
    ]);
    const game = new GameService();
    game.world.set(purchased);

    game.mountStockRig(1, 8);
    expect(getRig(game.world(), 8).rigProductId).toBe('rig-8-frame-none');
    expect(game.stockQuantity('rig-8-frame-none')).toBe(0);
    game.mountStockGpu(2, 8);
    game.mountStockGpu(3, 8);
    game.world.update((world) => ({
      ...world,
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) =>
            gpu.id === 29
              ? { ...gpu, wearPercent: 17, dustPercent: 23 }
              : gpu.id === 30
                ? { ...gpu, wearPercent: 8, dustPercent: 41 }
                : gpu,
          ),
        })),
      })),
    }));
    game.viewRig(8);
    game.select(29);
    game.moveRigToStock(8);

    expect(getRig(game.world(), 8).unlocked).toBe(false);
    expect(getGpu(game.world(), 29).unlocked).toBe(false);
    expect(game.selectedGpuId()).toBeNull();
    expect(game.selectedRigId()).toBeNull();
    expect(game.stockQuantity('rig-8-frame-none')).toBe(1);
    expect(game.stockQuantity('gpu-passive')).toBe(0);

    const stored = game.world().inventory.items.find((item) => item.rig)!;
    expect(stored.rig?.setup).toEqual(PURCHASED_RIG_SETUP);
    expect(stored.rig?.gpus.map((gpu) => gpu?.state.wearPercent ?? null)).toEqual([
      17,
      8,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(stored.rig?.gpus[0]?.state.dustPercent).toBe(23);
    expect(stored.rig?.gpus[1]?.state.dustPercent).toBe(41);
    expect(
      inventoryEntries(game.world()).some(
        (entry) => entry.stockId === stored.id && entry.product.id === 'rig-8-frame-none',
      ),
    ).toBe(true);

    game.mountStockRig(stored.id, 9);
    expect(getRig(game.world(), 9).rigProductId).toBe('rig-8-frame-none');
    expect(getGpu(game.world(), 33).wearPercent).toBe(17);
    expect(getGpu(game.world(), 33).dustPercent).toBe(23);
    expect(getGpu(game.world(), 34).wearPercent).toBe(8);
    expect(getGpu(game.world(), 34).dustPercent).toBe(41);
    expect(game.stockQuantity('rig-8-frame-none')).toBe(0);
    expect(inventoryEntries(game.world()).some((entry) => entry.rigId === 9)).toBe(true);
  });

  it.each(RIG_MODELS.filter((model) => model.cooling !== 'bracket'))(
    'ships $id with the advertised capacity and included modules',
    (model) => {
      const world = purchaseCart(fundedWorld(createWorld(), [model.id]), [
        { productId: model.id, quantity: 1 },
      ]);
      const rig = world.inventory.items[0].rig!;
      expect(rig.gpus).toHaveLength(model.slots);
      expect(rig.setup.dustSystemId).toBe(model.filter);
      expect(rig.setup.coolingMethodId).toBe(model.cooling);
      expect(rig.setup.fanCount).toBe(0);
      expect(world.cashEur).toBe(2000 - model.priceEur);
    },
  );

  it('mines on all eight slots and preserves them across save, storage and replacement', () => {
    const game = new GameService();
    game.world.set(
      purchaseCart(fundedWorld(createWorld(), ['rig-8-frame-liquid']), [
        { productId: 'rig-8-frame-liquid', quantity: 1 },
        { productId: 'gpu-passive', quantity: 8 },
      ]),
    );
    game.mountStockRig(1, 2);
    for (let id = 2; id <= 9; id++) game.mountStockGpu(id, 2);
    const rig = getRig(game.world(), 2);
    expect(rig.gpus).toHaveLength(8);
    expect(rig.gpus.every((gpu) => gpu.unlocked)).toBe(true);
    expect(
      new Set(
        game
          .world()
          .plots.flatMap((plot) => plot.rigs.flatMap((entry) => entry.gpus.map((gpu) => gpu.id))),
      ).size,
    ).toBe(148);
    const idlePower = GPU_MODELS_BY_ID['gpu-passive'].specifications.idle.powerWatts;
    // Include anche il RIG iniziale: la pompa del RIG da otto si conta una sola volta.
    expect(farmPowerWatts(game.world()) - farmPowerWatts(createWorld())).toBeCloseTo(
      8 * idlePower + RIG_COOLING_METHODS.liquid.extraPowerWatts,
    );
    const last = rig.gpus[7];
    expect(rigIdForGpu(last.id)).toBe(2);
    game.world.set(recordGpuWork(game.world(), last.id, 1, 0, 850));
    expect(getGpu(game.world(), last.id).dustPercent).toBeGreaterThan(0);
    const save = parseGameSave(JSON.stringify(game.createSave()));
    expect(getRig(save.world, 2).gpus).toEqual(getRig(game.world(), 2).gpus);
    game.moveRigToStock(2);
    const stored = game.world().inventory.items.find((item) => item.rig)!;
    expect(stored.rig!.gpus[7]!.state.dustPercent).toBeGreaterThan(0);
    game.mountStockRig(stored.id, 3);
    expect(getRig(game.world(), 3).gpus[7].dustPercent).toBeGreaterThan(0);
    expect(getRig(game.world(), 3).gpus[7].id).not.toBe(last.id);
    game.buyCart([{ productId: 'rig-gameplay', quantity: 1 }]);
    const replacement = game
      .world()
      .inventory.items.find((item) => item.productId === 'rig-gameplay')!;
    game.replaceRigFromStock(3, replacement.id);
    expect(getRig(game.world(), 3).gpus).toHaveLength(4);
    expect(
      game
        .world()
        .inventory.items.find((item) => item.rig)!
        .rig!.gpus.filter(Boolean),
    ).toHaveLength(8);
    expect(() => parseGameSave(JSON.stringify(game.createSave()))).not.toThrow();
  });

  it('upgrades old eight-slot saves without changing the original GPU IDs or setup', () => {
    const game = new GameService();
    game.world.set(
      purchaseCart(fundedWorld(createWorld(), ['rig-8-frame-none']), [
        { productId: 'rig-8-frame-none', quantity: 1 },
      ]),
    );
    game.mountStockRig(1, 2);
    const legacy = JSON.parse(JSON.stringify(game.createSave()));
    legacy.world.plots[0].rigs[1].gpus.length = 4;
    const restored = parseGameSave(JSON.stringify(legacy));
    expect(getRig(restored.world, 2).gpus).toHaveLength(8);
    expect(
      getRig(restored.world, 2)
        .gpus.slice(0, 4)
        .map((gpu) => gpu.id),
    ).toEqual([5, 6, 7, 8]);
    expect(
      getRig(restored.world, 2)
        .gpus.slice(4)
        .every((gpu) => !gpu.unlocked),
    ).toBe(true);
  });

  it('replaces a mounted RIG atomically, returning its configured RIG and GPUs to stock', () => {
    const purchased = purchaseCart(fundedWorld(createWorld(), ['rig-8-frame-none']), [
      { productId: 'rig-8-frame-none', quantity: 1 },
    ]);
    const game = new GameService();
    game.world.set(purchased);
    game.replaceRigFromStock(1, 1);

    expect(getRig(game.world(), 1).rigProductId).toBe('rig-8-frame-none');
    expect(getGpu(game.world(), 1).unlocked).toBe(false);
    expect(game.stockQuantity('rig-8-frame-none')).toBe(0);
    const oldRig = game.world().inventory.items[0]!;
    expect(oldRig.productId).toBe('rig-gameplay');
    expect(oldRig.rig?.gpus[0]).not.toBeNull();
    expect(oldRig.rig?.gpus[0]?.state.modelId).toBe(getGpu(createWorld(), 1).modelId);
    expect(oldRig.rig?.gpus[1]).toBeNull();
    expect(inventoryEntries(game.world()).some((entry) => entry.stockId === oldRig.id)).toBe(true);

    const balanceBeforeSale = game.world().cashEur + cryptoValueEur(game.world().holdings);
    const expectedSale = resaleValue(oldRig);
    const gpuValue = oldRig.rig!.gpus.reduce(
      (total, gpu) =>
        total + (gpu ? resaleValue({ id: 0, productId: gpu.state.modelId, gpu: gpu.state }) : 0),
      0,
    );
    expect(expectedSale).toBeGreaterThan(gpuValue);
    game.sellStock(oldRig.id);
    expect(game.world().inventory.items).toHaveLength(0);
    expect(game.world().cashEur).toBe(0);
    expect(cryptoValueEur(game.world().holdings)).toBeCloseTo(balanceBeforeSale + expectedSale);
  });

  it('rejects running and workbench transitions without changing the world', () => {
    const purchased = purchaseCart(fundedWorld(), [{ productId: 'rig-gameplay', quantity: 1 }]);
    const game = new GameService();
    game.world.set(purchased);
    game.running.set(true);
    const runningWorld = game.world();
    expect(() => game.moveRigToStock(1)).toThrow('Ferma');
    expect(() => game.mountStockRig(1, 3)).toThrow('Ferma');
    expect(() => game.replaceRigFromStock(1, 1)).toThrow('Ferma');
    expect(game.world()).toBe(runningWorld);

    game.running.set(false);
    game.inspectRig(1);
    const rigBenchWorld = game.world();
    expect(() => game.moveRigToStock(1)).toThrow('banco');
    expect(() => game.replaceRigFromStock(1, 1)).toThrow('banco');
    expect(game.world()).toBe(rigBenchWorld);

    game.closeInspectedRigWorkbench();
    game.inspectGpu(1);
    const gpuBenchWorld = game.world();
    expect(() => game.moveRigToStock(1)).toThrow('banco');
    expect(game.world()).toBe(gpuBenchWorld);
  });

  it('requires stock for rig upgrades and returns removed catalog components', () => {
    const game = new GameService();
    game.world.set(fundedWorld(createWorld(), ['fan-pressure-140', 'filter-mesh', 'cooling-air']));
    game.inspectRig(1);
    game.buyCart([{ productId: 'fan-pressure-140', quantity: 4 }]);
    const insufficientStock = game.world();
    expect(() => game.configureInspectedRig({ fanId: 'fan-pressure-140', fanCount: 5 })).toThrow(
      'magazzino',
    );
    expect(game.world()).toBe(insufficientStock);

    game.buyCart([{ productId: 'fan-pressure-140', quantity: 1 }]);
    game.buyCart([
      { productId: 'filter-mesh', quantity: 1 },
      { productId: 'cooling-air', quantity: 1 },
    ]);
    game.configureInspectedRig({ fanId: 'fan-pressure-140', fanCount: 5 });
    game.configureInspectedRig({ fanCount: 4, dustSystemId: 'mesh', coolingMethodId: 'air' });
    expect(game.stockQuantity('fan-airflow-120')).toBe(STARTING_RIG_FAN_COUNT);
    expect(game.stockQuantity('fan-pressure-140')).toBe(1);
    expect(game.stockQuantity('filter-mesh')).toBe(0);
    expect(game.stockQuantity('cooling-air')).toBe(0);

    game.configureInspectedRig({ dustSystemId: 'none', coolingMethodId: 'none' });
    expect(game.stockQuantity('filter-mesh')).toBe(1);
    expect(game.stockQuantity('cooling-air')).toBe(1);
    expect(getRig(game.world(), 1).setup.fanCount).toBe(4);
  });
});
