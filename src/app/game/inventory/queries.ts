import { RIG_MODELS_BY_ID } from '../../config/rig-model-config';
import { SHOP_PRODUCTS_BY_ID } from '../../config/shop-config';
import { reconcileWallet } from '../wallet-transactions';
import type { GpuOperatingState } from '../gpu-operation';
import type { MiningWorld } from '../mining-world';
import type { InventoryEntry, InventoryGroup, StockItem } from './types';

/** Raggruppa copie dello stesso componente senza perdere le singole identità. */
export function groupInventoryEntries(entries: readonly InventoryEntry[]): InventoryGroup[] {
  const groups = new Map<string, InventoryEntry[]>();
  for (const entry of entries) {
    const key = `${entry.product.id}:${entry.condition}`;
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  return [...groups].map(([key, members]) => ({
    key,
    product: members[0].product,
    condition: members[0].condition,
    entries: members,
    quantity: members.reduce((sum, entry) => sum + entry.quantity, 0),
  }));
}

function condition(gpu?: GpuOperatingState): InventoryEntry['condition'] {
  return gpu && gpu.wearPercent >= 100
    ? 'broken'
    : gpu && (gpu.wearPercent > 0 || gpu.dustPercent > 0)
      ? 'used'
      : 'new';
}

function stockCondition(item: StockItem): InventoryEntry['condition'] {
  if (item.rig) return item.rig.isNew ? 'new' : 'used';
  if (item.used) return 'used';
  return condition(item.gpu);
}

/** Lo stato dei componenti montati viene letto dalla farm, mai duplicato in magazzino. */
export function inventoryEntries(world: MiningWorld): InventoryEntry[] {
  const entries: InventoryEntry[] = [];
  const add = (productId: string, entry: Omit<InventoryEntry, 'product'>) => {
    const product = SHOP_PRODUCTS_BY_ID.get(productId);
    if (product) entries.push({ ...entry, product });
  };
  for (const item of world.inventory.items) {
    add(item.productId, {
      key: `stock-${item.id}`,
      quantity: 1,
      stockId: item.id,
      condition: stockCondition(item),
      gpu: item.gpu,
      rig: item.rig,
      location: 'In magazzino',
    });
  }
  for (const plot of world.plots)
    for (const rig of plot.rigs) {
      if (!rig.unlocked) continue;
      const location = `RIG ${rig.id} · Plot ${plot.id}`;
      add(rig.rigProductId ?? 'rig-gameplay', {
        key: `rig-${rig.id}`,
        quantity: 1,
        condition: 'used',
        rigId: rig.id,
        location,
      });
      if (rig.setup.fanCount)
        add(rig.setup.fanId, {
          key: `fan-${rig.id}`,
          quantity: rig.setup.fanCount,
          condition: 'used',
          location,
        });
      add(`filter-${rig.setup.dustSystemId}`, {
        key: `filter-${rig.id}`,
        quantity: 1,
        condition: 'used',
        location,
      });
      add(`cooling-${rig.setup.coolingMethodId}`, {
        key: `cooling-${rig.id}`,
        quantity: 1,
        condition: 'used',
        location,
      });
      for (const gpu of rig.gpus)
        if (gpu.unlocked) {
          add(gpu.modelId, {
            key: `gpu-${gpu.id}`,
            quantity: 1,
            condition: condition(gpu),
            gpuId: gpu.id,
            gpu,
            location: gpu.onWorkbench ? 'Banco GPU' : location,
          });
          add(`gpu-fan-${gpu.fanKit}`, {
            key: `gpu-fan-${gpu.id}`,
            quantity: 1,
            condition: 'used',
            location: `GPU ${gpu.id} · ${location}`,
          });
        }
    }
  return entries;
}

export function resaleValue(item: StockItem): number {
  let price = SHOP_PRODUCTS_BY_ID.get(item.productId)?.priceEur ?? 0;
  if (item.rig) {
    const model = RIG_MODELS_BY_ID.get(item.productId);
    // Valuta telaio e componenti attuali: i moduli inclusi possono essere stati rimossi.
    price -= SHOP_PRODUCTS_BY_ID.get(`filter-${model?.filter}`)?.priceEur ?? 0;
    price -=
      model?.cooling === 'bracket'
        ? 0
        : (SHOP_PRODUCTS_BY_ID.get(`cooling-${model?.cooling}`)?.priceEur ?? 0);
    price += SHOP_PRODUCTS_BY_ID.get(`filter-${item.rig.setup.dustSystemId}`)?.priceEur ?? 0;
    price += SHOP_PRODUCTS_BY_ID.get(`cooling-${item.rig.setup.coolingMethodId}`)?.priceEur ?? 0;
    price +=
      (SHOP_PRODUCTS_BY_ID.get(item.rig.setup.fanId)?.priceEur ?? 0) * item.rig.setup.fanCount;
  }
  const rate =
    condition(item.gpu) === 'broken' ? 0.1 : 0.6 * (1 - (item.gpu?.wearPercent ?? 0) / 100);
  const gpuValue =
    item.rig?.gpus.reduce(
      (sum, gpu) =>
        sum +
        (gpu ? resaleValue({ id: item.id, productId: gpu.state.modelId, gpu: gpu.state }) : 0),
      0,
    ) ?? 0;
  return Math.round((price * rate + gpuValue) * 100) / 100;
}

export function sellStockItem(world: MiningWorld, id: number): MiningWorld {
  const item = world.inventory.items.find((entry) => entry.id === id);
  if (!item) throw new Error('Articolo non più presente in magazzino.');
  const wallet = reconcileWallet({ ...world, cashEur: world.cashEur + resaleValue(item) });
  return {
    ...wallet,
    inventory: {
      ...world.inventory,
      items: world.inventory.items.filter((entry) => entry.id !== id),
    },
  };
}
