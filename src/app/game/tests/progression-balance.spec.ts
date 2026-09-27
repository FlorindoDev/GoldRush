import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRYPTO_CONFIG,
  STARTING_CRYPTO_ID,
  cryptoValueEur,
  type CryptoId,
} from '../../config/crypto-config';
import { GAME_BALANCE } from '../../config/game-balance';
import { GPU_MODELS, GPU_MODELS_BY_ID } from '../../config/gpu-config';
import { SHOP_PRODUCTS_BY_ID } from '../../config/shop-config';
import { GUIDE_CODE } from '../../language/guide-code';
import { EXAMPLES } from '../../language/examples';
import { withUnlockedGpus } from './world-fixture';
import { estimateGpuMining } from '../mining-estimate';
import { createGpuOperatingState, gpuMiningProgress } from '../gpu-operation';
import { GameService } from '../game.service';
import {
  assignGpusCrypto,
  billElectricityForDay,
  createWorld,
  expandWorld,
  getBlockDifficulty,
  getCryptoBlock,
  getGpu,
  mineGpu,
  serviceGpu,
  setGpuFrequency,
  type MiningWorld,
} from '../mining-world';
import { canUnlockResearch, isResearchUnlocked, researchNode, unlockResearch } from '../research';
import { installStockGpu, purchaseCart } from '../inventory';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function chainAt(world: MiningWorld, cryptoId: CryptoId, id: number): MiningWorld {
  const blocks = [{ id, progress: 0 }];
  return {
    ...world,
    ...(cryptoId === STARTING_CRYPTO_ID ? { blocks, selectedId: id } : {}),
    cryptoChains: {
      ...world.cryptoChains,
      [cryptoId]: { blocks, selectedId: id, settledBlockIds: [] },
    },
  };
}

describe('Farm progression balance', () => {
  it('starts with only the least profitable crypto and gates all later assignments', () => {
    const world = createWorld();
    expect(getGpu(world, 1).modelId).toBe('gpu-passive');
    expect(getGpu(world, 1).cryptoId).toBe('dogecoin');
    for (const crypto of CRYPTO_CONFIG) {
      expect(isResearchUnlocked(world, crypto.id)).toBe(crypto.id === STARTING_CRYPTO_ID);
      if (crypto.id !== STARTING_CRYPTO_ID)
        expect(() => assignGpusCrypto(world, [1], crypto.symbol)).toThrow('Sblocca');
    }
  });

  it.each(CRYPTO_CONFIG)('increases $symbol independently and stops at its cap', (crypto) => {
    const difficulty = crypto.difficulty;
    expect(getBlockDifficulty(0, crypto.id)).toBe(difficulty.startingMultiplier);
    expect(getBlockDifficulty(1, crypto.id)).toBeGreaterThan(difficulty.startingMultiplier);
    expect(getBlockDifficulty(1e6, crypto.id)).toBe(difficulty.maxMultiplier);
    let world: MiningWorld = {
      ...createWorld(),
      unlockedResearchIds: CRYPTO_CONFIG.map((c) => c.id),
    };
    world = chainAt(world, crypto.id, 1_000_000);
    const estimate = estimateGpuMining(world, 1, crypto.id, undefined, 0);
    const mined = mineGpu(assignGpusCrypto(world, [1], crypto.id), 1, 0);
    expect(getCryptoBlock(mined, crypto.id).progress).toBeCloseTo(estimate.progressPerAction);
    expect(estimate.difficulty).toBe(difficulty.maxMultiplier);
    const other = CRYPTO_CONFIG.find((c) => c.id !== crypto.id)!;
    expect(estimateGpuMining(mined, 1, other.id, undefined, 0).difficulty).toBe(
      other.difficulty.startingMultiplier,
    );
  });

  it('gives newer crypto more reward per unit of work, with longer blocks and paid milestones', () => {
    for (let i = 1; i < CRYPTO_CONFIG.length; i++) {
      const previous = CRYPTO_CONFIG[i - 1],
        crypto = CRYPTO_CONFIG[i];
      const previousReward = previous.coinsPerBlock * previous.priceEur;
      const reward = crypto.coinsPerBlock * crypto.priceEur;
      expect(reward / crypto.difficulty.startingMultiplier).toBeGreaterThan(
        previousReward / previous.difficulty.startingMultiplier,
      );
      expect(crypto.difficulty.startingMultiplier).toBeGreaterThan(
        previous.difficulty.startingMultiplier,
      );
      const funded = { ...createWorld(), cashEur: 100000 };
      expect(canUnlockResearch(funded, researchNode(crypto.id)!)).toBe(false);
      const blocks = Array.from({ length: crypto.research.requiredBlocks }, (_, j) => j + 1);
      const ready = {
        ...funded,
        unlockedResearchIds: CRYPTO_CONFIG.slice(0, i).map((c) => c.id),
        cryptoChains: {
          ...funded.cryptoChains,
          dogecoin: { ...funded.cryptoChains.dogecoin, settledBlockIds: blocks },
        },
      };
      const unlocked = unlockResearch(ready, crypto.id);
      expect(unlocked.cashEur).toBe(100000 - crypto.research.costEur);
      expect(getGpu(assignGpusCrypto(unlocked, [1], crypto.id), 1).cryptoId).toBe(crypto.id);
    }
  });

  it('finishes the first block in 90–180 seconds and funds another GPU within five blocks', () => {
    let world = createWorld();
    let actions = 0,
      firstActions = 0;
    for (let block = 0; block < 5; block++) {
      while (getCryptoBlock(world, STARTING_CRYPTO_ID).progress < 100 && actions < 2000) {
        const startedAt = actions * GAME_BALANCE.mining.actionDurationMs;
        world = mineGpu(world, 1, startedAt, startedAt + GAME_BALANCE.mining.actionDurationMs);
        actions++;
      }
      expect(getCryptoBlock(world, STARTING_CRYPTO_ID).progress).toBe(100);
      if (block === 0) firstActions = actions;
      world = serviceGpu(world, 1, { kind: 'clean' });
      world = expandWorld(world);
    }
    const seconds = (firstActions * GAME_BALANCE.mining.actionDurationMs) / 1000;
    expect(seconds).toBeGreaterThanOrEqual(90);
    expect(seconds).toBeLessThanOrEqual(180);
    world = billElectricityForDay(world, 1, () => 0);
    const net = world.cashEur + cryptoValueEur(world.holdings);
    expect(net).toBeGreaterThan(SHOP_PRODUCTS_BY_ID.get('gpu-passive')!.priceEur);
    const bought = purchaseCart(world, [{ productId: 'gpu-passive', quantity: 1 }]);
    expect(getGpu(installStockGpu(bought, bought.inventory.items[0].id, 1), 2).unlocked).toBe(true);
  });

  it('makes underclocking profitable on a mature chain when nominal clock loses money', () => {
    let world = chainAt(createWorld(), STARTING_CRYPTO_ID, 1000);
    world = { ...world, electricity: { ...world.electricity, priceEurPerKwh: 0.5 } };
    const nominal = estimateGpuMining(world, 1, undefined, undefined, 0);
    const efficient = estimateGpuMining(world, 1, undefined, 0.6, 0);
    expect(nominal.profitPerActionEur).toBeLessThan(0);
    expect(efficient.profitPerActionEur).toBeGreaterThan(0);
    expect(efficient.progressPerAction).toBeLessThan(nominal.progressPerAction);
    const mined = mineGpu(setGpuFrequency(world, 1, 0.6), 1, 0);
    expect(mined.electricity.pendingKwh * 0.5).toBeCloseTo(efficient.energyCostPerActionEur);
  });

  it('rewards better hardware independently of GHz and keeps all chains viable with late hardware', () => {
    const passive = createGpuOperatingState('gpu-passive');
    for (const model of GPU_MODELS.filter((m) => m.id !== 'gpu-passive')) {
      const upgraded = {
        ...createGpuOperatingState(model.id),
        targetFrequencyGhz: passive.targetFrequencyGhz,
      };
      expect(gpuMiningProgress(upgraded)).toBeGreaterThan(gpuMiningProgress(passive));
    }
    for (const crypto of CRYPTO_CONFIG) {
      let world = chainAt(createWorld(), crypto.id, 10000);
      world = {
        ...world,
        electricity: { ...world.electricity, priceEurPerKwh: 0.72 },
        plots: world.plots.map((plot) => ({
          ...plot,
          rigs: plot.rigs.map((rig) => ({
            ...rig,
            gpus: rig.gpus.map((gpu) => ({ ...gpu, ...createGpuOperatingState('gpu-nitro') })),
          })),
        })),
      };
      expect(
        estimateGpuMining(world, 1, crypto.id, undefined, 0).profitPerActionEur,
      ).toBeGreaterThan(0);
    }
    expect(GPU_MODELS_BY_ID['gpu-nitro'].miningPower).toBeGreaterThan(8);
  });

  it('executes the documented optimization loop on a new game', async () => {
    vi.useFakeTimers();
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(GUIDE_CODE.optimization);
    const run = game.run();
    await vi.runAllTimersAsync();
    await run;
    expect(game.errorLine()).toBe(0);
    expect(game.selected().progress).toBe(100);
    expect(game.world().holdings.dogecoin).toBe(180);
    expect(getGpu(game.world(), 1).stopped).toBe(false);
  });

  it('settles deferred work before advancing a chain and never pays it twice', () => {
    const world = createWorld();
    const nearComplete = { ...world, blocks: [{ id: 1, progress: 99.99 }] };
    const deferred = mineGpu(nearComplete, 1, 0, 850, true);
    expect(deferred.holdings).toEqual({});
    const expanded = expandWorld(deferred);
    expect(expanded.holdings.dogecoin).toBe(180);
    expect(expanded.cryptoChains.dogecoin.settledBlockIds).toEqual([1]);
    expect(expandWorld(expanded)).toBe(expanded);
    expect(getCryptoBlock(expanded, STARTING_CRYPTO_ID).id).toBe(2);
  });

  it('finishes the multi-crypto example when the two chains complete at different times', async () => {
    vi.useFakeTimers();
    const game = new GameService();
    const world = withUnlockedGpus(createWorld(), 4);
    game.world.set({
      ...world,
      unlockedResearchIds: ['kaspa', 'litecoin'],
      cryptoChains: {
        ...world.cryptoChains,
        kaspa: { ...world.cryptoChains.kaspa, blocks: [{ id: 1, progress: 99.99 }] },
        litecoin: { ...world.cryptoChains.litecoin, blocks: [{ id: 1, progress: 99.7 }] },
      },
    });
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(EXAMPLES.find((example) => example.name === 'Mining multi-cripto')!.code);
    const run = game.run();
    await vi.runAllTimersAsync();
    await run;
    expect(game.errorLine()).toBe(0);
    for (const crypto of ['kaspa', 'litecoin'] as const) {
      expect(getCryptoBlock(game.world(), crypto)).toEqual({ id: 1, progress: 100 });
      expect(game.world().cryptoChains[crypto].settledBlockIds).toEqual([1]);
    }
  });

  it('returns estimate snapshots without changing crypto, clock, energy or balance', async () => {
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(`let gpu = plots[0].rigs[0].gpus[0];
let estimate = gpu.estimate("BTC", 0.6);
print(estimate.crypto); print(estimate.unlocked); print(estimate.difficulty);
print(estimate.powerWatts > 0); print(gpu.crypto); print(gpu.getTargetFrequencyGhz());`);
    const before = game.world();
    await game.run();
    expect(game.errorLine()).toBe(0);
    expect(
      game
        .logs()
        .filter((entry) => entry.kind === 'output')
        .map((entry) => entry.message),
    ).toEqual(['bitcoin', 'false', '240', 'true', 'dogecoin', '1.35']);
    expect(game.world().holdings).toEqual(before.holdings);
    expect(game.world().electricity).toEqual(before.electricity);
  });

  it.each([
    'gpu.estimate(1);',
    'gpu.estimate("DOGE", "1");',
    'gpu.estimate("DOGE", 99);',
    'gpu.estimate("NOPE");',
    'gpu.estimate("DOGE", 1, 2);',
  ])('reports invalid estimates at their source line: %s', async (source) => {
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(`let gpu = plots[0].rigs[0].gpus[0];\n${source}`);
    await game.run();
    expect(game.errorLine()).toBe(2);
    expect(getGpu(game.world(), 1).stopped).toBe(false);
  });
});
