import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SceneAssets } from './scene-assets';
import { disposeObject } from './dispose-object';

afterEach(() => vi.restoreAllMocks());

function template(): THREE.Group {
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  return root;
}

describe('scene GLB resources', () => {
  it('isolates mutable materials and retains shared geometry until the asset owner is disposed', async () => {
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(
      async () => ({ scene: template() }) as GLTF,
    );
    const assets = await SceneAssets.load();
    const first = assets.instantiate('rig');
    const second = assets.instantiate('rig');
    const a = first.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    const b = second.children[0] as typeof a;
    expect(a.geometry).toBe(b.geometry);
    expect(a.material).not.toBe(b.material);
    a.material.color.set(0xff0000);
    expect(b.material.color.getHex()).not.toBe(0xff0000);
    const geometryDispose = vi.spyOn(a.geometry, 'dispose');
    const textureDispose = vi.spyOn(a.material.map!, 'dispose');
    const materialDispose = vi.spyOn(a.material, 'dispose');
    disposeObject(first);
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
    disposeObject(second);
    assets.dispose();
    assets.dispose();
    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(textureDispose).toHaveBeenCalledOnce();
  });

  it('releases successful loads if another required GLB fails', async () => {
    const roots: THREE.Group[] = [];
    const disposals: ReturnType<typeof vi.spyOn>[] = [];
    vi.spyOn(GLTFLoader.prototype, 'loadAsync').mockImplementation(async (path) => {
      if (String(path).includes('workbench')) {
        throw new Error('missing GLB');
      }
      const root = template();
      roots.push(root);
      disposals.push(vi.spyOn((root.children[0] as THREE.Mesh).geometry, 'dispose'));
      return { scene: root } as GLTF;
    });
    await expect(SceneAssets.load()).rejects.toThrow('GLB');
    expect(roots).toHaveLength(6);
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledOnce());
  });
});
