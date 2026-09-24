import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from './game-balance';

describe('game balance', () => {
  it('keeps starting hardware and GPU telemetry within configured limits', () => {
    const { world, gpu } = GAME_BALANCE;
    const rigCount = world.plotCount * world.rigsPerPlot;
    const gpuCount = rigCount * world.gpusPerRig;

    expect(world.startingRigCount).toBeGreaterThan(0);
    expect(world.startingRigCount).toBeLessThanOrEqual(rigCount);
    expect(world.startingGpuCount).toBeGreaterThan(0);
    expect(world.startingGpuCount).toBeLessThanOrEqual(world.startingRigCount * world.gpusPerRig);
    expect(world.progressPerGpuAtFullFarm).toBeGreaterThan(0);
    expect(world.progressPerGpuAtFullFarm).toBeLessThanOrEqual(gpuCount * 100);
    expect(gpu.idle.frequencyGhz).toBeLessThanOrEqual(gpu.mining.frequencyGhz);
    expect(gpu.mining.frequencyGhz).toBeLessThanOrEqual(gpu.limits.frequencyGhz);
    expect(gpu.idle.temperatureCelsius).toBeLessThanOrEqual(gpu.mining.temperatureCelsius);
    expect(gpu.mining.temperatureCelsius).toBeLessThanOrEqual(gpu.limits.temperatureCelsius);
    expect(gpu.idle.fanSpeedPercent).toBeGreaterThanOrEqual(0);
    expect(gpu.mining.fanSpeedPercent).toBeLessThanOrEqual(100);
  });

  it('keeps camera, animation and scripting limits usable', () => {
    const { camera, animation, mining, scripting } = GAME_BALANCE;

    expect(camera.scene.near).toBeGreaterThan(0);
    expect(camera.scene.far).toBeGreaterThan(camera.scene.near);
    expect(camera.scene.minDistance).toBeLessThan(camera.scene.maxDistance);
    expect(camera.scene.minPolarAngleRadians).toBeLessThan(camera.scene.maxPolarAngleRadians);
    expect(animation.transitionSeconds).toBeGreaterThan(0);
    expect(mining.actionDurationMs).toBeGreaterThan(0);
    expect(scripting.yieldEverySteps).toBeGreaterThan(0);
    expect(scripting.maxExecutionSteps).toBeGreaterThan(scripting.yieldEverySteps);
  });
});
