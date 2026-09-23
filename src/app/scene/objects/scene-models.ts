import * as THREE from 'three';

export function fitBitcoinModel(model: THREE.Group): void {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const scale = 0.9 / Math.max(size.x, size.y);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

export function fitGpuModel(model: THREE.Group, width: number): void {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  if (size.z < size.x && size.z < size.y) {
    model.rotation.x -= Math.PI / 2;
  } else if (size.x < size.y && size.x < size.z) {
    model.rotation.z += Math.PI / 2;
  }
  bounds.setFromObject(model).getSize(size);
  if (size.z > size.x) {
    model.rotation.y += Math.PI / 2;
  }
  bounds.setFromObject(model).getSize(size);
  model.scale.multiplyScalar(width / Math.max(size.x, size.z));
  bounds.setFromObject(model);
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

export function addBitcoinStack(model: THREE.Group, target: THREE.Group): void {
  for (let index = 0; index < 5; index++) {
    const coin = model.clone(true);
    coin.userData['sharedModel'] = true;
    coin.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    coin.rotation.x = Math.PI / 2;
    coin.rotation.z = (index % 2) * 0.04;
    coin.position.set((index % 2) * 0.035, 0.04 + index * 0.09, 0);
    target.add(coin);
  }
}
