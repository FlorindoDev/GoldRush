import { RIG_MODELS } from './rig-model-config';
import { CRYPTO_CONFIG } from './crypto-config';

/** Albero della ricerca. `children` crea i collegamenti; `requirements` aggiunge vincoli extra. */
export type ResearchCategory = 'gpu' | 'fan' | 'rig' | 'filter' | 'crypto';

export type ResearchRequirement =
  | { readonly kind: 'node'; readonly id: string }
  | { readonly kind: 'blocks'; readonly count: number }
  | { readonly kind: 'rigs'; readonly count: number };

export interface ResearchNode {
  readonly id: string;
  readonly name: string;
  readonly category: ResearchCategory | 'root';
  readonly model: string;
  readonly description: string;
  readonly costEur: number;
  readonly requirements?: readonly ResearchRequirement[];
  readonly initiallyUnlocked?: boolean;
  readonly children?: readonly ResearchNode[];
}

const model = (folder: string, id: string) => `assets/models/${folder}/${id}.glb`;

function rigResearchBranch(id: string): ResearchNode {
  const rig = RIG_MODELS.find((entry) => entry.id === id)!;
  return {
    id: rig.id,
    name: rig.name,
    category: 'rig',
    model: model('rigs', rig.id),
    description: rig.description,
    costEur: rig.researchCostEur,
    initiallyUnlocked: id === 'rig-gameplay',
    requirements: [
      ...rig.requiredNodeIds.map((id): ResearchRequirement => ({ kind: 'node', id })),
      ...(id === 'rig-8-frame-none' ? [{ kind: 'rigs' as const, count: 2 }] : []),
    ],
    children: RIG_MODELS.filter((entry) => entry.parentId === id).map((entry) =>
      rigResearchBranch(entry.id),
    ),
  };
}

/** Ogni valuta richiede la precedente; configurazione economica unica in crypto-config. */
function cryptoResearchBranch(index: number): ResearchNode {
  const crypto = CRYPTO_CONFIG[index];
  return {
    id: crypto.id,
    name: `${crypto.name} · ${crypto.symbol}`,
    category: 'crypto',
    model: model('coins', crypto.id),
    description: `${crypto.coinsPerBlock * crypto.priceEur} € per blocco. Difficoltà ${crypto.difficulty.startingMultiplier} → ${crypto.difficulty.maxMultiplier}.`,
    costEur: crypto.research.costEur,
    initiallyUnlocked: index === 0,
    requirements: crypto.research.requiredBlocks
      ? [{ kind: 'blocks', count: crypto.research.requiredBlocks }]
      : [],
    children: index + 1 < CRYPTO_CONFIG.length ? [cryptoResearchBranch(index + 1)] : [],
  };
}

export const RESEARCH_TREE: ResearchNode = {
  id: 'research',
  name: 'Laboratorio',
  category: 'root',
  model: model('rigs', 'rig-gameplay'),
  description: 'Progetti hardware e valute da minare.',
  costEur: 0,
  initiallyUnlocked: true,
  children: [
    {
      id: 'gpu',
      name: 'Schede video',
      category: 'gpu',
      model: model('gpus', 'gpu-passive'),
      description: 'Schede video con frequenze, consumi e raffreddamento diversi.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'gpu-passive',
          name: 'Miner P0 · Passive',
          category: 'gpu',
          model: model('gpus', 'gpu-passive'),
          description: 'Scheda iniziale senza ventole. Consuma poco, ma accumula più calore.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'gpu-compact',
              name: 'Miner S1 · Compact',
              category: 'gpu',
              model: model('gpus', 'gpu-compact'),
              description: 'Prima scheda con ventola: piccola, con consumi contenuti.',
              costEur: 25,
              children: [
                {
                  id: 'gpu-dual',
                  name: 'Miner D2 · Dual',
                  category: 'gpu',
                  model: model('gpus', 'gpu-dual'),
                  description:
                    'Più veloce della Compact, ma consuma di più. Raffreddamento a due ventole.',
                  costEur: 90,
                  children: [
                    {
                      id: 'gpu-triple',
                      name: 'Miner T3 · Triple',
                      category: 'gpu',
                      model: model('gpus', 'gpu-triple'),
                      description: 'Tre ventole e una frequenza di mining più alta della Dual.',
                      costEur: 260,
                      requirements: [{ kind: 'blocks', count: 2 }],
                    },
                    {
                      id: 'gpu-proart',
                      name: 'Miner A3 · Atelier',
                      category: 'gpu',
                      model: model('gpus', 'gpu-proart'),
                      description: 'Tre ventole in un telaio compatto.',
                      costEur: 240,
                      requirements: [{ kind: 'blocks', count: 3 }],
                    },
                    {
                      id: 'gpu-nitro',
                      name: 'Miner N3 · Neon',
                      category: 'gpu',
                      model: model('gpus', 'gpu-nitro'),
                      description:
                        'Frequenza elevata e tre ventole. Richiede più energia della Triple.',
                      costEur: 480,
                      requirements: [{ kind: 'blocks', count: 4 }],
                    },
                  ],
                },
                {
                  id: 'gpu-blower',
                  name: 'Miner B1 · Blower',
                  category: 'gpu',
                  model: model('gpus', 'gpu-blower'),
                  description: 'Una turbina espelle l’aria calda dal retro della scheda.',
                  costEur: 110,
                  children: [
                    {
                      id: 'gpu-workstation',
                      name: 'Miner W2 · Workstation',
                      category: 'gpu',
                      model: model('gpus', 'gpu-workstation'),
                      description: 'Due ventole e più margine di frequenza rispetto alla Blower.',
                      costEur: 350,
                      requirements: [{ kind: 'blocks', count: 3 }],
                    },
                    {
                      id: 'gpu-low-profile',
                      name: 'Miner LP2 · Slim',
                      category: 'gpu',
                      model: model('gpus', 'gpu-low-profile'),
                      description: 'Formato ribassato a due ventole. Consuma meno della Blower.',
                      costEur: 65,
                    },
                  ],
                },
              ],
            },
            {
              id: 'gpu-liquid',
              name: 'Miner L0 · Hydro',
              category: 'gpu',
              model: model('gpus', 'gpu-liquid'),
              description:
                'Waterblock senza ventole: richiede Hydro Tower nel RIG per evitare il surriscaldamento.',
              costEur: 400,
              requirements: [{ kind: 'node', id: 'rig-4-frame-liquid' }],
            },
            {
              id: 'gpu-hybrid',
              name: 'Miner H1 · Hybrid',
              category: 'gpu',
              model: model('gpus', 'gpu-hybrid'),
              description: 'Circuito a liquido e ventola sulla scheda. Consuma meno della Hydro.',
              costEur: 220,
              requirements: [{ kind: 'node', id: 'fan-turbine-200' }],
            },
          ],
        },
      ],
    },
    {
      id: 'fan',
      name: 'Ventole',
      category: 'fan',
      model: model('fans', 'fan-airflow-120'),
      description: 'Ventole GPU e ventole RIG: due sistemi di raffreddamento distinti.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'fan-gpu',
          name: 'Ventole GPU',
          category: 'fan',
          model: model('fans', 'gpu-fan-silent'),
          description: 'Rotori per schede con almeno una ventola, da montare al banco GPU.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'gpu-fan-silent',
              name: 'Silent 90',
              category: 'fan',
              model: model('fans', 'gpu-fan-silent'),
              description: 'Sette pale ampie per un raffreddamento discreto.',
              costEur: 15,
              children: [
                {
                  id: 'gpu-fan-performance',
                  name: 'Axial Flow',
                  category: 'fan',
                  model: model('fans', 'gpu-fan-performance'),
                  description: 'Nove pale e mozzo ridotto per aumentare il flusso.',
                  costEur: 40,
                  children: [
                    {
                      id: 'gpu-fan-pressure',
                      name: 'Pressure Ring',
                      category: 'fan',
                      model: model('fans', 'gpu-fan-pressure'),
                      description:
                        'Anello sulle punte delle pale per spingere aria nel dissipatore.',
                      costEur: 90,
                      children: [
                        {
                          id: 'gpu-fan-industrial',
                          name: 'Forge GPU',
                          category: 'fan',
                          model: model('fans', 'gpu-fan-industrial'),
                          description: 'Rotore rinforzato e griglia per funzionamento continuo.',
                          costEur: 180,
                          children: [
                            {
                              id: 'gpu-fan-server',
                              name: 'Server Jet',
                              category: 'fan',
                              model: model('fans', 'gpu-fan-server'),
                              description: 'Rotore a tredici pale con condotto e portata massima.',
                              costEur: 320,
                              requirements: [{ kind: 'blocks', count: 4 }],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'fan-rig',
          name: 'Ventole RIG',
          category: 'fan',
          model: model('fans', 'fan-airflow-120'),
          description: 'Ventole montate sul telaio dal banco RIG.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'fan-airflow-120',
              name: 'Flow 120',
              category: 'fan',
              model: model('fans', 'fan-airflow-120'),
              description: 'Ventola da 120 mm in dotazione ai primi RIG.',
              costEur: 0,
              initiallyUnlocked: true,
              children: [
                {
                  id: 'fan-pressure-140',
                  name: 'Pressure 140',
                  category: 'fan',
                  model: model('fans', 'fan-pressure-140'),
                  description: 'Sposta più aria della Flow 120. Si monta dal banco RIG.',
                  costEur: 25,
                  children: [
                    {
                      id: 'fan-industrial-140',
                      name: 'Forge 140',
                      category: 'fan',
                      model: model('fans', 'fan-industrial-140'),
                      description:
                        'Più giri e più portata rispetto alla Pressure 140, con un consumo maggiore.',
                      costEur: 75,
                      children: [
                        {
                          id: 'fan-turbine-200',
                          name: 'Cyclone 200',
                          category: 'fan',
                          model: model('fans', 'fan-turbine-200'),
                          description: 'Turbina da 200 mm per aumentare il flusso d’aria nel RIG.',
                          costEur: 160,
                          children: [
                            {
                              id: 'fan-rgb-200',
                              name: 'Prism 200',
                              category: 'fan',
                              model: model('fans', 'fan-rgb-200'),
                              description:
                                'Ventola da 200 mm con anello luminoso. Più portata della Cyclone.',
                              costEur: 220,
                            },
                            {
                              id: 'fan-counter-200',
                              name: 'Counter 200',
                              category: 'fan',
                              model: model('fans', 'fan-counter-200'),
                              description:
                                'Due rotori controrotanti spingono più aria attraverso il RIG.',
                              costEur: 280,
                              children: [
                                {
                                  id: 'fan-server-240',
                                  name: 'Server Jet 240',
                                  category: 'fan',
                                  model: model('fans', 'fan-server-240'),
                                  description:
                                    'La portata più alta tra le ventole disponibili. Anche il consumo è il più alto.',
                                  costEur: 440,
                                  requirements: [{ kind: 'blocks', count: 6 }],
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'rig',
      name: 'RIG',
      category: 'rig',
      model: model('rigs', 'rig-gameplay'),
      description: 'Telai aperti, supporti esterni e varianti filtrate.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [rigResearchBranch('rig-gameplay')],
    },
    {
      id: 'filter',
      name: 'Filtri',
      category: 'filter',
      model: model('filters', 'filter-mesh'),
      description: 'Rallentano l’accumulo di polvere, ma ostacolano il passaggio dell’aria.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'filter-mesh',
          name: 'Filtro magnetico a rete',
          category: 'filter',
          model: model('filters', 'filter-mesh'),
          description: 'Riduce la polvere sulle GPU con una piccola penalità al raffreddamento.',
          costEur: 80,
          children: [
            {
              id: 'filter-pleated',
              name: 'Filtro pieghettato',
              category: 'filter',
              model: model('filters', 'filter-pleated'),
              description:
                'Trattiene più polvere della rete magnetica, ma fa salire la temperatura.',
              costEur: 300,
              children: [
                {
                  id: 'filter-carbon',
                  name: 'Filtro a doppio strato',
                  category: 'filter',
                  model: model('filters', 'filter-carbon'),
                  description:
                    'La protezione più efficace contro la polvere. Oppone anche più resistenza all’aria.',
                  costEur: 600,
                  requirements: [{ kind: 'blocks', count: 4 }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'crypto',
      name: 'Criptovalute',
      category: 'crypto',
      model: model('coins', 'bitcoin'),
      description: 'Nuove valute da assegnare alle GPU per il mining.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [cryptoResearchBranch(0)],
    },
  ],
};

export function flattenResearchTree(root: ResearchNode = RESEARCH_TREE): ResearchNode[] {
  return [root, ...(root.children ?? []).flatMap((child) => flattenResearchTree(child))];
}
