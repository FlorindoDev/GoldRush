import { computed, Injectable, signal } from '@angular/core';
import { delay, execute } from '../language/interpreter';
import { EXAMPLES } from '../language/examples';
import { ScriptError } from '../language/syntax';
import { canExpand, createWorld, expandWorld, MAX_BLOCKS, mineSelected } from './mining-world';

const CODE_STORAGE_KEY = 'blockcraft-code';
const FILES_STORAGE_KEY = 'blockcraft-files';
const ACTIVE_FILE_STORAGE_KEY = 'blockcraft-active-file';
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
  readonly activeLine = signal(0);
  readonly errorLine = signal(0);
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
  readonly won = computed(() => this.completed() === MAX_BLOCKS);
  readonly balance = computed(() => (this.world().satoshis / 100_000_000).toFixed(4));
  private controller?: AbortController;
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
    this.errorLine.set(0);
    this.activeLine.set(0);
    this.persistFiles();
  }

  async run(): Promise<void> {
    if (!this.started() || this.running()) {
      return;
    }
    const controller = new AbortController();
    this.controller = controller;
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
        (line) => this.activeLine.set(line),
      );
      this.log('Programma terminato.', 'success');
    } catch (error) {
      this.reportExecutionError(error, controller.signal);
    } finally {
      this.activeLine.set(0);
      this.running.set(false);
      this.mining.set(false);
      this.controller = undefined;
    }
  }

  stop(): void {
    this.controller?.abort();
  }

  select(id: number): void {
    if (!this.running() && this.world().blocks.some((block) => block.id === id)) {
      this.world.update((world) => ({ ...world, selectedId: id }));
    }
  }

  reset(): void {
    if (this.running()) {
      return;
    }
    this.world.set(createWorld());
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
        this.world.update(expandWorld);
        this.log(`Blocco #00${this.selected().id} sbloccato. Nuova GPU pronta.`, 'success');
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
