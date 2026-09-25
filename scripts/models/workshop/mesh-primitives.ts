import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

type Vector3Tuple = [x: number, y: number, z: number];
type BoxSize = [width: number, height: number, depth: number];
const CANVAS_TEXTURE_SCALE = 2;
export const GAME_FONT_FAMILY = '"JetBrains Mono", Consolas, monospace';
const LABEL_FONT = `700 52px ${GAME_FONT_FAMILY}`;

export function createCanvasTexture(
  width: number,
  height: number,
  draw: (context: CanvasRenderingContext2D) => void,
  fontToLoad?: string,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width * CANVAS_TEXTURE_SCALE;
  canvas.height = height * CANVAS_TEXTURE_SCALE;
  const context = canvas.getContext('2d')!;
  context.scale(CANVAS_TEXTURE_SCALE, CANVAS_TEXTURE_SCALE);
  draw(context);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (fontToLoad) {
    void document.fonts
      .load(fontToLoad)
      .then(() => {
        draw(context);
        texture.needsUpdate = true;
      })
      .catch(() => {
        // Keep the initial drawing when font loading fails.
      });
  }
  return texture;
}

export function createLabelTexture(text: string, color = '#b8f575'): THREE.CanvasTexture {
  return createCanvasTexture(
    512,
    128,
    (context) => {
      context.fillStyle = '#202c25';
      context.fillRect(0, 0, 512, 128);
      context.fillStyle = color;
      context.font = LABEL_FONT;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 256, 66);
    },
    LABEL_FONT,
  );
}

export function createBox(
  size: BoxSize,
  color: number,
  position: Vector3Tuple,
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
  start: Vector3Tuple,
  end: Vector3Tuple,
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
