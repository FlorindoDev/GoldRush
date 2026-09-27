import { GAME_BALANCE } from '../config/game-balance';
import type { Inventory } from './inventory';
import {
  CRYPTO_CONFIG,
  STARTING_CRYPTO_ID,
  cryptoValueEur,
  requireCrypto,
  type CryptoId,
  type CryptoAmounts,
} from '../config/crypto-config';
import { GAMEPLAY_RIG_SETUP, MAX_RIG_FANS, type RigSetup } from '../config/rig-config';
import { FAN_MODELS_BY_ID, gpuFanResearchId, type GpuFanModelId } from '../config/fan-config';
import { RIG_COOLING_METHODS } from '../config/cooling-config';
import { RIG_DUST_SYSTEMS } from '../config/dust-filter-config';
import { maintainGpu, type GpuMaintenanceAction } from './gpu-maintenance';
import {
  applyGpuWork,
  clearGpuStop,
  createGpuOperatingState,
  gpuMiningProgress,
  gpuIdlePowerWatts,
  gpuMiningPowerWatts,
  gpuTemperature,
  isGpuOperational,
  setGpuClock,
  setGpuFanSpeed as setOperatingGpuFanSpeed,
  type GpuOperatingState,
} from './gpu-operation';
import {
  type ElectricityBill,
  createElectricityMeter,
  electricityCostSatoshis,
  nextElectricityPriceEurPerKwh,
  type ElectricityMeter,
  type MiningSettlement,
  satoshisToEuros,
} from './electricity';

export interface MiningBlock {
  readonly id: number;
  readonly progress: number;
}

export interface CryptoChain {
  readonly blocks: readonly MiningBlock[];
  readonly selectedId: number;
  readonly settledBlockIds: readonly number[];
}

export interface MiningGpu extends GpuOperatingState {
  readonly cryptoId: CryptoId;
  readonly id: number;
  readonly rigId: number;
  readonly plotId: number;
  readonly unlocked: boolean;
}

export interface MiningRig {
  readonly id: number;
  readonly plotId: number;
  readonly unlocked: boolean;
  readonly rigProductId?: string;
  readonly setup: RigSetup;
  readonly gpus: readonly MiningGpu[];
}

export interface MiningPlot {
  readonly id: number;
  readonly rigs: readonly MiningRig[];
}

export interface MiningWorld {
  readonly inventory: Inventory;
  /** Alias della catena iniziale per HUD e script senza argomento. */
  readonly blocks: readonly MiningBlock[];
  readonly cryptoChains: Readonly<Record<CryptoId, CryptoChain>>;
  readonly plots: readonly MiningPlot[];
  readonly selectedId: number;
  /** Totale contabile in unità legacy; le quantità possedute sono in holdings. */
  readonly satoshis: number;
  readonly cashEur: number;
  readonly unlockedResearchIds: readonly string[];
  readonly holdings: CryptoAmounts;
  readonly electricity: ElectricityMeter;
  readonly lastSettlement: MiningSettlement | null;
  readonly lastElectricityBill: ElectricityBill | null;
}

export const PLOT_COUNT = GAME_BALANCE.world.plotCount;
export const RIGS_PER_PLOT = GAME_BALANCE.world.rigsPerPlot;
export const GPUS_PER_RIG = GAME_BALANCE.world.gpusPerRig;
export const RIG_COUNT = PLOT_COUNT * RIGS_PER_PLOT;
export const GPU_COUNT = RIG_COUNT * GPUS_PER_RIG;
export const STARTING_RIG_COUNT = GAME_BALANCE.world.startingRigCount;
export const STARTING_GPU_COUNT = GAME_BALANCE.world.startingGpuCount;
export const MINE_PROGRESS_PER_GPU = GAME_BALANCE.mining.baseProgressPerAction;
const BITCOIN = CRYPTO_CONFIG.find((crypto) => crypto.id === 'bitcoin')!;
export const BLOCK_REWARD = cryptoRewardSatoshis(STARTING_CRYPTO_ID);

export function getBlockDifficulty(
  blocksAlreadyMined: number,
  cryptoId: CryptoId = STARTING_CRYPTO_ID,
): number {
  const { startingMultiplier, increasePerMinedBlock, maxMultiplier } =
    requireCrypto(cryptoId).difficulty;
  return Math.min(
    startingMultiplier + Math.max(0, blocksAlreadyMined) * increasePerMinedBlock,
    maxMultiplier,
  );
}

export function cryptoRewardSatoshis(cryptoId: CryptoId): number {
  const crypto = CRYPTO_CONFIG.find((item) => item.id === cryptoId)!;
  return Math.round(
    (crypto.coinsPerBlock * crypto.priceEur * GAME_BALANCE.world.satoshisPerBitcoin) /
      BITCOIN.priceEur,
  );
}

function getCryptoChain(world: MiningWorld, cryptoId: CryptoId): CryptoChain {
  const chain = world.cryptoChains[cryptoId];
  if (
    cryptoId === STARTING_CRYPTO_ID &&
    (world.blocks !== chain.blocks || world.selectedId !== chain.selectedId)
  ) {
    return {
      blocks: world.blocks,
      selectedId: world.selectedId,
      settledBlockIds: chain.settledBlockIds,
    };
  }
  return chain;
}

export function getCryptoBlock(world: MiningWorld, cryptoId: CryptoId): MiningBlock {
  const chain = getCryptoChain(world, cryptoId);
  return chain.blocks.find((block) => block.id === chain.selectedId)!;
}

export function getCryptoProgress(world: MiningWorld, cryptoId: CryptoId): number {
  return getCryptoBlock(world, cryptoId).progress;
}

export function isCryptoBlockSettled(
  world: MiningWorld,
  cryptoId: CryptoId,
  blockId: number,
): boolean {
  return getCryptoChain(world, cryptoId).settledBlockIds.includes(blockId);
}

function withCryptoChain(world: MiningWorld, cryptoId: CryptoId, chain: CryptoChain): MiningWorld {
  const cryptoChains = { ...world.cryptoChains, [cryptoId]: chain };
  return cryptoId === STARTING_CRYPTO_ID
    ? { ...world, cryptoChains, blocks: chain.blocks, selectedId: chain.selectedId }
    : { ...world, cryptoChains };
}

export function createWorld(): MiningWorld {
  const startingBlocks = [{ id: 1, progress: 0 }];
  const cryptoChains = Object.fromEntries(
    CRYPTO_CONFIG.map((crypto) => [
      crypto.id,
      crypto.id === STARTING_CRYPTO_ID
        ? { blocks: startingBlocks, selectedId: 1, settledBlockIds: [] }
        : { blocks: [{ id: 1, progress: 0 }], selectedId: 1, settledBlockIds: [] },
    ]),
  ) as unknown as Record<CryptoId, CryptoChain>;
  return {
    blocks: startingBlocks,
    cryptoChains,
    plots: createPlots(),
    selectedId: 1,
    satoshis: 0,
    cashEur: 0,
    inventory: { items: [], nextId: 1 },
    unlockedResearchIds: [],
    holdings: {},
    electricity: createElectricityMeter(),
    lastSettlement: null,
    lastElectricityBill: null,
  };
}

export function createPlots(): MiningPlot[] {
  return Array.from({ length: PLOT_COUNT }, (_, plotIndex) => {
    const plotId = plotIndex + 1;
    const rigs = Array.from({ length: RIGS_PER_PLOT }, (_, rigIndex) => {
      const rigId = plotIndex * RIGS_PER_PLOT + rigIndex + 1;
      const gpus = Array.from({ length: GPUS_PER_RIG }, (_, gpuIndex) => ({
        ...createGpuOperatingState(),
        cryptoId: STARTING_CRYPTO_ID,
        id: (rigId - 1) * GPUS_PER_RIG + gpuIndex + 1,
        rigId,
        plotId,
        unlocked: (rigId - 1) * GPUS_PER_RIG + gpuIndex + 1 <= STARTING_GPU_COUNT,
      }));
      return {
        id: rigId,
        plotId,
        unlocked: rigId <= STARTING_RIG_COUNT,
        ...(rigId <= STARTING_RIG_COUNT ? { rigProductId: 'rig-gameplay' } : {}),
        setup: { ...GAMEPLAY_RIG_SETUP },
        gpus,
      };
    });
    return { id: plotId, rigs };
  });
}

export function mineGpu(
  world: MiningWorld,
  gpuId: number,
  startedAt = Date.now(),
  endedAt = startedAt,
  deferSettlement = false,
  activeGpuIds: readonly number[] = [gpuId],
): MiningWorld {
  const gpu = requireOperationalGpu(world, gpuId);
  const rigSetup = getRig(world, gpu.rigId).setup;
  const miningPower = gpuMiningProgress(gpu, gpuTemperature(gpu, startedAt, rigSetup));
  const chain = getCryptoChain(world, gpu.cryptoId);
  const block = chain.blocks.find((item) => item.id === chain.selectedId)!;
  if (block.progress >= 100 && activeGpuIds.length < 2) {
    throw new Error('Blocco già completato. Avvia il blocco successivo.');
  }
  const worked = recordGpuWork(world, gpuId, 1, startedAt, endedAt, activeGpuIds);
  if (!isGpuOperational(getGpu(worked, gpuId))) {
    return worked;
  }
  const difficulty = getBlockDifficulty(block.id - 1, gpu.cryptoId);
  const accumulatedProgress = block.progress + miningPower / difficulty;
  const progress = accumulatedProgress >= 100 - 1e-9 ? 100 : accumulatedProgress;
  const result = withCryptoChain(worked, gpu.cryptoId, {
    ...chain,
    blocks: chain.blocks.map((item) => (item.id === block.id ? { ...item, progress } : item)),
  });
  return progress === 100 && !deferSettlement
    ? settleCompletedCryptoBlock(result, gpu.cryptoId)
    : result;
}

/** Liquida la catena iniziale. */
export function settleCompletedBlock(world: MiningWorld): MiningWorld {
  return settleCompletedCryptoBlock(world, STARTING_CRYPTO_ID);
}

/** Liquida un blocco esclusivamente sulla catena della relativa cripto. */
export function settleCompletedCryptoBlock(world: MiningWorld, cryptoId: CryptoId): MiningWorld {
  const chain = getCryptoChain(world, cryptoId);
  const block = chain.blocks.find((item) => item.id === chain.selectedId)!;
  if (block.progress < 100 || chain.settledBlockIds.includes(block.id)) {
    return world;
  }
  const crypto = CRYPTO_CONFIG.find((item) => item.id === cryptoId)!;
  const rewardSatoshis = cryptoRewardSatoshis(cryptoId);
  const balanceAfterSatoshis = world.satoshis + rewardSatoshis;
  const balanceBeforeEur = world.cashEur + cryptoValueEur(world.holdings);
  const holdings = { ...world.holdings };
  holdings[cryptoId] = (holdings[cryptoId] ?? 0) + crypto.coinsPerBlock;
  const balanceAfterEur = world.cashEur + cryptoValueEur(holdings);
  return withCryptoChain(
    {
      ...world,
      holdings,
      satoshis: balanceAfterSatoshis,
      lastSettlement: {
        cryptoId,
        blockId: block.id,
        coins: crypto.coinsPerBlock,
        energyKwh: 0,
        rewardSatoshis,
        electricitySatoshis: 0,
        balanceBeforeSatoshis: world.satoshis,
        balanceAfterSatoshis,
        balanceBeforeEur,
        balanceAfterEur,
      },
    },
    cryptoId,
    {
      ...chain,
      settledBlockIds: [...chain.settledBlockIds, block.id],
    },
  );
}

/** Liquida tutti i blocchi completati da GPU parallele. */
export function settleCompletedBlocks(world: MiningWorld): MiningWorld {
  return CRYPTO_CONFIG.reduce(
    (current, crypto) => settleCompletedCryptoBlock(current, crypto.id),
    world,
  );
}

export function billElectricityForDay(
  world: MiningWorld,
  gameDay: number,
  random: () => number = Math.random,
): MiningWorld {
  if (
    !Number.isInteger(gameDay) ||
    gameDay < 1 ||
    gameDay <=
      Math.max(world.electricity.lastPriceChangeDay ?? 0, world.lastElectricityBill?.gameDay ?? 0)
  ) {
    return world;
  }

  const energyKwh = Math.max(0, world.electricity.pendingKwh);
  const priceEurPerKwh =
    world.electricity.priceEurPerKwh ?? GAME_BALANCE.economy.electricityPriceEurPerKwh;
  const electricitySatoshis = electricityCostSatoshis(energyKwh, priceEurPerKwh);
  const balanceAfterSatoshis = world.satoshis - electricitySatoshis;
  const balanceBeforeEur = world.cashEur + cryptoValueEur(world.holdings);
  const cashEur = world.cashEur - satoshisToEuros(electricitySatoshis);
  const balanceAfterEur = cashEur + cryptoValueEur(world.holdings);
  // Prima si paga alla tariffa corrente; solo dopo si sceglie quella del giorno seguente.
  const nextPriceEurPerKwh = nextElectricityPriceEurPerKwh(energyKwh, priceEurPerKwh, random);
  return {
    ...world,
    satoshis: balanceAfterSatoshis,
    cashEur,
    electricity: {
      ...world.electricity,
      pendingKwh: 0,
      paidSatoshis: world.electricity.paidSatoshis + electricitySatoshis,
      priceEurPerKwh: nextPriceEurPerKwh,
      lastPriceChangeDay: gameDay,
    },
    lastElectricityBill:
      energyKwh > 0
        ? {
            gameDay,
            energyKwh,
            priceEurPerKwh,
            electricitySatoshis,
            balanceBeforeSatoshis: world.satoshis,
            balanceAfterSatoshis,
            balanceBeforeEur,
            balanceAfterEur,
          }
        : world.lastElectricityBill,
  };
}

export function getGpu(world: MiningWorld, gpuId: number): MiningGpu {
  if (!Number.isInteger(gpuId) || gpuId < 1 || gpuId > GPU_COUNT) {
    throw new Error('GPU inesistente.');
  }
  const rigId = rigIdForGpu(gpuId);
  return world.plots[plotIdForRig(rigId) - 1].rigs[(rigId - 1) % RIGS_PER_PLOT].gpus[
    (gpuId - 1) % GPUS_PER_RIG
  ];
}

/** Valida l'intero vettore prima di assegnare: nessuna modifica parziale. */
export function assignGpusCrypto(
  world: MiningWorld,
  gpuIds: readonly number[],
  cryptoName: string,
): MiningWorld {
  const crypto = requireCrypto(cryptoName);
  for (const id of gpuIds) {
    if (!isGpuUnlocked(world, id)) {
      throw new Error(`GPU ${id} bloccata o inesistente.`);
    }
  }
  if (crypto.research.costEur > 0 && !world.unlockedResearchIds.includes(crypto.id)) {
    throw new Error('Sblocca la criptovaluta nell’albero della ricerca.');
  }
  const ids = new Set(gpuIds);
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((gpu) => (ids.has(gpu.id) ? { ...gpu, cryptoId: crypto.id } : gpu)),
      })),
    })),
  };
}

export function getRig(world: MiningWorld, rigId: number): MiningRig {
  if (!Number.isInteger(rigId) || rigId < 1 || rigId > RIG_COUNT) {
    throw new Error('RIG inesistente.');
  }
  const plot = world.plots[plotIdForRig(rigId) - 1];
  return plot.rigs[(rigId - 1) % RIGS_PER_PLOT];
}

export function requireOperationalGpu(world: MiningWorld, gpuId: number): MiningGpu {
  if (!isGpuUnlocked(world, gpuId)) {
    throw new Error('Serve una GPU sbloccata per minare.');
  }
  const gpu = getGpu(world, gpuId);
  if (gpu.onWorkbench) {
    throw new Error(`GPU ${gpuId} sul banco. Rimontala nel RIG prima di mine().`);
  }
  if (!isGpuOperational(gpu)) {
    throw new Error(
      `GPU ${gpuId} ferma: ${gpu.stopReason || 'non operativa'}. Usa clearStop() prima di mine().`,
    );
  }
  return gpu;
}

function updateGpu(
  world: MiningWorld,
  gpuId: number,
  update: (gpu: MiningGpu) => GpuOperatingState,
): MiningWorld {
  if (!isGpuUnlocked(world, gpuId)) {
    throw new Error('GPU o RIG bloccato.');
  }
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        gpus: rig.gpus.map((gpu) => (gpu.id === gpuId ? { ...gpu, ...update(gpu) } : gpu)),
      })),
    })),
  };
}

export function setGpuFrequency(
  world: MiningWorld,
  gpuId: number,
  frequencyGhz: number,
): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => setGpuClock(gpu, frequencyGhz));
}

export function serviceGpu(
  world: MiningWorld,
  gpuId: number,
  action: GpuMaintenanceAction,
): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => {
    const maintained = maintainGpu(gpu, action);
    if (
      action.kind === 'fan' &&
      action.kit !== 'stock' &&
      !world.unlockedResearchIds.includes(gpuFanResearchId(action.kit as GpuFanModelId))
    ) {
      throw new Error('Sblocca questa ventola GPU nell’albero della ricerca.');
    }
    return maintained;
  });
}

export function setGpuWorkbenchState(
  world: MiningWorld,
  gpuId: number,
  onWorkbench: boolean,
  now = Date.now(),
): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => {
    const rigSetup = getRig(world, gpu.rigId).setup;
    return {
      ...gpu,
      temperatureCelsius: gpuTemperature(gpu, now, rigSetup),
      onWorkbench,
      lastUpdatedAt: now,
    };
  });
}

export function configureRig(
  world: MiningWorld,
  rigId: number,
  update: Partial<RigSetup>,
): MiningWorld {
  if (!isRigUnlocked(world, rigId)) {
    throw new Error('RIG bloccato o inesistente.');
  }
  const rig = getRig(world, rigId);
  const setup = { ...rig.setup, ...update };
  if (!Object.hasOwn(FAN_MODELS_BY_ID, setup.fanId)) {
    throw new Error('Modello ventola non disponibile.');
  }
  if (!Object.hasOwn(RIG_DUST_SYSTEMS, setup.dustSystemId)) {
    throw new Error('Filtro antipolvere non disponibile.');
  }
  if (!Object.hasOwn(RIG_COOLING_METHODS, setup.coolingMethodId)) {
    throw new Error('Dissipazione non disponibile.');
  }
  if (!Number.isInteger(setup.fanCount) || setup.fanCount < 0 || setup.fanCount > MAX_RIG_FANS) {
    throw new Error(`Il numero di ventole deve essere tra 0 e ${MAX_RIG_FANS}.`);
  }

  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((item) => (item.id === rigId ? { ...item, setup } : item)),
    })),
  };
}

export function setGpuFanSpeed(
  world: MiningWorld,
  gpuId: number,
  fanSpeedPercent: number | null,
): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => setOperatingGpuFanSpeed(gpu, fanSpeedPercent));
}

export function stopGpu(world: MiningWorld, gpuId: number): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => ({
    ...gpu,
    stopped: true,
    stopReason: gpu.stopReason || 'Stop manuale',
  }));
}

export function resumeGpu(world: MiningWorld, gpuId: number, now = Date.now()): MiningWorld {
  return updateGpu(world, gpuId, (gpu) => clearGpuStop(gpu, now, getRig(world, gpu.rigId).setup));
}

export function recordGpuWork(
  world: MiningWorld,
  gpuId: number,
  fraction: number,
  startedAt: number,
  endedAt: number,
  activeGpuIds: readonly number[] = [gpuId],
): MiningWorld {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('La frazione di lavoro deve essere tra 0 e 1.');
  }
  const activeGpus = activeGpuIds.length ? activeGpuIds : [gpuId];
  const energyKwh =
    (farmPowerWatts(world, activeGpus) / activeGpus.length / 1000) *
    GAME_BALANCE.economy.simulatedHoursPerAction *
    fraction;
  const rigSetup = getRig(world, rigIdForGpu(gpuId)).setup;
  const updated = updateGpu(world, gpuId, (gpu) =>
    applyGpuWork(gpu, fraction, startedAt, endedAt, rigSetup),
  );
  return {
    ...updated,
    electricity: {
      ...world.electricity,
      energyKwh: world.electricity.energyKwh + energyKwh,
      pendingKwh: world.electricity.pendingKwh + energyKwh,
    },
  };
}

/** Potenza delle GPU attive più le altre schede operative in standby. */
export function farmPowerWatts(
  world: MiningWorld,
  activeGpuIds: number | readonly number[] | null,
): number {
  const activeIds = new Set(
    typeof activeGpuIds === 'number' ? [activeGpuIds] : (activeGpuIds ?? []),
  );
  let watts = 0;
  for (const plot of world.plots) {
    for (const rig of plot.rigs) {
      if (!rig.unlocked) {
        continue;
      }
      for (const gpu of rig.gpus) {
        if (
          gpu.unlocked &&
          (activeIds.has(gpu.id) || (!gpu.onWorkbench && isGpuOperational(gpu)))
        ) {
          watts += activeIds.has(gpu.id)
            ? gpuMiningPowerWatts(gpu, rig.setup)
            : gpuIdlePowerWatts(rig.setup, gpu.modelId);
        }
      }
    }
  }
  return watts;
}

export function canExpand(world: MiningWorld): boolean {
  return CRYPTO_CONFIG.some((crypto) => getCryptoBlock(world, crypto.id).progress === 100);
}

export function rigIdForGpu(gpuId: number): number {
  return Math.floor((gpuId - 1) / GPUS_PER_RIG) + 1;
}

export function rigCount(world: MiningWorld): number {
  return world.plots.reduce((count, plot) => count + plot.rigs.length, 0);
}

export function countUnlockedRigs(world: MiningWorld): number {
  return world.plots.reduce(
    (count, plot) => count + plot.rigs.filter((rig) => rig.unlocked).length,
    0,
  );
}

export function countUnlockedGpusInRig(rig: MiningRig): number {
  return rig.unlocked ? rig.gpus.filter((gpu) => gpu.unlocked).length : 0;
}

export function countUnlockedGpus(world: MiningWorld): number {
  return world.plots.reduce(
    (plotTotal, plot) =>
      plotTotal + plot.rigs.reduce((rigTotal, rig) => rigTotal + countUnlockedGpusInRig(rig), 0),
    0,
  );
}

export function isGpuUnlocked(world: MiningWorld, gpuId: number): boolean {
  if (!Number.isInteger(gpuId) || gpuId < 1 || gpuId > GPU_COUNT) {
    return false;
  }

  const rigId = rigIdForGpu(gpuId);
  const plot = world.plots[plotIdForRig(rigId) - 1];
  const rig = plot?.rigs[(rigId - 1) % RIGS_PER_PLOT];
  return Boolean(rig?.unlocked && rig.gpus[(gpuId - 1) % GPUS_PER_RIG]?.unlocked);
}

export function isRigUnlocked(world: MiningWorld, rigId: number): boolean {
  if (!Number.isInteger(rigId) || rigId < 1 || rigId > RIG_COUNT) {
    return false;
  }

  const plot = world.plots[plotIdForRig(rigId) - 1];
  return plot?.rigs[(rigId - 1) % RIGS_PER_PLOT]?.unlocked ?? false;
}

export function plotIdForRig(rigId: number): number {
  return Math.floor((rigId - 1) / RIGS_PER_PLOT) + 1;
}

export function plotIdForGpu(gpuId: number): number {
  return plotIdForRig(rigIdForGpu(gpuId));
}

export function plotCount(world: MiningWorld): number {
  return world.plots.length;
}

export function expandWorld(world: MiningWorld): MiningWorld {
  if (!canExpand(world)) {
    return world;
  }
  let expanded = world;
  for (const crypto of CRYPTO_CONFIG) {
    const chain = getCryptoChain(expanded, crypto.id);
    const currentBlock = chain.blocks.find((block) => block.id === chain.selectedId)!;
    if (currentBlock.progress === 100) {
      const id = chain.blocks.length + 1;
      expanded = settleCompletedCryptoBlock(expanded, crypto.id);
      expanded = withCryptoChain(expanded, crypto.id, {
        blocks: [...chain.blocks, { id, progress: 0 }],
        selectedId: id,
        settledBlockIds: getCryptoChain(expanded, crypto.id).settledBlockIds,
      });
    }
  }
  return expanded;
}
