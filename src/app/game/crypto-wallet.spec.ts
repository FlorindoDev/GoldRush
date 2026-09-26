import { afterEach, describe, expect, it, vi } from 'vitest';
import { CRYPTO_CONFIG, cryptoValueEur } from '../config/crypto-config';
import { GameService } from './game.service';
import {
  assignGpusCrypto,
  billElectricityForDay,
  createWorld,
  expandWorld,
  getGpu,
  mineGpu,
  settleCompletedCryptoBlock,
  STARTING_GPU_COUNT,
} from './mining-world';

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function setCryptoBlockProgress(
  world: ReturnType<typeof createWorld>,
  cryptoId: (typeof CRYPTO_CONFIG)[number]['id'],
  progress: number,
) {
  const chain = world.cryptoChains[cryptoId];
  const blocks = chain.blocks.map((block) =>
    block.id === chain.selectedId ? { ...block, progress } : block,
  );
  return cryptoId === 'bitcoin'
    ? { ...world, blocks, cryptoChains: { ...world.cryptoChains, bitcoin: { ...chain, blocks } } }
    : { ...world, cryptoChains: { ...world.cryptoChains, [cryptoId]: { ...chain, blocks } } };
}

describe('Multi-crypto wallet', () => {
  it.each(CRYPTO_CONFIG)('mines $symbol using its configured euro price', (crypto) => {
    const world = assignGpusCrypto(createWorld(), [1], crypto.symbol);
    const mined = mineGpu(setCryptoBlockProgress(world, crypto.id, 99.9), 1, 0);
    expect(mined.holdings[crypto.id]).toBeCloseTo(crypto.coinsPerBlock, 8);
    expect(cryptoValueEur(mined.holdings)).toBeCloseTo(600);
    expect(settleCompletedCryptoBlock(mined, crypto.id)).toBe(mined);
  });

  it('splits a parallel reward fairly, retains holdings and charges cash for electricity', () => {
    let world = assignGpusCrypto(createWorld(), [2], 'LTC');
    world = setCryptoBlockProgress(world, 'bitcoin', 99.9);
    world = setCryptoBlockProgress(world, 'litecoin', 99.9);
    world = mineGpu(world, 1, 0, 0, true, [1, 2]);
    world = mineGpu(world, 2, 0, 0, true, [1, 2]);
    world = settleCompletedCryptoBlock(settleCompletedCryptoBlock(world, 'bitcoin'), 'litecoin');
    expect(world.holdings.bitcoin).toBeCloseTo(CRYPTO_CONFIG[0].coinsPerBlock);
    expect(world.holdings.litecoin).toBeCloseTo(
      CRYPTO_CONFIG.find((coin) => coin.id === 'litecoin')!.coinsPerBlock,
    );
    const billed = billElectricityForDay(world, 1);
    expect(billed.holdings).toEqual(world.holdings);
    expect(billed.cashEur).toBeLessThan(0);
    expect(billElectricityForDay(billed, 1)).toBe(billed);
    const next = expandWorld(billed);
    expect(next.holdings).toEqual(world.holdings);
    expect(getGpu(next, 2).cryptoId).toBe('litecoin');
  });

  it('keeps earlier work assigned to its original crypto after reassignment', () => {
    let world = mineGpu(createWorld(), 1, 0);
    world = assignGpusCrypto(world, [1], 'KAS');
    world = mineGpu(setCryptoBlockProgress(world, 'kaspa', 99.9), 1, 0);
    expect(world.holdings.bitcoin ?? 0).toBe(0);
    expect(world.holdings.kaspa).toBeCloseTo(
      CRYPTO_CONFIG.find((coin) => coin.id === 'kaspa')!.coinsPerBlock,
    );
  });

  it('rejects a locked GPU atomically and accepts duplicate or empty selections', () => {
    const world = createWorld();
    expect(() => assignGpusCrypto(world, [1, 144], 'KAS')).toThrow('bloccata');
    expect(getGpu(world, 1).cryptoId).toBe('bitcoin');
    expect(assignGpusCrypto(world, [], 'KAS')).toEqual(world);
    expect(getGpu(assignGpusCrypto(world, [1, 1], 'kaspa'), 1).cryptoId).toBe('kaspa');
    expect(() => assignGpusCrypto(world, [1], 'unknown')).toThrow('sconosciuta');
  });

  it('supports vectors, single-card vectors and live assignment reads in MineScript', async () => {
    const game = new GameService();
    game.world.update((world) => ({ ...world, unlockedResearchIds: ['litecoin', 'kaspa'] }));
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(`let gpus = plots[0].rigs[0].gpus;
setCrypto(gpus.slice(0, 2), "KAS");
setCrypto(gpus.slice(2, 3), "LTC");
print(gpus[0].crypto);`);
    await game.run();
    expect(game.errorLine()).toBe(0);
    expect(getGpu(game.world(), 1).cryptoId).toBe('kaspa');
    expect(getGpu(game.world(), 2).cryptoId).toBe('kaspa');
    expect(getGpu(game.world(), 3).cryptoId).toBe('litecoin');
    expect(getGpu(game.world(), 4).cryptoId).toBe('bitcoin');
    expect(game.logs().some((entry) => entry.message === 'kaspa')).toBe(true);
    game.reset();
    expect(game.world().holdings).toEqual({});
    expect(getGpu(game.world(), 1).cryptoId).toBe('bitcoin');
  });

  it('mine() without GPU vector mines every unlocked GPU on its assigned crypto', async () => {
    vi.useFakeTimers();
    const game = new GameService();
    game.world.update((world) => ({ ...world, unlockedResearchIds: ['litecoin', 'kaspa'] }));
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(`let gpus = plots[0].rigs[0].gpus;
setCrypto(gpus.slice(0, 1), "KAS");
setCrypto(gpus.slice(1, 2), "LTC");
mine();`);

    const run = game.run();
    await vi.runAllTimersAsync();
    await run;

    const miningMessages = game
      .logs()
      .filter((entry) => entry.kind === 'output' && entry.message.includes('mine()'));
    expect(miningMessages).toHaveLength(STARTING_GPU_COUNT);
    expect(miningMessages.some((entry) => entry.message.includes('GPU 1 · Kaspa (KAS)'))).toBe(
      true,
    );
    expect(miningMessages.some((entry) => entry.message.includes('GPU 2 · Litecoin (LTC)'))).toBe(
      true,
    );
  });

  it.each([
    'let mixed = vector(); mixed.push(gpus[0]); mixed.push(1); setCrypto(mixed, "KAS");',
    'setCrypto(gpus, "NOPE");',
    'setCrypto(gpus, 5);',
    'setCrypto(gpus[0], "KAS");',
    'setCrypto(gpus);',
  ])('reports bad arguments on their source line: %s', async (source) => {
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode(`let gpus = plots[0].rigs[0].gpus;\n${source}`);
    await game.run();
    expect(game.errorLine()).toBe(2);
    expect(getGpu(game.world(), 1).cryptoId).toBe('bitcoin');
  });

  it('rejects assignment during mining and cancels without crediting crypto', async () => {
    vi.useFakeTimers();
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    game.updateCode('mine();');
    const run = game.run();
    await vi.advanceTimersByTimeAsync(100);
    expect(() => game.setGpusCrypto([1], 'KAS')).toThrow('fine di mine()');
    game.stop();
    await run;
    expect(game.world().holdings).toEqual({});
  });
});
