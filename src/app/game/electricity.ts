import { GAME_BALANCE } from '../config/game-balance';

export interface ElectricityMeter {
  readonly energyKwh: number;
  readonly pendingKwh: number;
  readonly paidSatoshis: number;
}

export interface MiningSettlement {
  readonly blockId: number;
  readonly energyKwh: number;
  readonly rewardSatoshis: number;
  readonly electricitySatoshis: number;
  readonly balanceBeforeSatoshis: number;
  readonly balanceAfterSatoshis: number;
}

export interface ElectricityBill {
  readonly gameDay: number;
  readonly energyKwh: number;
  readonly electricitySatoshis: number;
  readonly balanceBeforeSatoshis: number;
  readonly balanceAfterSatoshis: number;
}

export function satoshisToEuros(satoshis: number): number {
  return (satoshis / GAME_BALANCE.world.satoshisPerBitcoin) * GAME_BALANCE.economy.bitcoinPriceEur;
}

/** Un solo arrotondamento a satoshi interi, al saldo del blocco. */
export function electricityCostSatoshis(energyKwh: number): number {
  const cost =
    ((energyKwh * GAME_BALANCE.economy.electricityPriceEurPerKwh) /
      GAME_BALANCE.economy.bitcoinPriceEur) *
    GAME_BALANCE.world.satoshisPerBitcoin;
  // Compensa l'errore binario sui mezzi satoshi (per esempio 102,49999999999999).
  return Math.round(cost + Number.EPSILON * Math.abs(cost) * 4);
}

export function createElectricityMeter(): ElectricityMeter {
  return { energyKwh: 0, pendingKwh: 0, paidSatoshis: 0 };
}
