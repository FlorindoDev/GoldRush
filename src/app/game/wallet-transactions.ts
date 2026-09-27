import {
  CRYPTO_CONFIG,
  STARTING_CRYPTO_ID,
  cryptoValueEur,
} from '../config/crypto-config';
import type { MiningWorld } from './mining-world';

function distributeEuros(holdings: MiningWorld['holdings'], amount: number) {
  const next = { ...holdings };
  const value = cryptoValueEur(holdings);
  if (value <= 0) {
    const crypto = CRYPTO_CONFIG.find((item) => item.id === STARTING_CRYPTO_ID)!;
    next[crypto.id] = (next[crypto.id] ?? 0) + amount / crypto.priceEur;
    return next;
  }

  const growth = amount / value;
  for (const crypto of CRYPTO_CONFIG) {
    const owned = holdings[crypto.id] ?? 0;
    if (owned > 0) next[crypto.id] = owned * (1 + growth);
  }
  return next;
}

/** Redistribuisce euro fra cripto o usa cripto per coprire scoperto, senza cambiare il saldo netto. */
export function reconcileWallet(world: MiningWorld): MiningWorld {
  if (world.cashEur > 0) {
    return {
      ...world,
      cashEur: 0,
      holdings: distributeEuros(world.holdings, world.cashEur),
    };
  }
  if (world.cashEur === 0) return world;

  let debt = -world.cashEur;
  const holdings = { ...world.holdings };
  for (const crypto of CRYPTO_CONFIG) {
    if (debt <= 0) break;
    const owned = holdings[crypto.id] ?? 0;
    const spent = Math.min(owned * crypto.priceEur, debt);
    holdings[crypto.id] = Math.max(0, owned - spent / crypto.priceEur);
    debt -= spent;
  }

  return {
    ...world,
    cashEur: -debt,
    holdings,
  };
}

/** Converte prima le cripto possedute, poi usa euro disponibili. Nessuna mutazione parziale. */
export function spendEuros(world: MiningWorld, amount: number): MiningWorld {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Importo non valido.');
  const reconciled = world.cashEur < 0 ? reconcileWallet(world) : world;
  if (reconciled.cashEur + cryptoValueEur(reconciled.holdings) + 0.000001 < amount) {
    throw new Error('Saldo insufficiente.');
  }
  let remaining = amount;
  const holdings = { ...reconciled.holdings };
  for (const crypto of CRYPTO_CONFIG) {
    if (remaining <= 0.000001) break;
    const owned = holdings[crypto.id] ?? 0;
    const spent = Math.min(owned * crypto.priceEur, remaining);
    holdings[crypto.id] = Math.max(0, owned - spent / crypto.priceEur);
    remaining -= spent;
  }
  return { ...reconciled, holdings };
}

/** Paga bollette con cripto e poi euro; conserva scoperto solo se fondi insufficienti. */
export function chargeEuros(world: MiningWorld, amount: number): MiningWorld {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Importo non valido.');
  const settled = reconcileWallet(world);
  let remaining = amount;
  const holdings = { ...settled.holdings };
  for (const crypto of CRYPTO_CONFIG) {
    if (remaining <= 0) break;
    const owned = holdings[crypto.id] ?? 0;
    const spent = Math.min(owned * crypto.priceEur, remaining);
    holdings[crypto.id] = Math.max(0, owned - spent / crypto.priceEur);
    remaining -= spent;
  }

  const cashSpent = Math.min(Math.max(settled.cashEur, 0), remaining);
  remaining -= cashSpent;
  return {
    ...settled,
    holdings,
    cashEur: settled.cashEur - cashSpent - remaining,
  };
}
