import { GAME_BALANCE } from '../config/game-balance';

export interface GpuTelemetry {
  readonly model: string;
  readonly frequencyGhz: number;
  readonly powerWatts: number;
  readonly temperatureCelsius: number;
  readonly fanSpeed: number;
  readonly currentFanSpeedRpm: number;
  readonly maxFrequencyGhz: number;
  readonly maxFanSpeedRpm: number;
  readonly maxTemperatureCelsius: number;
}

const { model, idle, mining, limits } = GAME_BALANCE.gpu;

export function getGpuTelemetry(workload: number): GpuTelemetry {
  const load = Math.min(1, Math.max(0, workload));
  const frequencyGhz = interpolate(idle.frequencyGhz, mining.frequencyGhz, load);
  const fanSpeed = Math.round(interpolate(idle.fanSpeedPercent, mining.fanSpeedPercent, load));

  return {
    model,
    frequencyGhz: round(frequencyGhz, 2),
    powerWatts: Math.round(interpolate(idle.powerWatts, mining.powerWatts, load)),
    temperatureCelsius: Math.round(
      interpolate(idle.temperatureCelsius, mining.temperatureCelsius, load),
    ),
    fanSpeed,
    currentFanSpeedRpm: Math.round((limits.fanSpeedRpm * fanSpeed) / 100),
    maxFrequencyGhz: limits.frequencyGhz,
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
