import { CRYPTO_CONFIG, cryptoValueEur } from '../config/crypto-config';
import type { MiningWorld } from './mining-world';

/** Spende prima euro, poi cripto ai prezzi fissi del gioco. Nessuna mutazione parziale. */
export function spendEuros(world: MiningWorld, amount: number): MiningWorld {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Importo non valido.');
  if (world.cashEur + cryptoValueEur(world.holdings) + 0.000001 < amount) {
    throw new Error('Saldo insufficiente.');
  }
  const cashSpent = Math.min(Math.max(world.cashEur, 0), amount);
  let remaining = amount - cashSpent;
  const holdings = { ...world.holdings };
  for (const crypto of CRYPTO_CONFIG) {
    if (remaining <= 0.000001) break;
    const owned = holdings[crypto.id] ?? 0;
    const spent = Math.min(owned * crypto.priceEur, remaining);
    holdings[crypto.id] = Math.max(0, owned - spent / crypto.priceEur);
    remaining -= spent;
  }
  return { ...world, cashEur: world.cashEur - cashSpent, holdings };
}
