import { GPU_MODELS } from './gpu-config';
import { FAN_MODELS, GPU_FAN_MODELS, GPU_FAN_KITS } from './fan-config';
import { FILTER_MODELS } from './dust-filter-config';
import { COOLING_MODELS } from './cooling-config';
import { flattenResearchTree } from './research-tree-config';

export type ShopCategory = 'gpu' | 'fan' | 'filter' | 'rig' | 'cooling';
export interface ShopProduct {
  readonly id: string;
  readonly name: string;
  readonly category: ShopCategory;
  readonly model: string;
  readonly priceEur: number;
  readonly researchId?: string;
  readonly description: string;
  readonly specs: readonly { label: string; value: string }[];
}

export const SHOP_CATEGORIES = [
  { id: 'all', name: 'Tutti i componenti', icon: 'layers' },
  { id: 'gpu', name: 'Schede video', icon: 'gpu' },
  { id: 'fan', name: 'Ventole', icon: 'fan' },
  { id: 'filter', name: 'Filtri', icon: 'filter' },
  { id: 'rig', name: 'RIG', icon: 'rack' },
  { id: 'cooling', name: 'Raffreddamento', icon: 'cooling' },
] as const;

// Prezzi di acquisto simulati, separati dai costi di ricerca.
const GPU_PRICES: Record<string, number> = {
  'gpu-passive': 65,
  'gpu-compact': 140,
  'gpu-dual': 280,
  'gpu-triple': 480,
  'gpu-blower': 320,
  'gpu-liquid': 760,
  'gpu-proart': 560,
  'gpu-nitro': 680,
  'gpu-workstation': 620,
  'gpu-low-profile': 380,
  'gpu-hybrid': 920,
};
const research = flattenResearchTree();
const spec = (label: string, value: string) => ({ label, value });

export const SHOP_PRODUCTS: readonly ShopProduct[] = [
  ...GPU_MODELS.map((gpu): ShopProduct => ({
    id: gpu.id,
    name: gpu.name,
    category: 'gpu',
    model: `assets/models/gpus/${gpu.id}.glb`,
    priceEur: GPU_PRICES[gpu.id],
    researchId: gpu.id,
    description: research.find((node) => node.id === gpu.id)?.description ?? '',
    specs: [
      spec('Frequenza nominale', `${gpu.specifications.mining.frequencyGhz} GHz`),
      spec('Consumo nominale', `${gpu.specifications.mining.powerWatts} W`),
      spec('Ventole', `${gpu.fans}`),
    ],
  })),
  ...FAN_MODELS.map((fan): ShopProduct => ({
    id: fan.id,
    name: fan.name,
    category: 'fan',
    model: `assets/models/fans/${fan.id}.glb`,
    priceEur: [18, 32, 55, 85, 110, 145, 190][fan.tier - 1],
    researchId: fan.id,
    description: 'Ventola per il telaio del RIG. Prezzo per singola unità.',
    specs: [
      spec('Diametro', `${fan.diameterMm} mm`),
      spec('Portata', `${fan.airflowCfm} CFM`),
      spec('Velocità', `${fan.rpm} RPM`),
    ],
  })),
  ...GPU_FAN_MODELS.map((fan, index): ShopProduct => ({
    id: `gpu-fan-${fan.id}`,
    name: GPU_FAN_KITS[fan.id].label,
    category: 'fan',
    model: `assets/models/fans/gpu-fan-${fan.id}.glb`,
    priceEur: [25, 40, 60, 85, 120][index],
    researchId: `gpu-fan-${fan.id}`,
    description: 'Kit di ricambio per le ventole della scheda video.',
    specs: [
      spec('Compatibilità', 'GPU con ventole'),
      spec('Velocità massima', `${GPU_FAN_KITS[fan.id].maxRpm} RPM`),
    ],
  })),
  ...FILTER_MODELS.map((filter, index): ShopProduct => ({
    id: filter.id,
    name: filter.name,
    category: 'filter',
    model: `assets/models/filters/${filter.id}.glb`,
    priceEur: [24, 48, 75][index],
    researchId: filter.id,
    description: 'Pannello antipolvere per il RIG. Riduce lo sporco sulle schede.',
    specs: [
      spec('Polvere trattenuta', `${filter.filterEfficiencyPercent}%`),
      spec('Resistenza termica', `+${filter.airflowResistanceCelsius} °C`),
    ],
  })),
  ...research
    .filter((node) => node.category === 'rig' && node.id !== 'rig')
    .map((node, index): ShopProduct => ({
      id: node.id,
      name: node.name,
      category: 'rig',
      model: node.model,
      priceEur: [120, 240, 320, 360][index],
      researchId: node.id,
      description: node.description,
      specs: [
        spec('Formato', node.id === 'rig-gameplay' ? '4 GPU' : '8 GPU'),
        spec('GPU incluse', 'Nessuna'),
      ],
    })),
  ...COOLING_MODELS.map((cooling, index): ShopProduct => ({
    id: cooling.id,
    name: cooling.name,
    category: 'cooling',
    model: `assets/models/cooling/${cooling.id}.glb`,
    priceEur: [35, 160, 290][index],
    researchId: 'rig-8-frame-bracket',
    description: 'Modulo esterno per il raffreddamento del RIG.',
    specs: [
      spec(
        'Tipo',
        cooling.style === 'liquid' ? 'Liquido' : cooling.style === 'air' ? 'Aria' : 'Supporto',
      ),
    ],
  })),
].sort((a, b) => a.priceEur - b.priceEur);

export const SHOP_PRODUCTS_BY_ID = new Map(SHOP_PRODUCTS.map((product) => [product.id, product]));
export const SHOP_MAX_QUANTITY = 99;
