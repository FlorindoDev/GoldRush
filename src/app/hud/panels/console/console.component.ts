import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { GameService, LogEntry } from '../../../game/game.service';
import { IconComponent } from '../../icons/icon.component';

const LOG_MARKERS: Record<LogEntry['kind'], string> = {
  info: '›',
  output: '›',
  success: '✓',
  error: '!',
  warning: '!',
};

@Component({
  selector: 'app-console',
  imports: [IconComponent],
  templateUrl: './console.component.html',
  styleUrl: './console.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsoleComponent {
  readonly game = inject(GameService);
  readonly docked = input(false);
  readonly toggleDock = output<void>();
  readonly scroll = viewChild<ElementRef<HTMLElement>>('scroll');
  readonly logMarkers = LOG_MARKERS;

  constructor() {
    effect(() => {
      this.game.logs();
      queueMicrotask(() => this.scrollToLatestEntry());
    });
  }

  private scrollToLatestEntry(): void {
    const logContainer = this.scroll()?.nativeElement;
    if (!logContainer) {
      return;
    }

    logContainer.scrollTop = logContainer.scrollHeight;
  }
}
