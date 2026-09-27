export const ECONOMY_CONFIG = {
  // Tariffa del primo giorno. I prezzi successivi sono estratti dopo la bolletta.
  electricityPriceEurPerKwh: 0.3,
  // Soglie di consumo giornaliero (kWh) e intervalli della tariffa per il giorno dopo.
  // Gli estremi sono inclusi; la tariffa varia in centesimi di euro per kWh.
  electricityDailyPriceRanges: [
    { maxDailyKwh: 5, minEurPerKwh: 0.24, maxEurPerKwh: 0.32 },
    { maxDailyKwh: 25, minEurPerKwh: 0.3, maxEurPerKwh: 0.4 },
    { maxDailyKwh: 75, minEurPerKwh: 0.38, maxEurPerKwh: 0.52 },
    { maxDailyKwh: Infinity, minEurPerKwh: 0.5, maxEurPerKwh: 0.68 },
  ],
  // Un'azione completa simula un'ora di lavoro.
  simulatedHoursPerAction: 1,
} as const;

export const CLOCK_CONFIG = {
  // Un secondo reale equivale a due minuti di gioco.
  millisecondsPerGameMinute: 500,
  minutesPerDay: 24 * 60,
} as const;
