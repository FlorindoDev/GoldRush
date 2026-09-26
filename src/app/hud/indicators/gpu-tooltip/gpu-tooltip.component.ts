import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnDestroy,
  signal,
} from '@angular/core';
import { GameService } from '../../../game/game.service';
import { getGpu, isGpuUnlocked } from '../../../game/mining-world';
import { GPU_MODELS_BY_ID } from '../../../config/gpu-config';

export interface GpuHover {
  readonly gpuId: number;
  readonly x: number;
  readonly y: number;
}

@Component({
  selector: 'app-gpu-tooltip',
  templateUrl: './gpu-tooltip.component.html',
  styleUrl: './gpu-tooltip.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GpuTooltipComponent implements OnDestroy {
  readonly hover = input.required<GpuHover>();
  private readonly game = inject(GameService);
  private readonly tick = signal(0);
  private readonly timer = setInterval(() => this.tick.update((tick) => tick + 1), 200);
  readonly gpu = computed(() => {
    const id = this.hover().gpuId;
    const world = this.game.world();
    return isGpuUnlocked(world, id) ? getGpu(world, id) : null;
  });
  readonly gpuModel = computed(() => {
    const gpu = this.gpu();
    return gpu ? GPU_MODELS_BY_ID[gpu.modelId] : null;
  });
  readonly telemetry = computed(() => {
    this.tick();
    const gpu = this.gpu();
    return gpu ? this.game.gpuTelemetry(gpu.id) : null;
  });
  readonly position = computed(() => ({
    x: Math.max(8, Math.min(this.hover().x + 16, window.innerWidth - 236)),
    y: Math.max(8, Math.min(this.hover().y + 16, window.innerHeight - 240)),
  }));

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
