import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { GameService } from '../../../game/game.service';
import { getGpu, isGpuUnlocked } from '../../../game/mining-world';
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

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
