export interface MiningBlock {
  readonly id: number;
  readonly progress: number;
}
export interface MiningWorld {
  readonly blocks: readonly MiningBlock[];
  readonly selectedId: number;
  readonly satoshis: number;
}
export const GPUS_PER_RIG = 4;
export const RIGS_PER_PLOT = 6;
export const MINE_PROGRESS = 20;
export const BLOCK_REWARD = 1_000_000;

export function createWorld(): MiningWorld {
  return { blocks: [{ id: 1, progress: 0 }], selectedId: 1, satoshis: 0 };
}

export function mineSelected(world: MiningWorld): MiningWorld {
  const block = world.blocks.find((item) => item.id === world.selectedId)!;
  if (block.progress >= 100) {
    throw new Error('Blocco già completato. Sblocca o seleziona un altro blocco.');
  }
  const progress = Math.min(100, block.progress + MINE_PROGRESS);
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
  return Math.ceil(world.blocks.length / GPUS_PER_RIG);
}

export function plotIdForRig(rigId: number): number {
  return Math.floor((rigId - 1) / RIGS_PER_PLOT) + 1;
}

export function plotIdForGpu(gpuId: number): number {
  return plotIdForRig(rigIdForGpu(gpuId));
}

export function plotCount(world: MiningWorld): number {
  return Math.ceil(rigCount(world) / RIGS_PER_PLOT);
}

export function expandWorld(world: MiningWorld): MiningWorld {
  if (!canExpand(world)) {
    return world;
  }
  const id = world.blocks.length + 1;
  return { ...world, blocks: [...world.blocks, { id, progress: 0 }], selectedId: id };
}
