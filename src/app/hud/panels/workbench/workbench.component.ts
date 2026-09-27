import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import { GAME_BALANCE } from '../../../config/game-balance';
import { GPU_MODELS_BY_ID } from '../../../config/gpu-config';
import { gpuFanResearchId, type GpuFanModelId } from '../../../config/fan-config';
import { GameService } from '../../../game/game.service';
import {
  dustWearMultiplier,
  thermalServiceHoursRemaining,
  type GpuFanKit,
  type GpuMaintenanceAction,
} from '../../../game/gpu-maintenance';
import { getGpu } from '../../../game/mining-world';
import { IconComponent } from '../../icons/icon.component';

type Intervention = 'clean' | 'thermal' | 'fan';

@Component({
  selector: 'app-workbench',
  imports: [IconComponent],
  templateUrl: './workbench.component.html',
  styleUrl: './workbench.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkbenchComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly closeBench = output<void>();
  readonly selected = signal<Intervention>('clean');
  readonly feedback = signal('');
  readonly feedbackError = signal(false);
  readonly config = GAME_BALANCE.gpu.maintenance;
  readonly dustDamage = GAME_BALANCE.gpu.dustDamage;
  readonly fanKits = Object.entries(GAME_BALANCE.gpu.fanKits).map(([id, kit]) => ({
    ...kit,
    id: id as GpuFanKit,
    researchId: id === 'stock' ? null : gpuFanResearchId(id as GpuFanModelId),
  }));
  readonly gpu = computed(() => {
    const id = this.game.inspectedGpuId();
    return id === null ? null : getGpu(this.game.world(), id);
  });
  readonly gpuSupportsFanKits = computed(() => {
    const gpu = this.gpu();
    return gpu !== null && GPU_MODELS_BY_ID[gpu.modelId].supportsFanKits;
  });

  fanKitStockQuantity(kit: GpuFanKit): number {
    return kit === 'stock' ? 0 : this.game.stockQuantity(`gpu-fan-${kit}`);
  }

  canChooseFanKit(kitId: GpuFanKit): boolean {
    const kit = this.fanKits.find((option) => option.id === kitId);
    const current = this.gpu();
    return (
      !this.game.running() &&
      this.gpuSupportsFanKits() &&
      kit !== undefined &&
      (kit.researchId === null || this.game.isResearchUnlocked(kit.researchId)) &&
      (kitId === 'stock' || current?.fanKit === kitId || this.fanKitStockQuantity(kitId) >= 1)
    );
  }

  fanKitUnavailableReason(kitId: GpuFanKit): string {
    if (this.game.running()) {
      return 'Ferma il programma per intervenire sulla GPU';
    }
    if (!this.gpuSupportsFanKits()) {
      return 'Questa GPU non supporta kit ventole';
    }
    const kit = this.fanKits.find((option) => option.id === kitId);
    if (kit?.researchId && !this.game.isResearchUnlocked(kit.researchId)) {
      return 'Sblocca nell’albero della ricerca';
    }
    if (kitId !== 'stock' && this.gpu()?.fanKit !== kitId && this.fanKitStockQuantity(kitId) < 1) {
      return 'Serve 1 kit in magazzino';
    }
    return '';
  }

  private readonly tick = signal(0);
  private readonly timer = setInterval(() => this.tick.update((tick) => tick + 1), 200);
  readonly telemetry = computed(() => {
    this.tick();
    const gpu = this.gpu();
    return gpu ? this.game.gpuTelemetry(gpu.id) : null;
  });
  readonly remainingHours = computed(() =>
    this.gpu() ? thermalServiceHoursRemaining(this.gpu()!) : 0,
  );
  readonly wearMultiplier = computed(() => dustWearMultiplier(this.gpu()?.dustPercent ?? 0));
  readonly thermalReady = computed(
    () => this.remainingHours() === 0 && (this.gpu()?.wearPercent ?? 0) > 0,
  );

  select(intervention: Intervention): void {
    this.selected.set(intervention);
    this.feedback.set('');
  }

  service(action: GpuMaintenanceAction): void {
    this.perform(
      () => this.game.serviceInspectedGpu(action),
      action.kind === 'clean'
        ? 'Pulizia completata.'
        : action.kind === 'thermal'
          ? 'Pasta e pad sostituiti. Usura azzerata.'
          : `Ventole ${GAME_BALANCE.gpu.fanKits[action.kit].label.toLowerCase()} installate.`,
    );
  }

  restart(): void {
    const gpu = this.gpu();
    if (gpu) {
      this.perform(
        () => this.game.clearGpuStop(gpu.id),
        'Arresto rimosso. Scheda pronta per il RIG.',
      );
    }
  }

  close(): void {
    this.game.returnInspectedGpuToRig();
    this.closeBench.emit();
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private perform(action: () => void, message: string): void {
    try {
      action();
      this.feedbackError.set(false);
      this.feedback.set(message);
    } catch (error) {
      this.feedbackError.set(true);
      this.feedback.set(error instanceof Error ? error.message : 'Intervento non disponibile.');
    }
  }
}
