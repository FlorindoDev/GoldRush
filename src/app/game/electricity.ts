import { GAME_BALANCE } from '../config/game-balance';
import { CRYPTO_CONFIG } from '../config/crypto-config';

const BITCOIN_PRICE_EUR = CRYPTO_CONFIG.find((crypto) => crypto.id === 'bitcoin')!.priceEur;

export interface ElectricityMeter {
  readonly energyKwh: number;
  readonly pendingKwh: number;
  readonly paidSatoshis: number;
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
export function electricityCostSatoshis(energyKwh: number): number {
  const cost =
    ((energyKwh * GAME_BALANCE.economy.electricityPriceEurPerKwh) / BITCOIN_PRICE_EUR) *
    GAME_BALANCE.world.satoshisPerBitcoin;
  // Compensa l'errore binario sui mezzi satoshi (per esempio 102,49999999999999).
  return Math.round(cost + Number.EPSILON * Math.abs(cost) * 4);
}

export function createElectricityMeter(): ElectricityMeter {
  return { energyKwh: 0, pendingKwh: 0, paidSatoshis: 0 };
}
