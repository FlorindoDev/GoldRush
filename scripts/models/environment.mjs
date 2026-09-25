import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GAME_BALANCE } from '../../src/app/config/game-balance.ts';
import { group, box, ring, materials as m } from './primitives.mjs';
import { createDashedOutline } from './workshop/dashed-outline.ts';

export function createPlot() {
  const root = group('plot');
  const { width, depth } = GAME_BALANCE.layout.plots;
  const style = GAME_BALANCE.scene.surfaces.plot;
  const floor = box(
    root,
    [width, 0.035, depth],
    new THREE.MeshStandardMaterial({
      color: style.color,
      roughness: 1,
    }),
    [0, -0.48, 0],
  );
  floor.name = 'plot-floor';
  floor.castShadow = false;
  root.add(
    createDashedOutline({
      width,
      depth,
      color: style.outline,
      dashSize: style.dashSize,
      gapSize: style.gapSize,
      y: -0.45,
      opacity: 0.7,
    }),
  );
  return root;
}

export function createRigSlot() {
  const root = group('rig-slot');
  const { rigSlotWidth: width, rigSlotDepth: depth } = GAME_BALANCE.layout.plots;
  const style = GAME_BALANCE.scene.surfaces.rigSlot;
  const platform = new THREE.Mesh(
    new RoundedBoxGeometry(width, 0.06, depth, 1, 0.08),
    new THREE.MeshStandardMaterial({
      color: style.unlockedColor,
      roughness: 0.8,
      metalness: 0.15,
    }),
  );
  platform.name = 'slot-platform';
  platform.receiveShadow = true;
  root.add(platform);
  const outline = createDashedOutline({
    width,
    depth,
    color: style.outline,
    dashSize: style.dashSize,
    gapSize: style.gapSize,
    y: 0.04,
    opacity: 0.7,
  });
  outline.name = 'slot-outline';
  root.add(outline);
  const lock = group('slot-lock');
  box(lock, [0.64, 0.07, 0.45], m.gold, [0, 0.08, 0]);
  const shackle = ring(lock, 0.22, 0.04, m.steel, [0, 0.08, -0.26]);
  shackle.rotation.x = -Math.PI / 2;
  root.add(lock);
  return root;
}

export function createWorldFloor() {
  const root = group('world-floor');
  const size = GAME_BALANCE.scene.groundSize;
  box(
    root,
    [size, 0.02, size],
    new THREE.MeshStandardMaterial({ color: 0x19241e, roughness: 1 }),
    [0, -0.51, 0],
  );
  const grid = new THREE.GridHelper(size, size, 0x35473b, 0x2c3c32);
  grid.position.y = -0.49;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  root.add(grid);
  return root;
}
