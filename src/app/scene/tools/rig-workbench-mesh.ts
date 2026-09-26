import * as THREE from 'three';
import { disposeObject } from '../resources/dispose-object';

export interface RigWorkbenchMesh {
  readonly root: THREE.Group;
  readonly rigMount: THREE.Object3D;
  readonly outline: THREE.LineSegments;
}

export function createRigWorkbench(model: THREE.Group): RigWorkbenchMesh {
  const rigMount = model.getObjectByName('rig-mount');
  if (!rigMount) {
    disposeObject(model);
    throw new Error('Banco RIG GLB privo del punto di montaggio.');
  }
  const outline = createSelectionOutline();
  model.add(outline);
  return { root: model, rigMount, outline };
}

export function fitRigOnWorkbench(model: THREE.Group): void {
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min(0.86, 5.2 / size.x, 3.35 / size.z, 2.1 / size.y);
  const center = bounds.getCenter(new THREE.Vector3());
  model.scale.multiplyScalar(scale);
  model.position.set(-center.x * scale, -bounds.min.y * scale + 0.025, -center.z * scale);
  model.updateMatrixWorld(true);
}

function createSelectionOutline(): THREE.LineSegments {
  const geometry = new THREE.BoxGeometry(6.22, 0.025, 4.48);
  const edges = new THREE.EdgesGeometry(geometry);
  geometry.dispose();
  const outline = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0xb8f575, transparent: true, opacity: 0.82 }),
  );
  outline.position.y = 1.39;
  outline.visible = false;
  return outline;
}
