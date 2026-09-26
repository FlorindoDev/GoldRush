import * as THREE from 'three';
import { GPU_MODELS_BY_ID, type GpuModelId } from '../../config/gpu-config';
import { SCENE_CONFIG } from '../../config/scene-config';

/** Mantiene le proporzioni tra le schede invece di portarle tutte alla stessa larghezza. */
export function gpuSceneWidth(modelId: GpuModelId): number {
  return (
    (SCENE_CONFIG.gpuModelWidth * GPU_MODELS_BY_ID[modelId].length) /
    GPU_MODELS_BY_ID['gpu-passive'].length
  );
}

export function fitGpuModel(model: THREE.Group, width: number): void {
  orientGpuModel(model);

  const bounds = new THREE.Box3().setFromObject(model);
  const dimensions = bounds.getSize(new THREE.Vector3());
  model.scale.multiplyScalar(width / Math.max(dimensions.x, dimensions.z));
  centerModelAtGround(model);
}

function orientGpuModel(model: THREE.Group): void {
  const initialSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (initialSize.z < initialSize.x && initialSize.z < initialSize.y) {
    model.rotation.x -= Math.PI / 2;
  } else if (initialSize.x < initialSize.y && initialSize.x < initialSize.z) {
    model.rotation.z += Math.PI / 2;
  }

  const rotatedSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
  if (rotatedSize.z > rotatedSize.x) {
    model.rotation.y += Math.PI / 2;
  }
}

function centerModelAtGround(model: THREE.Group): void {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
}

export function styleGpuModel(model: THREE.Group): void {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }
    object.castShadow = true;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        continue;
      }
      material.flatShading = true;
      if (material.name === '.002') {
        material.color.set(0xb8f575);
      }
      material.needsUpdate = true;
    }
  });
}
