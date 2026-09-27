import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import type { ModelCatalog } from '../../../assets/models/model-catalog';
import { GAME_BALANCE } from '../../../config/game-balance';
import {
  fitRigInSlot,
  rigPosition,
  rigPlotCenter,
  RIG_PLOT_WIDTH,
  RIG_PLOT_DEPTH,
  RIG_SLOT_WIDTH,
  RIG_SLOT_DEPTH,
} from '../scene-layout';
import { disposeObject } from '../../resources/dispose-object';
import { createGpuMiningRig } from '../../models/gpu-mining-rig';

const publicRoot = new URL('../../../../../public/', import.meta.url);
const catalog: ModelCatalog = JSON.parse(
  readFileSync(new URL('assets/models/catalog.json', publicRoot), 'utf8'),
);

describe('GLB rig footprints', () => {
  it('provides usable sockets, indicators and cables for every selectable starting rig', async () => {
    const loader = new GLTFLoader();
    for (const asset of catalog.models.filter((entry) => entry.id.startsWith('rig-gameplay'))) {
      const bytes = readFileSync(new URL(asset.path, publicRoot));
      const { scene } = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
      const rig = createGpuMiningRig(1, scene);
      expect(rig.slots, asset.id).toHaveLength(GAME_BALANCE.world.gpusPerRig);
      expect(rig.fans.length, asset.id).toBeGreaterThanOrEqual(5);
      expect(new Set(rig.slots.map((slot) => slot.position.x)).size).toBe(
        GAME_BALANCE.world.gpusPerRig,
      );
      disposeObject(rig.root);
    }
  });

  it('fits every full rig into every farm slot without overlapping neighboring slots or plots', async () => {
    const loader = new GLTFLoader();
    for (const asset of catalog.models.filter((entry) => entry.category === 'rigs')) {
      const bytes = readFileSync(new URL(asset.path, publicRoot));
      const { scene } = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
      fitRigInSlot(scene);
      const localBounds = new THREE.Box3().setFromObject(scene);
      const size = localBounds.getSize(new THREE.Vector3());
      expect(size.x, asset.id).toBeLessThanOrEqual(RIG_SLOT_WIDTH - 0.39);
      expect(size.z, asset.id).toBeLessThanOrEqual(RIG_SLOT_DEPTH - 0.39);
      expect(localBounds.min.y).toBeCloseTo(-0.4);
      for (let plotId = 1; plotId <= GAME_BALANCE.world.plotCount; plotId++) {
        const plot = rigPlotCenter(plotId);
        const placed: THREE.Box3[] = [];
        for (let index = 0; index < GAME_BALANCE.world.rigsPerPlot; index++) {
          const id = (plotId - 1) * GAME_BALANCE.world.rigsPerPlot + index + 1;
          const bounds = localBounds.clone().translate(rigPosition(id));
          expect(bounds.min.x).toBeGreaterThan(plot.x - RIG_PLOT_WIDTH / 2);
          expect(bounds.max.x).toBeLessThan(plot.x + RIG_PLOT_WIDTH / 2);
          expect(bounds.min.z).toBeGreaterThan(plot.z - RIG_PLOT_DEPTH / 2);
          expect(bounds.max.z).toBeLessThan(plot.z + RIG_PLOT_DEPTH / 2);
          for (const neighbor of placed) {
            expect(bounds.intersectsBox(neighbor), `${asset.id} slot ${id}`).toBe(false);
          }
          placed.push(bounds);
        }
      }
      disposeObject(scene);
    }
  });
});
