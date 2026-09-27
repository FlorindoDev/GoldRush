import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';
import type { ModelCatalog } from '../../../assets/models/model-catalog';
import { RIG_MODELS } from '../../../config/rig-model-config';
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
import { createRigLiquidHoses } from '../../models/rig-liquid-hoses';
import { fitGpuModel, gpuSceneWidth } from '../../models/gpu-model';

const publicRoot = new URL('../../../../../public/', import.meta.url);
const catalog: ModelCatalog = JSON.parse(
  readFileSync(new URL('assets/models/catalog.json', publicRoot), 'utf8'),
);

describe('GLB rig footprints', () => {
  it.each(['gpu-liquid', 'gpu-hybrid'] as const)(
    'connects mounted %s ports to the Hydro Tower pump',
    async (modelId) => {
      const loader = new GLTFLoader();
      const load = async (path: string) => {
        const bytes = readFileSync(new URL(path, publicRoot));
        return (
          await loader.parseAsync(
            bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
            '',
          )
        ).scene;
      };
      const rig = createGpuMiningRig(
        1,
        await load('assets/models/rigs/rig-gameplay-none-liquid.glb'),
      );
      rig.root.position.set(4, 0, -3);
      rig.root.rotation.y = 0.4;
      const gpuModel = await load(`assets/models/gpus/${modelId}.glb`);
      fitGpuModel(gpuModel, gpuSceneWidth(modelId));
      const gpu = new THREE.Group();
      gpu.position.copy(rig.slots[0].position);
      gpu.quaternion.copy(rig.slots[0].orientation);
      gpu.add(gpuModel);
      rig.root.add(gpu);
      rig.root.updateMatrixWorld(true);

      const hoses = createRigLiquidHoses(rig.model, [{ slotIndex: 0, gpu }]);
      expect(hoses).not.toBeNull();
      rig.model.add(hoses!);
      expect(hoses!.getObjectByName('coolant-hose-slot-2-in')).toBeUndefined();
      const inlet = gpu.getObjectByName('coolant-in')!;
      const branch = hoses!.getObjectByName(
        'coolant-hose-slot-1-in',
      ) as THREE.Mesh<THREE.TubeGeometry>;
      const manifold = hoses!.getObjectByName(
        'coolant-manifold-in',
      ) as THREE.Mesh<THREE.TubeGeometry>;
      const pumpMount = rig.model.getObjectByName('cooling-mount')!;
      expect(
        branch.geometry.parameters.path
          .getPoint(0)
          .distanceTo(rig.model.worldToLocal(inlet.getWorldPosition(new THREE.Vector3()))),
      ).toBeLessThan(1e-6);
      expect(
        manifold.geometry.parameters.path
          .getPoint(1)
          .distanceTo(
            rig.model.worldToLocal(pumpMount.localToWorld(new THREE.Vector3(1.08, 0.63, -0.16))),
          ),
      ).toBeLessThan(1e-6);
      const airRig = await load('assets/models/rigs/rig-gameplay-none-air.glb');
      expect(createRigLiquidHoses(airRig, [{ slotIndex: 0, gpu }])).toBeNull();
      disposeObject(airRig);
      disposeObject(rig.root);
    },
  );

  it('provides usable sockets, indicators and cables for every selectable starting rig', async () => {
    const loader = new GLTFLoader();
    for (const asset of catalog.models.filter(
      (entry) => entry.id.startsWith('rig-gameplay-') || entry.id.startsWith('rig-runtime-8-'),
    )) {
      const bytes = readFileSync(new URL(asset.path, publicRoot));
      const { scene } = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
      const rig = createGpuMiningRig(1, scene);
      expect(rig.slots, asset.id).toHaveLength(asset.slots!);
      expect(rig.fans.length, asset.id).toBeGreaterThanOrEqual(1);
      expect(new Set(rig.slots.map((slot) => slot.position.x)).size).toBe(asset.slots!);
      disposeObject(rig.root);
    }
  });

  it('exports every purchasable variant with exactly its advertised modules and slots', async () => {
    const loader = new GLTFLoader();
    for (const model of RIG_MODELS) {
      const asset = catalog.models.find((entry) => entry.id === model.id)!;
      expect(asset).toBeDefined();
      const bytes = readFileSync(new URL(asset.path, publicRoot));
      const { scene } = await loader.parseAsync(
        bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
        '',
      );
      expect(createGpuMiningRig(1, scene).slots, model.id).toHaveLength(model.slots);
      expect(scene.getObjectByName('filter-mount')!.children.length > 0, model.id).toBe(
        model.filter !== 'none',
      );
      expect(scene.getObjectByName('cooling-mount')!.children.length > 0, model.id).toBe(
        model.cooling !== 'none',
      );
      for (let index = 1; index <= 5; index++)
        expect(scene.getObjectByName(`fan-mount-${index}`)).toBeDefined();
      disposeObject(scene);
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
