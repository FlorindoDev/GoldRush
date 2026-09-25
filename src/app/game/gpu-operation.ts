import { GAME_BALANCE } from '../config/game-balance';
import { dustWearMultiplier, type GpuFanKit } from './gpu-maintenance';

const { gpu: config, economy } = GAME_BALANCE;

export interface GpuOperatingState {
  readonly targetFrequencyGhz: number;
  readonly targetFanSpeedPercent: number | null;
  readonly temperatureCelsius: number;
  readonly wearPercent: number;
  readonly dustPercent: number;
  readonly hoursSinceThermalService: number;
  readonly fanKit: GpuFanKit;
  readonly onWorkbench: boolean;
  readonly stopped: boolean;
  readonly stopReason: string;
  readonly lastUpdatedAt: number;
}

export function createGpuOperatingState(): GpuOperatingState {
  return {
    targetFrequencyGhz: config.mining.frequencyGhz,
    targetFanSpeedPercent: null,
    temperatureCelsius: config.idle.temperatureCelsius,
    wearPercent: 0,
    dustPercent: 0,
    hoursSinceThermalService: config.maintenance.thermalServiceIntervalHours,
    fanKit: 'stock',
    onWorkbench: false,
    stopped: false,
    stopReason: '',
    lastUpdatedAt: 0,
  };
}

export function gpuTemperature(gpu: GpuOperatingState, now: number): number {
  if (gpu.onWorkbench) {
    const elapsed = Math.max(0, now - gpu.lastUpdatedAt);
    return gpu.temperatureCelsius * (1 - Math.min(1, elapsed / config.benchCoolingMs));
  }
  const cooling = Math.min(1, Math.max(0, now - gpu.lastUpdatedAt) / config.cooldownMs);
  return (
    gpu.temperatureCelsius + (config.idle.temperatureCelsius - gpu.temperatureCelsius) * cooling
  );
}

export function gpuTemperatureWhilePoweredDown(
  gpu: GpuOperatingState,
  now: number,
  poweredDownAt: number,
): number {
  const duration = gpu.onWorkbench ? config.benchCoolingMs : config.cooldownMs;
  const elapsed = Math.max(0, now - poweredDownAt);
  const cooling = Math.min(1, elapsed / duration);
  return gpuTemperature(gpu, poweredDownAt) * (1 - cooling);
}

export function rigAuxiliaryPowerWattsPerGpu(): number {
  return (
    (GAME_BALANCE.rig.fan.powerWatts * GAME_BALANCE.rig.fanCount +
      GAME_BALANCE.rig.coolingMethod.extraPowerWatts) /
    GAME_BALANCE.world.gpusPerRig
  );
}

function rigFanCoolingCelsius(): number {
  return Math.min(
    GAME_BALANCE.rig.fanTuning.maxCoolingCelsius,
    GAME_BALANCE.rig.fan.airflowCfm *
      GAME_BALANCE.rig.fanCount *
      GAME_BALANCE.rig.fanTuning.coolingCelsiusPerCfm,
  );
}

export function gpuMiningPowerWatts(gpu: GpuOperatingState): number {
  return (
    config.mining.powerWatts * (gpu.targetFrequencyGhz / config.mining.frequencyGhz) ** 2 +
    config.fanKits[gpu.fanKit].extraPowerWatts +
    rigAuxiliaryPowerWattsPerGpu()
  );
}

export function gpuIdlePowerWatts(): number {
  return config.idle.powerWatts + rigAuxiliaryPowerWattsPerGpu();
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

export function setGpuFanSpeed(
  gpu: GpuOperatingState,
  fanSpeedPercent: number | null,
): GpuOperatingState {
  if (fanSpeedPercent === null) {
    return { ...gpu, targetFanSpeedPercent: null };
  }
  if (!Number.isFinite(fanSpeedPercent) || fanSpeedPercent < 0 || fanSpeedPercent > 100) {
    throw new Error('La velocità delle ventole deve essere un numero tra 0 e 100%.');
  }
  return { ...gpu, targetFanSpeedPercent: fanSpeedPercent };
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
  const workedHours = economy.simulatedHoursPerAction * fraction;
  const dustPercent = Math.min(
    100,
    gpu.dustPercent +
      config.maintenance.dustPercentPerHour *
        config.dustDamage.dustBuildUpMultiplier *
        (1 - GAME_BALANCE.rig.dustSystem.filterEfficiencyPercent / 100) *
        workedHours,
  );
  const dustLoad = (gpu.dustPercent + dustPercent) / 200;
  const initialTemperature = gpuTemperature(gpu, startedAt);
  const fanSpeedPercent = gpu.targetFanSpeedPercent ?? config.mining.fanSpeedPercent;
  const fanCooling =
    (config.mining.fanSpeedPercent - fanSpeedPercent) * config.fanCoolingCelsiusPerPercent;
  const rigDustSystem = GAME_BALANCE.rig.dustSystem;
  const rigCoolingMethod = GAME_BALANCE.rig.coolingMethod;
  const equilibrium =
    config.idle.temperatureCelsius +
    (config.mining.temperatureCelsius - config.idle.temperatureCelsius) * ratio ** 2 +
    fanCooling +
    rigDustSystem.airflowResistanceCelsius +
    dustLoad * config.dustDamage.maxExtraHeatCelsius -
    config.fanKits[gpu.fanKit].coolingCelsius * (fanSpeedPercent / config.mining.fanSpeedPercent) -
    rigCoolingMethod.coolingCelsius -
    rigFanCoolingCelsius();
  const response =
    1 -
    (1 - config.thermalResponsePerAction) **
      (fraction * (1 + dustLoad * config.dustDamage.maxHeatingResponseBonus));
  const temperatureCelsius = initialTemperature + (equilibrium - initialTemperature) * response;
  const heatStress = Math.max(1, temperatureCelsius / config.mining.temperatureCelsius);
  const wearPercent = Math.min(
    100,
    gpu.wearPercent +
      config.wearPercentPerHour *
        workedHours *
        ratio ** 2 *
        heatStress ** 2 *
        dustWearMultiplier(dustLoad * 100, config.dustDamage),
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
    dustPercent,
    hoursSinceThermalService: Math.min(
      config.maintenance.thermalServiceIntervalHours,
      gpu.hoursSinceThermalService + workedHours,
    ),
    lastUpdatedAt: endedAt,
    stopped: gpu.stopped || Boolean(fault),
    stopReason: fault || gpu.stopReason,
  };
}
