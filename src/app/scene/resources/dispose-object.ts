import * as THREE from 'three';

/** Shared clones borrow geometry and materials; their template releases those resources. */
export function disposeObject(object: THREE.Object3D, preserveShared = false): void {
  if (preserveShared && (object.userData['sharedGpu'] || object.userData['sharedModel'])) {
    return;
  }
  if (
    object instanceof THREE.Mesh ||
    object instanceof THREE.LineSegments ||
    object instanceof THREE.Points
  ) {
    if (!object.userData['sharedAssetGeometry']) {
      object.geometry.dispose();
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (
        !object.userData['sharedAssetGeometry'] &&
        'map' in material &&
        material.map instanceof THREE.Texture
      ) {
        material.map.dispose();
      }
      material.dispose();
    }
  }
  for (const child of object.children) {
    disposeObject(child, preserveShared);
  }
}
