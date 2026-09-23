import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type VectorTuple = [x: number, y: number, z: number];

export function createBox(
  size: [width: number, height: number, depth: number],
  color: number,
  position: VectorTuple,
  rounded = false,
): THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> {
  const radius = Math.min(0.08, Math.min(...size) / 3);
  const geometry = rounded
    ? new RoundedBoxGeometry(...size, 1, radius)
    : new THREE.BoxGeometry(...size);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.15, flatShading: true }),
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createRod(
  start: VectorTuple,
  end: VectorTuple,
  radius: number,
  color: number,
): THREE.Mesh {
  const from = new THREE.Vector3(...start);
  const to = new THREE.Vector3(...end);
  const direction = to.clone().sub(from);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35, flatShading: true }),
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
