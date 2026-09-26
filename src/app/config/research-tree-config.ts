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

export const RESEARCH_TREE: ResearchNode = {
  id: 'research',
  name: 'Laboratorio',
  category: 'root',
  model: model('rigs', 'rig-gameplay'),
  description: 'Sviluppa la farm sbloccando hardware e nuove valute.',
  costEur: 0,
  initiallyUnlocked: true,
  children: [
    {
      id: 'gpu',
      name: 'Schede video',
      category: 'gpu',
      model: model('gpus', 'gpu-compact'),
      description: 'Modelli di schede video per la farm.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'gpu-compact',
          name: 'Miner S1 · Compact',
          category: 'gpu',
          model: model('gpus', 'gpu-compact'),
          description: 'Scheda iniziale.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'gpu-dual',
              name: 'Miner D2 · Dual',
              category: 'gpu',
              model: model('gpus', 'gpu-dual'),
              description: 'Due ventole e maggior potenza di calcolo.',
              costEur: 120,
              children: [
                {
                  id: 'gpu-triple',
                  name: 'Miner T3 · Triple',
                  category: 'gpu',
                  model: model('gpus', 'gpu-triple'),
                  description: 'Tre ventole per carichi elevati.',
                  costEur: 350,
                  requirements: [{ kind: 'blocks', count: 2 }],
                },
                {
                  id: 'gpu-proart',
                  name: 'Miner A3 · Atelier',
                  category: 'gpu',
                  model: model('gpus', 'gpu-proart'),
                  description: 'Scheda compatta di fascia alta.',
                  costEur: 420,
                  requirements: [{ kind: 'blocks', count: 3 }],
                },
                {
                  id: 'gpu-nitro',
                  name: 'Miner N3 · Neon',
                  category: 'gpu',
                  model: model('gpus', 'gpu-nitro'),
                  description: 'Scheda ad alte prestazioni.',
                  costEur: 520,
                  requirements: [{ kind: 'blocks', count: 4 }],
                },
              ],
            },
            {
              id: 'gpu-blower',
              name: 'Miner B1 · Blower',
              category: 'gpu',
              model: model('gpus', 'gpu-blower'),
              description: 'Espulsione diretta dell’aria calda.',
              costEur: 180,
              children: [
                {
                  id: 'gpu-workstation',
                  name: 'Miner W2 · Workstation',
                  category: 'gpu',
                  model: model('gpus', 'gpu-workstation'),
                  description: 'Scheda professionale.',
                  costEur: 450,
                  requirements: [{ kind: 'blocks', count: 3 }],
                },
                {
                  id: 'gpu-low-profile',
                  name: 'Miner LP2 · Slim',
                  category: 'gpu',
                  model: model('gpus', 'gpu-low-profile'),
                  description: 'Scheda a basso profilo.',
                  costEur: 260,
                },
              ],
            },
            {
              id: 'gpu-passive',
              name: 'Miner P0 · Passive',
              category: 'gpu',
              model: model('gpus', 'gpu-passive'),
              description: 'Scheda iniziale a raffreddamento passivo.',
              costEur: 0,
              initiallyUnlocked: true,
              children: [
                {
                  id: 'gpu-liquid',
                  name: 'Miner L0 · Hydro',
                  category: 'gpu',
                  model: model('gpus', 'gpu-liquid'),
                  description: 'Raffreddamento a liquido.',
                  costEur: 600,
                  requirements: [{ kind: 'node', id: 'rig-8-frame-bracket' }],
                },
                {
                  id: 'gpu-hybrid',
                  name: 'Miner H1 · Hybrid',
                  category: 'gpu',
                  model: model('gpus', 'gpu-hybrid'),
                  description: 'Sistema di raffreddamento ibrido.',
                  costEur: 700,
                  requirements: [{ kind: 'node', id: 'fan-turbine-200' }],
                },
              ],
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
      description: 'Ventole installabili nei RIG.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'fan-airflow-120',
          name: 'Flow 120',
          category: 'fan',
          model: model('fans', 'fan-airflow-120'),
          description: 'Ventola iniziale.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'fan-pressure-140',
              name: 'Pressure 140',
              category: 'fan',
              model: model('fans', 'fan-pressure-140'),
              description: 'Più pressione statica.',
              costEur: 90,
              children: [
                {
                  id: 'fan-industrial-140',
                  name: 'Forge 140',
                  category: 'fan',
                  model: model('fans', 'fan-industrial-140'),
                  description: 'Ventola industriale.',
                  costEur: 210,
                  children: [
                    {
                      id: 'fan-turbine-200',
                      name: 'Cyclone 200',
                      category: 'fan',
                      model: model('fans', 'fan-turbine-200'),
                      description: 'Grande portata d’aria.',
                      costEur: 390,
                      children: [
                        {
                          id: 'fan-rgb-200',
                          name: 'Prism 200',
                          category: 'fan',
                          model: model('fans', 'fan-rgb-200'),
                          description: 'Ventola luminosa ad alta portata.',
                          costEur: 480,
                        },
                        {
                          id: 'fan-counter-200',
                          name: 'Counter 200',
                          category: 'fan',
                          model: model('fans', 'fan-counter-200'),
                          description: 'Doppio flusso controrotante.',
                          costEur: 550,
                          children: [
                            {
                              id: 'fan-server-240',
                              name: 'Server Jet 240',
                              category: 'fan',
                              model: model('fans', 'fan-server-240'),
                              description: 'Ventola più potente.',
                              costEur: 750,
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
    {
      id: 'rig',
      name: 'RIG',
      category: 'rig',
      model: model('rigs', 'rig-gameplay'),
      description: 'Telai per ospitare più schede.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'rig-gameplay',
          name: 'RIG 4 · Modular',
          category: 'rig',
          model: model('rigs', 'rig-gameplay'),
          description: 'RIG iniziale.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'rig-8-frame-none',
              name: 'RIG 8 · Telaio base',
              category: 'rig',
              model: model('rigs', 'rig-8-frame-none'),
              description: 'Telaio più capiente.',
              costEur: 350,
              requirements: [{ kind: 'rigs', count: 7 }],
              children: [
                {
                  id: 'rig-8-frame-bracket',
                  name: 'RIG 8 · Supporto esterno',
                  category: 'rig',
                  model: model('rigs', 'rig-8-frame-bracket'),
                  description: 'Telaio con supporto per raffreddamento.',
                  costEur: 520,
                  requirements: [{ kind: 'node', id: 'fan-pressure-140' }],
                },
                {
                  id: 'rig-8-frame-filtered',
                  name: 'RIG 8 · Telaio filtrato',
                  category: 'rig',
                  model: model('rigs', 'rig-8-frame-filtered'),
                  description: 'Telaio protetto dalla polvere.',
                  costEur: 500,
                  requirements: [{ kind: 'node', id: 'filter-mesh' }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'filter',
      name: 'Filtri',
      category: 'filter',
      model: model('filters', 'filter-mesh'),
      description: 'Protezione antipolvere per i RIG.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'filter-mesh',
          name: 'Filtro magnetico a rete',
          category: 'filter',
          model: model('filters', 'filter-mesh'),
          description: 'Protezione base dalla polvere.',
          costEur: 80,
          children: [
            {
              id: 'filter-pleated',
              name: 'Filtro pieghettato',
              category: 'filter',
              model: model('filters', 'filter-pleated'),
              description: 'Cattura più particelle.',
              costEur: 230,
              children: [
                {
                  id: 'filter-carbon',
                  name: 'Filtro a doppio strato',
                  category: 'filter',
                  model: model('filters', 'filter-carbon'),
                  description: 'Massima filtrazione.',
                  costEur: 440,
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
      description: 'Algoritmi e valute da minare.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'bitcoin',
          name: 'Bitcoin · BTC',
          category: 'crypto',
          model: model('coins', 'bitcoin'),
          description: 'Valuta iniziale.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'litecoin',
              name: 'Litecoin · LTC',
              category: 'crypto',
              model: model('coins', 'litecoin'),
              description: 'Sblocca il mining di Litecoin.',
              costEur: 100,
              children: [
                {
                  id: 'dogecoin',
                  name: 'Dogecoin · DOGE',
                  category: 'crypto',
                  model: model('coins', 'dogecoin'),
                  description: 'Sblocca il mining di Dogecoin.',
                  costEur: 180,
                },
                {
                  id: 'ethereum-classic',
                  name: 'Ethereum Classic · ETC',
                  category: 'crypto',
                  model: model('coins', 'ethereum-classic'),
                  description: 'Sblocca il mining di ETC.',
                  costEur: 250,
                },
              ],
            },
            {
              id: 'monero',
              name: 'Monero · XMR',
              category: 'crypto',
              model: model('coins', 'monero'),
              description: 'Sblocca il mining di Monero.',
              costEur: 300,
              children: [
                {
                  id: 'ravencoin',
                  name: 'Ravencoin · RVN',
                  category: 'crypto',
                  model: model('coins', 'ravencoin'),
                  description: 'Sblocca il mining di Ravencoin.',
                  costEur: 380,
                },
                {
                  id: 'ergo',
                  name: 'Ergo · ERG',
                  category: 'crypto',
                  model: model('coins', 'ergo'),
                  description: 'Sblocca il mining di Ergo.',
                  costEur: 400,
                },
                {
                  id: 'kaspa',
                  name: 'Kaspa · KAS',
                  category: 'crypto',
                  model: model('coins', 'kaspa'),
                  description: 'Sblocca il mining di Kaspa.',
                  costEur: 460,
                  requirements: [{ kind: 'blocks', count: 5 }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

export function flattenResearchTree(root: ResearchNode = RESEARCH_TREE): ResearchNode[] {
  return [root, ...(root.children ?? []).flatMap((child) => flattenResearchTree(child))];
}
