import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { GameService } from '../game/game.service';
import { SceneControlsComponent } from '../hud/controls/scene-controls.component';
import { IconComponent } from '../hud/icons/icon.component';
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
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  private scene?: MiningScene;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      const inspectedGpuId = this.game.inspectedGpuId();
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
      );
    });
  }

  ngAfterViewInit(): void {
    try {
      this.scene = new MiningScene(this.canvas().nativeElement, (id) => this.game.select(id));
      this.scene.update(
        this.game.world(),
        this.game.mining(),
        this.game.inspectedGpuId(),
        this.game.viewedPlotId(),
        this.game.viewedRigId(),
        this.cameraPreset(),
        this.selectedToolStationId(),
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
