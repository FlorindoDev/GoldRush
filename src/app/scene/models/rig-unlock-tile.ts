import * as THREE from 'three';
import { createBox, createLabelTexture } from '../geometry/mesh-primitives';

const TILE_SIZE: [number, number, number] = [5.2, 0.06, 4.6];
const LOCKED_TILE_COLOR = 0x29382f;
const UNLOCKED_TILE_COLOR = 0x39533d;
const LOCKED_ACCENT = 0x87967e;
const UNLOCKED_ACCENT = 0xb8f575;

export interface RigUnlockTile {
  readonly root: THREE.Group;
  setUnlocked(unlocked: boolean): void;
}

export function createRigUnlockTile(rigId: number, initiallyUnlocked: boolean): RigUnlockTile {
  const root = new THREE.Group();
  root.name = 'rig-unlock-tile';
  root.userData['rigId'] = rigId;

  const platform = createBox(TILE_SIZE, LOCKED_TILE_COLOR, [0, 0, 0], true);
  platform.material.transparent = true;
  platform.material.opacity = 0.72;
  platform.castShadow = false;
  root.add(platform);

  const outline = createOutline();
  root.add(outline);

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.34),
    new THREE.MeshBasicMaterial({
      map: createLabelTexture(`RIG ${String(rigId).padStart(2, '0')}`, '#b5c7a5'),
      transparent: true,
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.045, 1.78);
  root.add(label);

  const lock = createLockIcon();
  lock.rotation.x = -Math.PI / 2;
  root.add(lock);

  const activeMarker = createBox([0.48, 0.025, 0.16], UNLOCKED_ACCENT, [0, 0.045, -1.78], true);
  activeMarker.material.emissive.set(UNLOCKED_ACCENT);
  activeMarker.material.emissiveIntensity = 0.45;
  activeMarker.visible = false;
  root.add(activeMarker);

  const tile = {
    root,
    setUnlocked(unlocked: boolean): void {
      const color = unlocked ? UNLOCKED_TILE_COLOR : LOCKED_TILE_COLOR;
      const accent = unlocked ? UNLOCKED_ACCENT : LOCKED_ACCENT;
      platform.material.color.setHex(color);
      outline.material.color.setHex(accent);
      lock.visible = !unlocked;
      activeMarker.visible = unlocked;
    },
  };
  tile.setUnlocked(initiallyUnlocked);
  return tile;
}

function createLockIcon(): THREE.Group {
  const lock = new THREE.Group();
  lock.name = 'unlock-lock-icon';

  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.23, 0.055, 8, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0xd3b976, roughness: 0.36, metalness: 0.62 }),
  );
  shackle.position.set(0, 0.58, 0.07);
  lock.add(shackle);

  const body = createBox([0.74, 0.54, 0.16], 0x83977d, [0, 0.3, 0.07], true);
  body.material.color.setHex(0x83977d);
  body.material.metalness = 0.5;
  body.material.roughness = 0.38;
  lock.add(body);

  const keyhole = new THREE.Mesh(
    new THREE.CircleGeometry(0.055, 16),
    new THREE.MeshBasicMaterial({ color: 0x27342d }),
  );
  keyhole.position.set(0, 0.34, 0.156);
  lock.add(keyhole);

  const keyholeStem = createBox([0.07, 0.14, 0.018], 0x27342d, [0, 0.245, 0.157], true);
  keyholeStem.material.roughness = 0.5;
  lock.add(keyholeStem);
  return lock;
}

function createOutline(): THREE.LineSegments<THREE.BufferGeometry, THREE.LineDashedMaterial> {
  const geometry = new THREE.BoxGeometry(TILE_SIZE[0], 0.075, TILE_SIZE[2]);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineDashedMaterial({
      color: LOCKED_ACCENT,
      dashSize: 0.22,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.7,
    }),
  );
  geometry.dispose();
  outline.computeLineDistances();
  return outline;
}
