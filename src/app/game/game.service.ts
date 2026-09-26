import { computed, Injectable, signal } from '@angular/core';
import { purchaseCart, sellStockItem, storeGpu, installStockGpu, type CartLine } from './inventory';
import { GAME_BALANCE } from '../config/game-balance';
import { CRYPTO_CONFIG, cryptoValueEur, requireCrypto } from '../config/crypto-config';
import { gpuIdsFromVector } from './script-api/gpu-script-object';
import type { RigSetup } from '../config/rig-config';
import { delay, execute } from '../language/interpreter';
import { ScriptError } from '../language/syntax';
import { createWorldBindings } from './script-api/world-bindings';
import { satoshisToEuros } from './electricity';
import { isResearchUnlocked, unlockResearch } from './research';
import { applyGpuWork, gpuTemperatureWhilePoweredDown, isGpuOperational } from './gpu-operation';
import { getGpuTelemetry } from './gpu-telemetry';
import type { GpuMaintenanceAction } from './gpu-maintenance';
import type { ElectricityReadings } from './script-api/electricity-script-object';
import {
  loadActiveFileId,
  loadLineEffectsEnabled,
  loadScriptFiles,
  persistLineEffectsEnabled,
  persistScriptFiles,
  type ScriptFile,
} from './script-storage';
import {
  canExpand,
  assignGpusCrypto,
  billElectricityForDay,
  countUnlockedGpus,
  countUnlockedRigs,
  configureRig,
  createWorld,
  farmPowerWatts,
  getGpu,
  getCryptoBlock,
  getCryptoProgress,
  isCryptoBlockSettled,
  getRig,
  serviceGpu,
  setGpuWorkbenchState,
  recordGpuWork,
  requireOperationalGpu,
  settleCompletedBlocks,
  resumeGpu,
  setGpuFrequency,
  setGpuFanSpeed,
  stopGpu as stopGpuOnWorld,
  expandWorld,
  GPU_COUNT,
  isGpuUnlocked,
  isRigUnlocked,
  mineGpu as mineGpuOnWorld,
  plotCount as worldPlotCount,
  plotIdForGpu,
  plotIdForRig,
  RIGS_PER_PLOT,
  rigCount,
  rigIdForGpu,
  STARTING_GPU_COUNT,
  STARTING_RIG_COUNT,
} from './mining-world';

const LINE_EFFECT_DURATION_MS = GAME_BALANCE.editor.lineEffectDurationMs;
const MINING_DURATION_MS = GAME_BALANCE.mining.actionDurationMs;
const MAX_LOG_ENTRIES = GAME_BALANCE.editor.maxLogEntries;
const PROGRESS_EPSILON = 1e-9;

function shouldOutputMineProgress(
  previousProgress: number,
  currentProgress: number,
  progressEveryPercent?: number,
): boolean {
  if (progressEveryPercent === undefined || currentProgress >= 100) {
    return true;
  }
  return (
    Math.floor((currentProgress + PROGRESS_EPSILON) / progressEveryPercent) >
    Math.floor((previousProgress + PROGRESS_EPSILON) / progressEveryPercent)
  );
}

export type { ScriptFile } from './script-storage';

export interface LogEntry {
  id: number;
  time: string;
  message: string;
  kind: 'info' | 'success' | 'error' | 'output' | 'warning';
}

interface MiningAction {
  readonly gpuId: number;
  readonly startedAt: number;
  readonly durationMs: number;
  readonly parallelGroupId?: number;
}

@Injectable({ providedIn: 'root' })
export class GameService {
  private nextGlobalMineGroupId = 0;
  readonly world = signal(createWorld());
  readonly gameElapsedMinutes = signal(0);
  readonly started = signal(false);
  readonly computerOpen = signal(false);
  readonly running = signal(false);
  readonly mining = signal(false);
  readonly miningActions = signal<readonly MiningAction[]>([]);
  readonly miningAction = computed(() => this.miningActions()[0] ?? null);
  readonly activeGpuIds = computed(() => this.miningActions().map(({ gpuId }) => gpuId));
  readonly activeGpuId = computed(() => this.activeGpuIds()[0] ?? null);
  readonly selectedGpuId = signal<number | null>(null);
  readonly selectedRigId = signal<number | null>(null);
  readonly inspectedGpuId = signal<number | null>(null);
  readonly inspectedRigId = signal<number | null>(null);
  readonly viewedRigId = signal(1);
  readonly viewedPlotId = signal(1);
  readonly rigCount = computed(() => rigCount(this.world()));
  readonly unlockedRigCount = computed(() => countUnlockedRigs(this.world()));
  readonly plotCount = computed(() => worldPlotCount(this.world()));
  readonly unlockedGpuCount = computed(() => countUnlockedGpus(this.world()));
  readonly activeLine = signal(0);
  readonly executedLineEffects = signal<ReadonlyMap<number, number>>(new Map());
  readonly errorLine = signal(0);
  readonly stepMode = signal(false);
  readonly waitingForStep = signal(false);
  readonly lineEffectsEnabled = signal(loadLineEffectsEnabled());
  readonly speed = signal(1);
  readonly files = signal(loadScriptFiles());
  readonly activeFileId = signal(loadActiveFileId(this.files()));
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
  readonly balance = computed(() =>
    (this.world().satoshis / GAME_BALANCE.world.satoshisPerBitcoin).toFixed(8),
  );
  readonly balanceEur = computed(
    () => this.world().cashEur + cryptoValueEur(this.world().holdings),
  );
  readonly isResearchUnlocked = (id: string) => isResearchUnlocked(this.world(), id);

  unlockResearch(id: string): void {
    this.world.update((world) => unlockResearch(world, id));
  }

  buyCart(cart: readonly CartLine[]): void {
    this.world.update((world) => purchaseCart(world, cart));
  }

  sellStock(id: number): void {
    this.world.update((world) => sellStockItem(world, id));
  }

  moveGpuToStock(id: number): void {
    if (this.running()) throw new Error('Ferma il programma prima di smontare una GPU.');
    this.world.update((world) => storeGpu(world, id));
    if (this.selectedGpuId() === id) this.selectedGpuId.set(null);
  }

  mountStockGpu(id: number, rigId: number): void {
    if (this.running()) throw new Error('Ferma il programma prima di montare una GPU.');
    this.world.update((world) => installStockGpu(world, id, rigId));
  }
  private controller?: AbortController;
  private rigPoweredDownAt = Date.now();
  private billedGameDay = 0;
  private readonly miningControllers = new Map<number, AbortController>();
  private readonly parallelGpuIds = new Map<number, Set<number>>();
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
    this.log(
      `Ambiente pronto. ${STARTING_RIG_COUNT} RIG e ${STARTING_GPU_COUNT} GPU sbloccati; il resto della farm è bloccato.`,
      'success',
    );
    this.log('Esegui il codice per iniziare a minare.');
  }

  advanceGameTime(realElapsedMilliseconds: number): void {
    if (!Number.isFinite(realElapsedMilliseconds) || realElapsedMilliseconds <= 0) {
      return;
    }

    const elapsedMinutes =
      this.gameElapsedMinutes() +
      realElapsedMilliseconds / GAME_BALANCE.clock.millisecondsPerGameMinute;
    this.gameElapsedMinutes.set(elapsedMinutes);

    const completedDays = Math.floor(elapsedMinutes / GAME_BALANCE.clock.minutesPerDay);
    this.billedGameDay = Math.max(
      this.billedGameDay,
      this.world().lastElectricityBill?.gameDay ?? 0,
    );
    while (this.billedGameDay < completedDays) {
      const gameDay = ++this.billedGameDay;
      this.world.update((world) => billElectricityForDay(world, gameDay));
      const bill = this.world().lastElectricityBill;
      if (bill?.gameDay === gameDay) {
        this.log(
          `Bolletta giorno ${gameDay}: −${satoshisToEuros(bill.electricitySatoshis).toFixed(2)} €.`,
          'warning',
        );
      }
    }
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
    this.prepareNextBlock();
    this.powerOnGpus(Date.now());
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
          globals: createWorldBindings(
            this.world(),
            {
              getGpu: (id) => getGpu(this.world(), id),
              getTelemetry: (id) => this.gpuTelemetry(id),
              getCryptoProgress: (cryptoId) => getCryptoProgress(this.world(), cryptoId),
              isSelected: (id) => this.selectedGpuId() === id,
              setFrequencyGhz: (id, frequency) => this.setGpuFrequencyGhz(id, frequency),
              setFanSpeedPercent: (id, percentage) => this.setGpuFanSpeedPercent(id, percentage),
              stopGpu: (id) => this.stopGpu(id),
              clearStop: (id) => this.clearGpuStop(id),
            },
            () => this.readElectricity(),
          ),
          print: (message) => this.log(message, 'output'),
          mine: (gpus, message, line, parallelGroupId, progressEveryPercent) =>
            this.mineUnlockedGpus(
              controller.signal,
              gpus === null ? undefined : gpuIdsFromVector(gpus, line, 'mine'),
              message,
              parallelGroupId,
              progressEveryPercent,
            ),
          progress: (cryptoName) =>
            cryptoName
              ? getCryptoProgress(this.world(), requireCrypto(cryptoName).id)
              : this.selected().progress,
          setCrypto: (gpus, crypto, line) => {
            if (typeof crypto !== 'string') {
              throw new ScriptError('setCrypto richiede una sigla cripto tra virgolette.', line);
            }
            this.setGpusCrypto(gpuIdsFromVector(gpus, line), crypto);
          },
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
      this.rigPoweredDownAt = Date.now();
      this.running.set(false);
      this.mining.set(false);
      this.miningActions.set([]);
      this.miningControllers.clear();
      this.parallelGpuIds.clear();
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
    persistLineEffectsEnabled(enabled);
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
    if (isGpuUnlocked(this.world(), id)) {
      this.viewedRigId.set(rigIdForGpu(id));
      this.viewedPlotId.set(plotIdForGpu(id));
      this.selectedGpuId.set(id);
    }
  }

  inspectGpu(id: number): void {
    if (!this.running() && isGpuUnlocked(this.world(), id)) {
      if (this.inspectedGpuId() !== id) {
        this.returnInspectedGpuToRig();
        this.world.update((world) => setGpuWorkbenchState(world, id, true));
      }
      this.select(id);
      this.inspectedGpuId.set(id);
    }
  }

  inspectRig(id: number): void {
    if (this.running() || !isRigUnlocked(this.world(), id)) {
      return;
    }
    this.viewedRigId.set(id);
    this.viewedPlotId.set(plotIdForRig(id));
    this.selectedRigId.set(id);
    this.inspectedRigId.set(id);
  }

  configureInspectedRig(update: Partial<RigSetup>): void {
    const rigId = this.inspectedRigId();
    if (rigId === null || this.running()) {
      throw new Error('Ferma il programma e seleziona un RIG sul banco.');
    }
    if (update.fanId && !this.isResearchUnlocked(update.fanId)) {
      throw new Error('Sblocca la ventola nell’albero della ricerca.');
    }
    if (
      update.dustSystemId &&
      update.dustSystemId !== 'none' &&
      !this.isResearchUnlocked(`filter-${update.dustSystemId}`)
    ) {
      throw new Error('Sblocca il filtro nell’albero della ricerca.');
    }
    this.world.update((world) => configureRig(world, rigId, update));
  }

  returnToRig(): void {
    this.returnInspectedGpuToRig();
    this.closeInspectedRigWorkbench();
  }

  returnInspectedGpuToRig(): void {
    const gpuId = this.inspectedGpuId();
    if (gpuId !== null) {
      this.world.update((world) => setGpuWorkbenchState(world, gpuId, false));
    }
    this.inspectedGpuId.set(null);
  }

  closeInspectedRigWorkbench(): void {
    this.inspectedRigId.set(null);
  }

  serviceInspectedGpu(action: GpuMaintenanceAction): void {
    const id = this.requireWorkbenchGpu();
    this.world.update((world) => serviceGpu(world, id, action));
  }

  private requireWorkbenchGpu(): number {
    const id = this.inspectedGpuId();
    if (id === null || this.running()) {
      throw new Error('Ferma il programma e porta una GPU sul banco.');
    }
    return id;
  }

  viewRig(id: number): void {
    if (!Number.isInteger(id) || id < 1 || id > this.rigCount()) {
      return;
    }
    this.viewedRigId.set(id);
    this.viewedPlotId.set(plotIdForRig(id));
    this.selectedRigId.set(id);
  }

  viewPlot(id: number): void {
    if (!Number.isInteger(id) || id < 1 || id > this.plotCount()) {
      return;
    }
    const firstRigId = (id - 1) * RIGS_PER_PLOT + 1;
    this.viewedPlotId.set(id);
    this.viewedRigId.set(firstRigId);
    this.selectedGpuId.set(null);
    this.selectedRigId.set(null);
    this.returnToRig();
  }

  reset(): void {
    if (this.running()) {
      return;
    }
    this.returnToRig();
    this.world.set(createWorld());
    this.computerOpen.set(false);
    this.gameElapsedMinutes.set(0);
    this.billedGameDay = 0;
    this.clearLineEffects();
    this.selectedGpuId.set(null);
    this.selectedRigId.set(null);
    this.viewedRigId.set(1);
    this.viewedPlotId.set(1);
    this.started.set(false);
    this.logs.set([]);
    this.errorLine.set(0);
  }

  clearLogs(): void {
    this.logs.set([]);
  }

  private async mineUnlockedGpus(
    signal: AbortSignal,
    selectedGpuIds: number[] | undefined,
    message: string | false | null,
    parallelGroupId?: number,
    progressEveryPercent?: number,
  ): Promise<void> {
    const world = this.world();
    const unlockedGpuIds =
      selectedGpuIds === undefined
        ? Array.from({ length: GPU_COUNT }, (_, index) => index + 1).filter((gpuId) =>
            isGpuUnlocked(world, gpuId),
          )
        : Array.from(new Set(selectedGpuIds));
    for (const gpuId of unlockedGpuIds) {
      if (
        !Number.isInteger(gpuId) ||
        gpuId < 1 ||
        gpuId > GPU_COUNT ||
        !isGpuUnlocked(world, gpuId)
      ) {
        throw new Error(`GPU ${gpuId} bloccata o inesistente.`);
      }
    }
    const benchGpuIds = unlockedGpuIds.filter((gpuId) => getGpu(world, gpuId).onWorkbench);
    for (const gpuId of benchGpuIds) {
      this.log(`GPU ${gpuId} al banco: mining ignorato. Rimontala nel RIG.`, 'warning');
    }
    const mountedGpuIds = unlockedGpuIds.filter((gpuId) => !getGpu(world, gpuId).onWorkbench);
    const gpuIds = mountedGpuIds.filter((gpuId) => {
      const gpu = getGpu(world, gpuId);
      if (gpu.stopped) {
        this.log(
          `GPU ${gpuId} ferma: mining ignorato. Usa gpu.clearStop() per riavviarla.`,
          'warning',
        );
        return false;
      }
      if (!isGpuOperational(gpu)) {
        this.log(`GPU ${gpuId} non operativa: mining ignorato.`, 'warning');
        return false;
      }
      return true;
    });
    if (gpuIds.length === 0) {
      throw new Error('Nessuna GPU operativa disponibile per minare.');
    }

    const activeGpuId = gpuIds.find((gpuId) => this.activeGpuIds().includes(gpuId));
    if (activeGpuId !== undefined) {
      throw new Error(`GPU ${activeGpuId} sta già minando.`);
    }

    const groupId = parallelGroupId ?? --this.nextGlobalMineGroupId;
    const results = await Promise.allSettled(
      gpuIds.map(async (gpuId) => {
        try {
          await this.mineBlock(gpuId, signal, groupId, message, progressEveryPercent);
        } catch (error) {
          if (!signal.aborted && error instanceof Error && error.name === 'AbortError') {
            this.log(`GPU ${gpuId} fermata: il mining continua sulle altre schede.`, 'warning');
            return;
          }
          throw error;
        }
      }),
    );
    const failure = results.find((result) => result.status === 'rejected');
    if (failure?.status === 'rejected') {
      throw failure.reason;
    }
  }

  private async mineBlock(
    gpuId: number,
    signal: AbortSignal,
    parallelGroupId?: number,
    message: string | false | null = null,
    progressEveryPercent?: number,
  ): Promise<void> {
    signal.throwIfAborted();
    const groupGpuIds =
      parallelGroupId === undefined ? undefined : this.parallelGpuIds.get(parallelGroupId);
    if (this.activeGpuIds().includes(gpuId) || groupGpuIds?.has(gpuId)) {
      throw new Error(`GPU ${gpuId} sta già minando.`);
    }
    if (getGpu(this.world(), gpuId).stopped) {
      this.log(
        `GPU ${gpuId} ferma: mining ignorato. Usa gpu.clearStop() per riavviarla.`,
        'warning',
      );
      return;
    }
    requireOperationalGpu(this.world(), gpuId);
    const miningGpu = getGpu(this.world(), gpuId);
    if (getCryptoProgress(this.world(), miningGpu.cryptoId) === 100) {
      this.world.update(expandWorld);
    }

    const startedAt = Date.now();
    const durationMs = MINING_DURATION_MS / this.speed();
    if (parallelGroupId !== undefined) {
      const participants = groupGpuIds ?? new Set<number>();
      participants.add(gpuId);
      this.parallelGpuIds.set(parallelGroupId, participants);
    }
    const controller = new AbortController();
    const abort = () => controller.abort(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    this.miningControllers.set(gpuId, controller);
    this.miningActions.update((actions) => [
      ...actions,
      { gpuId, startedAt, durationMs, parallelGroupId },
    ]);
    this.mining.set(true);
    let progressBefore = getCryptoProgress(this.world(), miningGpu.cryptoId);
    try {
      await delay(durationMs, controller.signal);
      controller.signal.throwIfAborted();
      const activeGpuIds =
        parallelGroupId === undefined
          ? this.activeGpuIds()
          : Array.from(this.parallelGpuIds.get(parallelGroupId) ?? [gpuId]);
      this.world.update((world) => {
        progressBefore = getCryptoProgress(world, miningGpu.cryptoId);
        return mineGpuOnWorld(
          world,
          gpuId,
          startedAt,
          Date.now(),
          activeGpuIds.length > 1,
          activeGpuIds,
        );
      });
    } catch (error) {
      const fraction = Math.min(1, Math.max(0, (Date.now() - startedAt) / durationMs));
      const activeGpuIds =
        parallelGroupId === undefined
          ? this.activeGpuIds()
          : Array.from(this.parallelGpuIds.get(parallelGroupId) ?? [gpuId]);
      this.world.update((world) =>
        recordGpuWork(world, gpuId, fraction, startedAt, Date.now(), activeGpuIds),
      );
      throw error;
    } finally {
      signal.removeEventListener('abort', abort);
      this.miningControllers.delete(gpuId);
      this.miningActions.update((actions) => actions.filter((action) => action.gpuId !== gpuId));
      const hasActiveMining = this.activeGpuIds().length > 0;
      this.mining.set(hasActiveMining);
      if (!hasActiveMining) {
        this.world.update(settleCompletedBlocks);
      }
      if (
        parallelGroupId !== undefined &&
        !this.miningActions().some((action) => action.parallelGroupId === parallelGroupId)
      ) {
        this.parallelGpuIds.delete(parallelGroupId);
      }
    }

    const gpu = getGpu(this.world(), gpuId);
    if (gpu.stopped) {
      if (message !== false) {
        this.log(
          `GPU ${gpuId} arrestata: ${gpu.stopReason}. Raffredda la scheda e usa clearStop().`,
          'info',
        );
      }
      return;
    }

    const cryptoId = miningGpu.cryptoId;
    const block = getCryptoBlock(this.world(), cryptoId);
    const crypto = CRYPTO_CONFIG.find((item) => item.id === cryptoId)!;
    const cryptoLabel = `${crypto.name} (${crypto.symbol})`;
    const blockNumber = String(block.id).padStart(3, '0');
    const customPrefix = typeof message === 'string' && message ? `${message} · ` : '';
    if (
      message !== false &&
      shouldOutputMineProgress(progressBefore, block.progress, progressEveryPercent)
    ) {
      this.log(
        `${customPrefix}GPU ${gpuId} · ${cryptoLabel} · mine() → blocco #${blockNumber} · ${block.progress.toFixed(2)}%`,
        'output',
      );
    }

    if (isCryptoBlockSettled(this.world(), cryptoId, block.id)) {
      if (message !== false) {
        this.log(
          `${customPrefix}Blocco ${cryptoLabel} #${String(block.id).padStart(3, '0')} estratto! +${crypto.coinsPerBlock} ${crypto.symbol}.`,
          'success',
        );
      }
    }
  }

  private prepareNextBlock(): void {
    if (this.expandable()) {
      this.world.update(expandWorld);
      const id = this.selected().id;
      this.log(`Blocco #${String(id).padStart(3, '0')} pronto. La farm mantiene le stesse GPU.`);
    }
  }

  private powerOnGpus(now: number): void {
    this.world.update((world) => ({
      ...world,
      plots: world.plots.map((plot) => ({
        ...plot,
        rigs: plot.rigs.map((rig) => ({
          ...rig,
          gpus: rig.gpus.map((gpu) => ({
            ...gpu,
            temperatureCelsius: gpuTemperatureWhilePoweredDown(
              gpu,
              now,
              this.rigPoweredDownAt,
              rig.setup,
            ),
            lastUpdatedAt: now,
          })),
        })),
      })),
    }));
  }

  /** Telemetria della singola scheda, inclusi calore e usura dell'azione in corso. */
  gpuTelemetry(gpuId: number) {
    const now = Date.now();
    const world = this.world();
    const gpu = getGpu(world, gpuId);
    const rigSetup = getRig(world, gpu.rigId).setup;
    const action = this.miningActions().find((item) => item.gpuId === gpuId);
    if (!action) {
      return getGpuTelemetry(0, gpu, now, this.running(), this.rigPoweredDownAt, rigSetup);
    }
    const fraction = Math.min(1, Math.max(0, (now - action.startedAt) / action.durationMs));
    const projected = applyGpuWork(gpu, fraction, action.startedAt, now, rigSetup);
    return getGpuTelemetry(1, projected, now, this.running(), this.rigPoweredDownAt, rigSetup);
  }

  setGpuFrequencyGhz(gpuId: number, frequencyGhz: number): void {
    if (this.activeGpuIds().includes(gpuId)) {
      throw new Error('Attendi la fine di mine() prima di cambiare frequenza.');
    }
    this.world.update((world) => setGpuFrequency(world, gpuId, frequencyGhz));
  }

  setGpusCrypto(gpuIds: readonly number[], crypto: string): void {
    if (gpuIds.some((id) => this.activeGpuIds().includes(id))) {
      throw new Error('Attendi la fine di mine() prima di cambiare cripto.');
    }
    if (!this.isResearchUnlocked(requireCrypto(crypto).id)) {
      throw new Error('Sblocca la criptovaluta nell’albero della ricerca.');
    }
    this.world.update((world) => assignGpusCrypto(world, gpuIds, crypto));
  }

  setGpuFanSpeedPercent(gpuId: number, fanSpeedPercent: number | null): void {
    this.world.update((world) => setGpuFanSpeed(world, gpuId, fanSpeedPercent));
  }

  /** Interrompe anche un mine() in corso; lo stop sopravvive alle esecuzioni successive. */
  stopGpu(gpuId: number): void {
    this.world.update((world) => stopGpuOnWorld(world, gpuId));
    const controller = this.miningControllers.get(gpuId);
    if (controller) {
      controller.abort(new Error(`GPU ${gpuId} fermata. Usa clearStop() per riabilitarla.`));
    }
  }

  clearGpuStop(gpuId: number): void {
    if (this.activeGpuIds().includes(gpuId)) {
      throw new Error('Attendi che il mining sia terminato.');
    }
    this.world.update((world) => resumeGpu(world, gpuId));
  }

  readElectricity(): ElectricityReadings {
    const world = this.world();
    const actions = this.miningActions();
    const powerWatts = this.running()
      ? farmPowerWatts(
          world,
          actions.map(({ gpuId }) => gpuId),
        )
      : 0;
    const liveKwh = actions.reduce((energy, action) => {
      const participants = action.parallelGroupId
        ? Array.from(this.parallelGpuIds.get(action.parallelGroupId) ?? [action.gpuId])
        : [action.gpuId];
      const fraction = Math.min(
        1,
        Math.max(0, (Date.now() - action.startedAt) / action.durationMs),
      );
      return (
        energy +
        (farmPowerWatts(world, participants) / participants.length / 1000) *
          GAME_BALANCE.economy.simulatedHoursPerAction *
          fraction
      );
    }, 0);
    const pricePerKwh = GAME_BALANCE.economy.electricityPriceEurPerKwh;
    const pendingCostEur = (world.electricity.pendingKwh + liveKwh) * pricePerKwh;
    return {
      powerWatts,
      energyKwh: world.electricity.energyKwh + liveKwh,
      pendingCostEur,
      totalCostEur: satoshisToEuros(world.electricity.paidSatoshis) + pendingCostEur,
      pricePerKwh,
    };
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

  private persistFiles(): void {
    persistScriptFiles(this.files(), this.activeFileId(), this.code());
  }
}
