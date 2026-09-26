/** Prezzi di bilanciamento del gioco, non quotazioni di mercato. */
export const CRYPTO_CONFIG = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', priceEur: 60_000, coinsPerBlock: 0.01 },
  {
    id: 'ethereum-classic',
    symbol: 'ETC',
    name: 'Ethereum Classic',
    priceEur: 20,
    coinsPerBlock: 30,
  },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', priceEur: 80, coinsPerBlock: 7.5 },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', priceEur: 0.1, coinsPerBlock: 6_000 },
  { id: 'monero', symbol: 'XMR', name: 'Monero', priceEur: 150, coinsPerBlock: 4 },
  { id: 'ravencoin', symbol: 'RVN', name: 'Ravencoin', priceEur: 0.02, coinsPerBlock: 30_000 },
  { id: 'ergo', symbol: 'ERG', name: 'Ergo', priceEur: 1, coinsPerBlock: 600 },
  { id: 'kaspa', symbol: 'KAS', name: 'Kaspa', priceEur: 0.1, coinsPerBlock: 6_000 },
] as const;

export type CryptoId = (typeof CRYPTO_CONFIG)[number]['id'];
export type CryptoAmounts = Partial<Record<CryptoId, number>>;

export function requireCrypto(value: string) {
  const key = value.trim().toLowerCase();
  const crypto = CRYPTO_CONFIG.find(
    (item) =>
      item.id === key || item.symbol.toLowerCase() === key || item.name.toLowerCase() === key,
  );
  if (!crypto) {
    throw new Error(
      `Cripto sconosciuta: ${value}. Usa ${CRYPTO_CONFIG.map((item) => item.symbol).join(', ')}.`,
    );
  }
  return crypto;
}

export function cryptoValueEur(holdings: CryptoAmounts): number {
  return CRYPTO_CONFIG.reduce(
    (total, crypto) => total + (holdings[crypto.id] ?? 0) * crypto.priceEur,
    0,
  );
}
