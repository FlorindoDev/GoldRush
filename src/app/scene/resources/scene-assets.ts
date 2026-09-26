import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  RIG_WORKBENCH_MODEL_PATH,
  SCENE_MODEL_PATHS,
  type SceneModelId,
} from '../../assets/models/scene-model-paths';
import { RIG_COOLING_METHODS } from '../../config/cooling-config';
import { FAN_MODELS, FAN_MODELS_BY_ID } from '../../config/fan-config';
import { RIG_DUST_SYSTEMS } from '../../config/dust-filter-config';
import { MAX_RIG_FANS, type RigSetup } from '../../config/rig-config';
import { disposeObject } from './dispose-object';

/** Templates own shared geometry/textures; each instance owns its mutable materials. */
export class SceneAssets {
  private readonly templates = new Map<string, THREE.Group>();

  static async load(): Promise<SceneAssets> {
    const assets = new SceneAssets();
    const entries = Object.entries(SCENE_MODEL_PATHS) as [SceneModelId, string][];
    const loader = new GLTFLoader();
    const results = await Promise.allSettled(entries.map(([, path]) => loader.loadAsync(path)));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        assets.templates.set(entries[index][0], result.value.scene);
      }
    });
    if (results.some((result) => result.status === 'rejected')) {
      assets.dispose();
      throw new Error('Caricamento dei modelli GLB della scena non riuscito.');
    }
    return assets;
  }

  instantiate(id: SceneModelId): THREE.Group {
    return this.instantiateTemplate(id, SCENE_MODEL_PATHS[id]);
  }

  async loadRigAssets(): Promise<void> {
    if (this.templates.has('rig-workbench')) {
      return;
    }
    const rigVariants = Object.keys(RIG_DUST_SYSTEMS).flatMap((filterId) =>
      Object.keys(RIG_COOLING_METHODS).map((coolingId) => ({
        id: rigVariantId(filterId, coolingId),
        path: `assets/models/rigs/rig-gameplay-${filterId}-${coolingId}.glb`,
      })),
    );
    const fans = FAN_MODELS.map((fan) => ({
      id: fanAssetId(fan.id),
      path: `assets/models/fans/${fan.id}.glb`,
    }));
    const entries = [
      ...rigVariants,
      ...fans,
      { id: 'rig-workbench', path: RIG_WORKBENCH_MODEL_PATH },
    ];
    const loader = new GLTFLoader();
    const results = await Promise.allSettled(entries.map(({ path }) => loader.loadAsync(path)));
    if (results.some((result) => result.status === 'rejected')) {
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          disposeObject(result.value.scene);
        }
      });
      throw new Error('Caricamento dei modelli del banco rig non riuscito.');
    }
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        this.templates.set(entries[index].id, result.value.scene);
      }
    });
  }

  instantiateRig(setup: RigSetup): THREE.Group {
    const filterId = setup.dustSystemId;
    const coolingId = setup.coolingMethodId;
    const model = this.instantiateTemplate(
      rigVariantId(filterId, coolingId),
      `assets/models/rigs/rig-gameplay-${filterId}-${coolingId}.glb`,
    );
    const fan = this.instantiateTemplate(
      fanAssetId(setup.fanId),
      `assets/models/fans/${setup.fanId}.glb`,
    );
    const activeMounts = new Set(
      Array.from({ length: MAX_RIG_FANS }, (_, index) => index + 1)
        .sort((left, right) => Math.abs(left - 3) - Math.abs(right - 3))
        .slice(0, setup.fanCount),
    );
    const fanScale = 1 / FAN_MODELS_BY_ID[setup.fanId].size;

    for (let index = 1; index <= MAX_RIG_FANS; index++) {
      const mount = model.getObjectByName(`fan-mount-${index}`);
      if (!mount) {
        disposeObject(model);
        disposeObject(fan);
        throw new Error('Rig GLB incompatibile: manca un attacco ventola.');
      }
      for (const child of [...mount.children]) {
        mount.remove(child);
        disposeObject(child);
      }
      mount.visible = activeMounts.has(index);
      if (mount.visible) {
        const mountedFan = fan.clone(true);
        mountedFan.traverse((object) => {
          if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) {
            return;
          }
          object.userData['sharedAssetGeometry'] = true;
          object.material = Array.isArray(object.material)
            ? object.material.map((material) => material.clone())
            : object.material.clone();
        });
        mountedFan.scale.setScalar(fanScale);
        mount.add(mountedFan);
      }
    }
    disposeObject(fan);
    return model;
  }

  instantiateRigWorkbench(): THREE.Group {
    return this.instantiateTemplate('rig-workbench', RIG_WORKBENCH_MODEL_PATH);
  }

  private instantiateTemplate(id: string, path: string): THREE.Group {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Modello non caricato: ${id}`);
    }
    const instance = template.clone(true);
    instance.userData['assetPath'] = path;
    const copies = new Map<THREE.Material, THREE.Material>();
    const cloneMaterial = (material: THREE.Material): THREE.Material => {
      if (!copies.has(material)) {
        copies.set(material, material.clone());
      }
      return copies.get(material)!;
    };
    instance.traverse((object) => {
      if (object instanceof THREE.Mesh || object instanceof THREE.LineSegments) {
        object.userData['sharedAssetGeometry'] = true;
        object.material = Array.isArray(object.material)
          ? object.material.map(cloneMaterial)
          : cloneMaterial(object.material);
        object.castShadow =
          object instanceof THREE.Mesh &&
          (id.startsWith('rig-variant:') ||
            id.startsWith('fan:') ||
            id === 'rig' ||
            id === 'workbench' ||
            id === 'computer' ||
            id === 'gpuFallback' ||
            id === 'rig-workbench');
        object.receiveShadow = object instanceof THREE.Mesh;
      }
    });
    return instance;
  }

  dispose(): void {
    this.templates.forEach((template) => disposeObject(template));
    this.templates.clear();
  }
}

function rigVariantId(filterId: string, coolingId: string): string {
  return `rig-variant:${filterId}:${coolingId}`;
}

function fanAssetId(fanId: string): string {
  return `fan:${fanId}`;
}
