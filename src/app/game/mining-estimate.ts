import { requireCrypto } from '../config/crypto-config';
import { GAME_BALANCE } from '../config/game-balance';
import { GPU_MODELS_BY_ID } from '../config/gpu-config';
import {
  gpuMiningPowerWatts,
  gpuMiningProgress,
  gpuTemperature,
  isGpuOperational,
} from './gpu-operation';
import {
  getBlockDifficulty,
  getCryptoBlock,
  getGpu,
  getRig,
  isGpuUnlocked,
  type MiningWorld,
} from './mining-world';

/** Stima a condizioni costanti. Ricavi maturati come lavoro, pagati solo al completamento. */
export function estimateGpuMining(
  world: MiningWorld,
  gpuId: number,
  cryptoName?: string,
  frequencyGhz?: number,
  now = Date.now(),
) {
  const gpu = getGpu(world, gpuId);
  const crypto = requireCrypto(cryptoName ?? gpu.cryptoId);
  const { limits } = GPU_MODELS_BY_ID[gpu.modelId].specifications;
  const frequency = frequencyGhz ?? gpu.targetFrequencyGhz;
  if (
    !Number.isFinite(frequency) ||
    frequency < limits.minFrequencyGhz ||
    frequency > limits.absoluteFrequencyGhz
  ) {
    throw new Error(
      `La frequenza stimata deve essere tra ${limits.minFrequencyGhz} e ${limits.absoluteFrequencyGhz} GHz.`,
    );
  }
  const projected = { ...gpu, targetFrequencyGhz: frequency };
  const rigSetup = getRig(world, gpu.rigId).setup;
  const temperature = gpuTemperature(gpu, now, rigSetup);
  const block = getCryptoBlock(world, crypto.id);
  // A blocco concluso confronta già il prossimo, senza modificare la catena.
  const difficulty = getBlockDifficulty(block.id - 1 + Number(block.progress === 100), crypto.id);
  const available = isGpuUnlocked(world, gpuId) && !gpu.onWorkbench && isGpuOperational(projected);
  const progressPerAction = available
    ? Math.min(100, gpuMiningProgress(projected, temperature) / difficulty)
    : 0;
  const powerWatts = available ? gpuMiningPowerWatts(projected, rigSetup, temperature) : 0;
  const rewardEur = crypto.coinsPerBlock * crypto.priceEur;
  const price = world.electricity.priceEurPerKwh ?? GAME_BALANCE.economy.electricityPriceEurPerKwh;
  const energyCostPerActionEur =
    (powerWatts / 1000) * GAME_BALANCE.economy.simulatedHoursPerAction * price;
  const revenuePerActionEur = (progressPerAction / 100) * rewardEur;
  return {
    crypto: crypto.id,
    unlocked: crypto.research.costEur === 0 || world.unlockedResearchIds.includes(crypto.id),
    difficulty,
    maxDifficulty: crypto.difficulty.maxMultiplier,
    rewardEur,
    progressPerAction,
    powerWatts,
    energyCostPerActionEur,
    revenuePerActionEur,
    profitPerActionEur: revenuePerActionEur - energyCostPerActionEur,
  };
}

export type MiningEstimate = ReturnType<typeof estimateGpuMining>;
