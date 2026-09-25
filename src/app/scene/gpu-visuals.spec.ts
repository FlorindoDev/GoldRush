import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_BALANCE } from '../config/game-balance';
import { createWorld, stopGpu, type MiningWorld } from '../game/mining-world';
import { GpuVisuals, type GpuPose } from './gpu-visuals';

const visualsToDispose: GpuVisuals[] = [];
const duration = GAME_BALANCE.animation.transitionSeconds;

afterEach(() => {
  visualsToDispose.splice(0).forEach((visuals) => visuals.dispose());
  vi.restoreAllMocks();
});

function worldWithGpus(...ids: number[]): MiningWorld {
  const world = createWorld();
  return {
    ...world,
    plots: world.plots.map((plot) => ({
      ...plot,
      rigs: plot.rigs.map((rig) => ({
        ...rig,
        unlocked: rig.gpus.some((gpu) => ids.includes(gpu.id)),
        gpus: rig.gpus.map((gpu) => ({ ...gpu, unlocked: ids.includes(gpu.id) })),
      })),
    })),
  };
}

function homePose(id: number): GpuPose {
  return {
    position: new THREE.Vector3(id * 4, 1, 0),
    rotation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), id * 0.2),
  };
}

function setup() {
  const scene = new THREE.Scene();
  const workbench = new THREE.Group();
  workbench.position.set(20, 0, -3);
  workbench.rotation.y = Math.PI / 2;
  const mount = new THREE.Group();
  mount.position.set(1, 3, 2);
  mount.rotation.z = 0.4;
  workbench.add(mount);
  scene.add(workbench);
  const visuals = new GpuVisuals(scene, homePose, mount);
  visualsToDispose.push(visuals);
  return { scene, mount, visuals };
}

function loadedAsset(animations: THREE.AnimationClip[] = []) {
  const scene = new THREE.Group();
  const texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ map: texture });
  const geometry = new THREE.BoxGeometry(3, 1, 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'loaded-gpu';
  const fan = new THREE.Group();
  fan.name = 'Spin';
  scene.add(mesh, fan);
  return { gltf: { scene, animations } as GLTF, geometry, material, texture };
}

function expectAtMount(gpu: THREE.Group, mount: THREE.Object3D): void {
  expect(gpu.position.distanceTo(mount.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8);
  expect(gpu.quaternion.angleTo(mount.getWorldQuaternion(new THREE.Quaternion()))).toBeLessThan(
    1e-7,
  );
}

describe('GPU visuals', () => {
  it('only spins the active GPU and stops its fans after a stop', () => {
    const { visuals } = setup();
    const world = worldWithGpus(1, 2);
    visuals.sync(world, null);
    const firstFan = visuals.objects[0].getObjectByName('gpu-fan-rotor')!;
    const secondFan = visuals.objects[1].getObjectByName('gpu-fan-rotor')!;
    visuals.update(0.1, true, false, 1);
    expect(firstFan.rotation.y).toBeLessThan(0);
    expect(secondFan.rotation.y).toBe(0);
    const rotation = firstFan.rotation.y;
    visuals.sync(stopGpu(world, 1), null);
    visuals.update(0.1, true, false, 1);
    expect(firstFan.rotation.y).toBe(rotation);
  });
  it('synchronizes available GPUs without replacing surviving instances', () => {
    const { visuals, scene } = setup();
    visuals.sync(worldWithGpus(1, 2), null);
    const [first, second] = visuals.objects;
    expect(visuals.objects.map((gpu) => gpu.userData['gpuId'])).toEqual([1, 2]);
    expect(first.position.toArray()).toEqual(homePose(1).position.toArray());
    expect(first.quaternion.angleTo(homePose(1).rotation)).toBeLessThan(1e-7);
    expect(scene.getObjectByName('gpu-1')).toBe(first);

    visuals.sync(worldWithGpus(1, 2), null);
    expect(visuals.objects).toEqual([first, second]);
    visuals.sync(worldWithGpus(1), null);
    expect(visuals.objects).toEqual([first]);
    expect(second.parent).toBeNull();
  });

  it('retargets interrupted transfers and returns each GPU to its own rig pose', () => {
    const { visuals, mount } = setup();
    const world = worldWithGpus(1, 2);
    visuals.sync(world, 1);
    const [first, second] = visuals.objects;
    visuals.update(duration / 2, false, false);
    expect(first.position.x).toBeGreaterThan(homePose(1).position.x);
    expect(first.position.x).toBeLessThan(mount.getWorldPosition(new THREE.Vector3()).x);
    expect(first.position.y).toBeCloseTo(2 + GAME_BALANCE.animation.gpuTransferArcHeight);
    const interruptedPosition = first.position.clone();

    visuals.sync(world, 2);
    expect(first.position.toArray()).toEqual(interruptedPosition.toArray());
    visuals.update(duration, false, false);
    expectAtMount(second, mount);
    expect(first.position.distanceTo(homePose(1).position)).toBeLessThan(1e-8);
    expect(first.quaternion.angleTo(homePose(1).rotation)).toBeLessThan(1e-7);

    visuals.sync(world, null);
    visuals.update(duration, false, false);
    expect(second.position.distanceTo(homePose(2).position)).toBeLessThan(1e-8);
    expect(second.quaternion.angleTo(homePose(2).rotation)).toBeLessThan(1e-7);
  });

  it('finishes transfers immediately with reduced motion and spins fans only while mining', () => {
    const { visuals, mount } = setup();
    visuals.sync(worldWithGpus(1), 1);
    const gpu = visuals.objects[0];
    const fan = gpu.getObjectByName('gpu-fan-rotor')!;
    const initialRotation = fan.rotation.y;
    visuals.update(0.01, true, true);
    expectAtMount(gpu, mount);
    expect(fan.rotation.y).toBe(initialRotation);
    visuals.update(0.1, false, false);
    expect(fan.rotation.y).toBe(initialRotation);
    visuals.update(0.1, true, false);
    expect(fan.rotation.y).toBeCloseTo(
      initialRotation - 0.1 * GAME_BALANCE.animation.gpuFanRadiansPerSecond,
    );
  });

  it('replaces fallback models during a transfer and releases shared resources only with their owner', async () => {
    const { visuals, mount } = setup();
    visuals.sync(worldWithGpus(1, 2), 1);
    const [first, second] = visuals.objects;
    const fallbackMesh = first.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const disposeFallback = vi.spyOn(fallbackMesh.geometry, 'dispose');
    visuals.update(duration / 2, false, false);
    const position = first.position.clone();
    const asset = loadedAsset();
    const disposeGeometry = vi.spyOn(asset.geometry, 'dispose');
    const disposeMaterial = vi.spyOn(asset.material, 'dispose');
    const disposeTexture = vi.spyOn(asset.texture, 'dispose');
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(asset.gltf);

    await visuals.loadModel();
    expect(visuals.objects).toEqual([first, second]);
    expect(first.position.toArray()).toEqual(position.toArray());
    expect(first.userData['gpuId']).toBe(1);
    expect(disposeFallback).toHaveBeenCalledOnce();
    expect((first.getObjectByName('loaded-gpu') as THREE.Mesh).geometry).toBe(asset.geometry);
    expect((second.getObjectByName('loaded-gpu') as THREE.Mesh).geometry).toBe(asset.geometry);

    visuals.sync(worldWithGpus(1), 1);
    visuals.update(duration, false, false);
    expectAtMount(first, mount);
    expect(disposeGeometry).not.toHaveBeenCalled();
    expect(disposeMaterial).not.toHaveBeenCalled();
    visuals.dispose();
    visuals.dispose();
    expect(first.parent).toBeNull();
    expect(visuals.objects).toEqual([]);
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
    expect(disposeTexture).toHaveBeenCalledOnce();
  });

  it('updates loaded clips and fan rotations only during mining with motion enabled', async () => {
    const { visuals } = setup();
    const clip = new THREE.AnimationClip('spin', 1, [
      new THREE.NumberKeyframeTrack('Spin.rotation[x]', [0, 1], [0, 1]),
    ]);
    const asset = loadedAsset([clip]);
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockResolvedValue(asset.gltf);
    await visuals.loadModel();
    visuals.sync(worldWithGpus(1), null);
    const fan = visuals.objects[0].getObjectByName('Spin')!;
    visuals.update(0.1, true, false);
    expect(fan.rotation.x).toBeCloseTo(0.1 * GAME_BALANCE.animation.gpuMixerTimeScale);
    expect(fan.rotation.z).toBeCloseTo(-0.1 * GAME_BALANCE.animation.gpuFanRadiansPerSecond);
    const rotation = fan.rotation.clone();
    visuals.update(0.1, false, false);
    visuals.update(0.1, true, true);
    expect(fan.rotation.toArray()).toEqual(rotation.toArray());
  });

  it('keeps the fallback usable when loading fails', async () => {
    const { visuals, mount } = setup();
    visuals.sync(worldWithGpus(1), null);
    const gpu = visuals.objects[0];
    const fallback = gpu.children[0];
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockRejectedValue(new Error('asset unavailable'));
    await visuals.loadModel();
    expect(gpu.children[0]).toBe(fallback);
    visuals.sync(worldWithGpus(1), 1);
    visuals.update(duration, false, false);
    expectAtMount(gpu, mount);
  });

  it('releases a model arriving after disposal without adding it to the scene', async () => {
    const { visuals, scene } = setup();
    const asset = loadedAsset();
    const disposeGeometry = vi.spyOn(asset.geometry, 'dispose');
    let completeLoading!: (asset: GLTF) => void;
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockReturnValue(
      new Promise<GLTF>((resolve) => {
        completeLoading = resolve;
      }),
    );
    const loading = visuals.loadModel();
    visuals.sync(worldWithGpus(1), null);
    visuals.dispose();
    completeLoading(asset.gltf);
    await loading;
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(scene.getObjectByName('gpu-1')).toBeUndefined();
    expect(scene.getObjectByName('loaded-gpu')).toBeUndefined();
    expect(visuals.objects).toEqual([]);
  });
});
