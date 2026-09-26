import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { GameService } from '../../game/game.service';
import {
  GPU_COUNT,
  GPUS_PER_RIG,
  isGpuUnlocked,
  isRigUnlocked,
  RIG_COUNT,
  RIGS_PER_PLOT,
} from '../../game/mining-world';
import type { CameraPreset } from '../../scene/camera/camera-preset';
import { IconComponent } from '../icons/icon.component';
import { TOOL_STATIONS, type ToolStationId } from '../../scene/tools/tool-stations';

@Component({
  selector: 'app-scene-controls',
  imports: [IconComponent],
  templateUrl: './scene-controls.component.html',
  styleUrl: './scene-controls.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneControlsComponent {
  readonly game = inject(GameService);
  readonly collapsed = signal(false);
  readonly cameraPreset = input.required<CameraPreset>();
  readonly selectedToolStationId = input<ToolStationId | null>(null);
  readonly cameraPresetChange = output<CameraPreset>();
  readonly selectedToolStationIdChange = output<ToolStationId | null>();
  readonly gpuCapacity = GPU_COUNT;
  readonly rigCapacity = RIG_COUNT;
  readonly toolStations = TOOL_STATIONS;
  readonly focusedToolStationId = computed(() =>
    this.game.inspectedRigId() !== null
      ? 'rigWorkbench'
      : this.game.inspectedGpuId() !== null
        ? 'workbench'
        : this.selectedToolStationId(),
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
  readonly availableGpuCount = computed(() => {
    const world = this.game.world();
    return this.slots().filter((slot) => isGpuUnlocked(world, slot.id)).length;
  });

  toggleCollapsed(): void {
    this.collapsed.update((collapsed) => !collapsed);
  }

  isGpuUnlocked(id: number): boolean {
    return isGpuUnlocked(this.game.world(), id);
  }

  isRigUnlocked(id: number): boolean {
    return isRigUnlocked(this.game.world(), id);
  }

  gpuNumber(id: number): string {
    return String(id).padStart(3, '0');
  }

  rigTitle(id: number): string {
    if (!this.isRigUnlocked(id)) {
      return `Slot RIG bloccato ${id}`;
    }
    return this.game.inspectedRigId() !== null
      ? 'Clic: cambia RIG sul banco'
      : 'Clic: seleziona · Doppio clic: banco RIG';
  }

  handleGpuKey(event: KeyboardEvent, id: number): void {
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault();
      this.inspectGpu(id);
    }
  }

  handleRigKey(event: KeyboardEvent, id: number): void {
    if (event.altKey && event.key === 'Enter') {
      event.preventDefault();
      this.openRigWorkbench(id);
    }
  }

  setCameraPreset(preset: CameraPreset): void {
    this.cameraPresetChange.emit(preset);
  }

  selectPlot(id: number): void {
    this.selectedToolStationIdChange.emit(null);
    this.game.viewPlot(id);
  }

  selectToolStation(id: ToolStationId): void {
    if (this.game.running() || this.focusedToolStationId() === id) {
      return;
    }
    this.game.returnToRig();
    this.selectedToolStationIdChange.emit(id);
  }

  selectRig(id: number): void {
    if (this.game.inspectedRigId() !== null) {
      this.game.inspectRig(id);
      return;
    }
    if (this.focusedToolStationId() !== 'rigWorkbench') {
      this.selectedToolStationIdChange.emit(null);
    }
    this.game.viewRig(id);
  }

  selectGpu(id: number): void {
    if (this.game.inspectedGpuId() !== null) {
      this.inspectGpu(id);
      return;
    }
    this.game.select(id);
  }

  openRigWorkbench(id: number): void {
    if (this.game.running() || !this.isRigUnlocked(id)) {
      return;
    }
    this.selectedToolStationIdChange.emit('rigWorkbench');
    this.game.inspectRig(id);
  }

  inspectGpu(id: number): void {
    this.selectedToolStationIdChange.emit(null);
    this.game.inspectGpu(id);
  }

  returnToRig(): void {
    this.selectedToolStationIdChange.emit(null);
    this.game.returnToRig();
  }
}
