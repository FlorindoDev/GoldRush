import { SHOP_MAX_QUANTITY, SHOP_PRODUCTS_BY_ID, type ShopProduct } from '../../config/shop-config';
import type { GpuModelId } from '../../config/gpu-config';
import { GAMEPLAY_RIG_SETUP } from '../../config/rig-config';
import { createGpuOperatingState } from '../gpu-operation';
import { GPUS_PER_RIG, type MiningWorld } from '../mining-world';
import { isResearchUnlocked } from '../research';
import { spendEuros } from '../wallet-transactions';
import type { CartLine, StockRig } from './types';

export function productAvailable(world: MiningWorld, product: ShopProduct): boolean {
  return !product.researchId || isResearchUnlocked(world, product.researchId);
}

export function purchaseCart(world: MiningWorld, cart: readonly CartLine[]): MiningWorld {
  if (!cart.length) throw new Error('Il carrello è vuoto.');
  const quantities = new Map<string, number>();
  for (const line of cart) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > SHOP_MAX_QUANTITY
    ) {
      throw new Error(`Quantità non valida: scegli da 1 a ${SHOP_MAX_QUANTITY}.`);
    }
    quantities.set(line.productId, (quantities.get(line.productId) ?? 0) + line.quantity);
  }
  let total = 0;
  const items = [...world.inventory.items];
  let nextId = world.inventory.nextId;
  for (const [id, quantity] of quantities) {
    const product = SHOP_PRODUCTS_BY_ID.get(id);
    if (!product || quantity > SHOP_MAX_QUANTITY)
      throw new Error('Articolo o quantità non validi.');
    if (!productAvailable(world, product))
      throw new Error(`Sblocca ${product.name} nell’albero della ricerca.`);
    total += product.priceEur * quantity;
    for (let i = 0; i < quantity; i++) {
      items.push({
        id: nextId++,
        productId: id,
        ...(product.category === 'gpu' ? { gpu: createGpuOperatingState(id as GpuModelId) } : {}),
        ...(product.category === 'rig' ? { rig: createEmptyStockRig() } : {}),
      });
    }
  }
  return { ...spendEuros(world, total), inventory: { items, nextId } };
}

function createEmptyStockRig(): StockRig {
  return {
    setup: { ...GAMEPLAY_RIG_SETUP },
    gpus: Array.from({ length: GPUS_PER_RIG }, () => null),
    isNew: true,
  };
}
