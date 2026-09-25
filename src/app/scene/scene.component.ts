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
import type { ToolStationId } from './tools/tool-stations';

@Component({
  selector: 'app-scene',
  imports: [IconComponent, SceneControlsComponent],
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  readonly game = inject(GameService);
  readonly gpuHover = output<GpuHover | null>();
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  private scene?: MiningScene;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      const activeGpuIds = this.game.activeGpuIds();
      const inspectedGpuId = this.game.inspectedGpuId();
      const selectedGpuId = this.game.selectedGpuId();
      const viewedPlotId = this.game.viewedPlotId();
      const viewedRigId = this.game.viewedRigId();
      const cameraPreset = this.cameraPreset();
      const selectedToolStationId = this.selectedToolStationId();
      this.scene?.update(
        world,
        mining,
        inspectedGpuId,
        viewedPlotId,
        viewedRigId,
        cameraPreset,
        selectedToolStationId,
        activeGpuIds,
        selectedGpuId,
      );
    });
  }

  ngAfterViewInit(): void {
    try {
      this.scene = new MiningScene(this.canvas().nativeElement, {
        select: (id) => this.game.select(id),
        inspect: (id) => this.game.inspectGpu(id),
        telemetry: (id) => this.game.gpuTelemetry(id),
        hover: (gpuId, x, y) => this.gpuHover.emit(gpuId === null ? null : { gpuId, x, y }),
      });
      this.scene.update(
        this.game.world(),
        this.game.mining(),
        this.game.inspectedGpuId(),
        this.game.viewedPlotId(),
        this.game.viewedRigId(),
        this.cameraPreset(),
        this.selectedToolStationId(),
        this.game.activeGpuIds(),
        this.game.selectedGpuId(),
      );
    } catch {
      this.unavailable.set(true);
    }
  }

  ngOnDestroy(): void {
    this.scene?.dispose();
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset.set(preset);
  }

  setSelectedToolStationId(id: ToolStationId | null): void {
    this.selectedToolStationId.set(id);
  }
}
