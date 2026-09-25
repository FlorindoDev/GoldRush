import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GpuConditionEffects } from './gpu-condition-effects';
import { createFallbackGpu } from './models/fallback-gpu';

describe('GPU condition effects', () => {
  it('keeps effects and material ownership isolated across GPU clones', () => {
    const template = createFallbackGpu(2.4);
    const original = template.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const originalMaterial = original.material as THREE.MeshStandardMaterial;
    const disposeOriginal = vi.spyOn(originalMaterial, 'dispose');
    const first = template.clone(true);
    const second = template.clone(true);
    const a = new GpuConditionEffects(first);
    const b = new GpuConditionEffects(second);
    const firstMesh = first.getObjectByProperty('isMesh', true) as THREE.Mesh;
    const secondMesh = second.getObjectByProperty('isMesh', true) as THREE.Mesh;
    expect(firstMesh.geometry).toBe(original.geometry);
    expect(firstMesh.material).not.toBe(secondMesh.material);
    expect(firstMesh.material).not.toBe(original.material);
    a.update({ dustPercent: 90, temperatureCelsius: 95, fanKit: 'performance' }, 0.1, false);
    b.update({ dustPercent: 0, temperatureCelsius: 34, fanKit: 'stock' }, 0.1, false);
    for (const name of ['gpu-dust-cloud', 'gpu-heat-plume', 'gpu-fan-kit']) {
      expect(a.root.getObjectByName(name)?.visible).toBe(true);
      expect(b.root.getObjectByName(name)?.visible).toBe(false);
    }
    const disposeOwned = vi.spyOn(firstMesh.material as THREE.Material, 'dispose');
    a.dispose();
    expect(disposeOwned).toHaveBeenCalledOnce();
    expect(disposeOriginal).not.toHaveBeenCalled();
    b.dispose();
  });

  it('emits a short cleaning burst, cools down, and respects reduced motion', () => {
    const effects = new GpuConditionEffects(createFallbackGpu(2.4));
    const dirty = { dustPercent: 80, temperatureCelsius: 95, fanKit: 'quiet' as const };
    const clean = { ...dirty, dustPercent: 0, temperatureCelsius: 34 };
    effects.update(dirty, 0.1, false);
    effects.update(clean, 0.1, false);
    expect(effects.root.getObjectByName('gpu-dust-cloud')?.visible).toBe(true);
    expect(effects.root.getObjectByName('gpu-heat-plume')?.visible).toBe(false);
    effects.update(clean, 2, false);
    effects.update(clean, 0.1, false);
    expect(effects.root.getObjectByName('gpu-dust-cloud')?.visible).toBe(false);
    effects.update(dirty, 0.1, true);
    expect(effects.root.getObjectByName('gpu-dust-cloud')?.visible).toBe(false);
    expect(effects.root.getObjectByName('gpu-heat-plume')?.visible).toBe(false);
    expect(effects.root.getObjectByName('gpu-fan-kit')?.visible).toBe(true);
    effects.dispose();
  });
});
