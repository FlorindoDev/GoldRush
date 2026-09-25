export const ECONOMY_CONFIG = {
  bitcoinPriceEur: 60_000,
  electricityPriceEurPerKwh: 0.3,
  // Un'azione completa simula un'ora di lavoro.
  simulatedHoursPerAction: 1,
} as const;

export const CLOCK_CONFIG = {
  // Un secondo reale equivale a due minuti di gioco.
  millisecondsPerGameMinute: 500,
  minutesPerDay: 24 * 60,
} as const;
