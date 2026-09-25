export type ModelCategory =
  'rigs' | 'fans' | 'gpus' | 'filters' | 'cooling' | 'workshop' | 'environment' | 'coins';

export interface ModelAsset {
  readonly id: string;
  readonly name: string;
  readonly category: ModelCategory;
  readonly path: string;
  readonly description: string;
  readonly dimensions?: readonly number[];
  readonly bytes?: number;
  readonly slots?: number;
  readonly tier?: number;
  readonly rpm?: number;
  readonly airflowCfm?: number;
  readonly powerWatts?: number;
  readonly diameterMm?: number;
  readonly fanCount?: number;
  readonly filter?: string;
  readonly cooling?: string;
  readonly populated?: boolean;
  readonly licensePath?: string;
  readonly ticker?: string;
  readonly algorithm?: string;
  readonly source?: string;
}

export interface ModelCatalog {
  readonly version: number;
  readonly models: readonly ModelAsset[];
  readonly references: readonly { name: string; url: string }[];
}

export const MODEL_CATEGORIES: readonly { id: ModelCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'Tutti' },
  { id: 'rigs', label: 'Rig e combinazioni' },
  { id: 'fans', label: 'Ventole' },
  { id: 'gpus', label: 'Schede video' },
  { id: 'filters', label: 'Filtri aria' },
  { id: 'cooling', label: 'Raffreddamento esterno' },
  { id: 'coins', label: 'Criptovalute' },
  { id: 'workshop', label: 'Officina' },
  { id: 'environment', label: 'Ambiente e plot' },
];
