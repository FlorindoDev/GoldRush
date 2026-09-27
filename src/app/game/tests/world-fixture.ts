import { createGpuOperatingState } from '../gpu-operation';
import { createWorld, type MiningWorld } from '../mining-world';

/** Scenari con più schede: non dipendono dall'hardware della nuova partita. */
export function withUnlockedGpus(world: MiningWorld, count: number): MiningWorld {
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        unlocked: rig.gpus.some((gpu) => gpu.id <= count),
        gpus: rig.gpus.map((gpu) => ({ ...gpu, unlocked: gpu.id <= count })),
      })),
    })),
  };
}

export function createDualGpuWorld(): MiningWorld {
  const world = withUnlockedGpus(createWorld(), 2);
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        setup: { ...rig.setup, fanCount: 0 },
        gpus: rig.gpus.map((gpu) => ({ ...gpu, ...createGpuOperatingState('gpu-dual') })),
      })),
    })),
  };
}
