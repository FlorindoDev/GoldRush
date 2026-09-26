import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
import { GPU_MODELS_BY_ID } from '../config/gpu-config';
import { SHOP_PRODUCTS_BY_ID } from '../config/shop-config';
import { isGpuOperational } from '../game/gpu-operation';

@Component({
  selector: 'app-scene',
  imports: [IconComponent, SceneControlsComponent],
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closeGpuContextMenu()' },
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  readonly game = inject(GameService);
  readonly gpuHover = output<GpuHover | null>();
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  readonly gpuContextMenu = signal<{ gpuId: number; x: number; y: number } | null>(null);
  readonly contextFeedback = signal('');
  readonly contextNotice = signal('');
  readonly contextGpu = computed(() => {
    const menu = this.gpuContextMenu();
    const world = this.game.world();
    if (!menu || !isGpuUnlocked(world, menu.gpuId)) return null;
    const gpu = getGpu(world, menu.gpuId);
    if (gpu.onWorkbench) return null;
    return { gpu, model: GPU_MODELS_BY_ID[gpu.modelId] };
  });
  readonly replacementGpus = computed(() =>
    this.game.world().inventory.items.filter((item) => item.gpu && isGpuOperational(item.gpu)),
  );
  private scene?: MiningScene;
  private destroyed = false;
  private contextNoticeTimeout?: ReturnType<typeof setTimeout>;
  readonly stockProducts = SHOP_PRODUCTS_BY_ID;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      const activeGpuIds = this.game.activeGpuIds();
      const inspectedGpuId = this.game.inspectedGpuId();
      const inspectedRigId = this.game.inspectedRigId();
      const selectedGpuId = this.game.selectedGpuId();
      const viewedPlotId = this.game.viewedPlotId();
      const viewedRigId = this.game.viewedRigId();
      const cameraPreset = this.cameraPreset();
      const selectedToolStationId = this.selectedToolStationId();
      this.scene?.update(
        world,
        mining,
        inspectedGpuId,
        inspectedRigId,
        viewedPlotId,
        viewedRigId,
        cameraPreset,
        selectedToolStationId,
        activeGpuIds,
        selectedGpuId,
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
          contextMenu: (gpuId, x, y) => this.openGpuContextMenu(gpuId, x, y),
        },
        assets,
      );
      this.scene.update(
        this.game.world(),
        this.game.mining(),
        this.game.inspectedGpuId(),
        this.game.inspectedRigId(),
        this.game.viewedPlotId(),
        this.game.viewedRigId(),
        this.cameraPreset(),
        this.selectedToolStationId(),
        this.game.activeGpuIds(),
        this.game.selectedGpuId(),
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

  closeGpuContextMenu(): void {
    this.gpuContextMenu.set(null);
    this.contextFeedback.set('');
  }

  removeContextGpu(): void {
    const menu = this.gpuContextMenu();
    const gpu = this.contextGpu()?.gpu;
    if (!menu || !gpu) return;
    try {
      this.game.moveGpuToStock(gpu.id);
      this.showContextNotice(`GPU #${gpu.id} spostata in magazzino.`);
      this.closeGpuContextMenu();
    } catch (error) {
      this.contextFeedback.set(
        error instanceof Error ? error.message : 'Operazione non disponibile.',
      );
    }
  }

  replaceContextGpu(stockId: number): void {
    const menu = this.gpuContextMenu();
    const gpu = this.contextGpu()?.gpu;
    const stock = this.game.world().inventory.items.find((item) => item.id === stockId);
    if (!menu || !gpu || !stock?.gpu) return;
    const replacementName = this.stockProducts.get(stock.productId)?.name ?? stock.productId;
    try {
      this.game.replaceGpuFromStock(gpu.id, stockId);
      this.showContextNotice(`GPU #${gpu.id} sostituita con ${replacementName}.`);
      this.closeGpuContextMenu();
    } catch (error) {
      this.contextFeedback.set(
        error instanceof Error ? error.message : 'Operazione non disponibile.',
      );
    }
  }

  private openGpuContextMenu(gpuId: number | null, x: number, y: number): void {
    this.closeGpuContextMenu();
    if (gpuId === null || !isGpuUnlocked(this.game.world(), gpuId)) return;
    const gpu = getGpu(this.game.world(), gpuId);
    if (gpu.onWorkbench) return;
    this.contextNotice.set('');
    if (this.contextNoticeTimeout) clearTimeout(this.contextNoticeTimeout);
    const bounds = this.canvas().nativeElement.getBoundingClientRect();
    const maxMenuHeight = Math.min(bounds.height * 0.7, 520);
    const yPosition = Math.max(8, Math.min(y - bounds.top, bounds.height - maxMenuHeight - 8));
    this.gpuContextMenu.set({
      gpuId,
      x: Math.max(8, Math.min(x - bounds.left, bounds.width - 292)),
      y: yPosition,
    });
  }

  private showContextNotice(message: string): void {
    this.contextNotice.set(message);
    if (this.contextNoticeTimeout) clearTimeout(this.contextNoticeTimeout);
    this.contextNoticeTimeout = setTimeout(() => this.contextNotice.set(''), 4500);
  }
}
