/** Economia simulata: ordine di progressione, premi, difficoltà e ricerca. */
export const CRYPTO_CONFIG = [
  {
    id: 'dogecoin',
    symbol: 'DOGE',
    name: 'Dogecoin',
    priceEur: 0.1,
    coinsPerBlock: 180,
    difficulty: { startingMultiplier: 1, increasePerMinedBlock: 0.14, maxMultiplier: 3.2 },
    research: { costEur: 0, requiredBlocks: 0 },
  },
  {
    id: 'ravencoin',
    symbol: 'RVN',
    name: 'Ravencoin',
    priceEur: 0.02,
    coinsPerBlock: 2250,
    difficulty: { startingMultiplier: 2, increasePerMinedBlock: 0.35, maxMultiplier: 7 },
    research: { costEur: 45, requiredBlocks: 4 },
  },
  {
    id: 'ergo',
    symbol: 'ERG',
    name: 'Ergo',
    priceEur: 1,
    coinsPerBlock: 120,
    difficulty: { startingMultiplier: 4.5, increasePerMinedBlock: 0.75, maxMultiplier: 16 },
    research: { costEur: 160, requiredBlocks: 10 },
  },
  {
    id: 'ethereum-classic',
    symbol: 'ETC',
    name: 'Ethereum Classic',
    priceEur: 20,
    coinsPerBlock: 15,
    difficulty: { startingMultiplier: 9, increasePerMinedBlock: 1.5, maxMultiplier: 36 },
    research: { costEur: 620, requiredBlocks: 20 },
  },
  {
    id: 'monero',
    symbol: 'XMR',
    name: 'Monero',
    priceEur: 150,
    coinsPerBlock: 5,
    difficulty: { startingMultiplier: 18, increasePerMinedBlock: 3.5, maxMultiplier: 80 },
    research: { costEur: 1500, requiredBlocks: 35 },
  },
  {
    id: 'litecoin',
    symbol: 'LTC',
    name: 'Litecoin',
    priceEur: 80,
    coinsPerBlock: 25,
    difficulty: { startingMultiplier: 40, increasePerMinedBlock: 7, maxMultiplier: 180 },
    research: { costEur: 3600, requiredBlocks: 55 },
  },
  {
    id: 'kaspa',
    symbol: 'KAS',
    name: 'Kaspa',
    priceEur: 0.1,
    coinsPerBlock: 60000,
    difficulty: { startingMultiplier: 95, increasePerMinedBlock: 18, maxMultiplier: 440 },
    research: { costEur: 9000, requiredBlocks: 85 },
  },
  {
    id: 'bitcoin',
    symbol: 'BTC',
    name: 'Bitcoin',
    priceEur: 60000,
    coinsPerBlock: 0.3,
    difficulty: { startingMultiplier: 240, increasePerMinedBlock: 45, maxMultiplier: 1200 },
    research: { costEur: 22000, requiredBlocks: 125 },
  },
] as const;

export type CryptoId = (typeof CRYPTO_CONFIG)[number]['id'];
export type CryptoAmounts = Partial<Record<CryptoId, number>>;
export const STARTING_CRYPTO_ID: CryptoId = CRYPTO_CONFIG[0].id;

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
