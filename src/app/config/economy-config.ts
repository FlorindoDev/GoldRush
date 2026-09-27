export const ECONOMY_CONFIG = {
  // Tariffa del primo giorno. I prezzi successivi sono estratti dopo la bolletta.
  electricityPriceEurPerKwh: 0.3,
  // Soglie di consumo giornaliero (kWh) e intervalli della tariffa per il giorno dopo.
  // Gli estremi sono inclusi; la tariffa varia in centesimi di euro per kWh.
  electricityDailyPriceRanges: [
    { maxDailyKwh: 120, minEurPerKwh: 0.26, maxEurPerKwh: 0.34 },
    { maxDailyKwh: 600, minEurPerKwh: 0.34, maxEurPerKwh: 0.44 },
    { maxDailyKwh: 2400, minEurPerKwh: 0.44, maxEurPerKwh: 0.58 },
    { maxDailyKwh: Infinity, minEurPerKwh: 0.58, maxEurPerKwh: 0.72 },
  ],
  // Un'azione completa simula un'ora di lavoro.
  simulatedHoursPerAction: 1,
} as const;

export const CLOCK_CONFIG = {
  // Un secondo reale equivale a due minuti di gioco.
  millisecondsPerGameMinute: 500,
  minutesPerDay: 24 * 60,
} as const;
