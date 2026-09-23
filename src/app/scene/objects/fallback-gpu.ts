import * as THREE from 'three';
import { createBox } from './mesh-primitives';

const FAN_POSITIONS = [-0.75, 0.75];
const FAN_BLADE_COUNT = 8;

export function createFallbackGpu(width: number): THREE.Group {
  const gpu = new THREE.Group();
  gpu.scale.setScalar(width / 3);
  gpu.add(createBox([3.0, 0.35, 1.45], 0x232b29, [0, 0.25, 0], true));
  gpu.add(createBox([2.8, 0.07, 1.52], 0xa5d877, [0, 0.08, 0]));
  for (const fanX of FAN_POSITIONS) {
    addCoolingFan(gpu, fanX);
  }
  return gpu;
}

function addCoolingFan(gpu: THREE.Group, x: number): void {
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.56, 0.56, 0.08, 12),
    new THREE.MeshStandardMaterial({ color: 0x101715 }),
  );
  rim.position.set(x, 0.46, 0);
  gpu.add(rim);

  for (let bladeIndex = 0; bladeIndex < FAN_BLADE_COUNT; bladeIndex++) {
    const angle = (bladeIndex * Math.PI) / (FAN_BLADE_COUNT / 2);
    const blade = createBox([0.42, 0.05, 0.15], 0x68736e, [
      x + Math.cos(angle) * 0.24,
      0.52,
      Math.sin(angle) * 0.24,
    ]);
    blade.rotation.y = -angle + 0.4;
    gpu.add(blade);
  }
}
