import { computed, Injectable, signal } from '@angular/core';
import { delay, execute } from '../language/interpreter';
import { EXAMPLES } from '../language/examples';
import { ScriptError } from '../language/syntax';
import {
  canExpand,
  createWorld,
  expandWorld,
  mineSelected,
  plotCount as worldPlotCount,
  plotIdForGpu,
  plotIdForRig,
  RIGS_PER_PLOT,
  rigCount,
  rigIdForGpu,
} from './mining-world';

const CODE_STORAGE_KEY = 'blockcraft-code';
const FILES_STORAGE_KEY = 'blockcraft-files';
const ACTIVE_FILE_STORAGE_KEY = 'blockcraft-active-file';
const LINE_EFFECTS_STORAGE_KEY = 'blockcraft-line-effects';
const LINE_EFFECT_DURATION_MS = 620;
const MINING_DURATION_MS = 850;
const MAX_LOG_ENTRIES = 100;

export interface ScriptFile {
  id: string;
  name: string;
  code: string;
}

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  kind: 'info' | 'success' | 'error' | 'output';
}

@Injectable({ providedIn: 'root' })
export class GameService {
  readonly world = signal(createWorld());
  readonly started = signal(false);
  readonly running = signal(false);
  readonly mining = signal(false);
  readonly inspectedGpuId = signal<number | null>(null);
  readonly viewedRigId = signal(1);
  readonly viewedPlotId = signal(1);
  readonly rigCount = computed(() => rigCount(this.world()));
  readonly plotCount = computed(() => worldPlotCount(this.world()));
  readonly activeLine = signal(0);
  readonly executedLineEffects = signal<ReadonlyMap<number, number>>(new Map());
  readonly errorLine = signal(0);
  readonly stepMode = signal(false);
  readonly waitingForStep = signal(false);
  readonly lineEffectsEnabled = signal(this.readLineEffectsEnabled());
  readonly speed = signal(1);
  readonly files = signal(this.readFiles());
  readonly activeFileId = signal(this.readActiveFileId());
  readonly activeFile = computed(
    () => this.files().find((file) => file.id === this.activeFileId()) ?? this.files()[0]!,
  );
  readonly code = computed(() => this.activeFile().code);
  readonly logs = signal<LogEntry[]>([]);
  readonly selected = computed(() => {
    const world = this.world();
    return world.blocks.find((block) => block.id === world.selectedId)!;
  });
  readonly expandable = computed(() => canExpand(this.world()));
  readonly completed = computed(
    () => this.world().blocks.filter((block) => block.progress === 100).length,
  );
  readonly balance = computed(() => (this.world().satoshis / 100_000_000).toFixed(4));
  private controller?: AbortController;
  private lineExecutionId = 0;
  private lineEffectTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private queuedSteps = 0;
  private releaseStepWaiter?: () => void;
  private executionMode: 'continuous' | 'step' = 'continuous';
  private logId = 0;

  start(): void {
    if (this.started()) {
      return;
    }
    this.started.set(true);
    this.log('Ambiente pronto. GPU connessa al blocco #001.', 'success');
    this.log('Esegui il codice per iniziare a minare.');
  }

  updateCode(code: string): void {
    this.clearLineEffects();
    const activeFileId = this.activeFileId();
    this.files.update((files) =>
      files.map((file) => (file.id === activeFileId ? { ...file, code } : file)),
    );
    this.errorLine.set(0);
    this.persistFiles();
  }

  selectFile(id: string): void {
    if (this.running() || !this.files().some((file) => file.id === id)) {
      return;
    }
    this.activeFileId.set(id);
    this.clearLineEffects();
    this.errorLine.set(0);
    this.activeLine.set(0);
    this.persistFiles();
  }

  addFile(): void {
    if (this.running()) {
      return;
    }
    let number = 2;
    while (this.files().some((file) => file.name === `script-${number}.mine`)) {
      number++;
    }
    const file: ScriptFile = {
      id: `script-${number}`,
      name: `script-${number}.mine`,
      code: '',
    };
    this.files.update((files) => [...files, file]);
    this.activeFileId.set(file.id);
    this.clearLineEffects();
    this.errorLine.set(0);
    this.activeLine.set(0);
    this.persistFiles();
  }

  closeFile(id: string): void {
    const files = this.files();
    const index = files.findIndex((file) => file.id === id);
    if (this.running() || index < 0 || files.length === 1) {
      return;
    }

    const remaining = files.filter((file) => file.id !== id);
    if (this.activeFileId() === id) {
      this.activeFileId.set(remaining[Math.max(0, index - 1)].id);
    }
    this.files.set(remaining);
    this.clearLineEffects();
    this.errorLine.set(0);
    this.activeLine.set(0);
    this.persistFiles();
  }

  async run(): Promise<void> {
    if (!this.started()) {
      return;
    }
    if (this.running()) {
      this.resumeContinuousExecution();
      return;
    }
    const controller = new AbortController();
    this.clearLineEffects();
    this.controller = controller;
    this.stepMode.set(this.executionMode === 'step');
    this.running.set(true);
    this.errorLine.set(0);
    this.log(`Esecuzione di ${this.activeFile().name}…`);
    try {
      await execute(
        this.code(),
        {
          mine: (signal) => this.mineBlock(signal),
          print: (message) => this.log(message, 'output'),
          progress: () => this.selected().progress,
        },
        controller.signal,
        async (line) => {
          await this.waitForStepPermit(controller.signal);
          this.activeLine.set(line);
          this.markLineExecuted(line);
        },
      );
      this.log('Programma terminato.', 'success');
    } catch (error) {
      this.reportExecutionError(error, controller.signal);
    } finally {
      this.activeLine.set(0);
      this.running.set(false);
      this.mining.set(false);
      this.waitingForStep.set(false);
      this.stepMode.set(false);
      this.executionMode = 'continuous';
      this.queuedSteps = 0;
      this.releaseStepWaiter?.();
      this.controller = undefined;
    }
  }

  async step(): Promise<void> {
    if (!this.started()) {
      return;
    }
    if (this.running()) {
      if (this.executionMode === 'step') {
        this.releaseNextStep();
      }
      return;
    }

    this.executionMode = 'step';
    this.queuedSteps = 1;
    await this.run();
  }

  setLineEffectsEnabled(enabled: boolean): void {
    this.lineEffectsEnabled.set(enabled);
    if (!enabled) {
      this.clearLineEffects();
    }
    try {
      localStorage.setItem(LINE_EFFECTS_STORAGE_KEY, String(enabled));
    } catch {
      // The preference remains usable for this session without storage.
    }
  }

  private async waitForStepPermit(signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    if (this.executionMode !== 'step') {
      return;
    }
    if (this.queuedSteps > 0) {
      this.queuedSteps--;
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const abort = () => {
        this.releaseStepWaiter = undefined;
        this.waitingForStep.set(false);
        reject(signal.reason);
      };
      this.releaseStepWaiter = () => {
        signal.removeEventListener('abort', abort);
        this.releaseStepWaiter = undefined;
        this.waitingForStep.set(false);
        resolve();
      };
      this.waitingForStep.set(true);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  private releaseNextStep(): void {
    if (this.releaseStepWaiter) {
      this.releaseStepWaiter();
      return;
    }
    this.queuedSteps++;
  }

  private resumeContinuousExecution(): void {
    if (this.executionMode !== 'step') {
      return;
    }
    this.executionMode = 'continuous';
    this.stepMode.set(false);
    this.waitingForStep.set(false);
    this.queuedSteps = 0;
    this.releaseStepWaiter?.();
  }

  private markLineExecuted(line: number): void {
    if (!this.lineEffectsEnabled()) {
      return;
    }

    const executionId = ++this.lineExecutionId;
    this.executedLineEffects.update((lines) => new Map(lines).set(line, executionId));
    const previousTimer = this.lineEffectTimers.get(line);
    if (previousTimer) {
      clearTimeout(previousTimer);
    }
    const timer = setTimeout(() => {
      let expired = false;
      this.executedLineEffects.update((lines) => {
        if (lines.get(line) !== executionId) {
          return lines;
        }
        expired = true;
        const remaining = new Map(lines);
        remaining.delete(line);
        return remaining;
      });
      if (expired) {
        this.lineEffectTimers.delete(line);
      }
    }, LINE_EFFECT_DURATION_MS);
    this.lineEffectTimers.set(line, timer);
  }

  private clearLineEffects(): void {
    for (const timer of this.lineEffectTimers.values()) {
      clearTimeout(timer);
    }
    this.lineEffectTimers.clear();
    this.executedLineEffects.set(new Map());
  }

  stop(): void {
    this.controller?.abort();
  }

  select(id: number): void {
    if (!this.running() && this.world().blocks.some((block) => block.id === id)) {
      this.world.update((world) => ({ ...world, selectedId: id }));
      this.viewedRigId.set(rigIdForGpu(id));
      this.viewedPlotId.set(plotIdForGpu(id));
      this.inspectedGpuId.set(id);
    }
  }

  returnToRig(): void {
    this.inspectedGpuId.set(null);
  }

  viewRig(id: number): void {
    if (!Number.isInteger(id) || id < 1 || id > this.rigCount()) {
      return;
    }
    this.viewedRigId.set(id);
    this.viewedPlotId.set(plotIdForRig(id));
    this.inspectedGpuId.set(null);
  }

  viewPlot(id: number): void {
    if (!Number.isInteger(id) || id < 1 || id > this.plotCount()) {
      return;
    }
    const firstRigId = (id - 1) * RIGS_PER_PLOT + 1;
    this.viewedPlotId.set(id);
    this.viewedRigId.set(firstRigId);
    this.inspectedGpuId.set(null);
  }

  reset(): void {
    if (this.running()) {
      return;
    }
    this.world.set(createWorld());
    this.clearLineEffects();
    this.inspectedGpuId.set(null);
    this.viewedRigId.set(1);
    this.viewedPlotId.set(1);
    this.started.set(false);
    this.logs.set([]);
    this.errorLine.set(0);
  }

  clearLogs(): void {
    this.logs.set([]);
  }

  private async mineBlock(signal: AbortSignal): Promise<void> {
    if (this.selected().progress === 100) {
      throw new Error('Blocco completato. Sblocca il prossimo blocco.');
    }

    this.mining.set(true);
    try {
      await delay(MINING_DURATION_MS / this.speed(), signal);
    } finally {
      this.mining.set(false);
    }

    // Un'interruzione durante l'animazione non deve assegnare progresso o premi.
    signal.throwIfAborted();
    this.world.update(mineSelected);

    const block = this.selected();
    const blockNumber = String(block.id).padStart(3, '0');
    this.log(`mine() → blocco #${blockNumber} · ${block.progress}%`, 'output');

    if (block.progress === 100) {
      this.log('Blocco estratto! +0.0100 BTC al saldo simulato.', 'success');
      if (this.expandable()) {
        const previousRigCount = this.rigCount();
        this.world.update(expandWorld);
        const id = this.selected().id;
        this.log(`Blocco #${String(id).padStart(3, '0')} sbloccato. Nuova GPU pronta.`, 'success');
        if (this.rigCount() > previousRigCount) {
          this.log(
            `Rig ${this.rigCount()} sbloccato. Continua a minare per espandere la farm.`,
            'success',
          );
          if (this.inspectedGpuId() === null) {
            this.viewedRigId.set(this.rigCount());
            this.viewedPlotId.set(plotIdForRig(this.rigCount()));
          }
        }
      }
    }
  }

  private reportExecutionError(error: unknown, signal: AbortSignal): void {
    if (signal.aborted) {
      this.log('Esecuzione interrotta. Progressi conservati.');
      return;
    }

    const line = error instanceof ScriptError ? error.line : 0;
    const message = error instanceof Error ? error.message : 'Errore durante l’esecuzione.';
    this.errorLine.set(line);
    this.log(message, 'error');
  }

  private log(message: string, kind: LogEntry['kind'] = 'info'): void {
    this.logs.update((logs) => [
      ...logs.slice(-(MAX_LOG_ENTRIES - 1)),
      { id: ++this.logId, message, kind, time: new Date().toLocaleTimeString('it-IT') },
    ]);
  }

  private readFiles(): ScriptFile[] {
    try {
      const stored = localStorage.getItem(FILES_STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const files = parsed.filter(isScriptFile);
          const ids = new Set(files.map((file) => file.id));
          if (files.length && ids.size === files.length) {
            return files;
          }
        }
      }
    } catch {
      // Fall through to the legacy single-file save.
    }
    return [
      {
        id: 'main',
        name: 'main.mine',
        code: this.readLegacyCode(),
      },
    ];
  }

  private readActiveFileId(): string {
    const firstFileId = this.files()[0].id;
    try {
      const storedId = localStorage.getItem(ACTIVE_FILE_STORAGE_KEY);
      return this.files().some((file) => file.id === storedId) ? storedId! : firstFileId;
    } catch {
      return firstFileId;
    }
  }

  private readLegacyCode(): string {
    try {
      return localStorage.getItem(CODE_STORAGE_KEY) ?? EXAMPLES[0].code;
    } catch {
      return EXAMPLES[0].code;
    }
  }

  private readLineEffectsEnabled(): boolean {
    try {
      return localStorage.getItem(LINE_EFFECTS_STORAGE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  private persistFiles(): void {
    const files = this.files();
    try {
      localStorage.setItem(FILES_STORAGE_KEY, JSON.stringify(files));
      localStorage.setItem(ACTIVE_FILE_STORAGE_KEY, this.activeFileId());
      const mainFile = files.find((file) => file.id === 'main');
      localStorage.setItem(CODE_STORAGE_KEY, mainFile?.code ?? this.code());
    } catch {
      /* Editing remains available without storage. */
    }
  }
}

function isScriptFile(value: unknown): value is ScriptFile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const file = value as Partial<ScriptFile>;
  return (
    typeof file.id === 'string' && typeof file.name === 'string' && typeof file.code === 'string'
  );
}
