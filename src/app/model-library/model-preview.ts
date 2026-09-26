import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ModelAsset } from '../assets/models/model-catalog';
import { disposeObject } from '../scene/resources/dispose-object';

export class ModelPreview {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.01, 500);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  private model?: THREE.Group;
  private grid?: THREE.GridHelper;
  private mixer?: THREE.AnimationMixer;
  private rotors: { object: THREE.Object3D; axis: 'x' | 'y' | 'z' }[] = [];
  private request = 0;
  private disposed = false;
  private lastTime = 0;
  private radius = 3;
  private height = 2;
  private rpm = 1500;
  animateFans = true;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.scene.background = new THREE.Color(0x142024);
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(this.renderer);
    this.environment = generator.fromScene(room);
    room.dispose();
    generator.dispose();
    this.scene.environment = this.environment.texture;
    this.scene.add(new THREE.HemisphereLight(0xe6f6ff, 0x55635b, 2));
    const key = new THREE.DirectionalLight(0xfff3d9, 3);
    key.position.set(5, 8, 5);
    this.scene.add(key);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.85;
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.renderer.setAnimationLoop((time) => this.render(time));
  }

  async show(asset: ModelAsset): Promise<boolean> {
    const request = ++this.request;
    const gltf = await new GLTFLoader().loadAsync(asset.path);
    if (this.disposed || request !== this.request) {
      disposeObject(gltf.scene);
      return false;
    }
    this.clearModel();
    const model = gltf.scene;
    model.traverse((object) => {
      if (object.userData['hiddenWhenEmpty'] && !asset.populated) {
        object.visible = false;
      }
    });
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
    this.radius = Math.max(size.length() / 2, asset.category === 'gpus' ? 1.45 : 0.2);
    this.height = size.y;
    this.rpm = asset.rpm ?? 1500;
    this.model = model;
    this.scene.add(model);
    this.grid = new THREE.GridHelper(
      (asset.category === 'gpus' ? 2.8 : Math.max(size.x, size.z, 2)) * 2.4,
      24,
      0x547174,
      0x2d4146,
    );
    this.grid.position.y = -0.012;
    this.scene.add(this.grid);
    model.traverse((object) => {
      const axis = object.userData['animationAxis'];
      if (axis === 'x' || axis === 'y' || axis === 'z') {
        // Mount markers also carry metadata; only spin actual rotors.
        if (object.name.startsWith('fan-rotor')) {
          this.rotors.push({ object, axis });
        }
      } else if (object.name === 'gpu-fan-rotor') {
        this.rotors.push({ object, axis: 'y' });
      }
    });
    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach((clip) => this.mixer!.clipAction(clip).play());
    }
    this.resetCamera();
    return true;
  }

  resetCamera(): void {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const limitingFov = Math.min(halfFov, Math.atan(Math.tan(halfFov) * this.camera.aspect));
    const distance = (this.radius / Math.sin(limitingFov)) * 1.1;
    this.controls.target.set(0, this.height / 2, 0);
    this.camera.position
      .copy(this.controls.target)
      .add(new THREE.Vector3(1.1, 0.72, 1.5).normalize().multiplyScalar(distance));
    this.controls.minDistance = this.radius * 0.3;
    this.controls.maxDistance = distance * 3;
    this.controls.update();
  }

  dispose(): void {
    this.disposed = true;
    this.request++;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    this.clearModel();
    this.environment.dispose();
    this.renderer.dispose();
  }

  private clearModel(): void {
    this.mixer?.stopAllAction();
    if (this.model) {
      this.mixer?.uncacheRoot(this.model);
      this.scene.remove(this.model);
      disposeObject(this.model);
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      for (const mat of Array.isArray(this.grid.material)
        ? this.grid.material
        : [this.grid.material]) {
        mat.dispose();
      }
    }
    this.model = undefined;
    this.grid = undefined;
    this.mixer = undefined;
    this.rotors = [];
  }

  private resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    if (this.model) {
      this.resetCamera();
    }
  }

  private render(time: number): void {
    const delta = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;
    if (this.animateFans && !this.reducedMotion.matches) {
      // Slow enough to show blade geometry, proportional to the fictional fan tier.
      const speed = this.rpm / 1500;
      for (const { object, axis } of this.rotors) {
        object.rotation[axis] -= delta * 6 * speed * (object.userData['animationDirection'] ?? 1);
      }
      this.mixer?.update(delta);
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
