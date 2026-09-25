import { CLOCK_CONFIG, ECONOMY_CONFIG } from './economy-config';
import { FAN_MODELS_BY_ID, GPU_FAN_KITS } from './fan-config';
import {
  GPU_DEFAULT_MODEL_ID,
  GPU_FALLBACK_MODEL_ID,
  GPU_MODELS_BY_ID,
  GPU_RUNTIME_CONFIG,
} from './gpu-config';
import { GAMEPLAY_RIG_MODEL_ID, GAMEPLAY_RIG_SETUP, RIG_FAN_TUNING } from './rig-config';
import { RIG_COOLING_METHODS } from './cooling-config';
import { RIG_DUST_SYSTEMS } from './dust-filter-config';
import {
  ANIMATION_CONFIG,
  CAMERA_CONFIG,
  LAYOUT_CONFIG,
  SCENE_CONFIG,
  TOOL_STATIONS_CONFIG,
} from './scene-config';
import { EDITOR_CONFIG, SCRIPTING_CONFIG } from './runtime-config';
import { MINING_CONFIG, WORLD_CONFIG } from './world-config';

const startingGpu = GPU_MODELS_BY_ID[GPU_DEFAULT_MODEL_ID];

/** Facade di configurazione mantenuta per i sistemi di gioco esistenti. */
export const GAME_BALANCE = {
  models: {
    startingRigId: GAMEPLAY_RIG_MODEL_ID,
    startingGpuId: GPU_DEFAULT_MODEL_ID,
    fallbackGpuId: GPU_FALLBACK_MODEL_ID,
    startingRigFanId: GAMEPLAY_RIG_SETUP.fanId,
  },
  world: WORLD_CONFIG,
  gpu: {
    model: startingGpu.name,
    ...startingGpu.specifications,
    dustDamage: startingGpu.specifications.dustDamage,
    ...GPU_RUNTIME_CONFIG,
    maintenance: {
      ...GPU_RUNTIME_CONFIG.maintenance,
      // Alias mantenuti per i componenti esistenti; i valori per GPU sono in dustDamage.
      dustWearThresholdPercent: startingGpu.specifications.dustDamage.wearThresholdPercent,
      dustMaxExtraHeatCelsius: startingGpu.specifications.dustDamage.maxExtraHeatCelsius,
      dustMaxHeatingResponseBonus:
        startingGpu.specifications.dustDamage.maxHeatingResponseBonus,
      dustMaxWearMultiplier: startingGpu.specifications.dustDamage.maxWearMultiplier,
    },
    fanKits: GPU_FAN_KITS,
  },
  rig: {
    fan: FAN_MODELS_BY_ID[GAMEPLAY_RIG_SETUP.fanId],
    fanCount: GAMEPLAY_RIG_SETUP.fanCount,
    fanTuning: RIG_FAN_TUNING,
    dustSystemId: GAMEPLAY_RIG_SETUP.dustSystemId,
    dustSystem: RIG_DUST_SYSTEMS[GAMEPLAY_RIG_SETUP.dustSystemId],
    coolingMethodId: GAMEPLAY_RIG_SETUP.coolingMethodId,
    coolingMethod: RIG_COOLING_METHODS[GAMEPLAY_RIG_SETUP.coolingMethodId],
  },
  economy: ECONOMY_CONFIG,
  clock: CLOCK_CONFIG,
  mining: MINING_CONFIG,
  editor: EDITOR_CONFIG,
  scripting: SCRIPTING_CONFIG,
  camera: CAMERA_CONFIG,
  animation: ANIMATION_CONFIG,
  scene: SCENE_CONFIG,
  layout: LAYOUT_CONFIG,
  toolStations: TOOL_STATIONS_CONFIG,
} as const;
