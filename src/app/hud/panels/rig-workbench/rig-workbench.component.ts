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
  readonly fanCounts = Array.from({ length: MAX_RIG_FANS }, (_, index) => index + 1);
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

  close(): void {
    this.game.returnToRig();
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
