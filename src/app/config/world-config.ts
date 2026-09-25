export const WORLD_CONFIG = {
  plotCount: 6,
  rigsPerPlot: 6,
  gpusPerRig: 4,
  startingRigCount: 1,
  startingGpuCount: 2,
  // Progresso GPU al completamento della farm.
  progressPerGpuAtFullFarm: 80,
  blockRewardSatoshis: 1_000_000,
  satoshisPerBitcoin: 100_000_000,
} as const;

export const MINING_CONFIG = {
  actionDurationMs: 850,
  blockDifficulty: {
    startingMultiplier: 1,
    increasePerMinedBlock: 0.1,
    maxMultiplier: 5,
  },
} as const;
