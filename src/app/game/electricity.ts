import { GAME_BALANCE } from '../config/game-balance';
import { CRYPTO_CONFIG } from '../config/crypto-config';

const BITCOIN_PRICE_EUR = CRYPTO_CONFIG.find((crypto) => crypto.id === 'bitcoin')!.priceEur;

export interface ElectricityMeter {
  readonly energyKwh: number;
  readonly pendingKwh: number;
  readonly paidSatoshis: number;
  /** Campi opzionali per gli stati creati prima delle tariffe variabili. */
  readonly priceEurPerKwh?: number;
  readonly lastPriceChangeDay?: number;
}

export interface MiningSettlement {
  readonly cryptoId: string;
  readonly blockId: number;
  readonly coins: number;
  readonly energyKwh: number;
  readonly rewardSatoshis: number;
  readonly electricitySatoshis: number;
  readonly balanceBeforeSatoshis: number;
  readonly balanceAfterSatoshis: number;
  readonly balanceBeforeEur: number;
  readonly balanceAfterEur: number;
}

export interface ElectricityBill {
  readonly gameDay: number;
  readonly energyKwh: number;
  readonly priceEurPerKwh: number;
  readonly electricitySatoshis: number;
  readonly balanceBeforeSatoshis: number;
  readonly balanceAfterSatoshis: number;
  readonly balanceBeforeEur: number;
  readonly balanceAfterEur: number;
}

export function satoshisToEuros(satoshis: number): number {
  return (satoshis / GAME_BALANCE.world.satoshisPerBitcoin) * BITCOIN_PRICE_EUR;
}

/** Un solo arrotondamento a satoshi interi, al saldo del blocco. */
export function electricityCostSatoshis(
  energyKwh: number,
  priceEurPerKwh: number = GAME_BALANCE.economy.electricityPriceEurPerKwh,
): number {
  const cost =
    ((energyKwh * priceEurPerKwh) / BITCOIN_PRICE_EUR) * GAME_BALANCE.world.satoshisPerBitcoin;
  // Compensa l'errore binario sui mezzi satoshi (per esempio 102,49999999999999).
  return Math.round(cost + Number.EPSILON * Math.abs(cost) * 4);
}

export function createElectricityMeter(): ElectricityMeter {
  return {
    energyKwh: 0,
    pendingKwh: 0,
    paidSatoshis: 0,
    priceEurPerKwh: GAME_BALANCE.economy.electricityPriceEurPerKwh,
    lastPriceChangeDay: 0,
  };
}

/** Estrae la tariffa del giorno dopo, escludendo quella attuale quando possibile. */
export function nextElectricityPriceEurPerKwh(
  dailyKwh: number,
  currentPriceEurPerKwh: number,
  random: () => number = Math.random,
): number {
  const ranges = GAME_BALANCE.economy.electricityDailyPriceRanges;
  const range = ranges.find((candidate) => dailyKwh <= candidate.maxDailyKwh) ?? ranges.at(-1)!;
  const minCents = Math.round(range.minEurPerKwh * 100);
  const maxCents = Math.round(range.maxEurPerKwh * 100);
  const currentCents = Math.round(currentPriceEurPerKwh * 100);
  const skipCurrent = currentCents >= minCents && currentCents <= maxCents && minCents < maxCents;
  const optionCount = maxCents - minCents + 1 - Number(skipCurrent);
  const index = Math.floor(Math.min(1 - Number.EPSILON, Math.max(0, random())) * optionCount);
  const cents = minCents + index + (skipCurrent && minCents + index >= currentCents ? 1 : 0);
  return cents / 100;
}
