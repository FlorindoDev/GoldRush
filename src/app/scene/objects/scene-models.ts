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
