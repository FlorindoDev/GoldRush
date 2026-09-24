import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAME_BALANCE } from '../config/game-balance';
import {
  GPUS_PER_RIG,
  isGpuUnlocked,
  MiningWorld,
  plotCount,
  rigIdForGpu,
} from '../game/mining-world';
import { BITCOIN_MODEL_PATH } from '../assets/models/bitcoin/bitcoin-model-path';
import { createGpuMiningRig, createRigPlot, type GpuMiningRig } from './models/gpu-mining-rig';
import { createRigUnlockTile, RigUnlockTile } from './models/rig-unlock-tile';
import { SceneCameraController } from './camera/scene-camera-controller';
import { resolveCameraFocus, rigCameraFocus } from './camera/camera-focus';
import type { CameraPreset } from './camera/camera-preset';
import { createSceneEnvironment } from './environment/scene-environment';
import { addBitcoinStack, fitBitcoinModel } from './models/bitcoin-model';
import { rigPlotCenter, rigPosition, TOOL_AREA_POSITION } from './environment/scene-layout';
import { GpuVisuals, type GpuPose } from './gpu-visuals';
import { disposeObject } from './resources/dispose-object';
import { createToolArea } from './tools/tool-area';
import { createWorkbench, WorkbenchMesh } from './tools/workbench-mesh';
import { toolStationPosition, type ToolStationId } from './tools/tool-stations';

const CAMERA = GAME_BALANCE.camera.scene;
const ANIMATION = GAME_BALANCE.animation;
const PARTICLE_COUNT = ANIMATION.particleCount;
const PARTICLE_HEIGHT = ANIMATION.particleHeight;
const GPU_FAN_SPEED = ANIMATION.gpuFanRadiansPerSecond;

export class MiningScene {
  private readonly scene = createSceneEnvironment();
  private readonly camera = new THREE.PerspectiveCamera(
    CAMERA.fieldOfViewDegrees,
    1,
    CAMERA.near,
    CAMERA.far,
  );
  private readonly renderer: THREE.WebGLRenderer;
  private readonly cameraController: SceneCameraController;
  private readonly observer: ResizeObserver;
  private readonly rigs = new Map<number, GpuMiningRig>();
  private readonly rigUnlockTiles = new Map<number, RigUnlockTile>();
  private readonly plots = new Map<number, THREE.Group>();
  private readonly workbench: WorkbenchMesh;
  private readonly gpuVisuals: GpuVisuals;
  private readonly particles: THREE.Points;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private bitcoin?: THREE.Group;
  private viewedPlotId = 1;
  private viewedRigId = 1;
  private selectedToolStationId: ToolStationId | null = null;
  private cameraPreset: CameraPreset = 'front';
  private inspectedGpuId: number | null = null;
  private isMining = false;
  private disposed = false;
  private lastFrame = 0;
  private particleElapsed = 0;
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
    this.gpuVisuals = new GpuVisuals(
      this.scene,
      (id) => this.gpuHomePose(id),
      this.workbench.gpuMount,
    );
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    this.resetCamera();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    this.resize();
    void this.gpuVisuals.loadModel();
    void this.loadBitcoin();
    this.renderer.setAnimationLoop((time) => this.animate(time));
  }

  update(
    world: MiningWorld,
    mining: boolean,
    inspectedGpuId: number | null,
    viewedPlotId: number,
    viewedRigId: number,
    cameraPreset: CameraPreset,
    selectedToolStationId: ToolStationId | null,
  ): void {
    const inspection =
      inspectedGpuId !== null && isGpuUnlocked(world, inspectedGpuId) ? inspectedGpuId : null;
    const inspectionChanged = inspection !== this.inspectedGpuId;
    const plotChanged = viewedPlotId !== this.viewedPlotId;
    const rigChanged = viewedRigId !== this.viewedRigId;
    const cameraPresetChanged = cameraPreset !== this.cameraPreset;
    const toolStationChanged = selectedToolStationId !== this.selectedToolStationId;
    this.inspectedGpuId = inspection;
    this.isMining = mining;
    this.viewedPlotId = viewedPlotId;
    this.viewedRigId = viewedRigId;
    this.cameraPreset = cameraPreset;
    this.selectedToolStationId = selectedToolStationId;
    this.syncPlots(world);
    this.syncRigUnlockTiles(world);
    this.syncRigs(world);
    this.gpuVisuals.sync(world, inspection);
    this.updateAppearance(world);
    if (
      inspectionChanged ||
      plotChanged ||
      rigChanged ||
      cameraPresetChanged ||
      toolStationChanged
    ) {
      const focus = resolveCameraFocus({
        viewedRigId,
        cameraPreset,
        inspectedGpuId: inspection,
        selectedToolStationId,
      });
      this.cameraController.focus(focus.target, focus.offset);
    }
  }

  resetCamera(): void {
    const focus = rigCameraFocus(this.viewedRigId, 'front');
    this.cameraController.reset(focus.target, focus.offset);
  }

  dispose(): void {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.observer.disconnect();
    this.cameraController.dispose();
    this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    this.gpuVisuals.dispose();
    // Clones share their model's geometry and materials; only the template owns them.
    disposeObject(this.scene, true);
    if (this.bitcoin) {
      disposeObject(this.bitcoin);
    }
    this.rigs.clear();
    this.rigUnlockTiles.clear();
    this.plots.clear();
    this.renderer.dispose();
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, GAME_BALANCE.scene.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = GAME_BALANCE.scene.exposure;
    return renderer;
  }

  private syncPlots(world: MiningWorld): void {
    const count = plotCount(world);
    for (const [id, plot] of this.plots) {
      if (id > count) {
        this.scene.remove(plot);
        disposeObject(plot);
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

  private syncRigUnlockTiles(world: MiningWorld): void {
    const rigIds = new Set<number>();
    for (const plot of world.plots) {
      for (const rig of plot.rigs) {
        rigIds.add(rig.id);
        const current = this.rigUnlockTiles.get(rig.id);
        if (current) {
          current.setUnlocked(rig.unlocked);
          continue;
        }

        const tile = createRigUnlockTile(rig.id, rig.unlocked);
        tile.root.position.copy(rigPosition(rig.id));
        tile.root.position.y = -0.42;
        this.rigUnlockTiles.set(rig.id, tile);
        this.scene.add(tile.root);
      }
    }

    for (const [id, tile] of this.rigUnlockTiles) {
      if (rigIds.has(id)) {
        continue;
      }
      this.scene.remove(tile.root);
      disposeObject(tile.root);
      this.rigUnlockTiles.delete(id);
    }
  }

  private syncRigs(world: MiningWorld): void {
    const unlockedRigIds = new Set<number>();
    for (const plot of world.plots) {
      for (const rig of plot.rigs) {
        if (!rig.unlocked) {
          continue;
        }
        unlockedRigIds.add(rig.id);
        if (this.rigs.has(rig.id)) {
          continue;
        }

        const miningRig = createGpuMiningRig(rig.id);
        miningRig.root.position.copy(rigPosition(rig.id));
        this.rigs.set(rig.id, miningRig);
        this.scene.add(miningRig.root);
      }
    }

    for (const [id, rig] of this.rigs) {
      if (unlockedRigIds.has(id)) {
        continue;
      }
      this.scene.remove(rig.root);
      disposeObject(rig.root);
      this.rigs.delete(id);
    }
  }

  private gpuHomePose(id: number): GpuPose {
    const rig = this.rigs.get(rigIdForGpu(id))!;
    const slot = rig.slots[(id - 1) % GPUS_PER_RIG]!;
    return {
      position: rig.root.localToWorld(slot.position.clone()),
      rotation: rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(slot.orientation),
    };
  }

  private updateAppearance(world: MiningWorld): void {
    for (const [rigId, rig] of this.rigs) {
      for (const [index, slot] of rig.slots.entries()) {
        const gpuId = (rigId - 1) * GPUS_PER_RIG + index + 1;
        const unlocked = isGpuUnlocked(world, gpuId);
        const inspecting = gpuId === this.inspectedGpuId;
        const mining = this.isMining && unlocked;
        const color = !unlocked ? 0x283630 : inspecting ? 0xe7c77e : 0xb8f575;
        slot.indicator.material.color.set(color);
        slot.indicator.material.emissive.set(color);
        slot.indicator.material.emissiveIntensity = mining ? 2 : unlocked ? 0.45 : 0;
        slot.outline.visible = inspecting || mining;
        slot.cable.visible = unlocked && !inspecting;
      }
    }

    const miningOnBench = this.isMining && this.inspectedGpuId !== null;
    this.workbench.outline.visible = this.inspectedGpuId !== null;
    this.workbench.beam.visible = miningOnBench;
    this.workbench.light.intensity = miningOnBench ? 5 : 0;
  }

  private async loadBitcoin(): Promise<void> {
    try {
      const gltf = await new GLTFLoader().loadAsync(BITCOIN_MODEL_PATH);
      if (this.disposed) {
        disposeObject(gltf.scene);
        return;
      }
      fitBitcoinModel(gltf.scene);
      this.bitcoin = gltf.scene;
      addBitcoinStack(this.bitcoin, this.workbench.ore);
    } catch {
      // The workbench remains usable without the decorative coin model.
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
    this.gpuVisuals.update(delta, this.isMining, this.reducedMotion.matches);
    this.cameraController.update(delta);
    this.particles.visible = this.isMining;
    if (this.isMining) {
      this.animateParticles(delta);
      if (!this.reducedMotion.matches) {
        this.rigs.forEach((rig) =>
          rig.fans.forEach((fan) => {
            fan.rotation.z -= delta * GPU_FAN_SPEED;
          }),
        );
      }
    }
    this.renderer.render(this.scene, this.camera);
  }

  private animateParticles(delta: number): void {
    this.particleElapsed += delta;
    const positions = this.particles.geometry.getAttribute('position');
    const gpus = this.gpuVisuals.objects;
    if (gpus.length === 0) {
      return;
    }

    for (let i = 0; i < positions.count; i++) {
      const gpu = gpus[i % gpus.length];
      const phase =
        ((i / PARTICLE_COUNT) * PARTICLE_HEIGHT +
          this.particleElapsed * ANIMATION.particlePhaseSpeed) %
        PARTICLE_HEIGHT;
      positions.setXYZ(
        i,
        gpu.position.x + Math.sin(i * 17.3) * 0.62,
        gpu.position.y + 0.3 + phase,
        gpu.position.z + Math.cos(i * 8.1) * 0.45,
      );
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
    const gpuId = this.findGpuAtPointer(event);
    if (gpuId !== undefined) {
      this.onSelect(gpuId);
    }
  };

  private findGpuAtPointer(event: PointerEvent): number | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.gpuVisuals.objects, this.workbench.root],
      true,
    );
    let object: THREE.Object3D | null =
      hits.find((hit) => hit.object instanceof THREE.Mesh)?.object ?? null;
    while (object && !object.userData['gpuId']) {
      object = object.parent;
    }
    return object?.userData['gpuId'];
  }
}
