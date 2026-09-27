import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  signal,
} from '@angular/core';
import { RIG_COOLING_METHODS, type RigCoolingMethodId } from '../../../config/cooling-config';
import { FAN_MODELS, FAN_MODELS_BY_ID, type FanModelId } from '../../../config/fan-config';
import { RIG_DUST_SYSTEMS, type RigDustSystemId } from '../../../config/dust-filter-config';
import { MAX_RIG_FANS, type RigSetup } from '../../../config/rig-config';
import { GameService } from '../../../game/game.service';
import { getRig } from '../../../game/mining-world';
import { IconComponent } from '../../icons/icon.component';

@Component({
  selector: 'app-rig-workbench',
  imports: [IconComponent],
  templateUrl: './rig-workbench.component.html',
  styleUrl: './rig-workbench.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RigWorkbenchComponent {
  readonly game = inject(GameService);
  readonly closeBench = output<void>();
  readonly selected = signal<'fan' | 'filter' | 'cooling'>('fan');
  readonly fanModels = FAN_MODELS;
  readonly fanCounts = Array.from({ length: MAX_RIG_FANS + 1 }, (_, index) => index);
  readonly maxRigFans = MAX_RIG_FANS;
  readonly filterOptions = Object.entries(RIG_DUST_SYSTEMS) as [
    RigDustSystemId,
    (typeof RIG_DUST_SYSTEMS)[RigDustSystemId],
  ][];
  readonly coolingOptions = Object.entries(RIG_COOLING_METHODS) as [
    RigCoolingMethodId,
    (typeof RIG_COOLING_METHODS)[RigCoolingMethodId],
  ][];
  readonly feedback = signal('');
  readonly feedbackError = signal(false);
  readonly maxAirflowCfm =
    Math.max(...FAN_MODELS.map((fan) => fan.airflowCfm)) * MAX_RIG_FANS +
    Math.max(...Object.values(RIG_COOLING_METHODS).map((cooling) => cooling.airflowCfm));
  readonly maxPowerWatts =
    Math.max(...FAN_MODELS.map((fan) => fan.powerWatts)) * MAX_RIG_FANS +
    Math.max(...Object.values(RIG_COOLING_METHODS).map((cooling) => cooling.extraPowerWatts));
  readonly rig = computed(() => {
    const id = this.game.inspectedRigId();
    return id === null ? null : getRig(this.game.world(), id);
  });
  readonly setup = computed(() => {
    const rig = this.rig();
    if (!rig) {
      return null;
    }
    const fan = FAN_MODELS_BY_ID[rig.setup.fanId];
    const filter = RIG_DUST_SYSTEMS[rig.setup.dustSystemId];
    const cooling = RIG_COOLING_METHODS[rig.setup.coolingMethodId];
    return {
      ...rig.setup,
      fan,
      filter,
      cooling,
      airflowCfm: fan.airflowCfm * rig.setup.fanCount + cooling.airflowCfm,
      powerWatts: fan.powerWatts * rig.setup.fanCount + cooling.extraPowerWatts,
    };
  });

  select(section: 'fan' | 'filter' | 'cooling'): void {
    this.selected.set(section);
    this.feedback.set('');
  }

  changeFan(fanId: FanModelId): void {
    this.configure({ fanId });
  }

  changeFanCount(fanCount: number): void {
    this.configure({ fanCount });
  }

  changeFilter(dustSystemId: RigDustSystemId): void {
    this.configure({ dustSystemId });
  }

  changeCooling(coolingMethodId: RigCoolingMethodId): void {
    this.configure({ coolingMethodId });
  }

  fanCountRequired(count: number): number {
    return Math.max(0, count - (this.setup()?.fanCount ?? 0));
  }

  canChooseFanCount(count: number): boolean {
    const current = this.setup();
    if (this.game.running() || !current) {
      return false;
    }
    const required = this.fanCountRequired(count);
    return required === 0 || this.game.stockQuantity(current.fanId) >= required;
  }

  fanCountUnavailableReason(count: number): string {
    const current = this.setup();
    if (this.game.running()) {
      return 'Ferma il programma per modificare il RIG';
    }
    if (current && !this.canChooseFanCount(count)) {
      return `Servono ${this.fanCountRequired(count)} ventole ${FAN_MODELS_BY_ID[current.fanId].name} in magazzino`;
    }
    return '';
  }

  fanModelRequired(fanId: FanModelId): number {
    const current = this.setup();
    return current?.fanId === fanId ? 0 : (current?.fanCount ?? 0);
  }

  canChooseFanModel(fanId: FanModelId): boolean {
    const required = this.fanModelRequired(fanId);
    return (
      !this.game.running() &&
      this.game.isResearchUnlocked(fanId) &&
      (required === 0 || this.game.stockQuantity(fanId) >= required)
    );
  }

  fanModelUnavailableReason(fanId: FanModelId): string {
    if (this.game.running()) {
      return 'Ferma il programma per modificare il RIG';
    }
    if (!this.game.isResearchUnlocked(fanId)) {
      return 'Sblocca nell’albero della ricerca';
    }
    if (!this.canChooseFanModel(fanId)) {
      return `Servono ${this.fanModelRequired(fanId)} ventole in magazzino`;
    }
    return '';
  }

  canChooseFilter(id: RigDustSystemId): boolean {
    return (
      !this.game.running() &&
      (id === 'none' || this.game.isResearchUnlocked(`filter-${id}`)) &&
      (id === 'none' ||
        this.setup()?.dustSystemId === id ||
        this.game.stockQuantity(`filter-${id}`) >= 1)
    );
  }

  filterUnavailableReason(id: RigDustSystemId): string {
    if (this.game.running()) {
      return 'Ferma il programma per modificare il RIG';
    }
    if (id !== 'none' && !this.game.isResearchUnlocked(`filter-${id}`)) {
      return 'Sblocca nell’albero della ricerca';
    }
    if (
      id !== 'none' &&
      this.setup()?.dustSystemId !== id &&
      this.game.stockQuantity(`filter-${id}`) < 1
    ) {
      return 'Serve 1 filtro in magazzino';
    }
    return '';
  }

  coolingStockQuantity(id: RigCoolingMethodId): number {
    return id === 'none' ? 0 : this.game.stockQuantity(`cooling-${id}`);
  }

  canChooseCooling(id: RigCoolingMethodId): boolean {
    return (
      !this.game.running() &&
      (id === 'none' || this.setup()?.coolingMethodId === id || this.coolingStockQuantity(id) >= 1)
    );
  }

  coolingUnavailableReason(id: RigCoolingMethodId): string {
    if (this.game.running()) {
      return 'Ferma il programma per modificare il RIG';
    }
    if (
      id !== 'none' &&
      this.setup()?.coolingMethodId !== id &&
      this.coolingStockQuantity(id) < 1
    ) {
      return 'Serve 1 modulo in magazzino';
    }
    return '';
  }

  close(): void {
    this.game.closeInspectedRigWorkbench();
    this.closeBench.emit();
  }

  private configure(update: Partial<RigSetup>): void {
    try {
      this.game.configureInspectedRig(update);
      this.feedbackError.set(false);
      this.feedback.set('Configurazione RIG aggiornata.');
    } catch (error) {
      this.feedbackError.set(true);
      this.feedback.set(error instanceof Error ? error.message : 'Modifica non disponibile.');
    }
  }
}
