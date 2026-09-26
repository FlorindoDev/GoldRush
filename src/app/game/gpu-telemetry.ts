import { GAME_BALANCE } from '../config/game-balance';
import { GAMEPLAY_RIG_SETUP, type RigSetup } from '../config/rig-config';
import type { GpuFanKit } from './gpu-maintenance';
import {
  gpuMiningPowerWatts,
  gpuIdlePowerWatts,
  gpuMaxFanSpeedRpm,
  rigAuxiliaryPowerWattsPerGpu,
  gpuTemperature,
  gpuTemperatureWhilePoweredDown,
  isGpuOperational,
  type GpuOperatingState,
} from './gpu-operation';

export interface GpuTelemetry {
  readonly model: string;
  readonly frequencyGhz: number;
  readonly powerWatts: number;
  readonly temperatureCelsius: number;
  readonly fanSpeed: number;
  readonly targetFanSpeedPercent: number | null;
  readonly currentFanSpeedRpm: number;
  readonly maxFrequencyGhz: number;
  readonly minFrequencyGhz: number;
  readonly absoluteMaxFrequencyGhz: number;
  readonly targetFrequencyGhz: number;
  readonly wearPercent: number;
  readonly dustPercent: number;
  readonly fanKit: GpuFanKit;
  readonly maxFanSpeedRpm: number;
  readonly maxTemperatureCelsius: number;
}

const { model, idle, mining, limits } = GAME_BALANCE.gpu;

export function getGpuTelemetry(
  workload: number,
  gpu?: GpuOperatingState,
  now = Date.now(),
  rigRunning = true,
  rigPoweredDownAt = now,
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): GpuTelemetry {
  const operational = !gpu || isGpuOperational(gpu);
  const powered = rigRunning;
  const load = powered && operational ? Math.min(1, Math.max(0, workload)) : 0;
  const targetFrequencyGhz = gpu?.targetFrequencyGhz ?? mining.frequencyGhz;
  const frequencyGhz =
    powered && operational ? interpolate(idle.frequencyGhz, targetFrequencyGhz, load) : 0;
  const temperatureCelsius = gpu
    ? rigRunning
      ? gpuTemperature(gpu, now, rigSetup)
      : gpuTemperatureWhilePoweredDown(gpu, now, rigPoweredDownAt, rigSetup)
    : rigRunning
      ? interpolate(idle.temperatureCelsius, mining.temperatureCelsius, load)
      : 0;
  const thermalLoad = Math.min(
    1,
    Math.max(
      0,
      (temperatureCelsius - idle.temperatureCelsius) /
        (limits.temperatureCelsius - idle.temperatureCelsius),
    ),
  );
  const fanKit = gpu?.fanKit ?? 'stock';
  const maxFanSpeedRpm = gpuMaxFanSpeedRpm(fanKit);
  const automaticFanSpeed =
    maxFanSpeedRpm === 0
      ? 0
      : gpu
        ? Math.round(interpolate(idle.fanSpeedPercent, 100, thermalLoad))
        : Math.round(interpolate(idle.fanSpeedPercent, mining.fanSpeedPercent, load));
  const fanSpeed =
    powered && maxFanSpeedRpm > 0 ? (gpu?.targetFanSpeedPercent ?? automaticFanSpeed) : 0;

  return {
    model,
    frequencyGhz: round(frequencyGhz, 2),
    powerWatts:
      powered && operational
        ? round(
            interpolate(
              gpuIdlePowerWatts(rigSetup),
              gpu
                ? gpuMiningPowerWatts(gpu, rigSetup)
                : mining.powerWatts + rigAuxiliaryPowerWattsPerGpu(rigSetup),
              load,
            ),
            2,
          )
        : 0,
    temperatureCelsius: round(temperatureCelsius, 2),
    fanSpeed,
    targetFanSpeedPercent: gpu?.targetFanSpeedPercent ?? null,
    currentFanSpeedRpm: Math.round((maxFanSpeedRpm * fanSpeed) / 100),
    maxFrequencyGhz: limits.frequencyGhz,
    minFrequencyGhz: limits.minFrequencyGhz,
    absoluteMaxFrequencyGhz: limits.absoluteFrequencyGhz,
    targetFrequencyGhz,
    wearPercent: gpu?.wearPercent ?? 0,
    dustPercent: gpu?.dustPercent ?? 0,
    fanKit,
    maxFanSpeedRpm,
    maxTemperatureCelsius: limits.temperatureCelsius,
  };
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
