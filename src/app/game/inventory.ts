import { SHOP_MAX_QUANTITY, SHOP_PRODUCTS_BY_ID, type ShopProduct } from '../config/shop-config';
import { createGpuOperatingState, isGpuOperational, type GpuOperatingState } from './gpu-operation';
import type { GpuModelId } from '../config/gpu-config';
import { getGpu, isGpuUnlocked, type MiningWorld } from './mining-world';
import { isResearchUnlocked } from './research';
import { spendEuros } from './wallet-transactions';

export interface StockItem {
  readonly id: number;
  readonly productId: string;
  readonly gpu?: GpuOperatingState;
}
export interface Inventory {
  readonly items: readonly StockItem[];
  readonly nextId: number;
}
export interface CartLine {
  readonly productId: string;
  readonly quantity: number;
}
export interface InventoryEntry {
  readonly key: string;
  readonly product: ShopProduct;
  readonly quantity: number;
  readonly condition: 'new' | 'used' | 'broken';
  readonly location: string;
  readonly stockId?: number;
  readonly gpuId?: number;
  readonly gpu?: GpuOperatingState;
}

export interface InventoryGroup {
  readonly key: string;
  readonly product: ShopProduct;
  readonly condition: InventoryEntry['condition'];
  readonly entries: readonly InventoryEntry[];
  readonly quantity: number;
}

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
      });
    }
  }
  return { ...spendEuros(world, total), inventory: { items, nextId } };
}

function condition(gpu?: GpuOperatingState): InventoryEntry['condition'] {
  return gpu && gpu.wearPercent >= 100
    ? 'broken'
    : gpu && (gpu.wearPercent > 0 || gpu.dustPercent > 0)
      ? 'used'
      : 'new';
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
      condition: condition(item.gpu),
      gpu: item.gpu,
      location: 'In magazzino',
    });
  }
  for (const plot of world.plots)
    for (const rig of plot.rigs) {
      if (!rig.unlocked) continue;
      const location = `RIG ${rig.id} · Plot ${plot.id}`;
      add('rig-gameplay', { key: `rig-${rig.id}`, quantity: 1, condition: 'used', location });
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
  const price = SHOP_PRODUCTS_BY_ID.get(item.productId)?.priceEur ?? 0;
  const rate =
    condition(item.gpu) === 'broken' ? 0.1 : 0.6 * (1 - (item.gpu?.wearPercent ?? 0) / 100);
  return Math.round(price * rate * 100) / 100;
}

export function sellStockItem(world: MiningWorld, id: number): MiningWorld {
  const item = world.inventory.items.find((entry) => entry.id === id);
  if (!item) throw new Error('Articolo non più presente in magazzino.');
  return {
    ...world,
    cashEur: world.cashEur + resaleValue(item),
    inventory: {
      ...world.inventory,
      items: world.inventory.items.filter((entry) => entry.id !== id),
    },
  };
}

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

export function installStockGpu(world: MiningWorld, stockId: number, rigId: number): MiningWorld {
  const item = world.inventory.items.find((entry) => entry.id === stockId);
  if (!item?.gpu || item.gpu.wearPercent >= 100)
    throw new Error('Serve una GPU funzionante in magazzino.');
  const rig = world.plots
    .flatMap((plot) => plot.rigs)
    .find((entry) => entry.id === rigId && entry.unlocked);
  const slot = rig?.gpus.find((gpu) => !gpu.unlocked);
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
