import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { SHOP_PRODUCTS, SHOP_PRODUCTS_BY_ID } from '../config/shop-config';
import { CRYPTO_CONFIG } from '../config/crypto-config';
import { researchNode } from './research';
import { createWorld, getGpu, type MiningWorld } from './mining-world';
import { GameService } from './game.service';
import { GPU_MODELS_BY_ID } from '../config/gpu-config';
import { getGpuTelemetry } from './gpu-telemetry';
import {
  isGpuOperational,
  gpuMiningPowerWatts,
  rigAuxiliaryPowerWattsPerGpu,
} from './gpu-operation';
import {
  installStockGpu,
  inventoryEntries,
  purchaseCart,
  resaleValue,
  sellStockItem,
  storeGpu,
} from './inventory';

const funded = (): MiningWorld => ({ ...createWorld(), cashEur: 1000 });
const buy = (world: MiningWorld, quantity = 1) =>
  purchaseCart(world, [{ productId: 'gpu-passive', quantity }]);

describe('Shop e magazzino', () => {
  it('has unique products, valid prices, research and model paths', () => {
    expect(SHOP_PRODUCTS_BY_ID.size).toBe(SHOP_PRODUCTS.length);
    for (const product of SHOP_PRODUCTS) {
      expect(product.priceEur).toBeGreaterThan(0);
      expect(Number.isFinite(product.priceEur)).toBe(true);
      expect(existsSync(`public/${product.model}`), product.model).toBe(true);
      if (product.researchId)
        expect(researchNode(product.researchId), product.researchId).toBeDefined();
    }
  });
  it('purchases multiple categories atomically without unlocking or changing installed hardware', () => {
    const before = funded();
    const after = purchaseCart(before, [
      { productId: 'gpu-passive', quantity: 2 },
      { productId: 'fan-airflow-120', quantity: 3 },
      { productId: 'rig-gameplay', quantity: 1 },
    ]);
    expect(after.cashEur).toBe(696);
    expect(after.inventory.items).toHaveLength(6);
    expect(new Set(after.inventory.items.map((item) => item.id)).size).toBe(6);
    expect(after.plots).toBe(before.plots);
    expect(before.inventory.items).toHaveLength(0);
    expect(before.cashEur).toBe(1000);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 100])('rejects quantity %s without changes', (quantity) => {
    const before = funded();
    expect(() => buy(before, quantity)).toThrow('Quantità');
    expect(before.inventory.items).toHaveLength(0);
    expect(before.cashEur).toBe(1000);
  });
  it('rejects empty, unknown, locked, duplicated-over-limit and unaffordable orders', () => {
    const before = funded();
    expect(() => purchaseCart(before, [])).toThrow('vuoto');
    expect(() => purchaseCart(before, [{ productId: 'missing', quantity: 1 }])).toThrow('Articolo');
    expect(() =>
      purchaseCart(before, [
        { productId: 'gpu-passive', quantity: 1 },
        { productId: 'gpu-dual', quantity: 1 },
      ]),
    ).toThrow('Sblocca');
    expect(() =>
      purchaseCart(before, [
        { productId: 'gpu-passive', quantity: 60 },
        { productId: 'gpu-passive', quantity: 40 },
      ]),
    ).toThrow('quantità');
    expect(() => buy(createWorld())).toThrow('Saldo insufficiente');
    expect(before.inventory.items).toEqual([]);
  });
  it('accepts an exact balance and converts only the required crypto', () => {
    expect(buy({ ...funded(), cashEur: 65 }).cashEur).toBe(0);
    const world = buy({ ...createWorld(), cashEur: 10, holdings: { bitcoin: 1 } });
    expect(world.cashEur).toBe(0);
    const price = CRYPTO_CONFIG.find((coin) => coin.id === 'bitcoin')!.priceEur;
    expect(world.holdings.bitcoin).toBeCloseTo(1 - 55 / price);
  });
  it('keeps damaged GPU identity and wear when stored, and sells a broken card once', () => {
    const initial = createWorld();
    const broken = {
      ...initial,
      plots: initial.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) =>
            gpu.id === 1
              ? {
                  ...gpu,
                  wearPercent: 100,
                  dustPercent: 76,
                  stopped: true,
                  stopReason: 'GPU usurata',
                }
              : gpu,
          ),
        })),
      })),
    };
    expect(inventoryEntries(broken).find((entry) => entry.gpuId === 1)?.condition).toBe('broken');
    const stored = storeGpu(broken, 1);
    expect(getGpu(stored, 1).unlocked).toBe(false);
    expect(stored.inventory.items[0].gpu?.wearPercent).toBe(100);
    expect(stored.inventory.items[0].gpu?.dustPercent).toBe(76);
    expect(inventoryEntries(stored).filter((entry) => entry.condition === 'broken')).toHaveLength(
      1,
    );
    expect(() => installStockGpu(stored, 1, 1)).toThrow('funzionante');
    const sale = sellStockItem(stored, 1);
    expect(sale.cashEur).toBe(resaleValue(stored.inventory.items[0]));
    expect(sale.cashEur).toBe(6.5);
    expect(sale.inventory.items).toHaveLength(0);
    expect(() => sellStockItem(sale, 1)).toThrow('non più presente');
  });
  it('mounts into an empty unlocked slot, consumes stock and preserves the slot assignment', () => {
    const purchased = buy(funded());
    expect(() => installStockGpu(purchased, 1, 1)).toThrow('slot libero');
    const stored = storeGpu(purchased, 1);
    const after = installStockGpu(stored, 1, 1);
    expect(after.inventory.items).toHaveLength(1);
    expect(getGpu(after, 1).unlocked).toBe(true);
    expect(getGpu(after, 1).wearPercent).toBe(0);
    expect(getGpu(after, 1).rigId).toBe(1);
    expect(() => installStockGpu(stored, 1, 36)).toThrow('slot libero');
  });
  it('mounts stock into the requested empty GPU slot instead of the first free slot', () => {
    const stored = storeGpu(storeGpu(createWorld(), 1), 2);
    const mounted = installStockGpu(stored, 1, 1, 2);

    expect(getGpu(mounted, 1).unlocked).toBe(false);
    expect(getGpu(mounted, 2).unlocked).toBe(true);
    expect(mounted.inventory.items).toHaveLength(1);
  });
  it('rejects moving hardware while mining and clears stock on a new game', () => {
    const game = new GameService();
    game.world.set(buy(funded()));
    game.running.set(true);
    expect(() => game.moveGpuToStock(1)).toThrow('Ferma');
    expect(() => game.mountStockGpu(1, 1)).toThrow('Ferma');
    game.running.set(false);
    game.computerOpen.set(true);
    game.reset();
    expect(game.world().inventory.items).toEqual([]);
    expect(game.computerOpen()).toBe(false);
  });

  it('uses the purchased GPU model for frequency, limits, name and power', () => {
    const purchased = purchaseCart({ ...funded(), unlockedResearchIds: ['gpu-dual'] }, [
      { productId: 'gpu-dual', quantity: 1 },
    ]);
    const mounted = installStockGpu(storeGpu(purchased, 1), 1, 1);
    const gpu = getGpu(mounted, 1);
    const model = GPU_MODELS_BY_ID['gpu-dual'];
    expect(gpu.targetFrequencyGhz).toBe(model.specifications.mining.frequencyGhz);
    expect(isGpuOperational(gpu)).toBe(true);
    const telemetry = getGpuTelemetry(1, gpu);
    expect(telemetry.model).toBe(model.name);
    expect(telemetry.absoluteMaxFrequencyGhz).toBe(
      model.specifications.limits.absoluteFrequencyGhz,
    );
    expect(gpuMiningPowerWatts(gpu) - rigAuxiliaryPowerWattsPerGpu()).toBeCloseTo(
      model.specifications.mining.powerWatts,
    );
  });
});
