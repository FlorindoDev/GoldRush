import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
  STARTING_GPU_COUNT,
} from '../game/mining-world';
import { ConsoleComponent } from './panels/console/console.component';
import { EditorComponent } from './panels/editor/editor.component';
import { GameService } from '../game/game.service';
import { loadGpuHoverTooltipEnabled, persistGpuHoverTooltipEnabled } from '../game/script-storage';
import { EXAMPLES, LANGUAGE_GUIDE_EXAMPLE } from '../language/examples';
import { GUIDE_CODE } from '../language/guide-code';
import { SceneComponent } from '../scene/scene.component';
import { WalletComponent } from './indicators/wallet/wallet.component';
import { PowerComponent } from './indicators/power/power.component';
import { GpuTooltipComponent, type GpuHover } from './indicators/gpu-tooltip/gpu-tooltip.component';
import { IconComponent } from './icons/icon.component';
import { WorkbenchComponent } from './panels/workbench/workbench.component';
import { RigWorkbenchComponent } from './panels/rig-workbench/rig-workbench.component';
import { GuideCodeComponent } from './guide-code/guide-code.component';
import { ResearchTreeComponent } from './research-tree/research-tree.component';
import { ComputerComponent } from './computer/computer.component';
import { HudWindowLayout } from './hud-window-layout';

type GuideSection = 'examples' | 'functions' | 'gpu' | 'energy' | 'constructs' | 'shortcuts';

const SHORTCUT_GROUPS = [
  {
    name: 'Editor',
    shortcuts: [
      { action: 'Avvia il codice', keys: ['Ctrl / ⌘', 'Invio'], separator: '+' },
      { action: 'Indenta di due spazi', keys: ['Tab'], separator: '+' },
      { action: 'Commenta le righe selezionate', keys: ['Ctrl / ⌘', '/'], separator: '+' },
      {
        action: 'Commento lungo sulla selezione',
        keys: ['Ctrl / ⌘', 'Alt / ⌥', 'A'],
        separator: '+',
      },
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
    RigWorkbenchComponent,
    GuideCodeComponent,
    ResearchTreeComponent,
    ComputerComponent,
  ],
  templateUrl: './hud.component.html',
  styleUrl: './hud.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'hoveredGpu.set(null)' },
})
export class HudComponent {
  readonly game = inject(GameService);
  readonly hoveredGpu = signal<GpuHover | null>(null);
  readonly gpuHoverTooltipEnabled = signal(loadGpuHoverTooltipEnabled());
  readonly visibleGpuHover = computed(() => {
    if (
      !this.gpuHoverTooltipEnabled() ||
      this.game.inspectedGpuId() !== null ||
      this.game.inspectedRigId() !== null
    ) {
      return null;
    }
    return this.hoveredGpu();
  });
  readonly balance = GAME_BALANCE;
  readonly plotCapacity = PLOT_COUNT;
  readonly rigCapacity = RIG_COUNT;
  readonly gpuCapacity = GPU_COUNT;
  readonly rigsPerPlot = RIGS_PER_PLOT;
  readonly gpusPerRig = GPUS_PER_RIG;
  readonly gpusPerPlot = RIGS_PER_PLOT * GPUS_PER_RIG;
  readonly minesPerBlock = Math.ceil(
    100 / (MINE_PROGRESS_PER_GPU * Math.max(1, STARTING_GPU_COUNT)),
  );
  readonly idleGpu = getGpuTelemetry(0);
  readonly miningGpu = getGpuTelemetry(1);
  readonly examples = EXAMPLES;
  readonly guideCode = GUIDE_CODE;
  readonly languageGuideExample = LANGUAGE_GUIDE_EXAMPLE;
  readonly guideSection = signal<GuideSection>('examples');
  readonly shortcutGroups = SHORTCUT_GROUPS;
  readonly guide = viewChild.required<ElementRef<HTMLDialogElement>>('guide');
  readonly guideContent = viewChild.required<ElementRef<HTMLElement>>('guideContent');
  readonly settings = viewChild.required<ElementRef<HTMLDialogElement>>('settings');
  readonly researchTree = viewChild.required<ResearchTreeComponent>('researchTree');
  readonly windowLayout = new HudWindowLayout();

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

  updateGpuHoverTooltip(event: Event): void {
    const checkbox = event.target;
    if (checkbox instanceof HTMLInputElement) {
      const enabled = checkbox.checked;
      this.gpuHoverTooltipEnabled.set(enabled);
      persistGpuHoverTooltipEnabled(enabled);
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

  goToGuideHeading(event: MouseEvent, id: string): void {
    event.preventDefault();
    const heading = this.guideContent().nativeElement.querySelector<HTMLElement>(`#${id}`);
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
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

  onBackdrop(event: MouseEvent, dialog: HTMLDialogElement): void {
    if (event.target === dialog) {
      dialog.close();
    }
  }
}
