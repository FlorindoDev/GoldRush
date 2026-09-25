import { GAME_BALANCE } from '../config/game-balance';
import {
  gpuMiningPowerWatts,
  gpuTemperature,
  isGpuOperational,
  type GpuOperatingState,
} from './gpu-operation';

export interface GpuTelemetry {
  readonly model: string;
  readonly frequencyGhz: number;
  readonly powerWatts: number;
  readonly temperatureCelsius: number;
  readonly fanSpeed: number;
  readonly currentFanSpeedRpm: number;
  readonly maxFrequencyGhz: number;
  readonly minFrequencyGhz: number;
  readonly absoluteMaxFrequencyGhz: number;
  readonly targetFrequencyGhz: number;
  readonly wearPercent: number;
  readonly maxFanSpeedRpm: number;
  readonly maxTemperatureCelsius: number;
}

const { model, idle, mining, limits } = GAME_BALANCE.gpu;

export function getGpuTelemetry(
  workload: number,
  gpu?: GpuOperatingState,
  now = Date.now(),
): GpuTelemetry {
  const operational = !gpu || isGpuOperational(gpu);
  const load = operational ? Math.min(1, Math.max(0, workload)) : 0;
  const targetFrequencyGhz = gpu?.targetFrequencyGhz ?? mining.frequencyGhz;
  const frequencyGhz = operational ? interpolate(idle.frequencyGhz, targetFrequencyGhz, load) : 0;
  const temperatureCelsius = gpu
    ? gpuTemperature(gpu, now)
    : interpolate(idle.temperatureCelsius, mining.temperatureCelsius, load);
  const thermalLoad = Math.min(
    1,
    Math.max(
      0,
      (temperatureCelsius - idle.temperatureCelsius) /
        (limits.temperatureCelsius - idle.temperatureCelsius),
    ),
  );
  const fanSpeed = gpu
    ? Math.round(interpolate(idle.fanSpeedPercent, 100, thermalLoad))
    : Math.round(interpolate(idle.fanSpeedPercent, mining.fanSpeedPercent, load));

  return {
    model,
    frequencyGhz: round(frequencyGhz, 2),
    powerWatts: operational
      ? round(
          interpolate(idle.powerWatts, gpu ? gpuMiningPowerWatts(gpu) : mining.powerWatts, load),
          2,
        )
      : 0,
    temperatureCelsius: round(temperatureCelsius, 2),
    fanSpeed,
    currentFanSpeedRpm: Math.round((limits.fanSpeedRpm * fanSpeed) / 100),
    maxFrequencyGhz: limits.frequencyGhz,
    minFrequencyGhz: limits.minFrequencyGhz,
    absoluteMaxFrequencyGhz: limits.absoluteFrequencyGhz,
    targetFrequencyGhz,
    wearPercent: gpu?.wearPercent ?? 0,
    maxFanSpeedRpm: limits.fanSpeedRpm,
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
