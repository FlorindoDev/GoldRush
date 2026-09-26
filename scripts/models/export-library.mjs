import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { batchMeshes } from './primitives.mjs';
import { GAME_BALANCE } from '../../src/app/config/game-balance.ts';
import { createPlot, createRigSlot, createWorldFloor } from './environment.mjs';
import { loadBitcoinMaster, createCoin, COIN_MODELS } from './coins.mjs';
import { createFan, createGpuFan, FAN_MODELS, GPU_FAN_MODELS } from './fans.mjs';
import { createGpu, GPU_MODELS } from './gpus.mjs';
import {
  createFilter,
  createExternalCooling,
  createRig,
  FILTER_MODELS,
  COOLING_MODELS,
} from './rigs.mjs';
import { GAMEPLAY_RIG_MODEL_ID, GAMEPLAY_RIG_SETUP } from '../../src/app/config/rig-config.ts';
import { RIG_COOLING_METHODS } from '../../src/app/config/cooling-config.ts';
import { RIG_DUST_SYSTEMS } from '../../src/app/config/dust-filter-config.ts';
import { createWorkbench } from './workshop/workbench-mesh.ts';
import { createRigWorkbench } from './workshop/rig-workbench.ts';
import { createToolArea } from './workshop/tool-area.ts';

const references = [
  {
    name: 'Ventole GPU assiali - ASUS Axial-tech',
    url: 'https://www.asus.com/ie/motherboards-components/graphics-cards/dual/dual-rtx4060ti-o8g-evo/',
  },
  { name: 'Anello delle pale - ARCTIC P12 Max', url: 'https://www.arctic.de/en/blog/p12-max' },
  {
    name: 'GPU professionali · NVIDIA RTX PRO',
    url: 'https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-6000-family/',
  },
  {
    name: 'GPU compatte · ASUS ProArt',
    url: 'https://www.asus.com/us/motherboards-components/graphics-cards/proart/proart-rtx5080-o16g/',
  },
  {
    name: 'GPU con carenatura metallica · Sapphire NITRO+',
    url: 'https://www.sapphiretech.com/en/consumer/nitro-radeon-rx-9070-xt-16g-gddr6',
  },
  { name: 'Ventole spesse · Phanteks T30', url: 'https://phanteks.com/product/t30-120/' },
  ...COIN_MODELS.map((coin) => ({ name: coin.name + ' · mining', url: coin.source })),
  {
    name: 'Telai aperti 8 GPU · Veddha',
    url: 'https://www.ricardo.ch/de/a/mining-rig-frame-veddha-minercase-v4-8-bay-1246445272/',
  },
  { name: 'Ventole · Noctua NF-A12x25', url: 'https://www.noctua.at/en/products/nf-a12x25-pwm' },
  { name: 'Filtri magnetici · DEMCiflex', url: 'https://www.demcifilter.com/How-to-choose' },
  {
    name: 'Radiatori esterni · Watercool MO-RA IV',
    url: 'https://shop.watercool.de/MO-RA-IV-200-Black_1',
  },
  {
    name: 'GPU dual fan · ASUS Dual',
    url: 'https://www.asus.com/ie/motherboards-components/graphics-cards/dual/dual-rtx4060-o8g/',
  },
  {
    name: 'GPU a liquido · MSI SUPRIM LIQUID',
    url: 'https://www.msi.com/Graphics-Card/GeForce-RTX-4090-SUPRIM-LIQUID-X-24G',
  },
];

export async function exportLibrary(save) {
  const entries = [];
  const exporter = new GLTFExporter();
  async function add(id, name, category, root, details = {}, optimize = true) {
    root.name = id;
    root.userData = { ...root.userData, modelId: id };
    if (optimize) {
      batchMeshes(root);
    }
    root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    const data = await exporter.parseAsync(root, { binary: true, onlyVisible: true });
    const bytes = new Uint8Array(data);
    const path = `${category}/${id}.glb`;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    await save(path, btoa(binary));
    entries.push({
      id,
      name,
      category,
      path: `assets/models/${path}`,
      dimensions: bounds.toArray().map((value) => +value.toFixed(3)),
      bytes: bytes.length,
      ...details,
    });
    root.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      const mats = Array.isArray(object.material) ? object.material : [object.material];
      for (const mat of mats) {
        mat?.map?.dispose();
      }
    });
  }

  const filterNames = Object.fromEntries(
    Object.entries(RIG_DUST_SYSTEMS).map(([id, spec]) => [id, spec.name]),
  );
  const coolingNames = Object.fromEntries(
    Object.entries(RIG_COOLING_METHODS).map(([id, spec]) => [id, spec.name]),
  );
  for (const cooling of Object.keys(RIG_COOLING_METHODS)) {
    for (const filter of Object.keys(RIG_DUST_SYSTEMS)) {
      const id = `rig-8-${filter}-${cooling}`;
      await add(
        id,
        `Rig 8 · ${filterNames[filter]} / ${coolingNames[cooling]}`,
        'rigs',
        createRig({ filter, cooling }),
        {
          description:
            'Otto GPU montate, alimentazione doppia e cinque ventole di ingresso. Moduli separati e punti di montaggio nominati.',
          slots: 8,
          filter,
          cooling,
          populated: true,
        },
      );
    }
  }
  for (const cooling of ['none', 'bracket']) {
    await add(
      `rig-8-frame-${cooling}`,
      cooling === 'none' ? 'Rig 8 · Telaio base' : 'Rig 8 · Telaio con supporto esterno',
      'rigs',
      createRig({ cooling, populated: false }),
      {
        description:
          'Telaio vuoto con otto riser, scheda madre, due PSU e attacchi per ventole e filtri.',
        slots: 8,
        cooling,
        filter: 'none',
        populated: false,
      },
    );
  }
  await add(
    'rig-8-frame-filtered',
    'Rig 8 · Telaio filtrato con supporto',
    'rigs',
    createRig({ filter: 'mesh', cooling: 'bracket', populated: false }),
    {
      description:
        'Telaio da otto GPU con filtro magnetico e staffe laterali per raffreddamento esterno.',
      slots: 8,
      filter: 'mesh',
      cooling: 'bracket',
      populated: false,
    },
  );
  for (const spec of FAN_MODELS) {
    await add(spec.id, spec.name, 'fans', createFan(spec), {
      description: `Livello ${spec.tier}/${FAN_MODELS.length}. Rotore indipendente, supporti antivibrazione${spec.tier >= 3 ? ' e griglia protettiva' : ''}. Valori nominali di gioco.`,
      tier: spec.tier,
      rpm: spec.rpm,
      airflowCfm: spec.airflowCfm,
      powerWatts: spec.powerWatts,
      diameterMm: spec.diameterMm,
      blades: spec.blades,
      depth: spec.depth,
      lighting: Boolean(spec.lighting),
      dualRotor: Boolean(spec.dualRotor),
      duct: Boolean(spec.duct),
    });
  }
  for (const spec of GPU_FAN_MODELS) {
    await add(
      `gpu-fan-${spec.id}`,
      `Ventola GPU · ${spec.id}`,
      'fans',
      createGpuFan(spec),
      {
        description: 'Ventola GPU originale low poly. Montabile sulle schede con almeno un rotore.',
        blades: spec.blades,
        profile: spec.profile,
      },
      false,
    );
  }
  for (const spec of GPU_MODELS) {
    await add(spec.id, spec.name, 'gpus', createGpu(spec), {
      description:
        'PCB, contatti PCIe, uscite video, backplate e connettori di alimentazione. Geometria originale.',
      fanCount: spec.fans,
      cooling: spec.style,
      specifications: spec.specifications,
    });
  }
  for (const spec of FILTER_MODELS) {
    await add(spec.id, spec.name, 'filters', createFilter(spec.style), {
      description:
        'Pannello estraibile compatibile con il punto filter-mount di ogni rig da otto GPU.',
      filter: spec.style,
      filterEfficiencyPercent: spec.filterEfficiencyPercent,
      airflowResistanceCelsius: spec.airflowResistanceCelsius,
    });
  }
  for (const spec of COOLING_MODELS) {
    await add(spec.id, spec.name, 'cooling', createExternalCooling(spec.style), {
      description:
        spec.style === 'liquid'
          ? 'Radiatore verticale, due ventole, serbatoio, pompa e raccordi.'
          : spec.style === 'air'
            ? 'Due ventole industriali su telaio esterno con piedini e staffe.'
            : 'Basamento, montanti e attacco per moduli esterni ad aria o liquido.',
      cooling: spec.style,
      ...(spec.specifications ?? {}),
    });
  }
  await add(
    'rig-gameplay',
    `Rig ${GAME_BALANCE.world.gpusPerRig} · Modular`,
    'rigs',
    createRig({
      slotCount: GAME_BALANCE.world.gpusPerRig,
      populated: false,
      installedFans: true,
      fanId: GAMEPLAY_RIG_SETUP.fanId,
    }),
    {
      description:
        'Rig della partita: telaio modulare nello stesso stile della famiglia da otto GPU.',
      slots: GAME_BALANCE.world.gpusPerRig,
      populated: false,
    },
  );
  for (const cooling of Object.keys(RIG_COOLING_METHODS)) {
    for (const filter of Object.keys(RIG_DUST_SYSTEMS)) {
      const id = `rig-gameplay-${filter}-${cooling}`;
      await add(
        id,
        `Rig ${GAME_BALANCE.world.gpusPerRig} · ${filterNames[filter]} / ${coolingNames[cooling]}`,
        'rigs',
        createRig({
          slotCount: GAME_BALANCE.world.gpusPerRig,
          filter,
          cooling,
          populated: false,
          installedFans: true,
          fanId: GAMEPLAY_RIG_SETUP.fanId,
        }),
        {
          description: 'Rig della partita con GPU montate solo quando sbloccate.',
          slots: GAME_BALANCE.world.gpusPerRig,
          filter,
          cooling,
          populated: false,
          isStartingModel: id === GAMEPLAY_RIG_MODEL_ID,
          fanModelId: GAMEPLAY_RIG_SETUP.fanId,
          fanCount: GAMEPLAY_RIG_SETUP.fanCount,
          dustFilterEfficiencyPercent: RIG_DUST_SYSTEMS[filter].filterEfficiencyPercent,
          coolingCelsius: RIG_COOLING_METHODS[cooling].coolingCelsius,
          coolingAirflowCfm: RIG_COOLING_METHODS[cooling].airflowCfm,
          coolingPowerWatts: RIG_COOLING_METHODS[cooling].extraPowerWatts,
        },
      );
    }
  }
  const bench = createWorkbench();
  bench.gpuMount.name = 'gpu-mount';
  bench.ore.name = 'coin-tray-mount';
  bench.root.remove(bench.beam, bench.light, bench.outline);
  await add(
    'workbench',
    'Banco da elettronico',
    'workshop',
    bench.root,
    { description: 'Banco GLB con attrezzi, oscilloscopio e punti di montaggio per GPU e monete.' },
    false,
  );
  await add(
    'rig-workbench',
    'Banco manutenzione rig',
    'workshop',
    createRigWorkbench(),
    {
      description: 'Postazione di servizio rinforzata con tappeto antistatico, morsetti e ricambi.',
    },
    false,
  );
  await add(
    'tool-area',
    'Area officina',
    'environment',
    createToolArea(),
    { description: 'Pavimento e postazioni officina.' },
    false,
  );
  await add(
    'plot',
    'Plot universale',
    'environment',
    createPlot(),
    { description: 'Plot a sei slot, dimensionato per tutti i rig del catalogo.' },
    false,
  );
  await add(
    'rig-slot',
    'Slot rig universale',
    'environment',
    createRigSlot(),
    { description: 'Piazzola compatibile con rig aperti, filtrati e con moduli esterni.' },
    false,
  );
  await add(
    'world-floor',
    'Pavimento della farm',
    'environment',
    createWorldFloor(),
    { description: 'Suolo e griglia della scena.' },
    false,
  );
  const bitcoin = await loadBitcoinMaster();
  const coinSize = new THREE.Box3().setFromObject(bitcoin).getSize(new THREE.Vector3());
  for (const spec of COIN_MODELS) {
    await add(
      spec.id,
      spec.name + ' · ' + spec.ticker,
      'coins',
      spec.id === 'bitcoin' ? bitcoin : createCoin(spec, coinSize),
      {
        description: 'Moneta con forma, diametro e spessore del Bitcoin. ' + spec.algorithm + '.',
        ticker: spec.ticker,
        algorithm: spec.algorithm,
        source: spec.source,
        ...(spec.id === 'bitcoin'
          ? { licensePath: 'assets/models/coins/bitcoin-license.txt' }
          : {}),
      },
      false,
    );
  }
  return {
    version: 2,
    units: 'game units',
    upAxis: 'Y',
    description:
      'Modelli originali low poly. Specifiche delle ventole fittizie per progressione di gioco; nessuna modifica automatica al bilanciamento della partita.',
    references,
    models: entries,
  };
}
