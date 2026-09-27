import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../game/mining-world';
import { resolveSceneContextTarget } from '../mining-scene';

function hit(object: THREE.Object3D, distance: number): THREE.Intersection {
  return { object, distance, point: new THREE.Vector3(), face: null, faceIndex: null };
}

describe('scene context target picking', () => {
  it('finds a GPU behind a RIG hit and ignores RIG-only hits', () => {
    const world = createWorld();
    const gpu = new THREE.Group();
    gpu.userData['gpuId'] = 1;
    const gpuMesh = new THREE.Mesh();
    gpu.add(gpuMesh);
    const rig = new THREE.Group();
    rig.userData['rigId'] = 1;
    const rigMesh = new THREE.Mesh();
    rig.add(rigMesh);

    expect(resolveSceneContextTarget([hit(gpuMesh, 1), hit(rigMesh, 2)], world)).toEqual({
      kind: 'gpu',
      id: 1,
    });
    expect(resolveSceneContextTarget([hit(rigMesh, 1), hit(gpuMesh, 2)], world)).toEqual({
      kind: 'gpu',
      id: 1,
    });
    expect(resolveSceneContextTarget([hit(rigMesh, 1)], world)).toBeUndefined();
  });

  it('does not expose context actions for a locked RIG', () => {
    const world = createWorld();
    const lockedRig = world.plots.flatMap((plot) => plot.rigs).find((rig) => !rig.unlocked);
    expect(lockedRig).toBeDefined();
    const root = new THREE.Group();
    root.userData['rigId'] = lockedRig!.id;
    const mesh = new THREE.Mesh();
    root.add(mesh);

    expect(resolveSceneContextTarget([hit(mesh, 1)], world)).toBeUndefined();
  });
});
