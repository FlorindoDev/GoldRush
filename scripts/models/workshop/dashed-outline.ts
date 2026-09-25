import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

interface DashedOutlineOptions {
  width: number;
  depth: number;
  color: number;
  dashSize: number;
  gapSize: number;
  y: number;
  x?: number;
  z?: number;
  opacity?: number;
}

/** Dash geometry survives GLB export; LineDashedMaterial does not. */
export function createDashedOutline(options: DashedOutlineOptions): THREE.Mesh {
  const segments: THREE.BufferGeometry[] = [];
  const addEdge = (length: number, fixed: number, alongX: boolean): void => {
    const count = Math.max(
      1,
      Math.floor((length + options.gapSize) / (options.dashSize + options.gapSize)),
    );
    const used = count * options.dashSize + (count - 1) * options.gapSize;
    for (let index = 0; index < count; index++) {
      const center =
        -used / 2 + options.dashSize / 2 + index * (options.dashSize + options.gapSize);
      const dash = new THREE.BoxGeometry(
        alongX ? options.dashSize : 0.065,
        0.024,
        alongX ? 0.065 : options.dashSize,
      );
      dash.translate(alongX ? center : fixed, 0, alongX ? fixed : center);
      segments.push(dash);
    }
  };
  for (const edge of [-1, 1]) {
    addEdge(options.width, (edge * options.depth) / 2, true);
    addEdge(options.depth, (edge * options.width) / 2, false);
  }
  const geometry = mergeGeometries(segments)!;
  segments.forEach((segment) => segment.dispose());
  const outline = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: options.color,
      transparent: true,
      opacity: options.opacity ?? 0.75,
      depthWrite: false,
    }),
  );
  outline.name = 'dashed-outline';
  outline.position.set(options.x ?? 0, options.y, options.z ?? 0);
  outline.castShadow = false;
  return outline;
}
