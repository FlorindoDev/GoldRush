import * as THREE from 'three';
import { createBox } from './mesh-primitives';

export function createFallbackGpu(width: number): THREE.Group {
  const gpu = new THREE.Group();
  gpu.scale.setScalar(width / 3);
  gpu.add(createBox([3.0, 0.35, 1.45], 0x232b29, [0, 0.25, 0], true));
  gpu.add(createBox([2.8, 0.07, 1.52], 0xa5d877, [0, 0.08, 0]));
  for (const fanX of [-0.75, 0.75]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.56, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x101715 }),
    );
    rim.position.set(fanX, 0.46, 0);
    gpu.add(rim);
    for (let bladeIndex = 0; bladeIndex < 8; bladeIndex++) {
      const angle = (bladeIndex * Math.PI) / 4;
      const blade = createBox([0.42, 0.05, 0.15], 0x68736e, [
        fanX + Math.cos(angle) * 0.24,
        0.52,
        Math.sin(angle) * 0.24,
      ]);
      blade.rotation.y = -angle + 0.4;
      gpu.add(blade);
    }
  }
  return gpu;
}
