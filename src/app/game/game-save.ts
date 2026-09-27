import { createGpuOperatingState } from './gpu-operation';
import { signal } from '@angular/core';
import { CRYPTO_CONFIG, STARTING_CRYPTO_ID } from '../config/crypto-config';
import { FAN_MODELS_BY_ID, GPU_FAN_KITS } from '../config/fan-config';
import { GPU_MODELS_BY_ID } from '../config/gpu-config';
import { RIG_COOLING_METHODS } from '../config/cooling-config';
import { RIG_DUST_SYSTEMS } from '../config/dust-filter-config';
import { MAX_RIG_FANS } from '../config/rig-config';
import { rigSlotCount } from '../config/rig-model-config';
import { SHOP_PRODUCTS_BY_ID } from '../config/shop-config';
import { reconcileWallet } from './wallet-transactions';
import type { GameService } from './game.service';
import {
  GPUS_PER_RIG,
  gpuIdForRigSlot,
  PLOT_COUNT,
  RIGS_PER_PLOT,
  type MiningWorld,
} from './mining-world';
import { clearStoredScriptFiles, type ScriptFile } from './script-storage';

const STORAGE_KEY = 'goldrush-game-save-v1';
const SAVE_VERSION = 1;
const MAX_SAVE_LENGTH = 8_000_000;
const AUTO_SAVE_INTERVAL_MS = 3_000;

export interface GameSave {
  readonly version: 1;
  readonly savedAt: number;
  readonly world: MiningWorld;
  readonly gameElapsedMinutes: number;
  readonly files: readonly ScriptFile[];
  readonly activeFileId: string;
  readonly speed: number;
}

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonnegative(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isRigSetup(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value['fanId'] === 'string' &&
    Object.hasOwn(FAN_MODELS_BY_ID, value['fanId']) &&
    typeof value['coolingMethodId'] === 'string' &&
    Object.hasOwn(RIG_COOLING_METHODS, value['coolingMethodId']) &&
    typeof value['dustSystemId'] === 'string' &&
    Object.hasOwn(RIG_DUST_SYSTEMS, value['dustSystemId']) &&
    Number.isInteger(value['fanCount']) &&
    (value['fanCount'] as number) >= 0 &&
    (value['fanCount'] as number) <= MAX_RIG_FANS
  );
}

function isGpuState(value: unknown): value is RecordValue {
  return (
    isRecord(value) &&
    typeof value['modelId'] === 'string' &&
    Object.hasOwn(GPU_MODELS_BY_ID, value['modelId']) &&
    isFiniteNumber(value['targetFrequencyGhz']) &&
    value['targetFrequencyGhz'] >=
      GPU_MODELS_BY_ID[value['modelId'] as keyof typeof GPU_MODELS_BY_ID].specifications.limits
        .minFrequencyGhz &&
    value['targetFrequencyGhz'] <=
      GPU_MODELS_BY_ID[value['modelId'] as keyof typeof GPU_MODELS_BY_ID].specifications.limits
        .absoluteFrequencyGhz &&
    (value['targetFanSpeedPercent'] === null ||
      (isFiniteNumber(value['targetFanSpeedPercent']) &&
        value['targetFanSpeedPercent'] >= 0 &&
        value['targetFanSpeedPercent'] <= 100)) &&
    isFiniteNumber(value['temperatureCelsius']) &&
    isNonnegative(value['wearPercent']) &&
    isNonnegative(value['dustPercent']) &&
    isNonnegative(value['hoursSinceThermalService']) &&
    typeof value['fanKit'] === 'string' &&
    Object.hasOwn(GPU_FAN_KITS, value['fanKit']) &&
    typeof value['onWorkbench'] === 'boolean' &&
    typeof value['stopped'] === 'boolean' &&
    typeof value['stopReason'] === 'string' &&
    isNonnegative(value['lastUpdatedAt'])
  );
}

function isChain(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value['blocks']) || !value['blocks'].length) return false;
  const blocks = value['blocks'];
  const selectedId = value['selectedId'];
  return (
    isPositiveInteger(selectedId) &&
    blocks.every(
      (block) =>
        isRecord(block) &&
        isPositiveInteger(block['id']) &&
        isFiniteNumber(block['progress']) &&
        block['progress'] >= 0 &&
        block['progress'] <= 100,
    ) &&
    blocks.some((block) => block['id'] === selectedId) &&
    Array.isArray(value['settledBlockIds']) &&
    value['settledBlockIds'].every(isPositiveInteger)
  );
}

function isInventory(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value['items']) || !isPositiveInteger(value['nextId'])) {
    return false;
  }
  const ids = new Set<number>();
  let maxId = 0;
  for (const item of value['items']) {
    if (
      !isRecord(item) ||
      !isPositiveInteger(item['id']) ||
      ids.has(item['id']) ||
      typeof item['productId'] !== 'string' ||
      !SHOP_PRODUCTS_BY_ID.has(item['productId']) ||
      (item['used'] !== undefined && typeof item['used'] !== 'boolean') ||
      (item['gpu'] !== undefined && !isGpuState(item['gpu']))
    ) {
      return false;
    }
    ids.add(item['id']);
    maxId = Math.max(maxId, item['id']);
    if (item['rig'] !== undefined) {
      const rig = item['rig'];
      if (
        !isRecord(rig) ||
        !isRigSetup(rig['setup']) ||
        !Array.isArray(rig['gpus']) ||
        (rig['gpus'].length !== GPUS_PER_RIG &&
          rig['gpus'].length !== rigSlotCount(item['productId'])) ||
        (rig['isNew'] !== undefined && typeof rig['isNew'] !== 'boolean') ||
        !rig['gpus'].every(
          (gpu) =>
            gpu === null ||
            (isRecord(gpu) && isGpuState(gpu['state']) && isCryptoId(gpu['cryptoId'])),
        )
      ) {
        return false;
      }
    }
  }
  return value['nextId'] > maxId;
}

function isCryptoId(value: unknown): boolean {
  return typeof value === 'string' && CRYPTO_CONFIG.some((crypto) => crypto.id === value);
}

function isSettlement(value: unknown): boolean {
  if (!isRecord(value) || !isCryptoId(value['cryptoId'])) return false;
  return (
    isPositiveInteger(value['blockId']) &&
    isNonnegative(value['coins']) &&
    isNonnegative(value['energyKwh']) &&
    isNonnegative(value['rewardSatoshis']) &&
    isNonnegative(value['electricitySatoshis']) &&
    isFiniteNumber(value['balanceBeforeSatoshis']) &&
    isFiniteNumber(value['balanceAfterSatoshis']) &&
    isFiniteNumber(value['balanceBeforeEur']) &&
    isFiniteNumber(value['balanceAfterEur'])
  );
}

function isElectricityBill(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    isPositiveInteger(value['gameDay']) &&
    isNonnegative(value['energyKwh']) &&
    isNonnegative(value['priceEurPerKwh']) &&
    isNonnegative(value['electricitySatoshis']) &&
    isFiniteNumber(value['balanceBeforeSatoshis']) &&
    isFiniteNumber(value['balanceAfterSatoshis']) &&
    isFiniteNumber(value['balanceBeforeEur']) &&
    isFiniteNumber(value['balanceAfterEur'])
  );
}

function isWorld(value: unknown): value is MiningWorld {
  if (!isRecord(value) || !isRecord(value['cryptoChains'])) return false;
  const chains = value['cryptoChains'];
  if (!CRYPTO_CONFIG.every((crypto) => isChain(chains[crypto.id]))) return false;
  if (!Array.isArray(value['plots']) || value['plots'].length !== PLOT_COUNT) return false;
  for (let plotIndex = 0; plotIndex < PLOT_COUNT; plotIndex++) {
    const plot = value['plots'][plotIndex];
    if (
      !isRecord(plot) ||
      plot['id'] !== plotIndex + 1 ||
      !Array.isArray(plot['rigs']) ||
      plot['rigs'].length !== RIGS_PER_PLOT
    ) {
      return false;
    }
    for (let rigIndex = 0; rigIndex < RIGS_PER_PLOT; rigIndex++) {
      const rig = plot['rigs'][rigIndex];
      const rigId = plotIndex * RIGS_PER_PLOT + rigIndex + 1;
      if (
        !isRecord(rig) ||
        rig['id'] !== rigId ||
        rig['plotId'] !== plot['id'] ||
        typeof rig['unlocked'] !== 'boolean' ||
        (rig['rigProductId'] !== undefined &&
          (typeof rig['rigProductId'] !== 'string' ||
            (rig['rigProductId'] !== 'rig-gameplay' &&
              !SHOP_PRODUCTS_BY_ID.has(rig['rigProductId'])))) ||
        !isRigSetup(rig['setup']) ||
        !Array.isArray(rig['gpus']) ||
        (rig['gpus'].length !== GPUS_PER_RIG &&
          rig['gpus'].length !== rigSlotCount(rig['rigProductId'] as string | undefined))
      ) {
        return false;
      }
      for (let slot = 0; slot < rig['gpus'].length; slot++) {
        const gpu = rig['gpus'][slot];
        if (
          !isGpuState(gpu) ||
          gpu['id'] !== gpuIdForRigSlot(rigId, slot) ||
          gpu['rigId'] !== rigId ||
          gpu['plotId'] !== plot['id'] ||
          typeof gpu['unlocked'] !== 'boolean' ||
          !isCryptoId(gpu['cryptoId'])
        ) {
          return false;
        }
      }
    }
  }
  const electricity = value['electricity'];
  const holdings = value['holdings'];
  return (
    isInventory(value['inventory']) &&
    isFiniteNumber(value['satoshis']) &&
    isFiniteNumber(value['cashEur']) &&
    Array.isArray(value['unlockedResearchIds']) &&
    value['unlockedResearchIds'].every((id: unknown) => typeof id === 'string') &&
    isRecord(holdings) &&
    Object.entries(holdings).every(([id, amount]) => isCryptoId(id) && isNonnegative(amount)) &&
    isRecord(electricity) &&
    isNonnegative(electricity['energyKwh']) &&
    isNonnegative(electricity['pendingKwh']) &&
    isNonnegative(electricity['paidSatoshis']) &&
    isNonnegative(electricity['priceEurPerKwh']) &&
    isNonnegative(electricity['lastPriceChangeDay']) &&
    (value['lastSettlement'] === null || isSettlement(value['lastSettlement'])) &&
    (value['lastElectricityBill'] === null || isElectricityBill(value['lastElectricityBill']))
  );
}

function isScriptFiles(value: unknown): value is ScriptFile[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const file of value) {
    if (
      !isRecord(file) ||
      typeof file['id'] !== 'string' ||
      !file['id'] ||
      typeof file['name'] !== 'string' ||
      file['name'].length > 64 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9 _.-]*\.mine$/.test(file['name']) ||
      typeof file['code'] !== 'string' ||
      ids.has(file['id']) ||
      names.has(file['name'].toLowerCase())
    ) {
      return false;
    }
    ids.add(file['id']);
    names.add(file['name'].toLowerCase());
  }
  return true;
}

function restoredWorld(world: MiningWorld): MiningWorld {
  const wallet = reconcileWallet(world);
  const initialChain = world.cryptoChains[STARTING_CRYPTO_ID];
  return {
    ...wallet,
    blocks: initialChain.blocks,
    selectedId: initialChain.selectedId,
    inventory: {
      ...world.inventory,
      items: world.inventory.items.map((item) =>
        item.rig
          ? {
              ...item,
              rig: {
                ...item.rig,
                gpus: Array.from(
                  { length: rigSlotCount(item.productId) },
                  (_, index) => item.rig!.gpus[index] ?? null,
                ),
              },
            }
          : item,
      ),
    },
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: Array.from({ length: rigSlotCount(rig.rigProductId) }, (_, index) => ({
          ...(rig.gpus[index] ?? {
            ...createGpuOperatingState(),
            id: gpuIdForRigSlot(rig.id, index),
            rigId: rig.id,
            plotId: rig.plotId,
            cryptoId: STARTING_CRYPTO_ID,
            unlocked: false,
          }),
          onWorkbench: false,
        })),
      })),
    })),
  };
}

export function parseGameSave(text: string): GameSave {
  if (text.length > MAX_SAVE_LENGTH) throw new Error('File troppo grande per un salvataggio.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Il file non contiene un salvataggio JSON valido.');
  }
  if (!isRecord(value) || value['version'] !== SAVE_VERSION) {
    throw new Error('Versione del salvataggio non supportata.');
  }
  if (
    !isFiniteNumber(value['savedAt']) ||
    !isWorld(value['world']) ||
    !isNonnegative(value['gameElapsedMinutes']) ||
    !isScriptFiles(value['files']) ||
    typeof value['activeFileId'] !== 'string' ||
    !value['files'].some((file) => file.id === value['activeFileId']) ||
    (value['speed'] !== 1 && value['speed'] !== 2)
  ) {
    throw new Error('Salvataggio incompleto o danneggiato.');
  }
  return { ...(value as unknown as GameSave), world: restoredWorld(value['world']) };
}

export function loadGameSave(storage?: Pick<Storage, 'getItem'>): GameSave | null {
  try {
    const text = (storage ?? localStorage).getItem(STORAGE_KEY);
    return text ? parseGameSave(text) : null;
  } catch {
    return null;
  }
}

export function saveGame(save: GameSave, storage?: Pick<Storage, 'setItem'>): void {
  (storage ?? localStorage).setItem(STORAGE_KEY, JSON.stringify(save));
}

export function clearGameSave(storage?: Pick<Storage, 'removeItem'>): void {
  (storage ?? localStorage).removeItem(STORAGE_KEY);
}

export class GameSaveManager {
  readonly error = signal<string | null>(null);
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(private readonly game: GameService) {
    this.timer = setInterval(this.flush, AUTO_SAVE_INTERVAL_MS);
    window.addEventListener('pagehide', this.flush);
  }

  destroy(): void {
    this.flush();
    clearInterval(this.timer);
    window.removeEventListener('pagehide', this.flush);
  }

  readonly flush = (): boolean => {
    try {
      saveGame(this.game.createSave());
      this.error.set(null);
      return true;
    } catch {
      this.error.set('Salvataggio locale non disponibile in questo browser.');
      return false;
    }
  };

  reset(): boolean {
    this.game.resetSavedGame();
    let cleared = true;
    try {
      clearGameSave();
      clearStoredScriptFiles();
    } catch {
      cleared = false;
    }
    const saved = this.flush();
    if (!cleared) {
      this.error.set('Impossibile eliminare tutti i vecchi file salvati nel browser.');
    }
    return cleared && saved;
  }

  download(): void {
    if (this.game.running()) throw new Error('Ferma il programma prima di esportare la partita.');
    const save = this.game.createSave();
    const contents = JSON.stringify(save);
    if (contents.length > MAX_SAVE_LENGTH) throw new Error('Salvataggio troppo grande.');
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `goldrush-save-${new Date(save.savedAt).toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async importFile(file: File): Promise<boolean> {
    if (this.game.running()) throw new Error('Ferma il programma prima di importare la partita.');
    if (file.size > MAX_SAVE_LENGTH) throw new Error('File troppo grande per un salvataggio.');
    const save = parseGameSave(await file.text());
    this.game.restoreSave(save);
    return this.flush();
  }
}
