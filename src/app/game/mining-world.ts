import { GAME_BALANCE } from '../config/game-balance';
import {
  applyGpuWork,
  clearGpuStop,
  createGpuOperatingState,
  gpuMiningPowerWatts,
  isGpuOperational,
  setGpuClock,
  type GpuOperatingState,
} from './gpu-operation';
import {
  createElectricityMeter,
  electricityCostSatoshis,
  type ElectricityMeter,
  type MiningSettlement,
} from './electricity';

export interface MiningBlock {
  readonly id: number;
  readonly progress: number;
}

export interface MiningGpu extends GpuOperatingState {
  readonly id: number;
  readonly rigId: number;
  readonly plotId: number;
  readonly unlocked: boolean;
}

export interface MiningRig {
  readonly id: number;
  readonly plotId: number;
  readonly unlocked: boolean;
  readonly gpus: readonly MiningGpu[];
}

export interface MiningPlot {
  readonly id: number;
  readonly rigs: readonly MiningRig[];
}

export interface MiningWorld {
  readonly blocks: readonly MiningBlock[];
  readonly plots: readonly MiningPlot[];
  readonly selectedId: number;
  readonly satoshis: number;
  readonly electricity: ElectricityMeter;
  readonly lastSettlement: MiningSettlement | null;
}

export const PLOT_COUNT = GAME_BALANCE.world.plotCount;
export const RIGS_PER_PLOT = GAME_BALANCE.world.rigsPerPlot;
export const GPUS_PER_RIG = GAME_BALANCE.world.gpusPerRig;
export const RIG_COUNT = PLOT_COUNT * RIGS_PER_PLOT;
export const GPU_COUNT = RIG_COUNT * GPUS_PER_RIG;
export const STARTING_RIG_COUNT = GAME_BALANCE.world.startingRigCount;
export const STARTING_GPU_COUNT = GAME_BALANCE.world.startingGpuCount;
export const MINE_PROGRESS_PER_GPU = GAME_BALANCE.world.progressPerGpuAtFullFarm / GPU_COUNT;
export const BLOCK_REWARD = GAME_BALANCE.world.blockRewardSatoshis;

export function createWorld(): MiningWorld {
  return {
    blocks: [{ id: 1, progress: 0 }],
    plots: createPlots(),
    selectedId: 1,
    satoshis: 0,
    electricity: createElectricityMeter(),
    lastSettlement: null,
  };
}

export function createPlots(): MiningPlot[] {
  return Array.from({ length: PLOT_COUNT }, (_, plotIndex) => {
    const plotId = plotIndex + 1;
    const rigs = Array.from({ length: RIGS_PER_PLOT }, (_, rigIndex) => {
      const rigId = plotIndex * RIGS_PER_PLOT + rigIndex + 1;
      const gpus = Array.from({ length: GPUS_PER_RIG }, (_, gpuIndex) => ({
        ...createGpuOperatingState(),
        id: (rigId - 1) * GPUS_PER_RIG + gpuIndex + 1,
        rigId,
        plotId,
        unlocked: (rigId - 1) * GPUS_PER_RIG + gpuIndex + 1 <= STARTING_GPU_COUNT,
      }));
      return { id: rigId, plotId, unlocked: rigId <= STARTING_RIG_COUNT, gpus };
    });
    return { id: plotId, rigs };
  });
}

export function mineGpu(
  world: MiningWorld,
  gpuId: number,
  startedAt = Date.now(),
  endedAt = startedAt,
  deferSettlement = false,
  activeGpuIds: readonly number[] = [gpuId],
): MiningWorld {
  const block = world.blocks.find((item) => item.id === world.selectedId)!;
  if (block.progress >= 100 && activeGpuIds.length < 2) {
    throw new Error('Blocco già completato. Avvia il blocco successivo.');
  }
  const gpu = requireOperationalGpu(world, gpuId);
  const worked = recordGpuWork(world, gpuId, 1, startedAt, endedAt, activeGpuIds);
  if (block.progress >= 100) {
    return deferSettlement ? worked : settleCompletedBlock(worked);
  }
  if (!isGpuOperational(getGpu(worked, gpuId))) {
    return worked;
  }
  const progress = Math.min(
    100,
    block.progress +
      (MINE_PROGRESS_PER_GPU * gpu.targetFrequencyGhz) / GAME_BALANCE.gpu.mining.frequencyGhz,
  );
  const result = {
    ...worked,
    blocks: world.blocks.map((item) => (item.id === block.id ? { ...item, progress } : item)),
  };
  return progress === 100 && !deferSettlement ? settleCompletedBlock(result) : result;
}

/** Paga il blocco una sola volta dopo che tutte le GPU parallele hanno finito. */
export function settleCompletedBlock(world: MiningWorld): MiningWorld {
  const block = world.blocks.find((item) => item.id === world.selectedId)!;
  if (block.progress < 100 || world.lastSettlement?.blockId === block.id) {
    return world;
  }
  const electricitySatoshis = electricityCostSatoshis(world.electricity.pendingKwh);
  const balanceAfterSatoshis = world.satoshis + BLOCK_REWARD - electricitySatoshis;
  return {
    ...world,
    satoshis: balanceAfterSatoshis,
    electricity: {
      ...world.electricity,
      pendingKwh: 0,
      paidSatoshis: world.electricity.paidSatoshis + electricitySatoshis,
    },
    lastSettlement: {
      blockId: block.id,
      energyKwh: world.electricity.pendingKwh,
      rewardSatoshis: BLOCK_REWARD,
      electricitySatoshis,
      balanceBeforeSatoshis: world.satoshis,
      balanceAfterSatoshis,
    },
  };
}

export function getGpu(world: MiningWorld, gpuId: number): MiningGpu {
  if (!Number.isInteger(gpuId) || gpuId < 1 || gpuId > GPU_COUNT) {
    throw new Error('GPU inesistente.');
  }
  const rigId = rigIdForGpu(gpuId);
  return world.plots[plotIdForRig(rigId) - 1].rigs[(rigId - 1) % RIGS_PER_PLOT].gpus[
    (gpuId - 1) % GPUS_PER_RIG
  ];
}

export function requireOperationalGpu(world: MiningWorld, gpuId: number): MiningGpu {
  if (!isGpuUnlocked(world, gpuId)) {
    throw new Error('Serve una GPU sbloccata per minare.');
  }
  const gpu = getGpu(world, gpuId);
  if (!isGpuOperational(gpu)) {
    throw new Error(
      `GPU ${gpuId} ferma: ${gpu.stopReason || 'non operativa'}. Usa clearStop() prima di mine().`,
    );
  }
  return gpu;
}

function updateGpu(
  world: MiningWorld,
  gpuId: number,
  update: (gpu: MiningGpu) => GpuOperatingState,
): MiningWorld {
  if (!isGpuUnlocked(world, gpuId)) {
    throw new Error('GPU o rig bloccato.');
  }
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((gpu) => (gpu.id === gpuId ? { ...gpu, ...update(gpu) } : gpu)),
      })),
    })),
  };
}

export function setGpuFrequency(
  world: MiningWorld,
  gpuId: number,
  frequencyGhz: number,
): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => setGpuClock(gpu, frequencyGhz));
}

export function stopGpu(world: MiningWorld, gpuId: number): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => ({
    ...gpu,
    stopped: true,
    stopReason: gpu.stopReason || 'Stop manuale',
  }));
}

export function resumeGpu(world: MiningWorld, gpuId: number, now = Date.now()): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => clearGpuStop(gpu, now));
}

export function recordGpuWork(
  world: MiningWorld,
  gpuId: number,
  fraction: number,
  startedAt: number,
  endedAt: number,
  activeGpuIds: readonly number[] = [gpuId],
): MiningWorld {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('La frazione di lavoro deve essere tra 0 e 1.');
  }
  const activeGpus = activeGpuIds.length ? activeGpuIds : [gpuId];
  const energyKwh =
    (farmPowerWatts(world, activeGpus) / activeGpus.length / 1000) *
    GAME_BALANCE.economy.simulatedHoursPerAction *
    fraction;
  const updated = updateGpu(world, gpuId, (gpu) => applyGpuWork(gpu, fraction, startedAt, endedAt));
  return {
    ...updated,
    electricity: {
      ...world.electricity,
      energyKwh: world.electricity.energyKwh + energyKwh,
      pendingKwh: world.electricity.pendingKwh + energyKwh,
    },
  };
}

/** Potenza delle GPU attive più le altre schede operative in standby. */
export function farmPowerWatts(
  world: MiningWorld,
  activeGpuIds: number | readonly number[] | null,
): number {
  const activeIds = new Set(
    typeof activeGpuIds === 'number' ? [activeGpuIds] : (activeGpuIds ?? []),
  );
  let watts = 0;
  for (const plot of world.plots) {
    for (const rig of plot.rigs) {
      if (!rig.unlocked) {
        continue;
      }
      for (const gpu of rig.gpus) {
        if (gpu.unlocked && (activeIds.has(gpu.id) || isGpuOperational(gpu))) {
          watts += activeIds.has(gpu.id)
            ? gpuMiningPowerWatts(gpu)
            : GAME_BALANCE.gpu.idle.powerWatts;
        }
      }
    }
  }
  return watts;
}

export function canExpand(world: MiningWorld): boolean {
  return world.blocks.every((block) => block.progress === 100);
}

export function rigIdForGpu(gpuId: number): number {
  return Math.floor((gpuId - 1) / GPUS_PER_RIG) + 1;
}

export function rigCount(world: MiningWorld): number {
  return world.plots.reduce((count, plot) => count + plot.rigs.length, 0);
}

export function countUnlockedRigs(world: MiningWorld): number {
  return world.plots.reduce(
    (count, plot) => count + plot.rigs.filter((rig) => rig.unlocked).length,
    0,
  );
}

export function countUnlockedGpusInRig(rig: MiningRig): number {
  return rig.unlocked ? rig.gpus.filter((gpu) => gpu.unlocked).length : 0;
}

export function countUnlockedGpus(world: MiningWorld): number {
  return world.plots.reduce(
    (plotTotal, plot) =>
      plotTotal + plot.rigs.reduce((rigTotal, rig) => rigTotal + countUnlockedGpusInRig(rig), 0),
    0,
  );
}

export function isGpuUnlocked(world: MiningWorld, gpuId: number): boolean {
  if (!Number.isInteger(gpuId) || gpuId < 1 || gpuId > GPU_COUNT) {
    return false;
  }

  const rigId = rigIdForGpu(gpuId);
  const plot = world.plots[plotIdForRig(rigId) - 1];
  const rig = plot?.rigs[(rigId - 1) % RIGS_PER_PLOT];
  return Boolean(rig?.unlocked && rig.gpus[(gpuId - 1) % GPUS_PER_RIG]?.unlocked);
}

export function isRigUnlocked(world: MiningWorld, rigId: number): boolean {
  if (!Number.isInteger(rigId) || rigId < 1 || rigId > RIG_COUNT) {
    return false;
  }

  const plot = world.plots[plotIdForRig(rigId) - 1];
  return plot?.rigs[(rigId - 1) % RIGS_PER_PLOT]?.unlocked ?? false;
}

export function plotIdForRig(rigId: number): number {
  return Math.floor((rigId - 1) / RIGS_PER_PLOT) + 1;
}

export function plotIdForGpu(gpuId: number): number {
  return plotIdForRig(rigIdForGpu(gpuId));
}

export function plotCount(world: MiningWorld): number {
  return world.plots.length;
}

export function expandWorld(world: MiningWorld): MiningWorld {
  if (!canExpand(world)) {
    return world;
  }
  const id = world.blocks.length + 1;
  return { ...world, blocks: [...world.blocks, { id, progress: 0 }], selectedId: id };
}
