import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it, vi } from 'vitest';
import { PlacementDragVisual } from '../placement-drag-visual';

describe('placement drag preview', () => {
  it('renders the selected 3D model, swings when dragged, and releases it afterward', async () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const canvas = {
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 600 }),
    } as HTMLCanvasElement;
    const geometry = new THREE.BoxGeometry(2, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const model = new THREE.Group();
    model.add(new THREE.Mesh(geometry, material));
    const disposeGeometry = vi.spyOn(geometry, 'dispose');
    const disposeMaterial = vi.spyOn(material, 'dispose');
    const loader = { loadAsync: vi.fn(async () => ({ scene: model }) as GLTF) };
    const visual = new PlacementDragVisual(scene, camera, canvas, loader);

    visual.begin(7, 'assets/models/rigs/rig-gameplay.glb', 'rig', 300, 300);
    await Promise.resolve();
    expect(loader.loadAsync).toHaveBeenCalledOnce();
    expect(scene.getObjectByName('placement-drag-preview')).toBeDefined();
    expect(scene.getObjectByName('placement-pendulum')?.children).toHaveLength(1);

    visual.move(420, 300);
    visual.update(0.05, false);
    const preview = scene.getObjectByName('placement-drag-preview')!;
    const onScreen = preview.position.clone().project(camera);
    expect(((onScreen.x + 1) / 2) * 600).toBeCloseTo(420, 0);
    expect(scene.getObjectByName('placement-pendulum')!.children[0].position.y).toBeGreaterThan(
      -0.4,
    );
    expect(scene.getObjectByName('placement-pendulum')!.rotation.z).toBeLessThan(-0.01);
    visual.stop();
    expect(scene.getObjectByName('placement-drag-preview')).toBeUndefined();
    expect(disposeGeometry).toHaveBeenCalledOnce();
    expect(disposeMaterial).toHaveBeenCalledOnce();
  });
});
