import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SCENE_MODEL_PATHS, type SceneModelId } from '../../assets/models/scene-model-paths';
import { disposeObject } from './dispose-object';

/** Templates own shared geometry/textures; each instance owns its mutable materials. */
export class SceneAssets {
  private readonly templates = new Map<SceneModelId, THREE.Group>();

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
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Modello non caricato: ${id}`);
    }
    const instance = template.clone(true);
    instance.userData['assetPath'] = SCENE_MODEL_PATHS[id];
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
          (id === 'rig' || id === 'workbench' || id === 'gpuFallback');
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
