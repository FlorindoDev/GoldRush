import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  GPUS_PER_RIG,
  MiningWorld,
  plotCount,
  RIGS_PER_PLOT,
  rigCount,
  rigIdForGpu,
} from '../game/mining-world';
import { BITCOIN_MODEL_PATH } from '../shared/bitcoin-asset';
import { createFallbackGpu } from './objects/fallback-gpu';
import {
  createGpuMiningRig,
  createLockedRigTile,
  createRigPlot,
  GpuMiningRig,
  RigSlot,
} from './objects/gpu-mining-rig';
import { SceneCameraController } from './camera/scene-camera-controller';
import { createSceneEnvironment } from './environment/scene-environment';
import {
  addBitcoinStack,
  fitBitcoinModel,
  fitGpuModel,
  styleGpuModel,
} from './objects/scene-models';
import { rigPlotCenter, rigPosition, TOOL_AREA_POSITION } from './environment/scene-layout';
import { easeTransition, transitionProgress } from './camera/scene-transition';
import { createToolArea } from './tools/tool-area';
import { createWorkbench, WorkbenchMesh } from './tools/workbench-mesh';
import { toolStationCamera, toolStationPosition, type ToolStationId } from './tools/tool-stations';

const PARTICLE_COUNT = 28;
const PARTICLE_HEIGHT = 3;
const GPU_MODEL_PATH = 'models/modello-gpu/scene.gltf';
const GPU_MODEL_WIDTH = 2.4;
const VISIBLE_LOCKED_RIGS = 3;
const RIG_TARGET = new THREE.Vector3(0, 1, -1.5);
const RIG_CAMERA_OFFSET = new THREE.Vector3(12, 10, 23);
const PLOT_TOP_CAMERA_OFFSET = new THREE.Vector3(0, 35, 8.4);
const TOOL_TOP_CAMERA_OFFSET = new THREE.Vector3(0, 18, 3.8);

export type CameraPreset = 'front' | 'top';

interface GpuTransfer {
  readonly from: THREE.Vector3;
  readonly to: THREE.Vector3;
  readonly fromRotation: THREE.Quaternion;
  readonly toRotation: THREE.Quaternion;
  elapsed: number;
}

export class MiningScene {
  private readonly scene = createSceneEnvironment();
  private readonly camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cameraController: SceneCameraController;
  private readonly observer: ResizeObserver;
  private readonly rigs = new Map<number, GpuMiningRig>();
  private readonly plots = new Map<number, THREE.Group>();
  private readonly lockedRigTiles = new Map<number, THREE.Group>();
  private readonly workbench: WorkbenchMesh;
  private readonly gpus = new Map<number, THREE.Group>();
  private readonly transfers = new Map<number, GpuTransfer>();
  private readonly mixers = new Map<number, THREE.AnimationMixer>();
  private readonly particles: THREE.Points;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private gpu = createFallbackGpu(GPU_MODEL_WIDTH);
  private bitcoin?: THREE.Group;
  private clips: THREE.AnimationClip[] = [];
  private selectedId = 1;
  private viewedPlotId = 1;
  private selectedToolStationId: ToolStationId | null = null;
  private cameraPreset: CameraPreset = 'front';
  private inspectedGpuId: number | null = null;
  private isMining = false;
  private disposed = false;
  private lastFrame = 0;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onSelect: (id: number) => void,
  ) {
    this.renderer = this.createRenderer();
    this.cameraController = new SceneCameraController(canvas, this.camera, this.reducedMotion);
    const toolArea = createToolArea();
    toolArea.position.copy(TOOL_AREA_POSITION);
    this.scene.add(toolArea);
    this.workbench = createWorkbench();
    this.workbench.root.position.copy(toolStationPosition('workbench'));
    this.scene.add(this.workbench.root);
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    this.resetCamera();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    this.resize();
    void this.loadGpu();
    void this.loadBitcoin();
    this.renderer.setAnimationLoop((time) => this.animate(time));
  }

  update(
    world: MiningWorld,
    mining: boolean,
    inspectedGpuId: number | null,
    viewedPlotId: number,
    cameraPreset: CameraPreset,
    selectedToolStationId: ToolStationId | null,
  ): void {
    const inspection = world.blocks.some((block) => block.id === inspectedGpuId)
      ? inspectedGpuId
      : null;
    const inspectionChanged = inspection !== this.inspectedGpuId;
    const plotChanged = viewedPlotId !== this.viewedPlotId;
    const cameraPresetChanged = cameraPreset !== this.cameraPreset;
    const toolStationChanged = selectedToolStationId !== this.selectedToolStationId;
    this.selectedId = world.selectedId;
    this.inspectedGpuId = inspection;
    this.isMining = mining;
    this.viewedPlotId = viewedPlotId;
    this.cameraPreset = cameraPreset;
    this.selectedToolStationId = selectedToolStationId;
    this.syncPlots(world);
    this.syncRigs(world);
    this.syncGpus(world);
    this.updateAppearance(world);
    if (inspectionChanged) {
      for (const [id, gpu] of this.gpus) {
        this.transferGpu(id, gpu);
      }
    }
    if (inspectionChanged || plotChanged || cameraPresetChanged || toolStationChanged) {
      this.focusInspection();
    }
  }

  resetCamera(): void {
    this.cameraController.reset(
      rigPlotCenter(this.viewedPlotId).add(RIG_TARGET),
      RIG_CAMERA_OFFSET,
    );
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.cameraController.dispose();
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.mixers.forEach((mixer) => mixer.stopAllAction());
    // Clones share their model's geometry and materials; only the template owns them.
    this.disposeObject(this.scene, true);
    this.disposeObject(this.gpu);
    if (this.bitcoin) {
      this.disposeObject(this.bitcoin);
    }
    this.gpus.clear();
    this.rigs.clear();
    this.plots.clear();
    this.lockedRigTiles.clear();
    this.mixers.clear();
    this.transfers.clear();
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

  private syncPlots(world: MiningWorld): void {
    const count = Math.max(
      plotCount(world),
      Math.ceil((rigCount(world) + VISIBLE_LOCKED_RIGS) / RIGS_PER_PLOT),
    );
    for (const [id, plot] of this.plots) {
      if (id > count) {
        this.scene.remove(plot);
        this.disposeObject(plot);
        this.plots.delete(id);
      }
    }
    for (let id = 1; id <= count; id++) {
      if (this.plots.has(id)) {
        continue;
      }
      const plot = createRigPlot(id);
      plot.position.copy(rigPlotCenter(id));
      this.plots.set(id, plot);
      this.scene.add(plot);
    }
  }

  private syncRigs(world: MiningWorld): void {
    const count = rigCount(world);
    for (const [id, tile] of this.lockedRigTiles) {
      if (id <= count || id > count + VISIBLE_LOCKED_RIGS) {
        this.scene.remove(tile);
        this.disposeObject(tile);
        this.lockedRigTiles.delete(id);
      }
    }
    for (const [id, rig] of this.rigs) {
      if (id > count) {
        this.scene.remove(rig.root);
        this.disposeObject(rig.root);
        this.rigs.delete(id);
      }
    }
    for (let id = 1; id <= count; id++) {
      if (this.rigs.has(id)) {
        continue;
      }
      const rig = createGpuMiningRig(id);
      rig.root.position.copy(rigPosition(id));
      this.rigs.set(id, rig);
      this.scene.add(rig.root);
    }
    for (let id = count + 1; id <= count + VISIBLE_LOCKED_RIGS; id++) {
      if (this.lockedRigTiles.has(id)) {
        continue;
      }
      const tile = createLockedRigTile(id);
      tile.position.copy(rigPosition(id));
      tile.position.y = -0.42;
      this.lockedRigTiles.set(id, tile);
      this.scene.add(tile);
    }
  }

  private gpuSlot(id: number): RigSlot {
    return this.rigs.get(rigIdForGpu(id))!.slots[(id - 1) % GPUS_PER_RIG];
  }

  private gpuHomePosition(id: number): THREE.Vector3 {
    const rig = this.rigs.get(rigIdForGpu(id))!;
    return rig.root.localToWorld(this.gpuSlot(id).position.clone());
  }

  private syncGpus(world: MiningWorld): void {
    const ids = new Set(world.blocks.map((block) => block.id));
    for (const [id, gpu] of this.gpus) {
      if (!ids.has(id)) {
        this.scene.remove(gpu);
        this.mixers.get(id)?.stopAllAction();
        this.mixers.delete(id);
        this.transfers.delete(id);
        this.gpus.delete(id);
      }
    }
    for (const block of world.blocks) {
      if (this.gpus.has(block.id)) {
        continue;
      }
      const gpu = new THREE.Group();
      gpu.name = `gpu-${block.id}`;
      gpu.userData['blockId'] = block.id;
      const slot = this.gpuSlot(block.id);
      gpu.position.copy(this.gpuHomePosition(block.id));
      gpu.quaternion.copy(slot.orientation);
      this.attachGpu(block.id, gpu);
      this.gpus.set(block.id, gpu);
      this.scene.add(gpu);
    }
  }

  private updateAppearance(world: MiningWorld): void {
    const blocks = new Map(world.blocks.map((block) => [block.id, block]));
    for (const [rigId, rig] of this.rigs) {
      for (const [index, slot] of rig.slots.entries()) {
        const id = (rigId - 1) * GPUS_PER_RIG + index + 1;
        const block = blocks.get(id);
        const inspecting = id === this.inspectedGpuId;
        const mining = this.isMining && id === this.selectedId;
        const color = !block ? 0x283630 : inspecting ? 0xe7c77e : 0xb8f575;
        slot.indicator.material.color.set(color);
        slot.indicator.material.emissive.set(color);
        slot.indicator.material.emissiveIntensity = mining ? 2 : block ? 0.45 : 0;
        slot.outline.visible = inspecting || mining;
        slot.cable.visible = !!block && !inspecting;
      }
    }
    const inspected = world.blocks.find((block) => block.id === this.inspectedGpuId);
    const miningOnBench = this.isMining && this.selectedId === this.inspectedGpuId;
    this.workbench.outline.visible = !!inspected;
    this.workbench.beam.visible = miningOnBench;
    this.workbench.light.intensity = miningOnBench ? 5 : 0;
  }

  private transferGpu(id: number, gpu: THREE.Group): void {
    const slot = this.gpuSlot(id);
    const inspecting = id === this.inspectedGpuId;
    const to = inspecting
      ? this.workbench.gpuMount.getWorldPosition(new THREE.Vector3())
      : this.gpuHomePosition(id);
    const toRotation = inspecting
      ? this.workbench.gpuMount.getWorldQuaternion(new THREE.Quaternion())
      : slot.orientation.clone();
    if (gpu.position.distanceToSquared(to) < 0.0001 && gpu.quaternion.angleTo(toRotation) < 0.001) {
      this.transfers.delete(id);
      return;
    }
    this.transfers.set(id, {
      from: gpu.position.clone(),
      to,
      fromRotation: gpu.quaternion.clone(),
      toRotation,
      elapsed: 0,
    });
  }

  private focusInspection(): void {
    if (this.inspectedGpuId !== null) {
      const camera = toolStationCamera('workbench');
      this.cameraController.focus(camera.target, this.toolCameraOffset(camera.offset));
      return;
    }

    if (this.selectedToolStationId !== null) {
      const camera = toolStationCamera(this.selectedToolStationId);
      this.cameraController.focus(camera.target, this.toolCameraOffset(camera.offset));
      return;
    }

    const target = rigPlotCenter(this.viewedPlotId).add(RIG_TARGET);
    const offset = this.cameraPreset === 'top' ? PLOT_TOP_CAMERA_OFFSET : RIG_CAMERA_OFFSET;
    this.cameraController.focus(target, offset);
  }

  private toolCameraOffset(frontOffset: THREE.Vector3): THREE.Vector3 {
    return this.cameraPreset === 'top' ? TOOL_TOP_CAMERA_OFFSET : frontOffset;
  }

  private animateTransfers(delta: number): void {
    for (const [id, transfer] of this.transfers) {
      const gpu = this.gpus.get(id)!;
      transfer.elapsed += delta;
      const progress = transitionProgress(transfer.elapsed, this.reducedMotion.matches);
      const eased = easeTransition(progress);
      gpu.position.lerpVectors(transfer.from, transfer.to, eased);
      gpu.position.y += Math.sin(progress * Math.PI) * 1.4;
      gpu.quaternion.slerpQuaternions(transfer.fromRotation, transfer.toRotation, eased);
      if (progress === 1) {
        this.transfers.delete(id);
      }
    }
  }

  private async loadGpu(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(GPU_MODEL_PATH);
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      const previous = this.gpu;
      fitGpuModel(gltf.scene, GPU_MODEL_WIDTH);
      styleGpuModel(gltf.scene);
      this.gpu = new THREE.Group();
      this.gpu.add(gltf.scene);
      this.clips = gltf.animations;
      for (const [id, gpu] of this.gpus) {
        gpu.clear();
        this.attachGpu(id, gpu);
      }
      this.disposeObject(previous);
    } catch {
      // The procedural GPU is already mounted and remains selectable offline.
    }
  }

  private async loadBitcoin(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(BITCOIN_MODEL_PATH);
      if (this.disposed) {
        this.disposeObject(gltf.scene);
        return;
      }
      fitBitcoinModel(gltf.scene);
      this.bitcoin = gltf.scene;
      addBitcoinStack(this.bitcoin, this.workbench.ore);
    } catch {
      // The workbench remains usable without the decorative coin model.
    }
  }

  private attachGpu(id: number, root: THREE.Group): void {
    const clone = this.gpu.clone(true);
    clone.userData['sharedGpu'] = true;
    root.add(clone);
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
      positions[i * 3] = Math.sin(i * 17.3) * 0.9;
      positions[i * 3 + 1] = (i / PARTICLE_COUNT) * PARTICLE_HEIGHT;
      positions[i * 3 + 2] = Math.cos(i * 8.1) * 0.9;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const particles = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xd6ff9d, size: 0.075, transparent: true, opacity: 0.85 }),
    );
    particles.visible = false;
    return particles;
  }

  private animate(time: number): void {
    const delta = Math.min((time - this.lastFrame) / 1000, 0.05);
    this.lastFrame = time;
    this.animateTransfers(delta);
    this.cameraController.update(delta);
    this.particles.visible = this.isMining;
    if (this.isMining) {
      this.animateParticles(delta);
      this.mixers.get(this.selectedId)?.update(delta * 3);
      if (!this.reducedMotion.matches) {
        this.rigs.get(rigIdForGpu(this.selectedId))?.fans.forEach((fan) => {
          fan.rotation.z -= delta * 7;
        });
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private animateParticles(delta: number): void {
    const gpu = this.gpus.get(this.selectedId);
    if (!gpu) {
      return;
    }
    this.particles.position.copy(gpu.position);
    this.particles.position.y += 0.3;
    const positions = this.particles.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, (positions.getY(i) + delta * 1.3) % PARTICLE_HEIGHT);
    }
    positions.needsUpdate = true;
  }

  private resize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) {
      return;
    }
    this.cameraController.resize(width, height);
    this.renderer.setSize(width, height, false);
  }

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (!this.cameraController.finishPointer(event)) {
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
      [
        ...this.gpus.values(),
        ...[...this.rigs.values()].map((rig) => rig.root),
        this.workbench.root,
      ],
      true,
    );
    let object: THREE.Object3D | null =
      hits.find((hit) => hit.object instanceof THREE.Mesh)?.object ?? null;
    while (object && !object.userData['blockId']) {
      object = object.parent;
    }
    return object?.userData['blockId'];
  }

  private disposeObject(object: THREE.Object3D, preserveShared = false): void {
    if (preserveShared && (object.userData['sharedGpu'] || object.userData['sharedModel'])) {
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
      this.disposeObject(child, preserveShared);
    }
  }
}
