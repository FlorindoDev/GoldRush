import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  output,
  signal,
  untracked,
} from '@angular/core';
import { SHOP_PRODUCTS, SHOP_PRODUCTS_BY_ID, type ShopProduct } from '../../config/shop-config';
import { GameService } from '../../game/game.service';
import type { StockItem } from '../../game/inventory';
import { ResearchThumbnails } from '../research-tree/research-thumbnails';
import { IconComponent } from '../icons/icon.component';
import { PLACEMENT_MIME, type PlacementItem } from './placement-item';

type PlacementKind = PlacementItem['kind'];
interface StockGroup {
  readonly product: ShopProduct;
  readonly items: readonly StockItem[];
  readonly usable: StockItem | undefined;
}

@Component({
  selector: 'app-placement-panel',
  imports: [IconComponent],
  templateUrl: './placement-panel.component.html',
  styleUrl: './placement-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlacementPanelComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly dragStarted = output<PlacementItem>();
  readonly dragEnded = output<void>();
  readonly categories = [
    { kind: 'rig', label: 'RIG', icon: 'rack' },
    { kind: 'gpu', label: 'GPU', icon: 'gpu' },
  ] as const;
  readonly expanded = signal<PlacementKind | null>(null);
  readonly plotIds = computed(() =>
    Array.from({ length: this.game.plotCount() }, (_, index) => index + 1),
  );
  readonly thumbnails = signal<ReadonlyMap<string, string>>(new Map());
  readonly stock = computed(() => this.game.world().inventory.items);
  readonly groups = computed(() => {
    const groups = new Map<string, StockItem[]>();
    for (const item of this.stock()) {
      const category = SHOP_PRODUCTS_BY_ID.get(item.productId)?.category;
      if (category !== 'rig' && category !== 'gpu') continue;
      const copies = groups.get(item.productId) ?? [];
      copies.push(item);
      groups.set(item.productId, copies);
    }
    return [...groups]
      .flatMap(([productId, items]): StockGroup[] => {
        const product = SHOP_PRODUCTS_BY_ID.get(productId);
        if (!product) return [];
        return [
          {
            product,
            items,
            usable: items.find((item) =>
              product.category === 'rig' ? !!item.rig : !!item.gpu && item.gpu.wearPercent < 100,
            ),
          },
        ];
      })
      .sort((a, b) => a.product.name.localeCompare(b.product.name, 'it'));
  });
  private renderer?: ResearchThumbnails;
  private loading = false;
  private destroyed = false;
  private readonly failed = new Set<string>();

  constructor() {
    effect(() => {
      if (this.game.placementMode()) {
        this.groups();
        untracked(() => void this.loadThumbnails());
      }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.renderer?.dispose();
  }

  count(kind: PlacementKind): number {
    return this.groups()
      .filter((group) => group.product.category === kind)
      .reduce((total, group) => total + group.items.length, 0);
  }

  groupsFor(kind: PlacementKind): readonly StockGroup[] {
    return this.groups().filter((group) => group.product.category === kind);
  }

  categoryProduct(kind: PlacementKind): ShopProduct {
    return (
      this.groupsFor(kind)[0]?.product ??
      SHOP_PRODUCTS.find((product) => product.category === kind)!
    );
  }

  toggle(kind: PlacementKind): void {
    this.expanded.set(this.expanded() === kind ? null : kind);
  }

  startDrag(event: DragEvent, group: StockGroup): void {
    const stockId = group.usable?.id;
    if (stockId === undefined || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const item = { stockId, kind: group.product.category as PlacementKind };
    event.dataTransfer.setData(PLACEMENT_MIME, String(stockId));
    event.dataTransfer.effectAllowed = 'move';
    const transparentImage = document.createElement('canvas');
    transparentImage.width = 1;
    transparentImage.height = 1;
    event.dataTransfer.setDragImage(transparentImage, 0, 0);
    this.dragStarted.emit(item);
  }

  stopDrag(): void {
    this.dragEnded.emit();
  }

  viewPlot(id: number): void {
    this.game.viewPlot(id);
  }

  private async loadThumbnails(): Promise<void> {
    if (this.loading || this.destroyed) return;
    this.loading = true;
    try {
      this.renderer ??= new ResearchThumbnails();
      while (!this.destroyed && this.game.placementMode()) {
        const products = [
          this.categoryProduct('rig'),
          this.categoryProduct('gpu'),
          ...this.groups().map((group) => group.product),
        ];
        const next = products.find(
          (product) => !this.thumbnails().has(product.id) && !this.failed.has(product.id),
        );
        if (!next) break;
        try {
          const image = await this.renderer.render(next.model);
          if (!this.destroyed && image)
            this.thumbnails.update((images) => new Map(images).set(next.id, image));
        } catch {
          this.failed.add(next.id);
        }
      }
    } catch {
      // Il pannello resta utilizzabile anche senza anteprime WebGL.
    } finally {
      this.loading = false;
    }
  }
}
