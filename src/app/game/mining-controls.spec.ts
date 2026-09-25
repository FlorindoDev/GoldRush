import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_BALANCE } from '../config/game-balance';
import { GameService } from './game.service';
import { getGpu } from './mining-world';

function createGame(code: string) {
  const game = new GameService();
  game.start();
  game.setLineEffectsEnabled(false);
  game.updateCode(code);
  return game;
}

function output(game: GameService) {
  return game
    .logs()
    .filter((log) => log.kind === 'output')
    .map((log) => log.message);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('Mining controls through MineScript', () => {
  it('reads live clock, stop state, wear and electricity through retained script objects', async () => {
    const game = createGame(`let gpu = plots[0].rigs[0].gpus[0];
      gpu.setFrequencyGhz(2);
      print(gpu.getTargetFrequencyGhz());
      gpu.stop(); print(gpu.isStopped()); print(gpu.isWorking());
      gpu.clearStop(); mine();
      print(gpu.getWearPercent() > 0);
      print(electricity.getEnergyKwh() > 0);
      print(electricity.getPendingCostEur() > 0);
      print(electricity.getPricePerKwh());`);
    const run = game.run();
    await vi.runAllTimersAsync();
    await run;
    expect(game.errorLine()).toBe(0);
    expect(output(game).filter((line) => !line.includes('mine()'))).toEqual([
      '2',
      'true',
      'false',
      'true',
      'true',
      'true',
      '0.3',
    ]);
  });

  it('GPU stop skips that card while global mining continues on the farm', async () => {
    const game = createGame('let gpu = plots[0].rigs[0].gpus[0]; mine(); print("finished");');
    const run = game.run();
    await vi.advanceTimersByTimeAsync(GAME_BALANCE.mining.actionDurationMs / 2);
    expect(game.activeGpuId()).toBe(1);
    game.stopGpu(1);
    await vi.runAllTimersAsync();
    await run;
    expect(game.world().blocks[0].progress).toBeGreaterThan(0);
    expect(game.world().electricity.pendingKwh).toBeGreaterThan(0);
    expect(getGpu(game.world(), 1).stopped).toBe(true);
    expect(game.mining()).toBe(false);
    expect(output(game)).toContain('finished');
    const nextRun = game.run();
    await vi.runAllTimersAsync();
    await nextRun;
    expect(game.world().electricity.pendingKwh).toBeGreaterThan(0);
    game.updateCode('plots[0].rigs[0].gpus[0].clearStop();');
    await game.run();
    expect(getGpu(game.world(), 1).stopped).toBe(false);
    expect(game.world().blocks[0].progress).toBeGreaterThan(0);
  });

  it('editor stop preserves partial costs but does not latch a GPU stop', async () => {
    const game = createGame('mine();');
    const run = game.run();
    await vi.advanceTimersByTimeAsync(425);
    game.stop();
    await run;
    expect(game.world().satoshis).toBe(0);
    expect(getGpu(game.world(), 1).stopped).toBe(false);
    expect(game.world().electricity.pendingKwh).toBeGreaterThan(0);
  });

  it('keeps completed action energy identical at 1x and 2x speed', async () => {
    const normal = createGame('mine();');
    const fast = createGame('mine();');
    fast.speed.set(2);
    const runs = Promise.all([normal.run(), fast.run()]);
    await vi.runAllTimersAsync();
    await runs;
    expect(normal.world().electricity).toEqual(fast.world().electricity);
    expect(getGpu(normal.world(), 1).wearPercent).toBe(getGpu(fast.world(), 1).wearPercent);
    const before = normal.world().electricity;
    await vi.advanceTimersByTimeAsync(5000);
    expect(normal.gpuTelemetry(1).temperatureCelsius).toBe(34);
    expect(normal.world().electricity).toEqual(before);
  });

  it.each([
    'gpu.stop(1);',
    'gpu.clearStop(1);',
    'gpu.getWearPercent(1);',
    'gpu.setFrequencyGhz("2");',
    'electricity.getPricePerKwh(1);',
  ])('reports invalid arguments on their source line: %s', async (source) => {
    const game = createGame(`let gpu = plots[0].rigs[0].gpus[0];\n${source}`);
    await game.run();
    expect(game.errorLine()).toBe(2);
    expect(getGpu(game.world(), 1).stopped).toBe(false);
  });

  it('pays the block reward without billing electricity until day end', async () => {
    const game = createGame('mine();');
    game.world.update((world) => ({ ...world, blocks: [{ id: 1, progress: 99.9 }] }));
    const run = game.run();
    await vi.runAllTimersAsync();
    await run;
    expect(game.world().lastSettlement?.electricitySatoshis).toBe(0);
    expect(game.world().electricity.paidSatoshis).toBe(0);
    expect(game.world().electricity.pendingKwh).toBeGreaterThan(0);
    expect(game.balance()).toBe('0.01');
    expect(game.balanceEur()).toBe(600);
    game.reset();
    expect(game.world().lastSettlement).toBeNull();
    expect(game.readElectricity().totalCostEur).toBe(0);
    expect(game.balanceEur()).toBe(0);
  });
});
