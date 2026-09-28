import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { GameService } from '../game/game.service';
import { SceneControlsComponent } from '../hud/controls/scene-controls.component';
import { IconComponent } from '../hud/icons/icon.component';
import type { GpuHover } from '../hud/indicators/gpu-tooltip/gpu-tooltip.component';
import type { CameraPreset } from './camera/camera-preset';
import { MiningScene } from './mining-scene';
import type { PlacementTarget } from './mining-scene';
import { PLACED_MIME, PLACEMENT_MIME, type PlacementItem } from '../hud/placement/placement-item';
import { SceneAssets } from './resources/scene-assets';
import type { ToolStationId } from './tools/tool-stations';
import { getGpu, isGpuUnlocked, type PlacedItem } from '../game/mining-world';
import { SHOP_PRODUCTS_BY_ID } from '../config/shop-config';
import {
  SceneContextMenuComponent,
  type SceneContextMenu,
  type SceneContextRequest,
  type SceneContextTarget,
} from './scene-context-menu.component';

@Component({
  selector: 'app-scene',
  imports: [IconComponent, SceneControlsComponent, SceneContextMenuComponent],
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown.escape)': 'closeContextMenuFromEscape()',
    '(document:dragover)': 'trackPlacementDrag($event)',
    '(document:dragend)': 'endPlacementDrag()',
    '(document:drop)': 'cancelPlacementDrop($event)',
  },
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  readonly game = inject(GameService);
  readonly gpuHover = output<GpuHover | null>();
  readonly placementItem = input<PlacementItem | null>(null);
  readonly draggedPlacedItem = signal<PlacedItem | null>(null);
  readonly placementTarget = signal<PlacementTarget | null>(null);
  readonly dragCursor = signal<{ x: number; y: number } | null>(null);
  readonly placementSelection = signal<readonly PlacedItem[]>([]);
  readonly placementMenu = signal<{ x: number; y: number; items: readonly PlacedItem[] } | null>(
    null,
  );
  readonly placementFeedback = signal('');
  readonly placementMessage = signal('');
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  readonly contextMenu = signal<SceneContextMenu | null>(null);
  readonly contextFeedback = signal('');
  readonly contextNotice = signal('');
  private scene?: MiningScene;
  private pendingPlacedItem: PlacedItem | null = null;
  private destroyed = false;
  private contextNoticeTimeout?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      const paused = this.game.paused();
      const activeGpuIds = this.game.activeGpuIds();
      const inspectedGpuId = this.game.inspectedGpuId();
      const inspectedRigId = this.game.inspectedRigId();
      const selectedGpuId = this.game.selectedGpuId();
      const viewedPlotId = this.game.viewedPlotId();
      const viewedRigId = this.game.viewedRigId();
      const cameraPreset = this.cameraPreset();
      const selectedToolStationId = this.selectedToolStationId();
      const computerOpen = this.game.computerOpen();
      const placementMode = this.game.placementMode();
      if (placementMode && selectedToolStationId !== null) {
        untracked(() => this.selectedToolStationId.set(null));
      }
      if (!placementMode) {
        this.placementTarget.set(null);
        this.placementMessage.set('');
        this.placementMenu.set(null);
        if (untracked(() => this.placementSelection().length)) this.setPlacementSelection([]);
      } else if (
        !this.placementItem() &&
        !this.draggedPlacedItem() &&
        untracked(() => this.placementTarget()) !== null
      ) {
        this.leavePlacement();
      }
      if (!placementMode) this.endPlacementDrag();
      const menu = this.contextMenu();
      if (placementMode && menu) this.closeContextMenu();
      const targetUnavailable =
        menu !== null &&
        (!isGpuUnlocked(world, menu.id) ||
          getGpu(world, menu.id).onWorkbench ||
          this.game.isGpuMining(menu.id));
      if (targetUnavailable) this.closeContextMenu();
      this.scene?.update(
        world,
        mining,
        paused,
        inspectedGpuId,
        inspectedRigId,
        viewedPlotId,
        viewedRigId,
        cameraPreset,
        selectedToolStationId,
        activeGpuIds,
        selectedGpuId,
        computerOpen,
        placementMode,
      );
    });
  }

  async ngAfterViewInit(): Promise<void> {
    let assets: SceneAssets | undefined;
    try {
      assets = await SceneAssets.load();
      if (this.destroyed) {
        assets.dispose();
        return;
      }
      await assets.loadRigAssets();
      if (this.destroyed) {
        assets.dispose();
        return;
      }
      this.scene = new MiningScene(
        this.canvas().nativeElement,
        {
          select: (id) => this.game.select(id),
          inspect: (id) => {
            this.game.inspectGpu(id);
            if (this.game.inspectedGpuId() === id) {
              this.selectedToolStationId.set(null);
            }
          },
          viewRig: (id) => this.game.viewRig(id),
          inspectRig: (id) => {
            this.game.inspectRig(id);
            if (this.game.inspectedRigId() === id) {
              this.selectedToolStationId.set('rigWorkbench');
            }
          },
          telemetry: (id) => this.game.gpuTelemetry(id),
          openComputer: () => this.setSelectedToolStationId('computer'),
          hover: (gpuId, x, y) => this.gpuHover.emit(gpuId === null ? null : { gpuId, x, y }),
          contextMenu: (target, x, y) => this.openContextMenu(target, x, y),
          placementSelect: (target, extend) => this.selectPlacedItem(target, extend),
          placementContextMenu: (target, x, y) => this.openPlacementMenu(target, x, y),
        },
        assets,
      );
      this.scene.update(
        this.game.world(),
        this.game.mining(),
        this.game.paused(),
        this.game.inspectedGpuId(),
        this.game.inspectedRigId(),
        this.game.viewedPlotId(),
        this.game.viewedRigId(),
        this.cameraPreset(),
        this.selectedToolStationId(),
        this.game.activeGpuIds(),
        this.game.selectedGpuId(),
        this.game.computerOpen(),
        this.game.placementMode(),
      );
    } catch (error) {
      console.error('Impossibile inizializzare la scena 3D.', error);
      assets?.dispose();
      if (!this.destroyed) {
        this.unavailable.set(true);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.contextNoticeTimeout) clearTimeout(this.contextNoticeTimeout);
    this.scene?.dispose();
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset.set(preset);
  }

  setSelectedToolStationId(id: ToolStationId | null): void {
    this.selectedToolStationId.set(id);
    if (id === 'computer') this.game.computerOpen.set(true);
  }

  armPlacedDrag(event: PointerEvent): void {
    if (!this.game.placementMode() || event.button !== 0 || event.ctrlKey || event.metaKey) return;
    this.pendingPlacedItem = this.scene?.placedItemAt(event.clientX, event.clientY) ?? null;
    this.canvas().nativeElement.draggable = this.pendingPlacedItem !== null;
  }

  disarmPlacedDrag(): void {
    this.pendingPlacedItem = null;
    if (!this.draggedPlacedItem()) this.canvas().nativeElement.draggable = false;
  }

  startPlacedDrag(event: DragEvent): void {
    const item = this.pendingPlacedItem;
    if (!this.game.placementMode() || !item || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(PLACED_MIME, `${item.kind}:${item.id}`);
    event.dataTransfer.effectAllowed = 'move';
    const transparentImage = document.createElement('canvas');
    transparentImage.width = 1;
    transparentImage.height = 1;
    event.dataTransfer.setDragImage(transparentImage, 0, 0);
    this.draggedPlacedItem.set(item);
    this.placementMenu.set(null);
    this.setPlacementSelection([]);
  }

  dragOverPlacement(event: DragEvent): void {
    const stock = this.placementItem();
    const placed = this.draggedPlacedItem();
    const transfer = event.dataTransfer;
    if (!this.game.placementMode() || !transfer) return;
    const item = transfer.types.includes(PLACED_MIME)
      ? placed
      : transfer.types.includes(PLACEMENT_MIME)
        ? stock
        : null;
    if (!item) return;
    event.preventDefault();
    const target = this.scene?.placementTargetAt(event.clientX, event.clientY, item.kind) ?? null;
    this.placementTarget.set(target);
    this.scene?.setPlacementHover(target);
    transfer.dropEffect = 'move';
  }

  trackPlacementDrag(event: DragEvent): void {
    const stockItem = this.placementItem();
    const placedItem = this.draggedPlacedItem();
    const transfer = event.dataTransfer;
    if (!this.game.placementMode() || !transfer) return;
    const draggingPlaced = placedItem && transfer.types.includes(PLACED_MIME);
    const draggingStock = stockItem && transfer.types.includes(PLACEMENT_MIME);
    if (!draggingStock && !draggingPlaced) return;
    event.preventDefault();
    transfer.dropEffect = 'move';
    const bounds = this.canvas().nativeElement.getBoundingClientRect();
    this.dragCursor.set({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    if (draggingPlaced && placedItem) {
      this.scene?.beginPlacedDrag(placedItem, event.clientX, event.clientY);
      return;
    }
    const stock = this.game
      .world()
      .inventory.items.find((entry) => entry.id === stockItem!.stockId);
    const product = stock && SHOP_PRODUCTS_BY_ID.get(stock.productId);
    if (product)
      this.scene?.beginPlacementDrag(
        stockItem!.stockId,
        product.model,
        stockItem!.kind,
        event.clientX,
        event.clientY,
      );
  }

  endPlacementDrag(): void {
    this.dragCursor.set(null);
    this.draggedPlacedItem.set(null);
    this.pendingPlacedItem = null;
    if (this.scene) this.canvas().nativeElement.draggable = false;
    this.scene?.endPlacementDrag();
  }

  cancelPlacementDrop(event: DragEvent): void {
    if (
      !event.dataTransfer?.types.includes(PLACEMENT_MIME) &&
      !event.dataTransfer?.types.includes(PLACED_MIME)
    )
      return;
    event.preventDefault();
    this.endPlacementDrag();
    this.leavePlacement();
  }

  leavePlacement(): void {
    this.placementTarget.set(null);
    this.scene?.setPlacementHover(null);
  }

  dropPlacement(event: DragEvent): void {
    const stockItem = this.placementItem();
    const placedItem = this.draggedPlacedItem();
    const droppingPlaced = Boolean(
      placedItem &&
      event.dataTransfer?.getData(PLACED_MIME) === `${placedItem.kind}:${placedItem.id}`,
    );
    const droppingStock =
      stockItem && event.dataTransfer?.getData(PLACEMENT_MIME) === String(stockItem.stockId);
    if (!this.game.placementMode() || (!droppingPlaced && !droppingStock)) return;
    const kind = (droppingPlaced ? placedItem : stockItem)!.kind;
    event.preventDefault();
    event.stopPropagation();
    const target = this.scene?.placementTargetAt(event.clientX, event.clientY, kind);
    this.placementTarget.set(null);
    this.scene?.setPlacementHover(null);
    this.endPlacementDrag();
    if (!target) {
      this.placementMessage.set(
        kind === 'rig'
          ? 'Rilascia il RIG su una pedana vuota.'
          : 'Rilascia la GPU su un RIG con slot libero.',
      );
      return;
    }
    if (droppingPlaced && placedItem) {
      try {
        if (placedItem.kind === 'rig') {
          this.game.moveMountedRig(placedItem.id, target.rigId);
        } else if (target.slotGpuId !== undefined) {
          this.game.moveMountedGpu(placedItem.id, target.slotGpuId);
        }
        this.placementMessage.set('Componente spostato.');
      } catch (error) {
        this.placementMessage.set(
          error instanceof Error ? error.message : 'Spostamento non riuscito.',
        );
      }
      return;
    }
    const item = stockItem!;
    const stock = this.game.world().inventory.items.find((entry) => entry.id === item.stockId);
    if (!stock || (item.kind === 'rig' ? !stock.rig : !stock.gpu)) {
      this.placementMessage.set('Componente non più disponibile in magazzino.');
      return;
    }
    try {
      if (item.kind === 'rig') {
        this.game.mountStockRig(item.stockId, target.rigId, false);
        this.placementMessage.set(`RIG montato nella posizione ${target.rigId}.`);
      } else {
        this.game.mountStockGpu(item.stockId, target.rigId, target.slotGpuId);
        this.placementMessage.set(`GPU montata nel RIG ${target.rigId}.`);
      }
    } catch (error) {
      this.placementMessage.set(
        error instanceof Error ? error.message : 'Posizionamento non riuscito.',
      );
    }
  }

  closeContextMenu(restoreFocus = false): void {
    const wasOpen = this.contextMenu() !== null;
    this.contextMenu.set(null);
    this.contextFeedback.set('');
    if (restoreFocus && wasOpen) this.canvas().nativeElement.focus();
  }

  closeContextMenuFromEscape(): void {
    if (this.game.placementMode()) {
      this.placementMenu.set(null);
      this.setPlacementSelection([]);
      return;
    }
    this.closeContextMenu(true);
  }

  selectPlacedItem(target: PlacedItem | null, extend: boolean): void {
    this.placementMenu.set(null);
    this.placementFeedback.set('');
    if (!extend) {
      this.setPlacementSelection([]);
      return;
    }
    if (!target) return;
    const selected = this.placementSelection();
    const exists = selected.some((item) => item.kind === target.kind && item.id === target.id);
    this.setPlacementSelection(
      exists
        ? selected.filter((item) => item.kind !== target.kind || item.id !== target.id)
        : [...selected, target],
    );
  }

  openPlacementMenu(target: PlacedItem | null, clientX: number, clientY: number): void {
    this.placementFeedback.set('');
    if (!target) {
      this.placementMenu.set(null);
      return;
    }
    const selection = this.placementSelection();
    const included = selection.some((item) => item.kind === target.kind && item.id === target.id);
    const items = included ? selection : [target];
    if (!included) this.setPlacementSelection(items);
    const bounds = this.canvas().nativeElement.getBoundingClientRect();
    this.placementMenu.set({
      x: Math.max(8, Math.min(clientX - bounds.left, bounds.width - 228)),
      y: Math.max(8, Math.min(clientY - bounds.top, bounds.height - 88)),
      items,
    });
  }

  removePlacedItems(): void {
    const menu = this.placementMenu();
    if (!menu) return;
    try {
      this.game.movePlacedItemsToStock(menu.items);
      this.placementMessage.set(`${menu.items.length} elementi rimessi in magazzino.`);
      this.placementMenu.set(null);
      this.setPlacementSelection([]);
    } catch (error) {
      this.placementFeedback.set(
        error instanceof Error ? error.message : 'Spostamento in magazzino non riuscito.',
      );
    }
  }

  private setPlacementSelection(items: readonly PlacedItem[]): void {
    this.placementSelection.set(items);
    this.scene?.setPlacementSelection(items);
  }

  handleContextAction(request: SceneContextRequest): void {
    const menu = this.contextMenu();
    const world = this.game.world();
    const { target } = request;
    if (
      this.game.isGpuMining(target.id) ||
      !menu ||
      menu.kind !== target.kind ||
      menu.id !== target.id ||
      !isGpuUnlocked(world, target.id) ||
      getGpu(world, target.id).onWorkbench
    ) {
      return;
    }

    try {
      if (request.action === 'remove') {
        this.game.moveGpuToStock(target.id);
        this.showContextNotice(`GPU #${target.id} spostata in magazzino.`);
      } else {
        const stock = world.inventory.items.find((item) => item.id === request.stockId);
        if (!stock) return;
        const replacementName = SHOP_PRODUCTS_BY_ID.get(stock.productId)?.name ?? stock.productId;
        if (!stock.gpu) return;
        this.game.replaceGpuFromStock(target.id, request.stockId);
        this.showContextNotice(`GPU #${target.id} sostituita con ${replacementName}.`);
      }
      this.closeContextMenu(true);
    } catch (error) {
      this.contextFeedback.set(
        error instanceof Error ? error.message : 'Operazione non disponibile.',
      );
    }
  }

  private openContextMenu(target: SceneContextTarget | null, x: number, y: number): void {
    this.closeContextMenu();
    const world = this.game.world();
    if (
      !target ||
      this.game.isGpuMining(target.id) ||
      !isGpuUnlocked(world, target.id) ||
      getGpu(world, target.id).onWorkbench
    )
      return;
    this.contextNotice.set('');
    if (this.contextNoticeTimeout) clearTimeout(this.contextNoticeTimeout);
    const bounds = this.canvas().nativeElement.getBoundingClientRect();
    const menuWidth = Math.min(272, Math.max(0, bounds.width - 16));
    const maxMenuHeight = Math.min(bounds.height * 0.68, 460);
    const maxLeft = Math.max(8, bounds.width - menuWidth - 8);
    const maxTop = Math.max(8, bounds.height - maxMenuHeight - 8);
    this.contextMenu.set({
      ...target,
      x: Math.max(8, Math.min(x - bounds.left, maxLeft)),
      y: Math.max(8, Math.min(y - bounds.top, maxTop)),
      width: menuWidth,
      maxHeight: maxMenuHeight,
    });
  }

  private showContextNotice(message: string): void {
    this.contextNotice.set(message);
    if (this.contextNoticeTimeout) clearTimeout(this.contextNoticeTimeout);
    this.contextNoticeTimeout = setTimeout(() => this.contextNotice.set(''), 4500);
  }
}
