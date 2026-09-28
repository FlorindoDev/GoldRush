import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
import { createLabelTexture } from '../geometry/mesh-primitives';
import { RIG_SLOT_DEPTH, RIG_SLOT_WIDTH } from '../environment/scene-layout';

export interface RigSlotTile {
  readonly root: THREE.Group;
  setUnlocked(unlocked: boolean): void;
  setPlacementHighlight(highlighted: boolean): void;
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

  const placementGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(RIG_SLOT_WIDTH - 0.16, RIG_SLOT_DEPTH - 0.16),
    new THREE.MeshBasicMaterial({
      color: 0xa6ff60,
      transparent: true,
      opacity: 0.48,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  placementGlow.name = 'slot-placement-glow';
  placementGlow.rotation.x = -Math.PI / 2;
  placementGlow.position.y = 0.065;
  placementGlow.renderOrder = 900;
  placementGlow.visible = false;
  model.add(placementGlow);

  const border = new THREE.Shape();
  border.moveTo(-RIG_SLOT_WIDTH / 2, -RIG_SLOT_DEPTH / 2);
  border.lineTo(RIG_SLOT_WIDTH / 2, -RIG_SLOT_DEPTH / 2);
  border.lineTo(RIG_SLOT_WIDTH / 2, RIG_SLOT_DEPTH / 2);
  border.lineTo(-RIG_SLOT_WIDTH / 2, RIG_SLOT_DEPTH / 2);
  border.closePath();
  const inner = new THREE.Path();
  inner.moveTo(-RIG_SLOT_WIDTH / 2 + 0.12, -RIG_SLOT_DEPTH / 2 + 0.12);
  inner.lineTo(-RIG_SLOT_WIDTH / 2 + 0.12, RIG_SLOT_DEPTH / 2 - 0.12);
  inner.lineTo(RIG_SLOT_WIDTH / 2 - 0.12, RIG_SLOT_DEPTH / 2 - 0.12);
  inner.lineTo(RIG_SLOT_WIDTH / 2 - 0.12, -RIG_SLOT_DEPTH / 2 + 0.12);
  inner.closePath();
  border.holes.push(inner);
  const placementBorder = new THREE.Mesh(
    new THREE.ShapeGeometry(border),
    new THREE.MeshBasicMaterial({
      color: 0xd5ff70,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  placementBorder.name = 'slot-placement-border';
  placementBorder.rotation.x = -Math.PI / 2;
  placementBorder.position.y = 0.08;
  placementBorder.renderOrder = 1100;
  placementBorder.visible = false;
  model.add(placementBorder);

  let unlocked = initiallyUnlocked;
  let highlighted = false;
  const updateSurface = (): void => {
    lock.visible = !unlocked;
    platform.material.color.setHex(
      highlighted ? 0x9df255 : unlocked ? style.unlockedColor : style.lockedColor,
    );
    platform.material.emissive.setHex(highlighted ? 0x4f851b : 0x000000);
    platform.material.emissiveIntensity = highlighted ? 1.2 : 0;
    outline.material.color.setHex(highlighted ? 0xe3ff91 : style.outline);
    placementGlow.visible = highlighted;
    placementBorder.visible = highlighted;
  };
  const tile = {
    root: model,
    setUnlocked(value: boolean): void {
      unlocked = value;
      updateSurface();
    },
    setPlacementHighlight(value: boolean): void {
      highlighted = value;
      updateSurface();
    },
  };
  tile.setUnlocked(initiallyUnlocked);
  return tile;
}
