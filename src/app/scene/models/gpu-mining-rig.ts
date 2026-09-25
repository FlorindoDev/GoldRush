import * as THREE from 'three';
import { GPUS_PER_RIG } from '../../game/mining-world';
import { createLabelTexture } from '../geometry/mesh-primitives';
import { fitRigInSlot, RIG_PLOT_DEPTH } from '../environment/scene-layout';

export interface RigSlot {
  readonly position: THREE.Vector3;
  readonly orientation: THREE.Quaternion;
  readonly outline: THREE.LineSegments;
  readonly indicator: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  readonly cable: THREE.Group;
}
export interface GpuMiningRig {
  readonly root: THREE.Group;
  readonly slots: readonly RigSlot[];
  readonly fans: readonly THREE.Object3D[];
}

export function createGpuMiningRig(id: number, model: THREE.Group): GpuMiningRig {
  fitRigInSlot(model);
  const root = new THREE.Group();
  root.name = 'gpu-mining-rig';
  root.userData = { rigId: id, assetPath: model.userData['assetPath'] };
  root.add(model);
  root.updateMatrixWorld(true);
  const fans: THREE.Object3D[] = [];
  model.traverse((object) => {
    if (object.name.startsWith('fan-rotor')) {
      fans.push(object);
    }
  });
  const slots = Array.from({ length: GPUS_PER_RIG }, (_, index): RigSlot => {
    const socket = model.getObjectByName(`gpu-slot-${String(index + 1).padStart(2, '0')}`);
    const indicatorGroup = model.getObjectByName(`slot-indicator-${index + 1}`);
    const indicator = indicatorGroup?.getObjectByProperty('isMesh', true) as RigSlot['indicator'];
    const cable = model.getObjectByName(`slot-cable-${index + 1}`) as THREE.Group;
    if (!socket || !indicator || !cable) {
      throw new Error('Rig GLB incompatibile: rigenera gli asset con npm run models:generate.');
    }
    const position = socket.getWorldPosition(new THREE.Vector3());
    const orientation = socket.getWorldQuaternion(new THREE.Quaternion());
    const box = new THREE.BoxGeometry(0.85, 1.3, 2.7);
    const outline = new THREE.LineSegments(
      new THREE.EdgesGeometry(box),
      new THREE.LineBasicMaterial({ color: 0xb8f575, transparent: true, opacity: 0.75 }),
    );
    box.dispose();
    outline.position.copy(position).add(new THREE.Vector3(0.2, 0, 0));
    outline.visible = false;
    cable.visible = false;
    root.add(outline);
    return { position, orientation, outline, indicator, cable };
  });
  return { root, slots, fans };
}

export function createRigPlot(id: number, model: THREE.Group): THREE.Group {
  model.name = 'rig-plot';
  model.userData['plotId'] = id;
  // Il pavimento alpha del GLB si fondeva con la griglia durante l'orbita della camera.
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || object.name === 'dashed-outline') {
      return;
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    }
  });
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 0.3),
    new THREE.MeshBasicMaterial({ map: createLabelTexture(`PLOT ${String(id).padStart(2, '0')}`) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, -0.48, RIG_PLOT_DEPTH / 2 + 0.45);
  model.add(label);
  return model;
}
