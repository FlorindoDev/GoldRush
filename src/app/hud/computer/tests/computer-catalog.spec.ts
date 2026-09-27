import { describe, expect, it } from 'vitest';
import { SHOP_PRODUCTS } from '../../../config/shop-config';
import { inventoryEntries, purchaseCart } from '../../../game/inventory';
import { createWorld } from '../../../game/mining-world';
import {
  filterAndSortShopProducts,
  filterInventoryCopies,
  filterInventoryEntries,
  inventoryCategoryCount,
  resolveInventorySelectionAfterAction,
  resolveSelectedInventoryEntry,
  sortInventoryGroups,
} from '../computer-catalog';

describe('catalogo PC', () => {
  it('filtra e ordina prodotti per categoria e ricerca', () => {
    const matches = filterAndSortShopProducts(SHOP_PRODUCTS, 'gpu', 'passive', 'price-asc');
    expect(matches.map((product) => product.id)).toContain('gpu-passive');
    expect(matches.every((product) => product.category === 'gpu')).toBe(true);
    expect(matches.map((product) => product.priceEur)).toEqual(
      [...matches].map((product) => product.priceEur).sort((a, b) => a - b),
    );
  });

  it('cerca copie dello stesso modello e conserva la selezione dopo una vendita', () => {
    const world = purchaseCart({ ...createWorld(), cashEur: 1000 }, [
      { productId: 'gpu-passive', quantity: 2 },
    ]);
    const entries = filterInventoryEntries(inventoryEntries(world), 'gpu', 'passive', 'stock');
    const groups = sortInventoryGroups(entries, 'name');
    expect(inventoryCategoryCount(entries, 'gpu', 'passive', 'stock')).toBe(1);
    expect(groups[0].quantity).toBe(2);
    const selected = groups[0].entries[0];
    const other = groups[0].entries[1];
    const visible = filterInventoryCopies(groups[0].entries, `Stock #${other.stockId}`);
    expect(visible.map((entry) => entry.key)).toEqual([other.key]);
    expect(resolveSelectedInventoryEntry(groups[0], selected.key, 'Stock #', visible)).toEqual(
      other,
    );
    const remaining = sortInventoryGroups(
      entries.filter((entry) => entry.key !== selected.key),
      'name',
    );
    expect(resolveInventorySelectionAfterAction(groups, remaining, selected.key)?.key).toBe(
      other.key,
    );
  });
});
