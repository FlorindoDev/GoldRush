import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { RIG_COOLING_METHODS } from '../../../config/cooling-config';
import { RIG_DUST_SYSTEMS } from '../../../config/dust-filter-config';
import { FAN_MODELS_BY_ID } from '../../../config/fan-config';
import { GameService } from '../../../game/game.service';
import { rigFanCoolingCelsius } from '../../../game/gpu-operation';
import {
  getCryptoBlock,
  getGpu,
  getRig,
  isGpuUnlocked,
  isRigUnlocked,
} from '../../../game/mining-world';
import { IconComponent } from '../../icons/icon.component';

@Component({
  selector: 'app-power',
  imports: [IconComponent],
  templateUrl: './power.component.html',
  styleUrl: './power.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerComponent implements OnDestroy {
  readonly game = inject(GameService);
  private readonly tick = signal(0);
  private readonly timer = setInterval(() => this.tick.update((tick) => tick + 1), 200);
  readonly readings = computed(() => {
    this.tick();
    return this.game.readElectricity();
  });
  readonly gpu = computed(() => {
    const id = this.game.selectedGpuId();
    const world = this.game.world();
    return id !== null && isGpuUnlocked(world, id) ? getGpu(world, id) : null;
  });
  readonly telemetry = computed(() => {
    this.tick();
    const gpu = this.gpu();
    return gpu ? this.game.gpuTelemetry(gpu.id) : null;
  });
  readonly cryptoBlock = computed(() => {
    const gpu = this.gpu();
    return gpu ? getCryptoBlock(this.game.world(), gpu.cryptoId) : null;
  });
  readonly rig = computed(() => {
    const id = this.game.selectedRigId();
    const world = this.game.world();
    return id !== null && isRigUnlocked(world, id) ? getRig(world, id) : null;
  });
  readonly rigDetails = computed(() => {
    const rig = this.rig();
    if (!rig) {
      return null;
    }
    const fan = FAN_MODELS_BY_ID[rig.setup.fanId];
    const cooling = RIG_COOLING_METHODS[rig.setup.coolingMethodId];
    const filter = RIG_DUST_SYSTEMS[rig.setup.dustSystemId];
    const fanAirflowCfm = fan.airflowCfm * rig.setup.fanCount;
    return {
      fan,
      cooling,
      filter,
      fanAirflowCfm,
      totalAirflowCfm: fanAirflowCfm + cooling.airflowCfm,
      fanCoolingCelsius: rigFanCoolingCelsius(rig.setup),
      modulePowerWatts: fan.powerWatts * rig.setup.fanCount + cooling.extraPowerWatts,
    };
  });

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
