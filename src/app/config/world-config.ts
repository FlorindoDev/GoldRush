export const WORLD_CONFIG = {
  plotCount: 6,
  rigsPerPlot: 6,
  gpusPerRig: 4,
  startingRigCount: 7,
  startingGpuCount: 28,
  // Progresso GPU al completamento della farm.
  progressPerGpuAtFullFarm: 80,
  satoshisPerBitcoin: 100_000_000,
  cryptoBlockDifficulty: {
    bitcoin: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    'ethereum-classic': { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    litecoin: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    dogecoin: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    monero: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    ravencoin: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    ergo: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
    kaspa: { startingMultiplier: 1, increasePerMinedBlock: 0.1, maxMultiplier: 5 },
  },
} as const;

export const MINING_CONFIG = {
  actionDurationMs: 850,
  basePowerPerGpu: 1,
  frequencyPowerExponent: 1,
} as const;
