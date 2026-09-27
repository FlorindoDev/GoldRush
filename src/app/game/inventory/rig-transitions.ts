import { STARTING_CRYPTO_ID } from '../../config/crypto-config';
import { GAMEPLAY_RIG_SETUP } from '../../config/rig-config';
import { SHOP_PRODUCTS_BY_ID } from '../../config/shop-config';
import { createGpuOperatingState } from '../gpu-operation';
import {
  configureRig,
  getRig,
  GPUS_PER_RIG,
  isRigUnlocked,
  type MiningWorld,
} from '../mining-world';
import type { StockItem } from './types';

function storedRigItem(world: MiningWorld, rigId: number, stockId: number): StockItem {
  if (!isRigUnlocked(world, rigId)) throw new Error('RIG non disponibile.');
  const rig = getRig(world, rigId);
  if (rig.gpus.some((gpu) => gpu.unlocked && gpu.onWorkbench)) {
    throw new Error('Rimonta prima tutte le GPU dal banco.');
  }
  const productId = rig.rigProductId ?? 'rig-gameplay';
  if (SHOP_PRODUCTS_BY_ID.get(productId)?.category !== 'rig') {
    throw new Error('Modello RIG non valido.');
  }
  return {
    id: stockId,
    productId,
    rig: {
      setup: { ...rig.setup },
      gpus: rig.gpus.map((gpu) => {
        if (!gpu.unlocked) return null;
        const { id, rigId: ownerRigId, plotId, unlocked, cryptoId, ...state } = gpu;
        return { state, cryptoId };
      }),
      isNew: false,
    },
  };
}

function emptyGpuSlot(gpu: ReturnType<typeof getRig>['gpus'][number], now: number) {
  return {
    ...gpu,
    ...createGpuOperatingState(),
    cryptoId: STARTING_CRYPTO_ID,
    unlocked: false,
    onWorkbench: false,
    lastUpdatedAt: now,
  };
}

export function storeRig(world: MiningWorld, rigId: number, now = Date.now()): MiningWorld {
  const item = storedRigItem(world, rigId, world.inventory.nextId);
  return {
    ...world,
    inventory: {
      nextId: world.inventory.nextId + 1,
      items: [...world.inventory.items, item],
    },
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((entry) =>
        entry.id === rigId
          ? {
              ...entry,
              unlocked: false,
              rigProductId: undefined,
              setup: { ...GAMEPLAY_RIG_SETUP },
              gpus: entry.gpus.map((gpu) => emptyGpuSlot(gpu, now)),
            }
          : entry,
      ),
    })),
  };
}

function requireStockRig(world: MiningWorld, stockId: number): StockItem {
  const item = world.inventory.items.find((entry) => entry.id === stockId);
  if (!item || !item.rig || SHOP_PRODUCTS_BY_ID.get(item.productId)?.category !== 'rig') {
    throw new Error('Serve un RIG in magazzino.');
  }
  if (item.rig.gpus.length !== GPUS_PER_RIG) {
    throw new Error('Configurazione del RIG in magazzino non valida.');
  }
  return item;
}

function installRigData(
  world: MiningWorld,
  rigId: number,
  stock: StockItem,
  now: number,
): MiningWorld {
  const setup = stock.rig!.setup;
  const unlockedWorld = {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((entry) => (entry.id === rigId ? { ...entry, unlocked: true } : entry)),
    })),
  };
  const configured = configureRig(unlockedWorld, rigId, setup);
  return {
    ...configured,
    plots: configured.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((entry) => {
        if (entry.id !== rigId) return entry;
        return {
          ...entry,
          unlocked: true,
          rigProductId: stock.productId,
          setup: { ...setup },
          gpus: entry.gpus.map((slot, index) => {
            const stored = stock.rig!.gpus[index];
            if (!stored) return emptyGpuSlot(slot, now);
            return {
              ...slot,
              ...stored.state,
              id: slot.id,
              rigId: slot.rigId,
              plotId: slot.plotId,
              cryptoId: stored.cryptoId,
              unlocked: true,
              onWorkbench: false,
              lastUpdatedAt: now,
            };
          }),
        };
      }),
    })),
  };
}

export function installStockRig(
  world: MiningWorld,
  stockId: number,
  rigId: number,
  now = Date.now(),
): MiningWorld {
  const stock = requireStockRig(world, stockId);
  const target = getRig(world, rigId);
  if (target.unlocked || target.gpus.some((gpu) => gpu.unlocked || gpu.onWorkbench)) {
    throw new Error('Seleziona uno slot RIG vuoto.');
  }
  const installed = installRigData(world, rigId, stock, now);
  return {
    ...installed,
    inventory: {
      ...world.inventory,
      items: world.inventory.items.filter((item) => item.id !== stockId),
    },
  };
}

export function replaceRig(
  world: MiningWorld,
  rigId: number,
  stockId: number,
  now = Date.now(),
): MiningWorld {
  const stock = requireStockRig(world, stockId);
  const oldItem = storedRigItem(world, rigId, world.inventory.nextId);
  const installed = installRigData(world, rigId, stock, now);
  return {
    ...installed,
    inventory: {
      nextId: world.inventory.nextId + 1,
      items: [...world.inventory.items.filter((item) => item.id !== stockId), oldItem],
    },
  };
}
