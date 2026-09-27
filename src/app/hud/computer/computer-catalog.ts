import { SHOP_MAX_QUANTITY, type ShopProduct } from '../../config/shop-config';
import {
  groupInventoryEntries,
  type InventoryEntry,
  type InventoryGroup,
} from '../../game/inventory';

export type StockFilter = 'all' | 'stock' | 'installed' | 'stock-new' | 'stock-used' | 'broken';
export type ProductSort = 'name' | 'price-desc' | 'price-asc';
export type InventorySort = 'name' | 'quantity-desc' | 'value-desc';

export function matchesShopProduct(
  product: ShopProduct,
  categoryId: string,
  search: string,
): boolean {
  return (
    (categoryId === 'all' || product.category === categoryId) &&
    `${product.name} ${product.id} ${product.description}`
      .toLocaleLowerCase('it')
      .includes(search.trim().toLocaleLowerCase('it'))
  );
}

export function filterAndSortShopProducts(
  products: readonly ShopProduct[],
  categoryId: string,
  search: string,
  sort: ProductSort,
): ShopProduct[] {
  return products
    .filter((product) => matchesShopProduct(product, categoryId, search))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'it')
        : sort === 'price-desc'
          ? b.priceEur - a.priceEur
          : a.priceEur - b.priceEur,
    );
}

export function matchesInventoryFilter(entry: InventoryEntry, filter: StockFilter): boolean {
  switch (filter) {
    case 'stock':
      return entry.stockId !== undefined;
    case 'installed':
      return entry.stockId === undefined;
    case 'stock-new':
      return entry.stockId !== undefined && entry.condition === 'new';
    case 'stock-used':
      return entry.stockId !== undefined && entry.condition === 'used';
    case 'broken':
      return entry.condition === 'broken';
    default:
      return true;
  }
}

export function filterInventoryEntries(
  entries: readonly InventoryEntry[],
  categoryId: string,
  search: string,
  stockFilter: StockFilter,
): InventoryEntry[] {
  return entries.filter(
    (entry) =>
      matchesShopProduct(entry.product, categoryId, search) &&
      matchesInventoryFilter(entry, stockFilter),
  );
}

export function sortInventoryGroups(
  entries: readonly InventoryEntry[],
  sort: InventorySort,
): InventoryGroup[] {
  return groupInventoryEntries(entries).sort((a, b) => {
    if (sort === 'quantity-desc') return b.quantity - a.quantity;
    if (sort === 'value-desc')
      return b.quantity * b.product.priceEur - a.quantity * a.product.priceEur;
    return a.product.name.localeCompare(b.product.name, 'it');
  });
}

export function shopCategoryCount(
  products: readonly ShopProduct[],
  categoryId: string,
  search: string,
): number {
  return products.filter((product) => matchesShopProduct(product, categoryId, search)).length;
}

export function inventoryCategoryCount(
  entries: readonly InventoryEntry[],
  categoryId: string,
  search: string,
  stockFilter: StockFilter,
): number {
  return groupInventoryEntries(filterInventoryEntries(entries, categoryId, search, stockFilter))
    .length;
}

export function resolveSelectedInventoryGroup(
  groups: readonly InventoryGroup[],
  selectedKey: string | null,
): InventoryGroup | null {
  return (
    groups.find((group) => group.entries.some((entry) => entry.key === selectedKey)) ??
    groups[0] ??
    null
  );
}

export function inventoryConditionLabel(entry: InventoryEntry): string {
  return entry.condition === 'broken' ? 'Guasta' : entry.condition === 'used' ? 'Usato' : 'Nuovo';
}

export function mountedInventoryRigId(entry: InventoryEntry): number | null {
  if (entry.product.category !== 'rig' || entry.stockId !== undefined) return null;
  if (entry.rigId !== undefined) return entry.rigId;
  const match = /^rig-(\d+)$/.exec(entry.key);
  return match ? Number(match[1]) : null;
}

export function inventoryCopyLabel(entry: InventoryEntry): string {
  if (entry.gpuId !== undefined) return `GPU #${entry.gpuId}`;
  if (entry.stockId !== undefined) return `Stock #${entry.stockId}`;
  const rigId = mountedInventoryRigId(entry);
  if (rigId !== null) return `RIG #${rigId}`;
  return entry.location;
}

export function inventoryCopyDetails(entry: InventoryEntry): string {
  const telemetry = entry.gpu
    ? ` · Usura ${entry.gpu.wearPercent.toFixed(1)}% · Polvere ${entry.gpu.dustPercent.toFixed(1)}%`
    : entry.quantity > 1
      ? ` · ${entry.quantity} unità`
      : '';
  return `${inventoryConditionLabel(entry)} · ${entry.location}${telemetry}`;
}

export function filterInventoryCopies(
  entries: readonly InventoryEntry[],
  search: string,
): InventoryEntry[] {
  const query = search.trim().toLocaleLowerCase('it');
  return entries.filter((entry) =>
    `${inventoryCopyLabel(entry)} ${inventoryCopyDetails(entry)} ${entry.product.id}`
      .toLocaleLowerCase('it')
      .includes(query),
  );
}

export function resolveSelectedInventoryEntry(
  group: InventoryGroup | null,
  selectedKey: string | null,
  instanceSearch: string,
  visibleCopies: readonly InventoryEntry[],
): InventoryEntry | null {
  if (!group) return null;
  if (instanceSearch.trim()) {
    return visibleCopies.find((entry) => entry.key === selectedKey) ?? visibleCopies[0] ?? null;
  }
  return group.entries.find((entry) => entry.key === selectedKey) ?? group.entries[0] ?? null;
}

export function resolveInventorySelectionAfterAction(
  previousGroups: readonly InventoryGroup[],
  nextGroups: readonly InventoryGroup[],
  entryKey: string,
  preferredKey?: string,
): InventoryEntry | null {
  const previousGroup = previousGroups.find((group) =>
    group.entries.some((member) => member.key === entryKey),
  );
  const previousKeys = new Set(previousGroup?.entries.map((member) => member.key) ?? []);
  const previousIndex = previousGroup?.entries.findIndex((member) => member.key === entryKey) ?? 0;
  const nextGroup =
    nextGroups.find((group) => group.entries.some((member) => member.key === preferredKey)) ??
    nextGroups.find((group) => group.entries.some((member) => member.key === entryKey)) ??
    nextGroups.find((group) => group.key === previousGroup?.key);

  return (
    nextGroup?.entries.find((member) => member.key === preferredKey) ??
    nextGroup?.entries.find((member) => member.key === entryKey) ??
    nextGroup?.entries.find((member) => !previousKeys.has(member.key)) ??
    nextGroup?.entries[Math.min(previousIndex, (nextGroup?.entries.length ?? 1) - 1)] ??
    null
  );
}

export function clampShopQuantity(value: string): number {
  const quantity = Number(value);
  return Number.isFinite(quantity)
    ? Math.max(1, Math.min(SHOP_MAX_QUANTITY, Math.floor(quantity)))
    : 1;
}
