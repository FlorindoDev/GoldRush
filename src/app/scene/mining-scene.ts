import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MiningBlock, MiningWorld } from '../game/mining-world';
import { BITCOIN_MODEL_PATH } from '../shared/bitcoin-asset';
import { BlockMesh, createBlock, createFallbackGpu, createLockedTile } from './block-mesh';
import { WORKBENCH_SURFACE_Y } from './electronics-workbench';

const BLOCK_POSITIONS = [
  [0, 0],
  [5.6, 0],
  [0, -5.6],
  [5.6, -5.6],
] as const;

const MIN_CAMERA_DISTANCE = 8;
const MAX_CAMERA_DISTANCE = 32;
const PARTICLE_COUNT = 28;
const PARTICLE_HEIGHT = 3;
const GPU_MODEL_PATH = 'models/modello-gpu/scene.gltf';
const GPU_MODEL_WIDTH = 2.4;
const MAX_CLICK_MOVEMENT = 5;

export class MiningScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly observer: ResizeObserver;
  private readonly blocks = new Map<number, BlockMesh>();
  private readonly locked = new Map<number, THREE.Group>();
  private readonly mixers = new Map<number, THREE.AnimationMixer>();
  private readonly particles: THREE.Points;
  private gpu?: THREE.Group;
  private bitcoin?: THREE.Group;
  private clips: THREE.AnimationClip[] = [];
  private selectedId = 1;
  private isMining = false;
  private disposed = false;
  private lastFrame = 0;
  private readonly pointerDown = new THREE.Vector2();
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onSelect: (id: number) => void,
  ) {
    this.renderer = this.createRenderer();
    this.addLighting();
    this.addGround();
    this.addLockedTiles();

    this.particles = this.createParticles();
    this.scene.add(this.particles);

    this.controls = this.createCameraControls();
    this.resetCamera();

    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);

    this.resize();
    void this.loadGpu();
    void this.loadBitcoin();
    this.renderer.setAnimationLoop((time) => this.animate(time));
  }

  update(world: MiningWorld, mining: boolean): void {
    this.selectedId = world.selectedId;
    this.isMining = mining;
    this.removeMissingBlocks(world);

    for (const block of world.blocks) {
      const visual = this.blocks.get(block.id) ?? this.addBlock(block.id);
      this.updateBlockAppearance(block, visual);
    }

    const returnedToFirstBlock = world.blocks.length === 1 && this.controls.target.x > 1;
    if (returnedToFirstBlock) {
      this.resetCamera();
    }
  }

  resetCamera(): void {
    const expanded = this.blocks.size > 1;
    const target = expanded ? new THREE.Vector3(2.5, 1, -2.5) : new THREE.Vector3(0.7, 1, -0.7);
    const offset = expanded ? new THREE.Vector3(15, 12, 18) : new THREE.Vector3(9, 7, 12);

    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);

    // I cloni delle GPU condividono geometrie e materiali con il modello originale.
    this.disposeObject(this.scene, true);
    if (this.gpu) {
      this.disposeObject(this.gpu);
    }
    if (this.bitcoin) {
      this.disposeObject(this.bitcoin);
    }

    this.mixers.clear();
    this.renderer.dispose();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    return renderer;
  }

  private addLighting(): void {
    this.scene.fog = new THREE.FogExp2(0x141c19, 0.024);
    this.scene.add(new THREE.HemisphereLight(0xe8ffe1, 0x344738, 2.7));
    const sun = new THREE.DirectionalLight(0xffefd5, 4.5);
    sun.position.set(-3, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -12;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9ad4ac, 2.3);
    rim.position.set(5, 7, -8);
    this.scene.add(rim);
  }

  private addGround(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshStandardMaterial({ color: 0x19241e, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.5;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(70, 70, 0x35473b, 0x2c3c32);
    grid.position.y = -0.49;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    this.scene.add(grid);
  }

  private addLockedTiles(): void {
    BLOCK_POSITIONS.forEach(([x, z], index) => {
      const tile = createLockedTile();
      tile.position.set(x, -0.4, z);
      this.scene.add(tile);
      this.locked.set(index + 1, tile);
    });
  }

  private createCameraControls(): OrbitControls {
    const controls = new OrbitControls(this.camera, this.canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = MIN_CAMERA_DISTANCE;
    controls.maxDistance = MAX_CAMERA_DISTANCE;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2.3;
    return controls;
  }

  private removeMissingBlocks(world: MiningWorld): void {
    for (const [id, block] of this.blocks) {
      if (!world.blocks.some((item) => item.id === id)) {
        this.scene.remove(block.root);
        this.disposeObject(block.root, true);
        this.blocks.delete(id);
        this.mixers.delete(id);
        this.locked.get(id)!.visible = true;
      }
    }
  }

  private addBlock(id: number): BlockMesh {
    const visual = createBlock(id);
    const [x, z] = BLOCK_POSITIONS[id - 1];
    visual.root.position.set(x, 0, z);
    this.blocks.set(id, visual);
    this.scene.add(visual.root);
    this.locked.get(id)!.visible = false;

    if (this.gpu) {
      this.attachGpu(id, visual);
    }
    if (this.bitcoin) {
      this.attachBitcoin(visual);
    }

    return visual;
  }

  private updateBlockAppearance(block: MiningBlock, visual: BlockMesh): void {
    const selected = block.id === this.selectedId;
    const activelyMining = this.isMining && selected;
    const oreScale = block.progress === 100 ? 0.45 : 1 - block.progress * 0.004;

    visual.outline.visible = selected;
    visual.ore.scale.setScalar(oreScale);
    visual.beam.visible = activelyMining;
    visual.light.intensity = activelyMining ? 5 : 0;
  }

  private async loadGpu(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(GPU_MODEL_PATH);
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      const model = gltf.scene;
      this.fitGpuToBlock(model);
      this.styleGpuMaterials(model);
      this.gpu = new THREE.Group();
      this.gpu.add(model);
      this.clips = gltf.animations;
    } catch {
      if (this.disposed) {
        return;
      }
      this.gpu = createFallbackGpu(GPU_MODEL_WIDTH);
    }
    for (const [id, block] of this.blocks) {
      this.attachGpu(id, block);
    }
  }

  private async loadBitcoin(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(BITCOIN_MODEL_PATH);
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      this.fitBitcoinToBlock(gltf.scene);
      this.bitcoin = gltf.scene;
    } catch {
      return;
    }

    for (const block of this.blocks.values()) {
      this.attachBitcoin(block);
    }
  }

  private fitBitcoinToBlock(model: THREE.Group): void {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 0.9 / Math.max(size.x, size.y);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }

  private attachBitcoin(block: BlockMesh): void {
    if (!this.bitcoin) {
      return;
    }

    for (let index = 0; index < 5; index++) {
      const coin = this.cloneBitcoin();
      coin.rotation.x = Math.PI / 2;
      coin.rotation.z = (index % 2) * 0.04;
      coin.position.set((index % 2) * 0.035, 0.04 + index * 0.09, 0);
      block.ore.add(coin);
    }
  }

  private cloneBitcoin(): THREE.Group {
    const clone = this.bitcoin!.clone(true);
    clone.userData['sharedModel'] = true;
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }

  private fitGpuToBlock(model: THREE.Group): void {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());

    // Il lato più sottile diventa l'altezza della scheda sul supporto.
    if (size.z < size.x && size.z < size.y) {
      model.rotation.x -= Math.PI / 2;
    } else if (size.x < size.y && size.x < size.z) {
      model.rotation.z += Math.PI / 2;
    }

    bounds.setFromObject(model).getSize(size);
    if (size.z > size.x) {
      model.rotation.y += Math.PI / 2;
    }

    bounds.setFromObject(model).getSize(size);
    model.scale.multiplyScalar(GPU_MODEL_WIDTH / Math.max(size.x, size.z));

    bounds.setFromObject(model);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z));
  }

  private styleGpuMaterials(model: THREE.Group): void {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }

      object.castShadow = true;
      object.receiveShadow = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];

      for (const material of materials) {
        if (!(material instanceof THREE.MeshStandardMaterial)) {
          continue;
        }

        material.flatShading = true;
        // ".002" è il materiale arancione nel modello originale.
        if (material.name === '.002') {
          material.color.set(0xb8f575);
        }
        material.needsUpdate = true;
      }
    });
  }

  private attachGpu(id: number, block: BlockMesh): void {
    const clone = this.gpu!.clone(true);
    clone.userData['sharedGpu'] = true;
    block.gpuMount.add(clone);
    if (this.clips.length) {
      const mixer = new THREE.AnimationMixer(clone);
      this.clips.forEach((clip) => mixer.clipAction(clip).play());
      this.mixers.set(id, mixer);
    }
  }

  private createParticles(): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions[i * 3] = Math.sin(i * 17.3) * 1.7;
      positions[i * 3 + 1] = (i / PARTICLE_COUNT) * PARTICLE_HEIGHT;
      positions[i * 3 + 2] = Math.cos(i * 8.1) * 1.7;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xd6ff9d, size: 0.075, transparent: true, opacity: 0.85 }),
    );
  }

  private animate(time: number): void {
    const delta = Math.min((time - this.lastFrame) / 1000, 0.05);
    this.lastFrame = time;
    this.controls.update();
    this.particles.visible = this.isMining;
    if (this.isMining) {
      this.animateParticles(delta);
      this.mixers.get(this.selectedId)?.update(delta * 3);
    }
    this.renderer.render(this.scene, this.camera);
  }

  private animateParticles(delta: number): void {
    const [x, z] = BLOCK_POSITIONS[this.selectedId - 1];
    this.particles.position.set(x, WORKBENCH_SURFACE_Y + 0.15, z);

    const positions = this.particles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      const height = (positions.getY(i) + delta * 1.3) % PARTICLE_HEIGHT;
      positions.setY(i, height);
    }
    positions.needsUpdate = true;
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) {
      return;
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDown.set(event.clientX, event.clientY);
  };
  private readonly handlePointerUp = (event: PointerEvent): void => {
    const pointerEnd = new THREE.Vector2(event.clientX, event.clientY);
    const dragged = this.pointerDown.distanceTo(pointerEnd) > MAX_CLICK_MOVEMENT;
    if (dragged) {
      return;
    }

    const blockId = this.findBlockAtPointer(event);
    if (blockId !== undefined) {
      this.onSelect(blockId);
    }
  };

  private findBlockAtPointer(event: PointerEvent): number | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.blocks.values()].map((block) => block.root),
      true,
    );
    if (!hits.length) {
      return;
    }
    let object: THREE.Object3D | null = hits[0].object;
    while (object && !object.userData['blockId']) {
      object = object.parent;
    }
    return object?.userData['blockId'];
  }

  private disposeObject(object: THREE.Object3D, preserveGpu = false): void {
    if (preserveGpu && (object.userData['sharedGpu'] || object.userData['sharedModel'])) {
      return;
    }
    if (
      object instanceof THREE.Mesh ||
      object instanceof THREE.LineSegments ||
      object instanceof THREE.Points
    ) {
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('map' in material && material.map instanceof THREE.Texture) {
          material.map.dispose();
        }
        material.dispose();
      }
    }
    for (const child of object.children) {
      this.disposeObject(child, preserveGpu);
    }
  }
}
