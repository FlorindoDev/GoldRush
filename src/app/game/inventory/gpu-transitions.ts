import { createGpuOperatingState, isGpuOperational } from '../gpu-operation';
import { getGpu, getRig, isGpuUnlocked } from '../mining-world';
import type { MiningWorld } from '../mining-world';

export function storeGpu(world: MiningWorld, gpuId: number): MiningWorld {
  if (!isGpuUnlocked(world, gpuId)) throw new Error('GPU non disponibile.');
  const gpu = getGpu(world, gpuId);
  if (gpu.onWorkbench) throw new Error('Rimonta prima la GPU dal banco.');
  // I dati di posizione restano nello slot; il pezzo conserva soltanto lo stato operativo.
  const { id, rigId, plotId, unlocked, cryptoId, ...state } = gpu;
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((item) => (item.id === gpuId ? { ...item, unlocked: false } : item)),
      })),
    })),
    inventory: {
      nextId: world.inventory.nextId + 1,
      items: [
        ...world.inventory.items,
        { id: world.inventory.nextId, productId: gpu.modelId, gpu: state },
      ],
    },
  };
}

export function moveInstalledGpu(
  world: MiningWorld,
  sourceGpuId: number,
  targetGpuId: number,
  now = Date.now(),
): MiningWorld {
  if (!isGpuUnlocked(world, sourceGpuId)) throw new Error('GPU non disponibile.');
  const source = getGpu(world, sourceGpuId);
  const target = getGpu(world, targetGpuId);
  if (source.onWorkbench) throw new Error('Rimonta prima la GPU dal banco.');
  if (!getRig(world, target.rigId).unlocked || target.unlocked || target.onWorkbench)
    throw new Error('Seleziona uno slot GPU vuoto in un RIG montato.');

  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((gpu) => {
          if (gpu.id === sourceGpuId)
            return {
              ...gpu,
              ...createGpuOperatingState(),
              unlocked: false,
              onWorkbench: false,
              lastUpdatedAt: now,
            };
          if (gpu.id === targetGpuId)
            return {
              ...source,
              id: target.id,
              rigId: target.rigId,
              plotId: target.plotId,
              onWorkbench: false,
              lastUpdatedAt: now,
            };
          return gpu;
        }),
      })),
    })),
  };
}

export function installStockGpu(
  world: MiningWorld,
  stockId: number,
  rigId: number,
  slotGpuId?: number,
): MiningWorld {
  const item = world.inventory.items.find((entry) => entry.id === stockId);
  if (!item?.gpu || item.gpu.wearPercent >= 100)
    throw new Error('Serve una GPU funzionante in magazzino.');
  const rig = world.plots
    .flatMap((plot) => plot.rigs)
    .find((entry) => entry.id === rigId && entry.unlocked);
  const slot = rig?.gpus.find(
    (gpu) => !gpu.unlocked && (slotGpuId === undefined || gpu.id === slotGpuId),
  );
  if (!slot) throw new Error('Nessuno slot libero nel RIG selezionato.');
  return {
    ...world,
    inventory: {
      ...world.inventory,
      items: world.inventory.items.filter((entry) => entry.id !== stockId),
    },
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((entry) => ({
        ...entry,
        gpus: entry.gpus.map((gpu) =>
          gpu.id === slot.id
            ? {
                ...gpu,
                ...item.gpu!,
                unlocked: true,
                onWorkbench: false,
                lastUpdatedAt: Date.now(),
              }
            : gpu,
        ),
      })),
    })),
  };
}

export function replaceInstalledGpu(
  world: MiningWorld,
  gpuId: number,
  stockId: number,
  now = Date.now(),
): MiningWorld {
  const stock = world.inventory.items.find((entry) => entry.id === stockId);
  if (!stock?.gpu || !isGpuOperational(stock.gpu))
    throw new Error('Serve una GPU funzionante in magazzino.');
  if (!isGpuUnlocked(world, gpuId)) throw new Error('GPU da sostituire non disponibile.');
  const installed = getGpu(world, gpuId);
  if (installed.onWorkbench) throw new Error('Rimonta prima la GPU dal banco.');

  const { id, rigId, plotId, unlocked, cryptoId, ...removedState } = installed;
  const replacement = {
    ...installed,
    ...stock.gpu,
    id,
    rigId,
    plotId,
    unlocked,
    cryptoId,
    onWorkbench: false,
    lastUpdatedAt: now,
  };

  return {
    ...world,
    inventory: {
      nextId: world.inventory.nextId + 1,
      items: [
        ...world.inventory.items.filter((entry) => entry.id !== stockId),
        { id: world.inventory.nextId, productId: installed.modelId, gpu: removedState },
      ],
    },
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((gpu) => (gpu.id === gpuId ? replacement : gpu)),
      })),
    })),
  };
}
