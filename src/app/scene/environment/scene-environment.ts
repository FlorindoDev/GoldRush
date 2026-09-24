import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';

const GROUND_SIZE = GAME_BALANCE.scene.groundSize;

export function createSceneEnvironment(): THREE.Scene {
  const scene = new THREE.Scene();
  addLighting(scene);
  addGround(scene);
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

function addGround(scene: THREE.Scene): void {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x19241e, roughness: 1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.5;
  floor.receiveShadow = true;
  scene.add(floor);

  const grid = new THREE.GridHelper(GROUND_SIZE, GROUND_SIZE, 0x35473b, 0x2c3c32);
  grid.position.y = -0.49;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.45;
  scene.add(grid);
}
