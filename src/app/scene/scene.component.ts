import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { GameService } from '../game/game.service';
import { SceneControlsComponent } from '../hud/controls/scene-controls.component';
import { IconComponent } from '../hud/icons/icon.component';
import type { GpuHover } from '../hud/indicators/gpu-tooltip/gpu-tooltip.component';
import type { CameraPreset } from './camera/camera-preset';
import { MiningScene } from './mining-scene';
import { SceneAssets } from './resources/scene-assets';
import type { ToolStationId } from './tools/tool-stations';
import { getGpu, isGpuUnlocked } from '../game/mining-world';
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
  host: { '(document:keydown.escape)': 'closeContextMenuFromEscape()' },
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  readonly game = inject(GameService);
  readonly gpuHover = output<GpuHover | null>();
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  readonly contextMenu = signal<SceneContextMenu | null>(null);
  readonly contextFeedback = signal('');
  readonly contextNotice = signal('');
  private scene?: MiningScene;
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
      const menu = this.contextMenu();
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

  closeContextMenu(restoreFocus = false): void {
    const wasOpen = this.contextMenu() !== null;
    this.contextMenu.set(null);
    this.contextFeedback.set('');
    if (restoreFocus && wasOpen) this.canvas().nativeElement.focus();
  }

  closeContextMenuFromEscape(): void {
    this.closeContextMenu(true);
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
