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
  description: 'Progetti hardware e valute da minare.',
  costEur: 0,
  initiallyUnlocked: true,
  children: [
    {
      id: 'gpu',
      name: 'Schede video',
      category: 'gpu',
      model: model('gpus', 'gpu-compact'),
      description: 'Schede video con frequenze, consumi e raffreddamento diversi.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'gpu-compact',
          name: 'Miner S1 · Compact',
          category: 'gpu',
          model: model('gpus', 'gpu-compact'),
          description: 'Scheda di base a una ventola, con consumi contenuti.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'gpu-dual',
              name: 'Miner D2 · Dual',
              category: 'gpu',
              model: model('gpus', 'gpu-dual'),
              description:
                'Più veloce della Compact, ma consuma di più. Raffreddamento a due ventole.',
              costEur: 120,
              children: [
                {
                  id: 'gpu-triple',
                  name: 'Miner T3 · Triple',
                  category: 'gpu',
                  model: model('gpus', 'gpu-triple'),
                  description: 'Tre ventole e una frequenza di mining più alta della Dual.',
                  costEur: 350,
                  requirements: [{ kind: 'blocks', count: 2 }],
                },
                {
                  id: 'gpu-proart',
                  name: 'Miner A3 · Atelier',
                  category: 'gpu',
                  model: model('gpus', 'gpu-proart'),
                  description: 'Tre ventole in un telaio compatto.',
                  costEur: 420,
                  requirements: [{ kind: 'blocks', count: 3 }],
                },
                {
                  id: 'gpu-nitro',
                  name: 'Miner N3 · Neon',
                  category: 'gpu',
                  model: model('gpus', 'gpu-nitro'),
                  description:
                    'Frequenza elevata e tre ventole. Richiede più energia della Triple.',
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
              description: 'Una turbina espelle l’aria calda dal retro della scheda.',
              costEur: 180,
              children: [
                {
                  id: 'gpu-workstation',
                  name: 'Miner W2 · Workstation',
                  category: 'gpu',
                  model: model('gpus', 'gpu-workstation'),
                  description: 'Due ventole e più margine di frequenza rispetto alla Blower.',
                  costEur: 450,
                  requirements: [{ kind: 'blocks', count: 3 }],
                },
                {
                  id: 'gpu-low-profile',
                  name: 'Miner LP2 · Slim',
                  category: 'gpu',
                  model: model('gpus', 'gpu-low-profile'),
                  description: 'Formato ribassato a due ventole. Consuma meno della Blower.',
                  costEur: 260,
                },
              ],
            },
            {
              id: 'gpu-passive',
              name: 'Miner P0 · Passive',
              category: 'gpu',
              model: model('gpus', 'gpu-passive'),
              description:
                'Nessuna ventola. Consuma poco, ma il calore si accumula più facilmente.',
              costEur: 0,
              initiallyUnlocked: true,
              children: [
                {
                  id: 'gpu-liquid',
                  name: 'Miner L0 · Hydro',
                  category: 'gpu',
                  model: model('gpus', 'gpu-liquid'),
                  description:
                    'Il circuito a liquido mantiene basse le temperature durante il mining.',
                  costEur: 600,
                  requirements: [{ kind: 'node', id: 'rig-8-frame-bracket' }],
                },
                {
                  id: 'gpu-hybrid',
                  name: 'Miner H1 · Hybrid',
                  category: 'gpu',
                  model: model('gpus', 'gpu-hybrid'),
                  description:
                    'Circuito a liquido e ventola sulla scheda. Consuma meno della Hydro.',
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
      description: 'Ventole da montare sul RIG per raffreddare le schede.',
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
              costEur: 90,
              children: [
                {
                  id: 'fan-industrial-140',
                  name: 'Forge 140',
                  category: 'fan',
                  model: model('fans', 'fan-industrial-140'),
                  description:
                    'Più giri e più portata rispetto alla Pressure 140, con un consumo maggiore.',
                  costEur: 210,
                  children: [
                    {
                      id: 'fan-turbine-200',
                      name: 'Cyclone 200',
                      category: 'fan',
                      model: model('fans', 'fan-turbine-200'),
                      description: 'Turbina da 200 mm per aumentare il flusso d’aria nel RIG.',
                      costEur: 390,
                      children: [
                        {
                          id: 'fan-rgb-200',
                          name: 'Prism 200',
                          category: 'fan',
                          model: model('fans', 'fan-rgb-200'),
                          description:
                            'Ventola da 200 mm con anello luminoso. Più portata della Cyclone.',
                          costEur: 480,
                        },
                        {
                          id: 'fan-counter-200',
                          name: 'Counter 200',
                          category: 'fan',
                          model: model('fans', 'fan-counter-200'),
                          description:
                            'Due rotori controrotanti spingono più aria attraverso il RIG.',
                          costEur: 550,
                          children: [
                            {
                              id: 'fan-server-240',
                              name: 'Server Jet 240',
                              category: 'fan',
                              model: model('fans', 'fan-server-240'),
                              description:
                                'La portata più alta tra le ventole disponibili. Anche il consumo è il più alto.',
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
      description: 'Telai aperti, supporti esterni e varianti filtrate.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'rig-gameplay',
          name: 'RIG 4 · Modular',
          category: 'rig',
          model: model('rigs', 'rig-gameplay'),
          description: 'Telaio aperto a quattro posti. In dotazione all’inizio della partita.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'rig-8-frame-none',
              name: 'RIG 8 · Telaio base',
              category: 'rig',
              model: model('rigs', 'rig-8-frame-none'),
              description: 'Progetto di un telaio aperto a otto posti.',
              costEur: 350,
              requirements: [{ kind: 'rigs', count: 7 }],
              children: [
                {
                  id: 'rig-8-frame-bracket',
                  name: 'RIG 8 · Supporto esterno',
                  category: 'rig',
                  model: model('rigs', 'rig-8-frame-bracket'),
                  description:
                    'Telaio a otto posti con supporto laterale per il raffreddamento esterno.',
                  costEur: 520,
                  requirements: [{ kind: 'node', id: 'fan-pressure-140' }],
                },
                {
                  id: 'rig-8-frame-filtered',
                  name: 'RIG 8 · Telaio filtrato',
                  category: 'rig',
                  model: model('rigs', 'rig-8-frame-filtered'),
                  description: 'Variante a otto posti con pannello filtrante frontale.',
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
              costEur: 230,
              children: [
                {
                  id: 'filter-carbon',
                  name: 'Filtro a doppio strato',
                  category: 'filter',
                  model: model('filters', 'filter-carbon'),
                  description:
                    'La protezione più efficace contro la polvere. Oppone anche più resistenza all’aria.',
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
      description: 'Nuove valute da assegnare alle GPU per il mining.',
      costEur: 0,
      initiallyUnlocked: true,
      children: [
        {
          id: 'bitcoin',
          name: 'Bitcoin · BTC',
          category: 'crypto',
          model: model('coins', 'bitcoin'),
          description: 'La prima valuta disponibile. Le GPU iniziano a minare Bitcoin.',
          costEur: 0,
          initiallyUnlocked: true,
          children: [
            {
              id: 'litecoin',
              name: 'Litecoin · LTC',
              category: 'crypto',
              model: model('coins', 'litecoin'),
              description: 'Permette di assegnare le GPU al mining di Litecoin.',
              costEur: 100,
              children: [
                {
                  id: 'dogecoin',
                  name: 'Dogecoin · DOGE',
                  category: 'crypto',
                  model: model('coins', 'dogecoin'),
                  description: 'Permette di assegnare le GPU al mining di Dogecoin.',
                  costEur: 180,
                },
                {
                  id: 'ethereum-classic',
                  name: 'Ethereum Classic · ETC',
                  category: 'crypto',
                  model: model('coins', 'ethereum-classic'),
                  description: 'Permette di assegnare le GPU al mining di Ethereum Classic.',
                  costEur: 250,
                },
              ],
            },
            {
              id: 'monero',
              name: 'Monero · XMR',
              category: 'crypto',
              model: model('coins', 'monero'),
              description: 'Permette di assegnare le GPU al mining di Monero.',
              costEur: 300,
              children: [
                {
                  id: 'ravencoin',
                  name: 'Ravencoin · RVN',
                  category: 'crypto',
                  model: model('coins', 'ravencoin'),
                  description: 'Permette di assegnare le GPU al mining di Ravencoin.',
                  costEur: 380,
                },
                {
                  id: 'ergo',
                  name: 'Ergo · ERG',
                  category: 'crypto',
                  model: model('coins', 'ergo'),
                  description: 'Permette di assegnare le GPU al mining di Ergo.',
                  costEur: 400,
                },
                {
                  id: 'kaspa',
                  name: 'Kaspa · KAS',
                  category: 'crypto',
                  model: model('coins', 'kaspa'),
                  description: 'Permette di assegnare le GPU al mining di Kaspa.',
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
