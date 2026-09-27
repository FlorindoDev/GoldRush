import { SHOP_PRODUCTS_BY_ID } from '../../config/shop-config';
import type { RigSetup } from '../../config/rig-config';
import { getGpu, getRig, configureRig, serviceGpu } from '../mining-world';
import type { MiningWorld } from '../mining-world';
import type { GpuMaintenanceAction } from '../gpu-maintenance';

function stockDeltasForRigSetup(before: RigSetup, after: RigSetup): Map<string, number> {
  const deltas = new Map<string, number>();
  const add = (productId: string, quantity: number) => {
    if (SHOP_PRODUCTS_BY_ID.has(productId) && quantity !== 0) {
      deltas.set(productId, (deltas.get(productId) ?? 0) + quantity);
    }
  };
  add(before.fanId, -before.fanCount);
  add(after.fanId, after.fanCount);
  if (before.dustSystemId !== 'none') add(`filter-${before.dustSystemId}`, -1);
  if (after.dustSystemId !== 'none') add(`filter-${after.dustSystemId}`, 1);
  if (before.coolingMethodId !== 'none') add(`cooling-${before.coolingMethodId}`, -1);
  if (after.coolingMethodId !== 'none') add(`cooling-${after.coolingMethodId}`, 1);
  return deltas;
}

/** Applica ogni variazione su una copia e valida tutte le richieste prima del risultato. */
function applyStockDeltas(world: MiningWorld, deltas: ReadonlyMap<string, number>): MiningWorld {
  const remainingItems = [...world.inventory.items];
  for (const [productId, delta] of deltas) {
    if (delta <= 0) continue;
    const available = remainingItems.filter((item) => item.productId === productId).length;
    if (available < delta) {
      const product = SHOP_PRODUCTS_BY_ID.get(productId)!;
      throw new Error(`Servono ${delta - available} unità di ${product.name} in magazzino.`);
    }
    let toConsume = delta;
    for (let index = 0; index < remainingItems.length && toConsume > 0;) {
      if (remainingItems[index].productId === productId) {
        remainingItems.splice(index, 1);
        toConsume--;
      } else {
        index++;
      }
    }
  }
  let nextId = world.inventory.nextId;
  for (const [productId, delta] of deltas) {
    for (let index = 0; index < -delta; index++) {
      remainingItems.push({ id: nextId++, productId, used: true });
    }
  }
  return {
    ...world,
    inventory: { nextId, items: remainingItems },
  };
}

export function configureRigWithStock(
  world: MiningWorld,
  rigId: number,
  update: Partial<RigSetup>,
): MiningWorld {
  const rig = getRig(world, rigId);
  const configured = configureRig(world, rigId, update);
  return applyStockDeltas(
    configured,
    stockDeltasForRigSetup(rig.setup, getRig(configured, rigId).setup),
  );
}

export function serviceGpuWithStock(
  world: MiningWorld,
  gpuId: number,
  action: GpuMaintenanceAction,
): MiningWorld {
  const gpu = getGpu(world, gpuId);
  const serviced = serviceGpu(world, gpuId, action);
  if (action.kind !== 'fan') return serviced;
  const deltas = new Map<string, number>();
  if (gpu.fanKit !== 'stock') deltas.set(`gpu-fan-${gpu.fanKit}`, -1);
  if (action.kit !== 'stock') {
    const productId = `gpu-fan-${action.kit}`;
    deltas.set(productId, (deltas.get(productId) ?? 0) + 1);
  }
  return applyStockDeltas(serviced, deltas);
}
