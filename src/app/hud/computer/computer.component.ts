import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { GameService } from '../../game/game.service';
import {
  SHOP_CATEGORIES,
  SHOP_MAX_QUANTITY,
  SHOP_PRODUCTS,
  SHOP_PRODUCTS_BY_ID,
  type ShopProduct,
} from '../../config/shop-config';
import {
  inventoryEntries,
  productAvailable,
  resaleValue,
  type InventoryEntry,
  type InventoryGroup,
} from '../../game/inventory';
import {
  clampShopQuantity,
  filterAndSortShopProducts,
  filterInventoryCopies,
  filterInventoryEntries,
  inventoryCategoryCount,
  inventoryConditionLabel,
  inventoryCopyDetails,
  inventoryCopyLabel,
  mountedInventoryRigId,
  resolveInventorySelectionAfterAction,
  resolveSelectedInventoryEntry,
  resolveSelectedInventoryGroup,
  shopCategoryCount,
  sortInventoryGroups,
  type InventorySort,
  type ProductSort,
  type StockFilter,
} from './computer-catalog';
import { IconComponent } from '../icons/icon.component';
import { ResearchThumbnails } from '../research-tree/research-thumbnails';

type Application = 'desktop' | 'shop' | 'inventory';

@Component({
  selector: 'app-computer',
  imports: [IconComponent],
  templateUrl: './computer.component.html',
  styleUrl: './computer.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComputerComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  readonly app = signal<Application>('desktop');
  readonly category = signal('all');
  readonly search = signal('');
  readonly sort = signal<ProductSort>('price-asc');
  readonly stockFilter = signal<StockFilter>('all');
  readonly inventorySort = signal<InventorySort>('name');
  readonly selection = signal<string | null>(null);
  readonly instanceSearch = signal('');
  readonly cart = signal<ReadonlyMap<string, number>>(new Map());
  readonly quantities = signal<ReadonlyMap<string, number>>(new Map());
  readonly feedback = signal('');
  readonly feedbackError = signal(false);
  readonly salePending = signal<number | null>(null);
  readonly thumbnails = signal<ReadonlyMap<string, string>>(new Map());
  readonly categories = SHOP_CATEGORIES;
  readonly maxQuantity = SHOP_MAX_QUANTITY;
  readonly entries = computed(() => inventoryEntries(this.game.world()));
  readonly stockCount = computed(() => this.game.world().inventory.items.length);
  readonly brokenCount = computed(
    () => this.entries().filter((entry) => entry.condition === 'broken').length,
  );
  readonly availableBalance = computed(() => this.game.balanceEur());
  readonly products = computed(() =>
    filterAndSortShopProducts(SHOP_PRODUCTS, this.category(), this.search(), this.sort()),
  );
  readonly visibleEntries = computed(() =>
    filterInventoryEntries(this.entries(), this.category(), this.search(), this.stockFilter()),
  );
  readonly inventoryGroups = computed(() => {
    return sortInventoryGroups(this.visibleEntries(), this.inventorySort());
  });
  readonly selectedGroup = computed<InventoryGroup | null>(() =>
    resolveSelectedInventoryGroup(this.inventoryGroups(), this.selection()),
  );
  readonly selectedEntry = computed<InventoryEntry | null>(() =>
    resolveSelectedInventoryEntry(
      this.selectedGroup(),
      this.selection(),
      this.instanceSearch(),
      this.visibleCopies(),
    ),
  );
  readonly visibleCopies = computed(() => {
    return filterInventoryCopies(this.selectedGroup()?.entries ?? [], this.instanceSearch());
  });
  readonly cartLines = computed(() =>
    [...this.cart()].map(([id, quantity]) => ({ product: SHOP_PRODUCTS_BY_ID.get(id)!, quantity })),
  );
  readonly cartCount = computed(() =>
    this.cartLines().reduce((sum, line) => sum + line.quantity, 0),
  );
  readonly cartTotal = computed(() =>
    this.cartLines().reduce((sum, line) => sum + line.product.priceEur * line.quantity, 0),
  );
  readonly rigs = computed(() =>
    this.game
      .world()
      .plots.flatMap((plot) => plot.rigs)
      .filter((rig) => rig.unlocked),
  );
  readonly rigSlots = computed(() =>
    this.game
      .world()
      .plots.flatMap((plot) => plot.rigs)
      .filter((rig) => !rig.unlocked),
  );
  readonly targetRigId = signal(1);
  readonly targetRigSlotId = signal<number | null>(null);
  readonly selectedRigSlotId = computed<number | null>(
    () =>
      this.rigSlots().find((rig) => rig.id === this.targetRigSlotId())?.id ??
      this.rigSlots()[0]?.id ??
      null,
  );
  readonly replacementRigStockId = signal<number | null>(null);
  readonly rigStockEntries = computed(() =>
    this.entries().filter(
      (entry) => entry.product.category === 'rig' && entry.stockId !== undefined,
    ),
  );
  readonly selectedReplacementRigStockId = computed(
    () =>
      this.rigStockEntries().find((entry) => entry.stockId === this.replacementRigStockId())
        ?.stockId ??
      this.rigStockEntries()[0]?.stockId ??
      null,
  );
  private readonly euros = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  private renderer?: ResearchThumbnails;
  private loading = false;
  private destroyed = false;
  private readonly failedThumbnails = new Set<string>();

  constructor() {
    effect(() => {
      if (!this.game.started())
        untracked(() => {
          this.cart.set(new Map());
          this.quantities.set(new Map());
          this.stockFilter.set('all');
          this.launch('desktop');
        });
    });
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) return;
      if (this.game.computerOpen()) {
        if (!dialog.open) dialog.showModal();
      } else if (dialog.open) dialog.close();
    });
    effect(() => {
      const open = this.game.computerOpen();
      this.app();
      this.products();
      this.visibleEntries();
      if (open) untracked(() => void this.loadThumbnails());
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.renderer?.dispose();
  }
  close(): void {
    this.game.computerOpen.set(false);
  }
  launch(app: Application): void {
    this.app.set(app);
    this.category.set('all');
    this.search.set('');
    this.instanceSearch.set('');
    this.selection.set(null);
    this.feedback.set('');
    this.salePending.set(null);
  }
  selectCategory(id: string): void {
    this.category.set(id);
    this.selection.set(null);
    this.instanceSearch.set('');
    this.salePending.set(null);
  }
  setSearch(value: string): void {
    this.search.set(value);
    this.instanceSearch.set('');
    this.salePending.set(null);
  }
  setStockFilter(value: StockFilter): void {
    this.stockFilter.set(value);
    this.instanceSearch.set('');
    this.salePending.set(null);
  }
  selectEntry(entry: InventoryEntry): void {
    this.selection.set(entry.key);
    this.salePending.set(null);
  }
  selectGroup(group: InventoryGroup): void {
    this.selection.set(group.entries[0]?.key ?? null);
    this.instanceSearch.set('');
    this.salePending.set(null);
  }
  money(value: number): string {
    return this.euros.format(value);
  }
  available(product: ShopProduct): boolean {
    return productAvailable(this.game.world(), product);
  }
  stock(productId: string): number {
    return this.game.stockQuantity(productId);
  }
  owned(productId: string): number {
    return this.entries()
      .filter((entry) => entry.product.id === productId)
      .reduce((sum, entry) => sum + entry.quantity, 0);
  }
  categoryCount(categoryId: string): number {
    if (this.app() === 'shop') {
      return shopCategoryCount(SHOP_PRODUCTS, categoryId, this.search());
    }
    return inventoryCategoryCount(this.entries(), categoryId, this.search(), this.stockFilter());
  }
  quantity(id: string): number {
    return this.quantities().get(id) ?? 1;
  }
  setQuantity(id: string, value: string): void {
    this.quantities.update((values) => new Map(values).set(id, clampShopQuantity(value)));
  }
  addToCart(product: ShopProduct): void {
    if (!this.available(product)) return;
    const next = (this.cart().get(product.id) ?? 0) + this.quantity(product.id);
    if (next > SHOP_MAX_QUANTITY) {
      this.feedbackError.set(true);
      this.feedback.set(`Massimo ${SHOP_MAX_QUANTITY} unità per articolo nel carrello.`);
      return;
    }
    this.cart.update((cart) => new Map(cart).set(product.id, next));
    this.feedbackError.set(false);
    this.feedback.set(`${product.name} aggiunto al carrello.`);
  }
  changeCart(id: string, delta: number): void {
    this.cart.update((cart) => {
      const next = new Map(cart);
      const quantity = (next.get(id) ?? 0) + delta;
      if (quantity <= 0) next.delete(id);
      else next.set(id, Math.min(SHOP_MAX_QUANTITY, quantity));
      return next;
    });
  }
  checkout(): void {
    this.perform(() => {
      this.game.buyCart([...this.cart()].map(([productId, quantity]) => ({ productId, quantity })));
      this.cart.set(new Map());
    }, 'Ordine completato. Componenti disponibili in magazzino.');
  }
  conditionLabel(entry: InventoryEntry): string {
    return inventoryConditionLabel(entry);
  }
  copyLabel(entry: InventoryEntry): string {
    return inventoryCopyLabel(entry);
  }
  copyDetails(entry: InventoryEntry): string {
    return inventoryCopyDetails(entry);
  }
  stockQuantity(group: InventoryGroup): number {
    return group.entries
      .filter((entry) => entry.stockId !== undefined)
      .reduce((sum, entry) => sum + entry.quantity, 0);
  }
  mountedQuantity(group: InventoryGroup): number {
    return group.quantity - this.stockQuantity(group);
  }
  freeSlots(rigId: number): number {
    const rig = this.rigs().find((entry) => entry.id === rigId);
    return rig?.gpus.filter((gpu) => !gpu.unlocked).length ?? 0;
  }
  hasFreeSlot(rigId: number): boolean {
    return this.freeSlots(rigId) > 0;
  }
  resale(entry: InventoryEntry): number {
    const item = this.game.world().inventory.items.find((item) => item.id === entry.stockId);
    return item ? resaleValue(item) : 0;
  }
  rigGpuCount(entry: InventoryEntry): number {
    if (entry.product.category !== 'rig') return 0;
    if (entry.stockId !== undefined) {
      const item = this.game.world().inventory.items.find((item) => item.id === entry.stockId);
      return item?.rig?.gpus.filter(Boolean).length ?? 0;
    }
    return (
      this.rigs()
        .find((rig) => rig.id === entry.rigId)
        ?.gpus.filter((gpu) => gpu.unlocked).length ?? 0
    );
  }
  isRigMining(entry: InventoryEntry): boolean {
    const rigId = this.mountedRigId(entry);
    return rigId !== null && this.game.isRigMining(rigId);
  }
  sell(entry: InventoryEntry): void {
    if (entry.stockId === undefined || this.game.running()) return;
    this.performEntryAction(
      entry,
      () => {
        this.game.sellStock(entry.stockId!);
        this.salePending.set(null);
      },
      'Articolo venduto. Importo accreditato in euro.',
    );
  }
  store(entry: InventoryEntry): void {
    if (entry.gpuId === undefined || this.game.isGpuMining(entry.gpuId)) return;
    this.performEntryAction(
      entry,
      () => this.game.moveGpuToStock(entry.gpuId!),
      'GPU trasferita in magazzino. Lo slot nel RIG è libero.',
    );
  }
  storeRig(entry: InventoryEntry): void {
    const rigId = this.mountedRigId(entry);
    if (rigId === null || this.game.isRigMining(rigId)) return;
    this.performEntryAction(
      entry,
      () => this.game.moveRigToStock(rigId),
      'RIG trasferito in magazzino.',
    );
  }
  mountRig(entry: InventoryEntry): void {
    const targetRigId = this.selectedRigSlotId();
    if (entry.product.category !== 'rig' || entry.stockId === undefined || targetRigId === null)
      return;
    this.performEntryAction(
      entry,
      () => this.game.mountStockRig(entry.stockId!, targetRigId),
      'RIG montato nella farm.',
      `rig-${targetRigId}`,
    );
  }
  replaceRig(entry: InventoryEntry): void {
    const rigId = this.mountedRigId(entry);
    const stockId = this.selectedReplacementRigStockId();
    if (rigId === null || stockId === null || this.game.isRigMining(rigId)) return;
    this.performEntryAction(
      entry,
      () => this.game.replaceRigFromStock(rigId, stockId),
      'RIG sostituito con quello in magazzino.',
    );
  }
  setRigSlotTarget(value: string): void {
    const rigId = Number(value);
    if (this.rigSlots().some((rig) => rig.id === rigId)) this.targetRigSlotId.set(rigId);
  }
  setReplacementRigStock(value: string): void {
    const stockId = Number(value);
    if (this.rigStockEntries().some((entry) => entry.stockId === stockId))
      this.replacementRigStockId.set(stockId);
  }
  mount(entry: InventoryEntry): void {
    if (
      entry.stockId === undefined ||
      entry.condition === 'broken' ||
      !entry.gpu ||
      !this.hasFreeSlot(this.targetRigId())
    )
      return;
    this.performEntryAction(
      entry,
      () => this.game.mountStockGpu(entry.stockId!, this.targetRigId()),
      'GPU montata nel RIG.',
    );
  }
  inspect(entry: InventoryEntry): void {
    if (entry.gpuId === undefined || this.game.isGpuMining(entry.gpuId)) return;
    this.game.inspectGpu(entry.gpuId);
    this.close();
  }
  private mountedRigId(entry: InventoryEntry): number | null {
    return mountedInventoryRigId(entry);
  }
  private performEntryAction(
    entry: InventoryEntry,
    action: () => void,
    message: string,
    preferredKey?: string,
  ): void {
    const previousGroups = this.inventoryGroups();

    this.perform(action, message);
    if (this.feedbackError()) return;

    const nextEntry = resolveInventorySelectionAfterAction(
      previousGroups,
      this.inventoryGroups(),
      entry.key,
      preferredKey,
    );
    this.selection.set(nextEntry?.key ?? null);
    if (!nextEntry || nextEntry.key !== entry.key) this.instanceSearch.set('');
  }
  private perform(action: () => void, message: string): void {
    try {
      action();
      this.feedbackError.set(false);
      this.feedback.set(message);
    } catch (error) {
      this.feedbackError.set(true);
      this.feedback.set(error instanceof Error ? error.message : 'Operazione non disponibile.');
    }
  }
  private async loadThumbnails(): Promise<void> {
    if (this.loading || this.app() === 'desktop' || this.destroyed) return;
    this.loading = true;
    try {
      this.renderer ??= new ResearchThumbnails();
      while (!this.destroyed && this.game.computerOpen() && this.app() !== 'desktop') {
        const products =
          this.app() === 'shop'
            ? this.products()
            : this.visibleEntries().map((entry) => entry.product);
        const next = products.find(
          (product) => !this.thumbnails().has(product.id) && !this.failedThumbnails.has(product.id),
        );
        if (!next) break;
        try {
          const image = await this.renderer.render(next.model);
          if (!this.destroyed && image)
            this.thumbnails.update((images) => new Map(images).set(next.id, image));
        } catch {
          this.failedThumbnails.add(next.id);
        }
      }
    } catch {
      /* L'elenco resta utilizzabile anche senza WebGL. */
    } finally {
      this.loading = false;
    }
  }
}
