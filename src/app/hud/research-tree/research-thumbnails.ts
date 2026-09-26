import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from '../../scene/resources/dispose-object';

/** Un solo contesto WebGL genera immagini statiche dei modelli GLB. */
export class ResearchThumbnails {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly loader = new GLTFLoader();
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 3 / 2, 0.01, 1000);
  private disposed = false;

  constructor() {
    const canvas = document.createElement('canvas');
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(768, 512);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x65736d, 2.6));
    const key = new THREE.DirectionalLight(0xffe9bb, 3);
    key.position.set(3, 6, 5);
    this.scene.add(key);
  }

  async render(path: string): Promise<string> {
    const gltf = await this.loader.loadAsync(path);
    const model = gltf.scene;
    try {
      if (this.disposed) return '';
      this.scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model);
      const center = bounds.getCenter(new THREE.Vector3());
      const size = bounds.getSize(new THREE.Vector3());
      const radius = Math.max(size.length() / 2, path.includes('/gpus/') ? 1.45 : 0.15);
      const distance = (radius / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.05;
      this.camera.position
        .copy(center)
        .add(new THREE.Vector3(1.4, 0.9, 1.5).normalize().multiplyScalar(distance));
      this.camera.lookAt(center);
      this.camera.updateProjectionMatrix();
      this.renderer.render(this.scene, this.camera);
      return this.renderer.domElement.toDataURL('image/png');
    } finally {
      this.scene.remove(model);
      disposeObject(model);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
