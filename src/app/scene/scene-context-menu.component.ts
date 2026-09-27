import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  viewChild,
} from '@angular/core';
import { isGpuOperational } from '../game/gpu-operation';
import { getGpu, isGpuUnlocked } from '../game/mining-world';
import type { MiningWorld } from '../game/mining-world';
import { SHOP_PRODUCTS_BY_ID } from '../config/shop-config';
import { IconComponent } from '../hud/icons/icon.component';

export interface SceneContextTarget {
  readonly kind: 'gpu';
  readonly id: number;
}

export interface SceneContextMenu extends SceneContextTarget {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly maxHeight: number;
}

export type SceneContextRequest =
  | { readonly action: 'remove'; readonly target: SceneContextTarget }
  | { readonly action: 'replace'; readonly target: SceneContextTarget; readonly stockId: number };

@Component({
  selector: 'app-scene-context-menu',
  imports: [IconComponent],
  templateUrl: './scene-context-menu.component.html',
  styleUrl: './scene-context-menu.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SceneContextMenuComponent {
  readonly context = input<SceneContextMenu | null>(null);
  readonly world = input.required<MiningWorld>();
  readonly disabled = input(false);
  readonly feedback = input('');
  readonly close = output<boolean>();
  readonly action = output<SceneContextRequest>();

  private readonly injector = inject(Injector);
  private readonly contextMenuCloseButton =
    viewChild<ElementRef<HTMLButtonElement>>('contextMenuClose');

  readonly contextGpu = computed(() => {
    const context = this.context();
    const world = this.world();
    if (!context || context.kind !== 'gpu' || !isGpuUnlocked(world, context.id)) return null;
    const gpu = getGpu(world, context.id);
    return gpu.onWorkbench ? null : gpu;
  });
  readonly replacementGpus = computed(() =>
    this.world().inventory.items.filter((item) => item.gpu && isGpuOperational(item.gpu)),
  );
  readonly stockProducts = SHOP_PRODUCTS_BY_ID;

  constructor() {
    effect(() => {
      const context = this.context();
      if (!context) return;
      afterNextRender(
        () => {
          if (this.context() === context) this.contextMenuCloseButton()?.nativeElement.focus();
        },
        { injector: this.injector },
      );
    });
  }

  requestRemoval(): void {
    const context = this.context();
    if (!context || this.disabled()) return;
    this.action.emit({ action: 'remove', target: { kind: context.kind, id: context.id } });
  }

  requestReplacement(stockId: number): void {
    const context = this.context();
    if (!context || this.disabled()) return;
    this.action.emit({
      action: 'replace',
      target: { kind: context.kind, id: context.id },
      stockId,
    });
  }
}
