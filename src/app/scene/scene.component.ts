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
import { IconComponent } from '../shared/icon.component';
import { MiningScene } from './mining-scene';

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
  private scene?: MiningScene;

  constructor() {
    effect(() => {
      const world = this.game.world();
      const mining = this.game.mining();
      this.scene?.update(world, mining);
    });
  }

  ngAfterViewInit(): void {
    try {
      this.scene = new MiningScene(this.canvas().nativeElement, (id) => this.game.select(id));
      this.scene.update(this.game.world(), this.game.mining());
    } catch {
      this.unavailable.set(true);
    }
  }

  ngOnDestroy(): void {
    this.scene?.dispose();
  }
}
