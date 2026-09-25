import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from '../config/game-balance';
import { satoshisToEuros } from './electricity';
import { gpuTemperature } from './gpu-operation';
import { getGpuTelemetry } from './gpu-telemetry';
import {
  BLOCK_REWARD,
  createWorld,
  expandWorld,
  farmPowerWatts,
  getGpu,
  mineGpu,
  MINE_PROGRESS_PER_GPU,
  recordGpuWork,
  resumeGpu,
  setGpuFrequency,
  stopGpu,
} from './mining-world';

describe('GPU operation and electricity', () => {
  it('accumulates energy without charging until the block is complete', () => {
    const world = mineGpu(createWorld(), 1, 0);
    expect(world.satoshis).toBe(0);
    expect(world.electricity.energyKwh).toBeCloseTo(0.237);
    expect(world.electricity.pendingKwh).toBeCloseTo(0.237);
    expect(world.lastSettlement).toBeNull();
    expect(satoshisToEuros(BLOCK_REWARD)).toBe(600);
  });

  it('settles the final action once, rounding to a whole satoshi', () => {
    let world = createWorld();
    world = { ...world, blocks: [{ id: 1, progress: 99.9 }] };
    const settled = mineGpu(world, 1, 0);
    expect(settled.electricity.paidSatoshis).toBe(119);
    expect(settled.satoshis).toBe(BLOCK_REWARD - 119);
    expect(settled.lastSettlement).toMatchObject({
      blockId: 1,
      electricitySatoshis: 119,
      rewardSatoshis: BLOCK_REWARD,
    });
    expect(settled.electricity.pendingKwh).toBe(0);
    expect(() => mineGpu(settled, 1, 0)).toThrow('completato');
    const next = mineGpu(expandWorld(settled), 1, 0);
    expect(next.electricity.paidSatoshis).toBe(119);
    expect(next.satoshis).toBe(settled.satoshis);
    expect(next.lastSettlement).toBe(settled.lastSettlement);
  });

  it('retains debt when electricity costs more than the available reward', () => {
    const world = createWorld();
    const settled = mineGpu(
      {
        ...world,
        blocks: [{ id: 1, progress: 99.9 }],
        electricity: { energyKwh: 3000, pendingKwh: 3000, paidSatoshis: 0 },
      },
      1,
      0,
    );
    expect(settled.satoshis).toBeLessThan(0);
    expect(settled.satoshis + settled.electricity.paidSatoshis).toBe(BLOCK_REWARD);
  });

  it('underclock trades lower progress for lower power and wear', () => {
    const normal = mineGpu(createWorld(), 1, 0);
    const underclocked = mineGpu(setGpuFrequency(createWorld(), 1, 0.9), 1, 0);
    expect(underclocked.blocks[0].progress).toBeCloseTo(MINE_PROGRESS_PER_GPU / 2);
    expect(underclocked.electricity.energyKwh).toBeCloseTo(0.08325);
    expect(getGpu(underclocked, 1).wearPercent).toBeLessThan(getGpu(normal, 1).wearPercent);
  });

  it('overclock increases progress, heat, wear and energy independently per GPU', () => {
    const original = createWorld();
    const normal = mineGpu(original, 1, 0);
    const boosted = mineGpu(setGpuFrequency(original, 1, 2.4), 1, 0);
    expect(boosted.blocks[0].progress).toBeGreaterThan(normal.blocks[0].progress);
    expect(boosted.electricity.energyKwh).toBeGreaterThan(normal.electricity.energyKwh);
    expect(getGpu(boosted, 1).temperatureCelsius).toBeGreaterThan(
      getGpu(normal, 1).temperatureCelsius,
    );
    expect(getGpu(boosted, 1).wearPercent).toBeGreaterThan(getGpu(normal, 1).wearPercent);
    expect(getGpu(boosted, 2)).toEqual(getGpu(original, 2));
    expect(getGpu(original, 1).wearPercent).toBe(0);
  });

  it.each([NaN, Infinity, -1, 0.49])('rejects invalid clock %s without mutation', (frequency) => {
    const original = createWorld();
    expect(() => setGpuFrequency(original, 1, frequency)).toThrow('frequenza');
    expect(getGpu(original, 1).targetFrequencyGhz).toBe(1.8);
  });

  it('accepts both frequency boundaries and latches a stop above the absolute maximum', () => {
    let world = setGpuFrequency(createWorld(), 1, 0.5);
    expect(getGpu(world, 1).targetFrequencyGhz).toBe(0.5);
    world = setGpuFrequency(world, 1, 2.6);
    expect(getGpu(world, 1).stopped).toBe(false);
    world = setGpuFrequency(world, 1, 2.6001);
    expect(getGpu(world, 1).stopped).toBe(true);
    expect(getGpu(world, 1).targetFrequencyGhz).toBe(2.6);
    world = setGpuFrequency(world, 1, 1.8);
    expect(() => mineGpu(world, 1, 0)).toThrow('clearStop');
    expect(getGpu(resumeGpu(world, 1, 0), 1).stopped).toBe(false);
  });

  it('stops on overheating without progress, then requires cooldown and explicit clearStop', () => {
    let world = setGpuFrequency(createWorld(), 1, 2.6);
    let progress = 0;
    for (let action = 0; action < 20 && !getGpu(world, 1).stopped; action++) {
      progress = world.blocks[0].progress;
      world = mineGpu(world, 1, 0);
    }
    expect(getGpu(world, 1).stopReason).toBe('Surriscaldamento');
    expect(world.blocks[0].progress).toBe(progress);
    expect(() => resumeGpu(world, 1, 0)).toThrow('surriscaldata');
    expect(gpuTemperature(getGpu(world, 1), 5000)).toBe(34);
    expect(() => mineGpu(world, 1, 5000)).toThrow('ferma');
    const cooled = resumeGpu(setGpuFrequency(world, 1, 1.8), 1, 5000);
    expect(mineGpu(cooled, 1, 5000).blocks[0].progress).toBeGreaterThan(progress);
  });

  it('manual stop is idempotent, sets power to zero and preserves wear when cleared', () => {
    const mined = mineGpu(createWorld(), 1, 0);
    const stopped = stopGpu(stopGpu(mined, 1), 1);
    expect(farmPowerWatts(stopped, null)).toBe(32);
    expect(getGpuTelemetry(1, getGpu(stopped, 1), 0).powerWatts).toBe(0);
    expect(() => mineGpu(stopped, 1, 0)).toThrow('ferma');
    const resumed = resumeGpu(stopped, 1, 5000);
    expect(resumed.blocks).toEqual(mined.blocks);
    expect(getGpu(resumed, 1).wearPercent).toBe(getGpu(mined, 1).wearPercent);
  });

  it('charges standby for other unlocked GPUs, excluding stopped cards', () => {
    const initial = createWorld();
    const twoGpus = {
      ...initial,
      plots: initial.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) => ({ ...gpu, unlocked: gpu.id <= 2 })),
        })),
      })),
    };
    expect(mineGpu(twoGpus, 1, 0).electricity.energyKwh).toBeCloseTo(0.237);
    expect(mineGpu(stopGpu(twoGpus, 2), 1, 0).electricity.energyKwh).toBeCloseTo(0.205);
    expect(() => setGpuFrequency(initial, 3, 2)).toThrow('bloccato');
  });

  it('keeps partial energy and wear without progress or a premature payout', () => {
    const partial = recordGpuWork(createWorld(), 1, 0.5, 0, 425);
    expect(partial.electricity.pendingKwh).toBeCloseTo(0.1185);
    expect(getGpu(partial, 1).wearPercent).toBeCloseTo(0.0025);
    expect(partial.blocks[0].progress).toBe(0);
    expect(partial.satoshis).toBe(0);
    const settled = mineGpu({ ...partial, blocks: [{ id: 1, progress: 99.9 }] }, 1, 425);
    expect(settled.electricity.paidSatoshis).toBe(178);
  });

  it('wear reaching 100 blocks restart until maintenance and a new world resets all state', () => {
    const original = createWorld();
    const worn = {
      ...original,
      plots: original.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) => (gpu.id === 1 ? { ...gpu, wearPercent: 99.999 } : gpu)),
        })),
      })),
    };
    const failed = mineGpu(worn, 1, 0);
    expect(getGpu(failed, 1).wearPercent).toBe(100);
    expect(failed.blocks[0].progress).toBe(0);
    expect(() => resumeGpu(failed, 1, GAME_BALANCE.gpu.cooldownMs)).toThrow('esaurita');
    expect(getGpu(createWorld(), 1).wearPercent).toBe(0);
    expect(createWorld().electricity.energyKwh).toBe(0);
  });
});
