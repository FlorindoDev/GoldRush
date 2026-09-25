import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { GAME_BALANCE } from '../config/game-balance';
import { getGpuTelemetry } from '../game/gpu-telemetry';
import {
  GPU_COUNT,
  GPUS_PER_RIG,
  MINE_PROGRESS_PER_GPU,
  PLOT_COUNT,
  RIG_COUNT,
  RIGS_PER_PLOT,
} from '../game/mining-world';
import { ConsoleComponent } from './panels/console/console.component';
import { EditorComponent } from './panels/editor/editor.component';
import { GameService } from '../game/game.service';
import { EXAMPLES, LANGUAGE_GUIDE_EXAMPLE } from '../language/examples';
import { SceneComponent } from '../scene/scene.component';
import { WalletComponent } from './indicators/wallet/wallet.component';
import { PowerComponent } from './indicators/power/power.component';
import { GpuTooltipComponent, type GpuHover } from './indicators/gpu-tooltip/gpu-tooltip.component';
import { IconComponent } from './icons/icon.component';
import { WorkbenchComponent } from './panels/workbench/workbench.component';

type WindowName = 'editor' | 'console';
type GuideSection = 'examples' | 'functions' | 'gpu' | 'energy' | 'constructs' | 'shortcuts';
type ResizeTarget = WindowName | 'docked-console';
type WindowPosition = { x: number; y: number };
type WindowDrag = {
  name: WindowName;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  element: HTMLElement;
};
type WindowResize = {
  target: ResizeTarget;
  pointerId: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
  originX: number;
  originY: number;
  element: HTMLElement;
};

const SHORTCUT_GROUPS = [
  {
    name: 'Editor',
    shortcuts: [
      { action: 'Avvia il codice', keys: ['Ctrl / ⌘', 'Invio'], separator: '+' },
      { action: 'Indenta di due spazi', keys: ['Tab'], separator: '+' },
      { action: 'Nuova riga con rientro automatico', keys: ['Invio'], separator: '+' },
      { action: "Esci dall'editor", keys: ['Esc', 'Tab'], separator: '→' },
    ],
  },
  {
    name: 'Finestre',
    shortcuts: [
      { action: 'Ridimensiona dal manico selezionato', keys: ['Frecce'], separator: '+' },
      { action: 'Ridimensiona di 48 px', keys: ['Maiusc', 'Frecce'], separator: '+' },
    ],
  },
] as const;

@Component({
  selector: 'app-hud',
  imports: [
    ConsoleComponent,
    EditorComponent,
    SceneComponent,
    WalletComponent,
    PowerComponent,
    GpuTooltipComponent,
    IconComponent,
    WorkbenchComponent,
  ],
  templateUrl: './hud.component.html',
  styleUrl: './hud.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'hoveredGpu.set(null)' },
})
export class HudComponent {
  readonly game = inject(GameService);
  readonly hoveredGpu = signal<GpuHover | null>(null);
  readonly balance = GAME_BALANCE;
  readonly plotCapacity = PLOT_COUNT;
  readonly rigCapacity = RIG_COUNT;
  readonly gpuCapacity = GPU_COUNT;
  readonly rigsPerPlot = RIGS_PER_PLOT;
  readonly gpusPerRig = GPUS_PER_RIG;
  readonly gpusPerPlot = RIGS_PER_PLOT * GPUS_PER_RIG;
  readonly minesPerBlock = Math.ceil(100 / MINE_PROGRESS_PER_GPU);
  readonly idleGpu = getGpuTelemetry(0);
  readonly miningGpu = getGpuTelemetry(1);
  readonly examples = EXAMPLES;
  readonly languageGuideExample = LANGUAGE_GUIDE_EXAMPLE;
  readonly guideSection = signal<GuideSection>('examples');
  readonly shortcutGroups = SHORTCUT_GROUPS;
  readonly guide = viewChild.required<ElementRef<HTMLDialogElement>>('guide');
  readonly guideContent = viewChild.required<ElementRef<HTMLElement>>('guideContent');
  readonly settings = viewChild.required<ElementRef<HTMLDialogElement>>('settings');
  readonly consoleDocked = signal(false);
  readonly activeWindow = signal<WindowName>('editor');
  readonly editorPosition = signal<WindowPosition | null>(null);
  readonly consolePosition = signal<WindowPosition | null>(null);
  private windowDrag?: WindowDrag;
  private windowResize?: WindowResize;

  constructor() {
    this.game.start();
  }

  openSettings(): void {
    this.settings().nativeElement.showModal();
  }

  closeSettings(): void {
    this.settings().nativeElement.close();
  }

  updateLineEffects(event: Event): void {
    const checkbox = event.target;
    if (checkbox instanceof HTMLInputElement) {
      this.game.setLineEffectsEnabled(checkbox.checked);
    }
  }

  openGuide(): void {
    this.guide().nativeElement.showModal();
    this.selectGuideSection('examples');
  }

  selectGuideSection(section: GuideSection): void {
    this.guideSection.set(section);
    this.guideContent().nativeElement.scrollTop = 0;
  }

  closeGuide(): void {
    this.guide().nativeElement.close();
  }

  loadExample(code: string): void {
    if (this.game.running()) {
      return;
    }
    this.game.updateCode(code);
    this.closeGuide();
  }

  toggleConsoleDock(): void {
    this.consoleDocked.update((docked) => !docked);
  }

  startWindowDrag(event: PointerEvent, name: WindowName): void {
    this.activeWindow.set(name);
    const target = event.target as HTMLElement;
    const heading = target.closest<HTMLElement>('.panel-heading');
    if (!heading || target.closest('button, a, input, select') || event.button !== 0) {
      return;
    }

    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    this.setWindowPosition(name, { x: bounds.left, y: bounds.top });
    this.windowDrag = {
      name,
      pointerId: event.pointerId,
      offsetX: event.clientX - bounds.left,
      offsetY: event.clientY - bounds.top,
      element,
    };
    heading.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  startWindowResize(event: PointerEvent, target: ResizeTarget): void {
    event.stopPropagation();
    if (event.button !== 0) {
      return;
    }

    const handle = event.currentTarget as HTMLElement;
    const element = handle.parentElement;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    this.focusResizeTarget(target);
    this.anchorResizableWindow(target, element, bounds);
    this.windowResize = {
      target,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: bounds.width,
      startHeight: bounds.height,
      originX: bounds.left,
      originY: bounds.top,
      element,
    };
    handle.setPointerCapture(event.pointerId);
  }

  resizeWindowWithKeyboard(event: KeyboardEvent, target: ResizeTarget): void {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }

    const horizontal = target !== 'docked-console';
    if (!horizontal && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
      return;
    }

    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    const element = handle.parentElement;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    this.focusResizeTarget(target);
    this.anchorResizableWindow(target, element, bounds);
    const step = event.shiftKey ? 48 : 16;
    const width =
      bounds.width + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0);
    const height =
      bounds.height + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0);
    this.applyWindowSize(target, element, width, height, bounds.left, bounds.top);
  }

  moveWindow(event: PointerEvent): void {
    const drag = this.windowDrag;
    if (drag && event.pointerId === drag.pointerId) {
      const maxX = Math.max(8, window.innerWidth - drag.element.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - drag.element.offsetHeight - 8);
      this.setWindowPosition(drag.name, {
        x: Math.min(maxX, Math.max(8, event.clientX - drag.offsetX)),
        y: Math.min(maxY, Math.max(8, event.clientY - drag.offsetY)),
      });
      return;
    }

    const resize = this.windowResize;
    if (!resize || event.pointerId !== resize.pointerId) {
      return;
    }

    this.applyWindowSize(
      resize.target,
      resize.element,
      resize.startWidth + event.clientX - resize.startX,
      resize.startHeight + event.clientY - resize.startY,
      resize.originX,
      resize.originY,
    );
  }

  stopWindowInteraction(event: PointerEvent): void {
    if (this.windowDrag?.pointerId === event.pointerId) {
      this.windowDrag = undefined;
    }
    if (this.windowResize?.pointerId === event.pointerId) {
      this.windowResize = undefined;
    }
  }

  private focusResizeTarget(target: ResizeTarget): void {
    this.activeWindow.set(target === 'docked-console' ? 'editor' : target);
  }

  private anchorResizableWindow(target: ResizeTarget, element: HTMLElement, bounds: DOMRect): void {
    if (target === 'docked-console') {
      return;
    }
    element.style.right = 'auto';
    element.style.bottom = 'auto';
    this.setWindowPosition(target, { x: bounds.left, y: bounds.top });
  }

  private applyWindowSize(
    target: ResizeTarget,
    element: HTMLElement,
    width: number,
    height: number,
    originX: number,
    originY: number,
  ): void {
    if (target === 'docked-console') {
      const maxHeight = window.innerHeight * 0.55;
      const minHeight = Math.min(112, maxHeight);
      element.style.height = `${this.clamp(height, minHeight, maxHeight)}px`;
      return;
    }

    const maxWidth = Math.max(1, window.innerWidth - originX - 8);
    const maxHeight = Math.max(1, window.innerHeight - originY - 8);
    const minWidth = Math.min(target === 'editor' ? 320 : 260, maxWidth);
    const minHeight = Math.min(target === 'editor' ? 310 : 120, maxHeight);
    element.style.width = `${this.clamp(width, minWidth, maxWidth)}px`;
    element.style.height = `${this.clamp(height, minHeight, maxHeight)}px`;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }

  private setWindowPosition(name: WindowName, position: WindowPosition): void {
    if (name === 'editor') {
      this.editorPosition.set(position);
      return;
    }
    this.consolePosition.set(position);
  }

  onBackdrop(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }
}
