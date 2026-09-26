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
  groupInventoryEntries,
  productAvailable,
  resaleValue,
  type InventoryEntry,
  type InventoryGroup,
} from '../../game/inventory';
import { IconComponent } from '../icons/icon.component';
import { ResearchThumbnails } from '../research-tree/research-thumbnails';

type Application = 'desktop' | 'shop' | 'inventory';
type StockFilter = 'all' | 'stock' | 'installed' | 'broken';
type InventorySort = 'name' | 'quantity-desc' | 'value-desc';

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
  readonly sort = signal('price-asc');
  readonly stockFilter = signal<StockFilter>('all');
  readonly inventorySort = signal<InventorySort>('name');
  readonly selection = signal<string | null>(null);
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
    SHOP_PRODUCTS.filter((product) => this.matches(product)).sort((a, b) =>
      this.sort() === 'name'
        ? a.name.localeCompare(b.name, 'it')
        : this.sort() === 'price-desc'
          ? b.priceEur - a.priceEur
          : a.priceEur - b.priceEur,
    ),
  );
  readonly visibleEntries = computed(() =>
    this.entries().filter(
      (entry) =>
        this.matches(entry.product) &&
        (this.stockFilter() === 'all' ||
          (this.stockFilter() === 'broken' && entry.condition === 'broken') ||
          (this.stockFilter() === 'stock' && entry.stockId !== undefined) ||
          (this.stockFilter() === 'installed' && entry.stockId === undefined)),
    ),
  );
  readonly inventoryGroups = computed(() => {
    const groups = groupInventoryEntries(this.visibleEntries());
    return groups.sort((a, b) => {
      if (this.inventorySort() === 'quantity-desc') return b.quantity - a.quantity;
      if (this.inventorySort() === 'value-desc')
        return b.quantity * b.product.priceEur - a.quantity * a.product.priceEur;
      return a.product.name.localeCompare(b.product.name, 'it');
    });
  });
  readonly selectedGroup = computed<InventoryGroup | null>(
    () =>
      this.inventoryGroups().find((group) =>
        group.entries.some((entry) => entry.key === this.selection()),
      ) ??
      this.inventoryGroups()[0] ??
      null,
  );
  readonly selectedEntry = computed<InventoryEntry | null>(() => {
    const group = this.selectedGroup();
    return (
      group?.entries.find((entry) => entry.key === this.selection()) ?? group?.entries[0] ?? null
    );
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
  readonly targetRigId = signal(1);
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
    this.selection.set(null);
    this.feedback.set('');
    this.salePending.set(null);
  }
  selectCategory(id: string): void {
    this.category.set(id);
    this.selection.set(null);
    this.salePending.set(null);
  }
  selectEntry(entry: InventoryEntry): void {
    this.selection.set(entry.key);
    this.salePending.set(null);
  }
  selectGroup(group: InventoryGroup): void {
    this.selection.set(group.entries[0]?.key ?? null);
    this.salePending.set(null);
  }
  money(value: number): string {
    return this.euros.format(value);
  }
  available(product: ShopProduct): boolean {
    return productAvailable(this.game.world(), product);
  }
  stock(productId: string): number {
    return this.game.world().inventory.items.filter((item) => item.productId === productId).length;
  }
  owned(productId: string): number {
    return this.entries()
      .filter((entry) => entry.product.id === productId)
      .reduce((sum, entry) => sum + entry.quantity, 0);
  }
  categoryCount(categoryId: string): number {
    if (this.app() === 'shop') {
      return SHOP_PRODUCTS.filter(
        (product) =>
          (categoryId === 'all' || product.category === categoryId) && this.matches(product, false),
      ).length;
    }
    const filteredEntries = this.entries().filter((entry) => {
      const matchesState =
        this.stockFilter() === 'all' ||
        (this.stockFilter() === 'broken' && entry.condition === 'broken') ||
        (this.stockFilter() === 'stock' && entry.stockId !== undefined) ||
        (this.stockFilter() === 'installed' && entry.stockId === undefined);
      return (
        matchesState &&
        (categoryId === 'all' || entry.product.category === categoryId) &&
        this.matches(entry.product, false)
      );
    });
    return groupInventoryEntries(filteredEntries).length;
  }
  quantity(id: string): number {
    return this.quantities().get(id) ?? 1;
  }
  setQuantity(id: string, value: string): void {
    const quantity = Number(value);
    this.quantities.update((values) =>
      new Map(values).set(
        id,
        Number.isFinite(quantity)
          ? Math.max(1, Math.min(SHOP_MAX_QUANTITY, Math.floor(quantity)))
          : 1,
      ),
    );
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
    return entry.condition === 'broken' ? 'Guasta' : entry.condition === 'used' ? 'Usato' : 'Nuovo';
  }
  resale(entry: InventoryEntry): number {
    const item = this.game.world().inventory.items.find((item) => item.id === entry.stockId);
    return item ? resaleValue(item) : 0;
  }
  sell(entry: InventoryEntry): void {
    if (entry.stockId === undefined) return;
    this.perform(() => {
      this.game.sellStock(entry.stockId!);
      this.salePending.set(null);
    }, 'Articolo venduto. Importo accreditato in euro.');
  }
  store(entry: InventoryEntry): void {
    if (entry.gpuId === undefined) return;
    this.perform(
      () => this.game.moveGpuToStock(entry.gpuId!),
      'GPU trasferita in magazzino. Lo slot nel RIG è libero.',
    );
  }
  mount(entry: InventoryEntry): void {
    if (entry.stockId === undefined) return;
    this.perform(
      () => this.game.mountStockGpu(entry.stockId!, this.targetRigId()),
      'GPU montata nel RIG.',
    );
  }
  inspect(entry: InventoryEntry): void {
    if (entry.gpuId === undefined || this.game.running()) return;
    this.game.inspectGpu(entry.gpuId);
    this.close();
  }
  private matches(product: ShopProduct, includeCategory = true): boolean {
    return (
      (!includeCategory || this.category() === 'all' || product.category === this.category()) &&
      `${product.name} ${product.id} ${product.description}`
        .toLocaleLowerCase('it')
        .includes(this.search().trim().toLocaleLowerCase('it'))
    );
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
