import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  effect,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { GameService } from '../game/game.service';
import { GPUS_PER_RIG, RIGS_PER_PLOT } from '../game/mining-world';
import { IconComponent } from '../shared/icon.component';
import { MiningScene, type CameraPreset } from './mining-scene';
import { TOOL_STATIONS, type ToolStationId } from './tools/tool-stations';

@Component({
  selector: 'app-scene',
  imports: [IconComponent],
  templateUrl: './scene.component.html',
  styleUrl: './scene.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneComponent implements AfterViewInit, OnDestroy {
  readonly game = inject(GameService);
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly unavailable = signal(false);
  readonly cameraPreset = signal<CameraPreset>('front');
  readonly toolStations = TOOL_STATIONS;
  readonly selectedToolStationId = signal<ToolStationId | null>(null);
  readonly focusedToolStationId = computed(() =>
    this.game.inspectedGpuId() !== null ? 'workbench' : this.selectedToolStationId(),
  );
  readonly plotIds = computed(() =>
    Array.from({ length: this.game.plotCount() }, (_, index) => index + 1),
  );
  readonly rigIds = computed(() => {
    const firstRigId = (this.game.viewedPlotId() - 1) * RIGS_PER_PLOT + 1;
    const rigsInPlot = Math.min(RIGS_PER_PLOT, this.game.rigCount() - firstRigId + 1);
    return Array.from({ length: rigsInPlot }, (_, index) => firstRigId + index);
  });
  readonly slots = computed(() =>
    Array.from({ length: GPUS_PER_RIG }, (_, index) => ({
      id: (this.game.viewedRigId() - 1) * GPUS_PER_RIG + index + 1,
      label: String(index + 1).padStart(2, '0'),
    })),
  );
  readonly availableGpuCount = computed(
    () => this.slots().filter((slot) => slot.id <= this.game.world().blocks.length).length,
  );
  private scene?: MiningScene;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      const inspectedGpuId = this.game.inspectedGpuId();
      const viewedPlotId = this.game.viewedPlotId();
      const cameraPreset = this.cameraPreset();
      const selectedToolStationId = this.selectedToolStationId();
      this.scene?.update(
        world,
        mining,
        inspectedGpuId,
        viewedPlotId,
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

  gpuNumber(id: number): string {
    return String(id).padStart(3, '0');
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset.set(preset);
  }

  selectPlot(id: number): void {
    if (this.game.running()) {
      return;
    }
    this.selectedToolStationId.set(null);
    this.game.viewPlot(id);
  }

  selectToolStation(id: ToolStationId): void {
    if (this.game.running() || this.focusedToolStationId() === id) {
      return;
    }
    this.game.returnToRig();
    this.selectedToolStationId.set(id);
  }

  selectRig(id: number): void {
    this.selectedToolStationId.set(null);
    this.game.viewRig(id);
  }

  returnToRig(): void {
    this.selectedToolStationId.set(null);
    this.game.returnToRig();
  }
}
