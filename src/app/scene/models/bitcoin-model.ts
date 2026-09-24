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
