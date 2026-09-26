import { GAME_BALANCE } from '../config/game-balance';
import { GPU_DEFAULT_MODEL_ID, GPU_MODELS_BY_ID, type GpuModelId } from '../config/gpu-config';
import { FAN_MODELS_BY_ID } from '../config/fan-config';
import { RIG_COOLING_METHODS } from '../config/cooling-config';
import { RIG_DUST_SYSTEMS } from '../config/dust-filter-config';
import { GAMEPLAY_RIG_SETUP, type RigSetup } from '../config/rig-config';
import { dustWearMultiplier, type GpuFanKit } from './gpu-maintenance';

const { gpu: config, economy } = GAME_BALANCE;

export interface GpuOperatingState {
  readonly modelId: GpuModelId;
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

export function createGpuOperatingState(
  modelId: GpuModelId = GPU_DEFAULT_MODEL_ID,
): GpuOperatingState {
  const specifications = GPU_MODELS_BY_ID[modelId].specifications;
  return {
    modelId,
    targetFrequencyGhz: specifications.mining.frequencyGhz,
    targetFanSpeedPercent: null,
    temperatureCelsius: specifications.idle.temperatureCelsius,
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

export function gpuTemperature(
  gpu: GpuOperatingState,
  now: number,
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): number {
  if (gpu.onWorkbench) {
    const elapsed = Math.max(0, now - gpu.lastUpdatedAt);
    return gpu.temperatureCelsius * (1 - Math.min(1, elapsed / config.benchCoolingMs));
  }
  const cooling = Math.min(1, Math.max(0, now - gpu.lastUpdatedAt) / config.cooldownMs);
  const idleTemperature =
    GPU_MODELS_BY_ID[gpu.modelId].specifications.idle.temperatureCelsius -
    rigFanCoolingCelsius(rigSetup);
  return gpu.temperatureCelsius + (idleTemperature - gpu.temperatureCelsius) * cooling;
}

export function gpuTemperatureWhilePoweredDown(
  gpu: GpuOperatingState,
  now: number,
  poweredDownAt: number,
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): number {
  const duration = gpu.onWorkbench ? config.benchCoolingMs : config.cooldownMs;
  const elapsed = Math.max(0, now - poweredDownAt);
  const cooling = Math.min(1, elapsed / duration);
  return gpuTemperature(gpu, poweredDownAt, rigSetup) * (1 - cooling);
}

export function rigAuxiliaryPowerWattsPerGpu(rigSetup: RigSetup = GAMEPLAY_RIG_SETUP): number {
  const fan = FAN_MODELS_BY_ID[rigSetup.fanId];
  const cooling = RIG_COOLING_METHODS[rigSetup.coolingMethodId];
  return (
    (fan.powerWatts * rigSetup.fanCount + cooling.extraPowerWatts) / GAME_BALANCE.world.gpusPerRig
  );
}

export function rigFanCoolingCelsius(rigSetup: RigSetup): number {
  const fan = FAN_MODELS_BY_ID[rigSetup.fanId];
  return Math.min(
    GAME_BALANCE.rig.fanTuning.maxCoolingCelsius,
    fan.airflowCfm * rigSetup.fanCount * GAME_BALANCE.rig.fanTuning.coolingCelsiusPerCfm,
  );
}

export function gpuMiningPowerWatts(
  gpu: GpuOperatingState,
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): number {
  const { mining } = GPU_MODELS_BY_ID[gpu.modelId].specifications;
  return (
    mining.powerWatts * (gpu.targetFrequencyGhz / mining.frequencyGhz) ** 2 +
    config.fanKits[gpu.fanKit].extraPowerWatts +
    rigAuxiliaryPowerWattsPerGpu(rigSetup)
  );
}

export function gpuIdlePowerWatts(
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
  modelId: GpuModelId = GPU_DEFAULT_MODEL_ID,
): number {
  return (
    GPU_MODELS_BY_ID[modelId].specifications.idle.powerWatts +
    rigAuxiliaryPowerWattsPerGpu(rigSetup)
  );
}

export function gpuMaxFanSpeedRpm(
  fanKit: GpuFanKit = 'stock',
  modelId: GpuModelId = GPU_DEFAULT_MODEL_ID,
): number {
  const model = GPU_MODELS_BY_ID[modelId];
  if (!model.supportsFanKits) return 0;
  const kitMaxRpm = config.fanKits[fanKit].maxRpm;
  const configuredMaxRpm =
    fanKit === 'stock' ? Math.min(model.specifications.limits.fanSpeedRpm, kitMaxRpm) : kitMaxRpm;
  return Math.max(0, configuredMaxRpm);
}

/** Se profilo nominale è 0%, usa 100% come riferimento ed evita divisione per zero. */
export function gpuFanSpeedRatio(
  fanSpeedPercent: number,
  fanKit: GpuFanKit = 'stock',
  modelId: GpuModelId = GPU_DEFAULT_MODEL_ID,
): number {
  if (gpuMaxFanSpeedRpm(fanKit, modelId) === 0) {
    return 0;
  }
  const referenceSpeedPercent =
    GPU_MODELS_BY_ID[modelId].specifications.mining.fanSpeedPercent || 100;
  return fanSpeedPercent / referenceSpeedPercent;
}

export function isGpuOperational(gpu: GpuOperatingState): boolean {
  return (
    !gpu.stopped &&
    gpu.wearPercent < 100 &&
    gpu.targetFrequencyGhz <=
      GPU_MODELS_BY_ID[gpu.modelId].specifications.limits.absoluteFrequencyGhz
  );
}

export function setGpuClock(gpu: GpuOperatingState, frequencyGhz: number): GpuOperatingState {
  const { limits } = GPU_MODELS_BY_ID[gpu.modelId].specifications;
  if (!Number.isFinite(frequencyGhz) || frequencyGhz < limits.minFrequencyGhz) {
    throw new Error(`La frequenza deve essere un numero finito >= ${limits.minFrequencyGhz} GHz.`);
  }
  if (frequencyGhz > limits.absoluteFrequencyGhz) {
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

export function clearGpuStop(
  gpu: GpuOperatingState,
  now: number,
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): GpuOperatingState {
  if (gpu.wearPercent >= 100) {
    throw new Error('GPU esaurita: usura al 100%.');
  }
  if (
    gpuTemperature(gpu, now, rigSetup) >=
    GPU_MODELS_BY_ID[gpu.modelId].specifications.limits.temperatureCelsius
  ) {
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
  rigSetup: RigSetup = GAMEPLAY_RIG_SETUP,
): GpuOperatingState {
  const specifications = GPU_MODELS_BY_ID[gpu.modelId].specifications;
  const ratio = gpu.targetFrequencyGhz / specifications.mining.frequencyGhz;
  const workedHours = economy.simulatedHoursPerAction * fraction;
  const dustPercent = Math.min(
    100,
    gpu.dustPercent +
      config.maintenance.dustPercentPerHour *
        specifications.dustDamage.dustBuildUpMultiplier *
        (1 - RIG_DUST_SYSTEMS[rigSetup.dustSystemId].filterEfficiencyPercent / 100) *
        workedHours,
  );
  const dustLoad = (gpu.dustPercent + dustPercent) / 200;
  const initialTemperature = gpuTemperature(gpu, startedAt, rigSetup);
  const nominalFanSpeed = GPU_MODELS_BY_ID[gpu.modelId].specifications.mining.fanSpeedPercent;
  const fanSpeedPercent =
    gpuMaxFanSpeedRpm(gpu.fanKit, gpu.modelId) > 0
      ? (gpu.targetFanSpeedPercent ?? nominalFanSpeed)
      : 0;
  const fanCooling = (nominalFanSpeed - fanSpeedPercent) * config.fanCoolingCelsiusPerPercent;
  const fanSpeedRatio = gpuFanSpeedRatio(fanSpeedPercent, gpu.fanKit, gpu.modelId);
  const rigDustSystem = RIG_DUST_SYSTEMS[rigSetup.dustSystemId];
  const rigCoolingMethod = RIG_COOLING_METHODS[rigSetup.coolingMethodId];
  const equilibrium =
    specifications.idle.temperatureCelsius +
    (specifications.mining.temperatureCelsius - specifications.idle.temperatureCelsius) *
      ratio ** 2 +
    fanCooling +
    rigDustSystem.airflowResistanceCelsius +
    dustLoad * specifications.dustDamage.maxExtraHeatCelsius -
    config.fanKits[gpu.fanKit].coolingCelsius * fanSpeedRatio -
    rigCoolingMethod.coolingCelsius -
    rigFanCoolingCelsius(rigSetup);
  const response =
    1 -
    (1 - specifications.thermalResponsePerAction) **
      (fraction * (1 + dustLoad * specifications.dustDamage.maxHeatingResponseBonus));
  const temperatureCelsius = initialTemperature + (equilibrium - initialTemperature) * response;
  const heatStress = Math.max(1, temperatureCelsius / specifications.mining.temperatureCelsius);
  const wearPercent = Math.min(
    100,
    gpu.wearPercent +
      specifications.wearPercentPerHour *
        workedHours *
        ratio ** 2 *
        heatStress ** 2 *
        dustWearMultiplier(dustLoad * 100, specifications.dustDamage),
  );
  const fault =
    wearPercent >= 100
      ? 'Usura al 100%'
      : temperatureCelsius >= specifications.limits.temperatureCelsius
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
