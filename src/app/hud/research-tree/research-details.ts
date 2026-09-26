import { CRYPTO_CONFIG } from '../../config/crypto-config';
import { FILTER_MODELS } from '../../config/dust-filter-config';
import { FAN_MODELS } from '../../config/fan-config';
import { GPU_MODELS } from '../../config/gpu-config';
import type { ResearchNode } from '../../config/research-tree-config';

export interface ResearchStat {
  readonly label: string;
  readonly value: string;
}

const number = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

/** Read nominal values from the same configuration used by the simulation. */
export function researchStats(node: ResearchNode): readonly ResearchStat[] {
  const gpu = GPU_MODELS.find((item) => item.id === node.id);
  if (gpu) {
    return [
      {
        label: 'Frequenza di mining',
        value: `${number.format(gpu.specifications.mining.frequencyGhz)} GHz`,
      },
      {
        label: 'Consumo in mining',
        value: `${number.format(gpu.specifications.mining.powerWatts)} W`,
      },
      { label: 'Limite termico', value: `${gpu.specifications.limits.temperatureCelsius} °C` },
    ];
  }
  const fan = FAN_MODELS.find((item) => item.id === node.id);
  if (fan) {
    return [
      { label: 'Portata d’aria', value: `${fan.airflowCfm} CFM` },
      { label: 'Velocità', value: `${number.format(fan.rpm)} RPM` },
      { label: 'Consumo', value: `${number.format(fan.powerWatts)} W` },
    ];
  }
  const filter = FILTER_MODELS.find((item) => item.id === node.id);
  if (filter) {
    return [
      { label: 'Polvere trattenuta', value: `${filter.filterEfficiencyPercent}%` },
      {
        label: 'Calore aggiuntivo',
        value: `+${number.format(filter.airflowResistanceCelsius)} °C`,
      },
    ];
  }
  const crypto = CRYPTO_CONFIG.find((item) => item.id === node.id);
  if (crypto) {
    return [
      {
        label: 'Ricompensa per blocco',
        value: `${number.format(crypto.coinsPerBlock)} ${crypto.symbol}`,
      },
      {
        label: 'Valore per blocco',
        value: `${number.format(crypto.coinsPerBlock * crypto.priceEur)} €`,
      },
    ];
  }
  return [];
}
