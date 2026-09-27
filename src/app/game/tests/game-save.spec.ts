import { afterEach, describe, expect, it, vi } from 'vitest';
import { STARTING_CRYPTO_ID, cryptoValueEur } from '../../config/crypto-config';
import { EXAMPLES } from '../../language/examples';
import { purchaseCart } from '../inventory';
import { GameService } from '../game.service';
import { GameSaveManager, loadGameSave, parseGameSave, saveGame } from '../game-save';
import { createWorld, getGpu, setGpuWorkbenchState } from '../mining-world';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('game saves', () => {
  it('restores economy, mining progress, inventory, scripts and time after a reload', () => {
    const game = new GameService();
    const base = createWorld();
    const bought = purchaseCart({ ...base, cashEur: 50_000, unlockedResearchIds: ['gpu-dual'] }, [
      { productId: 'gpu-dual', quantity: 1 },
    ]);
    const blocks = [{ id: 1, progress: 37 }];
    const chain = { ...bought.cryptoChains[STARTING_CRYPTO_ID], blocks };
    const world = {
      ...bought,
      blocks,
      cryptoChains: { ...bought.cryptoChains, [STARTING_CRYPTO_ID]: chain },
      holdings: { [STARTING_CRYPTO_ID]: 25 },
    };
    game.world.set(setGpuWorkbenchState(world, 1, true));
    game.gameElapsedMinutes.set(75);
    game.speed.set(2);
    const library = game.createFile('utilita.mine');
    game.updateFileCode(library.id, 'def doppio(n) { return n * 2; }');

    const storage = memoryStorage();
    saveGame(game.createSave(), storage);
    vi.stubGlobal('localStorage', storage);
    const reloaded = new GameService();
    reloaded.start();

    expect(reloaded.world().cashEur).toBe(0);
    expect(cryptoValueEur(reloaded.world().holdings)).toBeCloseTo(
      bought.cashEur + cryptoValueEur(world.holdings),
    );
    expect(reloaded.world().inventory.items).toHaveLength(1);
    expect(reloaded.world().cryptoChains[STARTING_CRYPTO_ID].blocks[0].progress).toBe(37);
    expect(reloaded.world().blocks).toBe(reloaded.world().cryptoChains[STARTING_CRYPTO_ID].blocks);
    expect(getGpu(reloaded.world(), 1).onWorkbench).toBe(false);
    expect(reloaded.gameElapsedMinutes()).toBe(75);
    expect(reloaded.speed()).toBe(2);
    expect(reloaded.activeFileId()).toBe(library.id);
    expect(reloaded.code()).toContain('def doppio');
    expect(reloaded.logs().at(-1)?.message).toBe('Partita salvata ripristinata.');
  });

  it('rejects invalid or incompatible imports without changing the current game', () => {
    const game = new GameService();
    const originalWorld = game.world();
    const valid = game.createSave();
    const invalidWorld = JSON.parse(JSON.stringify(valid));
    invalidWorld.world.plots[0].rigs[0].gpus[0].modelId = 'missing';
    const invalidFiles = { ...valid, activeFileId: 'missing' };
    const invalidBill = JSON.parse(JSON.stringify(valid));
    invalidBill.world.lastElectricityBill = { gameDay: 1 };

    for (const text of [
      '{bad json',
      JSON.stringify({ ...valid, version: 99 }),
      JSON.stringify(invalidWorld),
      JSON.stringify(invalidFiles),
      JSON.stringify(invalidBill),
    ]) {
      expect(() => parseGameSave(text)).toThrow();
    }
    expect(game.world()).toBe(originalWorld);
  });

  it('rejects importing while a program is running', () => {
    const game = new GameService();
    const save = parseGameSave(JSON.stringify(game.createSave()));
    game.running.set(true);
    expect(() => game.restoreSave(save)).toThrow('Ferma il programma');
  });

  it('returns null when no local save exists', () => {
    expect(loadGameSave(memoryStorage())).toBeNull();
  });

  it('imports a valid file and immediately replaces the local save', async () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const game = new GameService();
    const manager = new GameSaveManager(game);
    try {
      const imported = JSON.parse(JSON.stringify(game.createSave()));
      imported.world.cashEur = 123;
      const file = new File([JSON.stringify(imported)], 'partita.json', {
        type: 'application/json',
      });

      expect(await manager.importFile(file)).toBe(true);
      expect(game.world().cashEur).toBe(0);
      expect(cryptoValueEur(game.world().holdings)).toBeCloseTo(123);
      expect(loadGameSave(storage)?.world.cashEur).toBe(0);
      await expect(manager.importFile(new File(['{bad'], 'rotto.json'))).rejects.toThrow();
      expect(game.world().cashEur).toBe(0);
    } finally {
      manager.destroy();
    }
  });

  it('automatically saves changes and flushes them when the page closes', async () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const listeners = new Map<string, EventListener>();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', {
      addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
      removeEventListener: (name: string) => listeners.delete(name),
    });
    let manager: GameSaveManager | undefined;
    try {
      const game = new GameService();
      manager = new GameSaveManager(game);
      game.world.update((world) => ({ ...world, cashEur: 45 }));

      await vi.advanceTimersByTimeAsync(3_000);
      expect(loadGameSave(storage)?.world.cashEur).toBe(0);
      expect(cryptoValueEur(loadGameSave(storage)!.world.holdings)).toBeCloseTo(45);

      game.world.update((world) => ({ ...world, cashEur: 90 }));
      await Promise.resolve();
      listeners.get('pagehide')?.(new Event('pagehide'));
      expect(loadGameSave(storage)?.world.cashEur).toBe(0);
      expect(cryptoValueEur(loadGameSave(storage)!.world.holdings)).toBeCloseTo(90);
    } finally {
      manager?.destroy();
      vi.useRealTimers();
    }
  });

  it('resets progress and scripts without restoring old files on reload', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const game = new GameService();
    game.start();
    game.world.update((world) => ({ ...world, cashEur: 1_000 }));
    game.gameElapsedMinutes.set(90);
    game.speed.set(2);
    const extraFile = game.createFile('vecchio.mine');
    game.updateFileCode(extraFile.id, 'vecchio');
    storage.setItem('blockcraft-line-effects', 'false');
    storage.setItem('blockcraft-gpu-hover-tooltip', 'false');
    const manager = new GameSaveManager(game);
    try {
      manager.flush();
      expect(storage.getItem('blockcraft-files')).not.toBeNull();
      expect(manager.reset()).toBe(true);

      expect(game.world().cashEur).toBe(createWorld().cashEur);
      expect(game.gameElapsedMinutes()).toBe(0);
      expect(game.speed()).toBe(1);
      expect(game.files()).toEqual([{ id: 'main', name: 'main.mine', code: EXAMPLES[0].code }]);
      expect(game.activeFileId()).toBe('main');
      expect(game.started()).toBe(true);
      expect(storage.getItem('blockcraft-files')).toBeNull();
      expect(storage.getItem('blockcraft-active-file')).toBeNull();
      expect(storage.getItem('blockcraft-code')).toBeNull();
      expect(storage.getItem('blockcraft-line-effects')).toBe('false');
      expect(storage.getItem('blockcraft-gpu-hover-tooltip')).toBe('false');
      expect(loadGameSave(storage)?.world.cashEur).toBe(createWorld().cashEur);

      const reloaded = new GameService();
      expect(reloaded.files()).toEqual(game.files());
      expect(reloaded.world().cashEur).toBe(createWorld().cashEur);
    } finally {
      manager.destroy();
    }
  });

  it('refuses reset while a program is running', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const game = new GameService();
    const manager = new GameSaveManager(game);
    try {
      game.world.update((world) => ({ ...world, cashEur: 100 }));
      manager.flush();
      game.running.set(true);
      expect(() => manager.reset()).toThrow('Ferma il programma');
      expect(game.world().cashEur).toBe(100);
      expect(loadGameSave(storage)?.world.cashEur).toBe(0);
      expect(cryptoValueEur(loadGameSave(storage)!.world.holdings)).toBeCloseTo(100);
    } finally {
      game.running.set(false);
      manager.destroy();
    }
  });
});
