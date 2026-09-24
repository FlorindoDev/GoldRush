export interface MiningBlock {
  readonly id: number;
  readonly progress: number;
}

export interface MiningGpu {
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
}

export const PLOT_COUNT = 6;
export const RIGS_PER_PLOT = 6;
export const GPUS_PER_RIG = 4;
export const RIG_COUNT = PLOT_COUNT * RIGS_PER_PLOT;
export const GPU_COUNT = RIG_COUNT * GPUS_PER_RIG;
export const STARTING_RIG_COUNT = 1;
export const STARTING_GPU_COUNT = 1;
export const MINE_PROGRESS_PER_GPU = 80 / GPU_COUNT;
export const BLOCK_REWARD = 1_000_000;

export function createWorld(): MiningWorld {
  return {
    blocks: [{ id: 1, progress: 0 }],
    plots: createPlots(),
    selectedId: 1,
    satoshis: 0,
  };
}

export function createPlots(): MiningPlot[] {
  return Array.from({ length: PLOT_COUNT }, (_, plotIndex) => {
    const plotId = plotIndex + 1;
    const rigs = Array.from({ length: RIGS_PER_PLOT }, (_, rigIndex) => {
      const rigId = plotIndex * RIGS_PER_PLOT + rigIndex + 1;
      const gpus = Array.from({ length: GPUS_PER_RIG }, (_, gpuIndex) => ({
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

export function mineGpu(world: MiningWorld, gpuId: number): MiningWorld {
  const block = world.blocks.find((item) => item.id === world.selectedId)!;
  if (block.progress >= 100) {
    throw new Error('Blocco già completato. Avvia il blocco successivo.');
  }
  if (!isGpuUnlocked(world, gpuId)) {
    throw new Error('Serve una GPU sbloccata per minare.');
  }
  const progress = Math.min(100, block.progress + MINE_PROGRESS_PER_GPU);
  return {
    ...world,
    blocks: world.blocks.map((item) => (item.id === block.id ? { ...item, progress } : item)),
    satoshis: world.satoshis + (progress === 100 ? BLOCK_REWARD : 0),
  };
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
