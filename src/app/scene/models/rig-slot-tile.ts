import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
import { createLabelTexture } from '../geometry/mesh-primitives';
import { RIG_SLOT_DEPTH } from '../environment/scene-layout';

export interface RigSlotTile {
  readonly root: THREE.Group;
  setUnlocked(unlocked: boolean): void;
}

export function createRigSlotTile(
  rigId: number,
  initiallyUnlocked: boolean,
  model: THREE.Group,
): RigSlotTile {
  model.name = 'rig-slot-tile';
  model.userData['rigId'] = rigId;

  const platform = model.getObjectByName('slot-platform') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshStandardMaterial
  >;
  const outline = model.getObjectByName('slot-outline') as THREE.Mesh<
    THREE.BufferGeometry,
    THREE.MeshBasicMaterial
  >;
  const style = GAME_BALANCE.scene.surfaces.rigSlot;
  platform.material.transparent = false;
  platform.material.opacity = 1;
  platform.material.depthWrite = true;
  platform.material.needsUpdate = true;
  outline.material.color.setHex(style.outline);

  // Lucchetto e tonalità della pedana indicano se il rig è sbloccato.
  const lock = model.getObjectByName('slot-lock')!;
  const activeMarker = model.getObjectByName('slot-active');
  if (activeMarker) activeMarker.visible = false;

  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(1.85, 0.34),
    new THREE.MeshBasicMaterial({
      map: createLabelTexture(`RIG ${String(rigId).padStart(2, '0')}`, '#b5c7a5'),
    }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, -0.06, RIG_SLOT_DEPTH / 2 + 0.2);
  model.add(label);

  const tile = {
    root: model,
    setUnlocked(unlocked: boolean): void {
      lock.visible = !unlocked;
      platform.material.color.setHex(unlocked ? style.unlockedColor : style.lockedColor);
    },
  };
  tile.setUnlocked(initiallyUnlocked);
  return tile;
}
