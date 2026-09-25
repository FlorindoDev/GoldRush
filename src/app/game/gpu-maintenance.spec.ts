import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_BALANCE } from '../config/game-balance';
import { GameService } from './game.service';
import { dustWearMultiplier, maintainGpu, thermalServiceHoursRemaining } from './gpu-maintenance';
import {
  applyGpuWork,
  createGpuOperatingState,
  gpuMiningPowerWatts,
  gpuTemperature,
} from './gpu-operation';
import { getGpuTelemetry } from './gpu-telemetry';
import { createWorld, getGpu, recordGpuWork, serviceGpu } from './mining-world';

const config = GAME_BALANCE.gpu.maintenance;
afterEach(() => vi.useRealTimers());

describe('GPU maintenance', () => {
  it('accumulates dirt and service hours only from actual work, including partial actions', () => {
    const gpu = { ...createGpuOperatingState(), hoursSinceThermalService: 0 };
    const partial = applyGpuWork(gpu, 0.25, 0, 1000);
    expect(partial.dustPercent).toBeCloseTo(config.dustPercentPerHour * 0.25);
    expect(partial.hoursSinceThermalService).toBe(0.25);
    const idle = applyGpuWork(partial, 0, 1e8, 1e8);
    expect(idle.dustPercent).toBe(partial.dustPercent);
    expect(thermalServiceHoursRemaining(idle)).toBe(config.thermalServiceIntervalHours - 0.25);
    expect(gpuTemperature(partial, 1e8)).toBe(GAME_BALANCE.gpu.idle.temperatureCelsius);
    const saturated = applyGpuWork({ ...gpu, dustPercent: 100 }, 1, 0, 1000);
    expect(saturated.dustPercent).toBe(100);
  });

  it('dust accelerates heating and wear beyond the configured threshold', () => {
    const gpu = createGpuOperatingState();
    const clean = applyGpuWork(gpu, 1, 0, 1000);
    const dirty = applyGpuWork({ ...gpu, dustPercent: 90 }, 1, 0, 1000);
    expect(dirty.temperatureCelsius).toBeGreaterThan(clean.temperatureCelsius);
    expect(dirty.wearPercent).toBeGreaterThan(clean.wearPercent * 2);
    expect(dustWearMultiplier(config.dustWearThresholdPercent)).toBe(1);
    expect(dustWearMultiplier(config.dustWearThresholdPercent + 1)).toBeGreaterThan(1);
    expect(dustWearMultiplier(100)).toBe(config.dustMaxWearMultiplier);
  });

  it('cleans only dust without repairing wear, cancelling faults or resetting service hours', () => {
    const gpu = {
      ...createGpuOperatingState(),
      dustPercent: 85,
      wearPercent: 40,
      hoursSinceThermalService: 6,
      stopped: true,
    };
    expect(maintainGpu(gpu, { kind: 'clean' })).toEqual({ ...gpu, dustPercent: 0 });
  });

  it('thermal service repairs wear, blocks repeated use, and unlocks exactly after sufficient GPU work', () => {
    const worn = { ...createGpuOperatingState(), wearPercent: 100, dustPercent: 35, stopped: true };
    let serviced = maintainGpu(worn, { kind: 'thermal' });
    expect(serviced.wearPercent).toBe(0);
    expect(serviced.stopped).toBe(true);
    expect(serviced.dustPercent).toBe(35);
    expect(thermalServiceHoursRemaining(serviced)).toBe(config.thermalServiceIntervalHours);
    expect(() => maintainGpu(serviced, { kind: 'thermal' })).toThrow('Usa di nuovo');
    serviced = { ...serviced, stopped: false };
    for (let i = 0; i < config.thermalServiceIntervalHours - 1; i++) {
      serviced = applyGpuWork(serviced, 1, i * 10_000, i * 10_000 + 1);
    }
    serviced = applyGpuWork(serviced, 0.5, 1e6, 1e6);
    expect(thermalServiceHoursRemaining(serviced)).toBe(0.5);
    expect(() => maintainGpu(serviced, { kind: 'thermal' })).toThrow();
    serviced = applyGpuWork(serviced, 0.5, 2e6, 2e6);
    expect(thermalServiceHoursRemaining(serviced)).toBe(0);
    expect(maintainGpu(serviced, { kind: 'thermal' }).wearPercent).toBe(0);
    expect(() => maintainGpu(createGpuOperatingState(), { kind: 'thermal' })).toThrow(
      'Nessuna usura',
    );
  });

  it('fan kits change cooling, power and rpm; they cannot repair or reset cooldown', () => {
    const gpu = { ...createGpuOperatingState(), wearPercent: 12, hoursSinceThermalService: 4 };
    const performance = maintainGpu(gpu, { kind: 'fan', kit: 'performance' });
    const industrial = maintainGpu(gpu, { kind: 'fan', kit: 'industrial' });
    expect(applyGpuWork(performance, 1, 0, 100).temperatureCelsius).toBeLessThan(
      applyGpuWork(gpu, 1, 0, 100).temperatureCelsius,
    );
    expect(applyGpuWork(industrial, 1, 0, 100).temperatureCelsius).toBeLessThan(
      applyGpuWork(performance, 1, 0, 100).temperatureCelsius,
    );
    expect(gpuMiningPowerWatts(performance) - gpuMiningPowerWatts(gpu)).toBe(12);
    expect(gpuMiningPowerWatts(industrial) - gpuMiningPowerWatts(gpu)).toBe(24);
    expect(performance.wearPercent).toBe(12);
    expect(performance.hoursSinceThermalService).toBe(4);
    expect(getGpuTelemetry(1, performance).maxFanSpeedRpm).toBe(4200);
    expect(maintainGpu(performance, { kind: 'fan', kit: 'stock' })).toEqual(gpu);
  });

  it('isolates maintenance and cooldown by GPU, rejects locked GPUs', () => {
    const initial = createWorld();
    const worked = recordGpuWork(initial, 1, 1, 0, 1000);
    const serviced = serviceGpu(worked, 1, { kind: 'thermal' });
    const otherWorked = recordGpuWork(serviced, 2, 1, 0, 1000);
    expect(thermalServiceHoursRemaining(getGpu(otherWorked, 1))).toBe(
      config.thermalServiceIntervalHours,
    );
    expect(getGpu(serviced, 2)).toEqual(getGpu(initial, 2));
    expect(() => serviceGpu(initial, 3, { kind: 'clean' })).toThrow('bloccato');
  });

  it('requires an idle workbench, preserves changes when switching GPUs and rejects mining on the bench', async () => {
    vi.useFakeTimers();
    const game = new GameService();
    game.start();
    game.setLineEffectsEnabled(false);
    expect(() => game.serviceInspectedGpu({ kind: 'clean' })).toThrow('banco');
    game.inspectGpu(1);
    game.serviceInspectedGpu({ kind: 'fan', kit: 'performance' });
    game.setGpuFanSpeedPercent(1, 80);
    game.inspectGpu(2);
    expect(getGpu(game.world(), 1).fanKit).toBe('performance');
    expect(getGpu(game.world(), 1).targetFanSpeedPercent).toBe(80);
    expect(getGpu(game.world(), 2).fanKit).toBe('stock');
    game.updateCode('plots[0].rigs[0].gpus[1].mine();');
    await game.run();
    expect(
      game.logs().some((log) => log.kind === 'error' && log.message.includes('sul banco')),
    ).toBe(true);
    expect(getGpu(game.world(), 2).dustPercent).toBe(0);
    game.returnToRig();
    const run = game.run();
    expect(() => game.serviceInspectedGpu({ kind: 'clean' })).toThrow();
    await vi.runAllTimersAsync();
    await run;
    expect(getGpu(game.world(), 2).dustPercent).toBeGreaterThan(0);
  });
});
