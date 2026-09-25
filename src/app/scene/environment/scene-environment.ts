import * as THREE from 'three';

export function createSceneEnvironment(ground: THREE.Group): THREE.Scene {
  const scene = new THREE.Scene();
  addLighting(scene);
  scene.add(ground);
  return scene;
}

function addLighting(scene: THREE.Scene): void {
  scene.fog = new THREE.FogExp2(0x141c19, 0.024);
  scene.add(new THREE.HemisphereLight(0xe8ffe1, 0x344738, 2.7));

  const sun = new THREE.DirectionalLight(0xffefd5, 4.5);
  sun.position.set(-3, 12, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -15;
  sun.shadow.camera.right = 15;
  sun.shadow.camera.top = 15;
  sun.shadow.camera.bottom = -15;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x9ad4ac, 2.3);
  rim.position.set(5, 7, -8);
  scene.add(rim);
}
