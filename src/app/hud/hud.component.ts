import { CRYPTO_CONFIG } from '../config/crypto-config';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  OnDestroy,
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
import { FileManagerComponent } from './panels/file-manager/file-manager.component';
import { GameService } from '../game/game.service';
import { GameSaveManager } from '../game/game-save';
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
type EditorWindow = { id: string; fileIds: readonly string[]; activeFileId: string };
type DraggedTab = { fileId: string; sourceWindowId: string };

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
    FileManagerComponent,
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
export class HudComponent implements OnDestroy {
  readonly game = inject(GameService);
  readonly gameSave = new GameSaveManager(this.game);
  readonly saveMessage = signal('');
  readonly confirmingSaveReset = signal(false);
  readonly editorWindows = signal<readonly EditorWindow[]>([
    { id: 'editor', fileIds: [this.game.activeFileId()], activeFileId: this.game.activeFileId() },
  ]);
  readonly draggedTab = signal<DraggedTab | null>(null);
  readonly dockEditorId = computed(
    () =>
      this.editorWindows().find((entry) => entry.id === 'editor')?.id ??
      this.editorWindows()[0]?.id ??
      null,
  );
  private nextEditorNumber = 2;
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
  readonly cryptoConfig = CRYPTO_CONFIG;
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
  readonly scene = viewChild.required<SceneComponent>('scene');
  readonly guideContent = viewChild.required<ElementRef<HTMLElement>>('guideContent');
  readonly settings = viewChild.required<ElementRef<HTMLDialogElement>>('settings');
  readonly researchTree = viewChild.required<ResearchTreeComponent>('researchTree');
  readonly windowLayout = new HudWindowLayout();

  constructor() {
    this.game.start();
  }

  ngOnDestroy(): void {
    this.gameSave.destroy();
  }

  openFile(id: string): void {
    if (!this.game.files().some((file) => file.id === id)) return;
    if (this.game.inspectedGpuId() !== null || this.game.inspectedRigId() !== null) {
      this.game.returnToRig();
      this.scene().setSelectedToolStationId(null);
    }
    const existing = this.editorWindows().find((entry) => entry.fileIds.includes(id));
    if (existing) {
      this.selectEditorTab(existing.id, id);
    } else {
      const windowId = this.editorWindows().some((entry) => entry.id === 'editor')
        ? `editor-${this.nextEditorNumber++}`
        : 'editor';
      if (windowId !== 'editor')
        this.windowLayout.placeEditor(windowId, this.editorWindows().length);
      this.editorWindows.update((entries) => [
        ...entries,
        { id: windowId, fileIds: [id], activeFileId: id },
      ]);
      this.windowLayout.focusWindow(windowId);
    }
    if (!this.game.running()) this.game.selectFile(id);
  }

  onEditorPointerDown(event: PointerEvent, windowId: string, fileId: string): void {
    this.windowLayout.startWindowDrag(event, windowId);
    if (!this.game.running() && this.game.activeFileId() !== fileId) {
      this.game.selectFile(fileId);
    }
  }

  finishEditorPointer(event: PointerEvent, sourceWindowId: string): void {
    const drag = this.windowLayout.stopWindowInteraction(event);
    if (!drag?.moved || drag.name !== sourceWindowId) return;
    const sourceElement = event.currentTarget as HTMLElement;
    const candidates = Array.from(
      sourceElement.parentElement?.querySelectorAll<HTMLElement>('.editor-window') ?? [],
    ).reverse();
    const target = candidates.find((element) => {
      if (element.hidden || element.dataset['editorWindowId'] === sourceWindowId) return false;
      const bounds = element.getBoundingClientRect();
      return (
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom
      );
    });
    if (target?.dataset['editorWindowId']) {
      this.mergeEditors(sourceWindowId, target.dataset['editorWindowId']);
    }
  }

  selectEditorTab(windowId: string, fileId: string): void {
    this.editorWindows.update((windows) =>
      windows.map((entry) =>
        entry.id === windowId && entry.fileIds.includes(fileId)
          ? { ...entry, activeFileId: fileId }
          : entry,
      ),
    );
    this.windowLayout.focusWindow(windowId);
    if (!this.game.running()) this.game.selectFile(fileId);
  }

  closeEditorTab(windowId: string, fileId: string): void {
    const window = this.editorWindows().find((entry) => entry.id === windowId);
    const index = window?.fileIds.indexOf(fileId) ?? -1;
    if (!window || index < 0) return;
    const fileIds = window.fileIds.filter((id) => id !== fileId);
    if (fileIds.length === 0) {
      this.closeEditor(windowId);
      return;
    }
    if (this.game.running() && this.game.executingFileId() === fileId) this.game.stop();
    const activeFileId =
      window.activeFileId === fileId
        ? fileIds[Math.min(index, fileIds.length - 1)]
        : window.activeFileId;
    this.editorWindows.update((windows) =>
      windows.map((entry) => (entry.id === windowId ? { ...entry, fileIds, activeFileId } : entry)),
    );
    this.windowLayout.focusWindow(windowId);
    if (!this.game.running()) this.game.selectFile(activeFileId);
  }

  createEditorFile(windowId: string): void {
    const file = this.game.createFile();
    this.editorWindows.update((windows) =>
      windows.map((entry) =>
        entry.id === windowId
          ? { ...entry, fileIds: [...entry.fileIds, file.id], activeFileId: file.id }
          : entry,
      ),
    );
    this.windowLayout.focusWindow(windowId);
  }

  closeEditor(id: string): void {
    const window = this.editorWindows().find((entry) => entry.id === id);
    if (!window) return;
    if (this.game.running() && window.fileIds.includes(this.game.executingFileId() ?? '')) {
      this.game.stop();
    }
    this.editorWindows.update((entries) => entries.filter((entry) => entry.id !== id));
    this.forgetEditorWindow(id);
    const next = this.editorWindows().at(-1);
    if (next) {
      this.windowLayout.focusWindow(next.id);
      if (!this.game.running()) this.game.selectFile(next.activeFileId);
    }
  }

  toggleConsoleDock(): void {
    if (!this.windowLayout.consoleDocked() && this.editorWindows().length === 0) {
      this.openFile(this.game.activeFileId());
    }
    this.windowLayout.toggleConsoleDock();
    if (this.windowLayout.consoleDocked() && this.dockEditorId()) {
      this.windowLayout.focusWindow(this.dockEditorId()!);
    }
  }

  fileDeleted(id: string): void {
    const windows = this.editorWindows().map((entry) => {
      const fileIds = entry.fileIds.filter((fileId) => fileId !== id);
      return {
        ...entry,
        fileIds,
        activeFileId: entry.activeFileId === id ? (fileIds[0] ?? '') : entry.activeFileId,
      };
    });
    const remaining = windows.filter((entry) => entry.fileIds.length > 0);
    this.editorWindows.set(remaining);
    for (const entry of windows) {
      if (entry.fileIds.length === 0) {
        this.forgetEditorWindow(entry.id);
      }
    }
    if (!remaining.some((entry) => entry.id === this.windowLayout.activeWindow())) {
      const next = remaining.at(-1);
      this.windowLayout.focusWindow(next?.id ?? 'console');
      if (next) this.game.selectFile(next.activeFileId);
    }
  }

  startTabDrag(event: DragEvent, sourceWindowId: string, fileId: string): void {
    this.draggedTab.set({ sourceWindowId, fileId });
    event.dataTransfer?.setData('application/x-goldrush-tab', fileId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  dragOverWorkspace(event: DragEvent): void {
    if (!this.draggedTab() || this.isOverEditor(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  dropTabOutside(event: DragEvent): void {
    const dragged = this.draggedTab();
    if (!dragged || this.isOverEditor(event)) return;
    event.preventDefault();
    this.draggedTab.set(null);
    const source = this.editorWindows().find((entry) => entry.id === dragged.sourceWindowId);
    if (!source?.fileIds.includes(dragged.fileId)) return;
    const sourceFileIds = source.fileIds.filter((id) => id !== dragged.fileId);
    const windowId = this.editorWindows().some((entry) => entry.id === 'editor')
      ? `editor-${this.nextEditorNumber++}`
      : 'editor';
    this.editorWindows.set([
      ...this.editorWindows()
        .map((entry) =>
          entry.id === source.id
            ? {
                ...entry,
                fileIds: sourceFileIds,
                activeFileId:
                  entry.activeFileId === dragged.fileId
                    ? (sourceFileIds[0] ?? '')
                    : entry.activeFileId,
              }
            : entry,
        )
        .filter((entry) => entry.fileIds.length > 0),
      { id: windowId, fileIds: [dragged.fileId], activeFileId: dragged.fileId },
    ]);
    if (sourceFileIds.length === 0) this.forgetEditorWindow(source.id);
    this.windowLayout.placeEditorAt(windowId, event.clientX, event.clientY);
    if (!this.game.running()) this.game.selectFile(dragged.fileId);
  }

  private isOverEditor(event: DragEvent): boolean {
    return event.target instanceof Element && event.target.closest('.editor-window') !== null;
  }

  dragOverEditor(event: DragEvent, targetWindowId: string): void {
    if (!this.draggedTab() || this.draggedTab()?.sourceWindowId === targetWindowId) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  }

  dropTab(event: DragEvent, targetWindowId: string): void {
    const dragged = this.draggedTab();
    if (!dragged || dragged.sourceWindowId === targetWindowId) return;
    event.preventDefault();
    event.stopPropagation();
    this.draggedTab.set(null);
    const source = this.editorWindows().find((entry) => entry.id === dragged.sourceWindowId);
    const target = this.editorWindows().find((entry) => entry.id === targetWindowId);
    if (!source?.fileIds.includes(dragged.fileId) || !target) return;

    const sourceFileIds = source.fileIds.filter((fileId) => fileId !== dragged.fileId);
    this.editorWindows.set(
      this.editorWindows()
        .map((entry) => {
          if (entry.id === dragged.sourceWindowId) {
            return {
              ...entry,
              fileIds: sourceFileIds,
              activeFileId:
                entry.activeFileId === dragged.fileId
                  ? (sourceFileIds[0] ?? '')
                  : entry.activeFileId,
            };
          }
          if (entry.id === targetWindowId) {
            return {
              ...entry,
              fileIds: entry.fileIds.includes(dragged.fileId)
                ? entry.fileIds
                : [...entry.fileIds, dragged.fileId],
              activeFileId: dragged.fileId,
            };
          }
          return entry;
        })
        .filter((entry) => entry.fileIds.length > 0),
    );
    if (sourceFileIds.length === 0) {
      this.forgetEditorWindow(dragged.sourceWindowId);
    }
    this.windowLayout.focusWindow(targetWindowId);
    if (!this.game.running()) this.game.selectFile(dragged.fileId);
  }

  private mergeEditors(sourceWindowId: string, targetWindowId: string): void {
    const source = this.editorWindows().find((entry) => entry.id === sourceWindowId);
    const target = this.editorWindows().find((entry) => entry.id === targetWindowId);
    if (!source || !target || source === target) return;
    this.editorWindows.set(
      this.editorWindows()
        .filter((entry) => entry.id !== sourceWindowId)
        .map((entry) =>
          entry.id === targetWindowId
            ? {
                ...entry,
                fileIds: [...new Set([...entry.fileIds, ...source.fileIds])],
                activeFileId: source.activeFileId,
              }
            : entry,
        ),
    );
    this.forgetEditorWindow(sourceWindowId);
    this.windowLayout.focusWindow(targetWindowId);
    if (!this.game.running()) this.game.selectFile(source.activeFileId);
  }

  private forgetEditorWindow(id: string): void {
    if (this.editorWindows().length === 0 && this.windowLayout.consoleDocked()) {
      this.windowLayout.toggleConsoleDock();
    }
    this.windowLayout.forgetEditor(id);
  }

  openSettings(): void {
    this.confirmingSaveReset.set(false);
    this.settings().nativeElement.showModal();
  }

  closeSettings(): void {
    this.settings().nativeElement.close();
  }

  cancelSaveReset(): void {
    this.confirmingSaveReset.set(false);
  }

  requestSaveReset(): void {
    this.saveMessage.set('');
    this.confirmingSaveReset.set(true);
  }

  resetSave(): void {
    if (!this.confirmingSaveReset()) return;
    try {
      const savedLocally = this.gameSave.reset();
      this.resetEditorWindows();
      this.saveMessage.set(
        savedLocally
          ? 'Salvataggi eliminati. Nuova partita avviata.'
          : 'Nuova partita avviata, ma impossibile aggiornare tutti i salvataggi nel browser.',
      );
    } catch (error) {
      this.saveMessage.set(error instanceof Error ? error.message : 'Ripristino non riuscito.');
    } finally {
      this.confirmingSaveReset.set(false);
    }
  }

  downloadSave(): void {
    try {
      this.gameSave.download();
      this.saveMessage.set('Salvataggio scaricato.');
    } catch (error) {
      this.saveMessage.set(error instanceof Error ? error.message : 'Download non riuscito.');
    }
  }

  async importSave(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
    try {
      const savedLocally = await this.gameSave.importFile(input.files[0]);
      this.resetEditorWindows();
      this.saveMessage.set(
        savedLocally
          ? 'Partita importata e salvata nel browser.'
          : 'Partita importata. Il browser non permette il salvataggio automatico.',
      );
    } catch (error) {
      this.saveMessage.set(error instanceof Error ? error.message : 'Importazione non riuscita.');
    } finally {
      input.value = '';
    }
  }

  private resetEditorWindows(): void {
    for (const editor of this.editorWindows()) {
      if (editor.id !== 'editor') this.windowLayout.forgetEditor(editor.id);
    }
    this.editorWindows.set([
      {
        id: 'editor',
        fileIds: [this.game.activeFileId()],
        activeFileId: this.game.activeFileId(),
      },
    ]);
    this.windowLayout.focusWindow('editor');
    this.scene().setSelectedToolStationId(null);
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
