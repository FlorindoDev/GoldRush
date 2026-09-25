import { GAME_BALANCE } from '../config/game-balance';

const { gpu: config, economy } = GAME_BALANCE;

export interface GpuOperatingState {
  readonly targetFrequencyGhz: number;
  readonly temperatureCelsius: number;
  readonly wearPercent: number;
  readonly stopped: boolean;
  readonly stopReason: string;
  readonly lastUpdatedAt: number;
}

export function createGpuOperatingState(): GpuOperatingState {
  return {
    targetFrequencyGhz: config.mining.frequencyGhz,
    temperatureCelsius: config.idle.temperatureCelsius,
    wearPercent: 0,
    stopped: false,
    stopReason: '',
    lastUpdatedAt: 0,
  };
}

export function gpuTemperature(gpu: GpuOperatingState, now: number): number {
  const cooling = Math.min(1, Math.max(0, now - gpu.lastUpdatedAt) / config.cooldownMs);
  return (
    gpu.temperatureCelsius + (config.idle.temperatureCelsius - gpu.temperatureCelsius) * cooling
  );
}

export function gpuMiningPowerWatts(gpu: GpuOperatingState): number {
  return config.mining.powerWatts * (gpu.targetFrequencyGhz / config.mining.frequencyGhz) ** 2;
}

export function isGpuOperational(gpu: GpuOperatingState): boolean {
  return (
    !gpu.stopped &&
    gpu.wearPercent < 100 &&
    gpu.targetFrequencyGhz <= config.limits.absoluteFrequencyGhz
  );
}

export function setGpuClock(gpu: GpuOperatingState, frequencyGhz: number): GpuOperatingState {
  if (!Number.isFinite(frequencyGhz) || frequencyGhz < config.limits.minFrequencyGhz) {
    throw new Error(
      `La frequenza deve essere un numero finito >= ${config.limits.minFrequencyGhz} GHz.`,
    );
  }
  if (frequencyGhz > config.limits.absoluteFrequencyGhz) {
    // Il tentativo oltre il limite arresta la scheda senza memorizzare valori fisicamente impossibili.
    return { ...gpu, stopped: true, stopReason: 'Limite assoluto di frequenza superato' };
  }
  return { ...gpu, targetFrequencyGhz: frequencyGhz };
}

export function clearGpuStop(gpu: GpuOperatingState, now: number): GpuOperatingState {
  if (gpu.wearPercent >= 100) {
    throw new Error('GPU esaurita: usura al 100%.');
  }
  if (gpuTemperature(gpu, now) >= config.limits.temperatureCelsius) {
    throw new Error('GPU ancora surriscaldata. Attendi il raffreddamento prima di clearStop().');
  }
  return { ...gpu, stopped: false, stopReason: '' };
}

/** Calore e usura del lavoro realmente svolto, anche se l'azione è stata interrotta. */
export function applyGpuWork(
  gpu: GpuOperatingState,
  fraction: number,
  startedAt: number,
  endedAt: number,
): GpuOperatingState {
  const ratio = gpu.targetFrequencyGhz / config.mining.frequencyGhz;
  const initialTemperature = gpuTemperature(gpu, startedAt);
  const equilibrium =
    config.idle.temperatureCelsius +
    (config.mining.temperatureCelsius - config.idle.temperatureCelsius) * ratio ** 2;
  const response = 1 - (1 - config.thermalResponsePerAction) ** fraction;
  const temperatureCelsius = initialTemperature + (equilibrium - initialTemperature) * response;
  const heatStress = Math.max(1, temperatureCelsius / config.mining.temperatureCelsius);
  const wearPercent = Math.min(
    100,
    gpu.wearPercent +
      config.wearPercentPerHour *
        economy.simulatedHoursPerAction *
        fraction *
        ratio ** 2 *
        heatStress ** 2,
  );
  const fault =
    wearPercent >= 100
      ? 'Usura al 100%'
      : temperatureCelsius >= config.limits.temperatureCelsius
        ? 'Surriscaldamento'
        : '';
  return {
    ...gpu,
    temperatureCelsius,
    wearPercent,
    lastUpdatedAt: endedAt,
    stopped: gpu.stopped || Boolean(fault),
    stopReason: fault || gpu.stopReason,
  };
}
