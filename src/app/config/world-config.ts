export const WORLD_CONFIG = {
  plotCount: 6,
  rigsPerPlot: 6,
  gpusPerRig: 4,
  startingRigCount: 1,
  startingGpuCount: 1,
  satoshisPerBitcoin: 100_000_000,
} as const;

export const MINING_CONFIG = {
  actionDurationMs: 850,
  // Percentuale per azione a difficoltà 1 e potenza nominale 1, indipendente dalla capienza farm.
  baseProgressPerAction: 0.8,
  frequencyPowerExponent: 1,
} as const;
