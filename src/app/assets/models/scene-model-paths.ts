import { GAME_BALANCE } from '../../config/game-balance';

export const SCENE_MODEL_PATHS = {
  rig: `assets/models/rigs/${GAME_BALANCE.models.startingRigId}.glb`,
  gpuFallback: `assets/models/gpus/${GAME_BALANCE.models.fallbackGpuId}.glb`,
  workbench: 'assets/models/workshop/workbench.glb',
  toolArea: 'assets/models/environment/tool-area.glb',
  plot: 'assets/models/environment/plot.glb',
  rigSlot: 'assets/models/environment/rig-slot.glb',
  floor: 'assets/models/environment/world-floor.glb',
} as const;
export type SceneModelId = keyof typeof SCENE_MODEL_PATHS;
