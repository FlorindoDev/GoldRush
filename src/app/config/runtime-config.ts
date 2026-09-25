export const EDITOR_CONFIG = {
  lineEffectDurationMs: 620,
  maxLogEntries: 100,
} as const;

export const SCRIPTING_CONFIG = {
  maxSourceLength: 20_000,
  maxNestingDepth: 64,
  maxExecutionSteps: 100_000,
  yieldEverySteps: 50,
  maxRepeatCount: 1_000,
  maxWaitMs: 5_000,
  maxOutputLength: 2_000,
  maxCollectionSize: 1_000,
} as const;
