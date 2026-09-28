import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GAME_BALANCE } from '../config/game-balance';
import { gpuHasLiquidCooling } from '../config/gpu-config';
import {
  gpuIdForRigSlot,
  gpuSlotIndex,
  getGpu,
  getRig,
  isGpuUnlocked,
  isRigUnlocked,
  MiningWorld,
  plotCount,
  rigIdForGpu,
} from '../game/mining-world';
import { BITCOIN_MODEL_PATH } from '../assets/models/bitcoin/bitcoin-model-path';
import { createGpuMiningRig, createRigPlot, type GpuMiningRig } from './models/gpu-mining-rig';
import { createRigLiquidHoses, type LiquidGpuConnection } from './models/rig-liquid-hoses';
import { createRigSlotTile, RigSlotTile } from './models/rig-slot-tile';
import { SceneCameraController } from './camera/scene-camera-controller';
import { resolveCameraFocus, rigCameraFocus } from './camera/camera-focus';
import type { CameraPreset } from './camera/camera-preset';
import { createSceneEnvironment } from './environment/scene-environment';
import { addBitcoinStack, fitBitcoinModel } from './models/bitcoin-model';
import { rigPlotCenter, rigPosition, TOOL_AREA_POSITION } from './environment/scene-layout';
import { GpuVisuals, type GpuPose } from './gpu-visuals';
import type { GpuTelemetry } from '../game/gpu-telemetry';
import { disposeObject } from './resources/dispose-object';
import { SceneAssets } from './resources/scene-assets';
import { createWorkbench, WorkbenchMesh } from './tools/workbench-mesh';
import {
  createRigWorkbench,
  fitRigOnWorkbench,
  type RigWorkbenchMesh,
} from './tools/rig-workbench-mesh';
import { toolStationPosition, type ToolStationId } from './tools/tool-stations';

const CAMERA = GAME_BALANCE.camera.scene;
const ANIMATION = GAME_BALANCE.animation;
const PARTICLE_COUNT = ANIMATION.particleCount;
const PARTICLE_HEIGHT = ANIMATION.particleHeight;
const GPU_FAN_SPEED = ANIMATION.gpuFanRadiansPerSecond;

interface GpuInteractions {
  openComputer(): void;
  select(id: number): void;
  inspect(id: number): void;
  viewRig(id: number): void;
  inspectRig(id: number): void;
  hover(id: number | null, x: number, y: number): void;
  contextMenu(target: { kind: 'gpu'; id: number } | null, x: number, y: number): void;
  telemetry(id: number): GpuTelemetry;
}

export class MiningScene {
  private readonly scene: THREE.Scene;
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
  private readonly rigSlotTiles = new Map<number, RigSlotTile>();
  private readonly plots = new Map<number, THREE.Group>();
  private readonly workbench: WorkbenchMesh;
  private readonly rigWorkbench: RigWorkbenchMesh;
  private readonly computer: THREE.Group;
  private readonly gpuVisuals: GpuVisuals;
  private readonly particles: THREE.Points;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private bitcoin?: THREE.Group;
  private viewedPlotId = 1;
  private viewedRigId = 1;
  private selectedToolStationId: ToolStationId | null = null;
  private computerOpen = false;
  private cameraPreset: CameraPreset = 'front';
  private inspectedGpuId: number | null = null;
  private selectedGpuId: number | null = null;
  private lastClickedGpuId: number | null = null;
  private previousClickedGpuId: number | null = null;
  private lastClickedRigId: number | null = null;
  private previousClickedRigId: number | null = null;
  private readonly previousRigClickPosition = new THREE.Vector2();
  private lastRigClickPosition = new THREE.Vector2();
  private previousRigClickTime = 0;
  private lastRigClickTime = 0;
  private previewRigId: number | null = null;
  private previewRigSetupKey = '';
  private isMining = false;
  private isPaused = false;
  private activeGpuIds: readonly number[] = [];
  private disposed = false;
  private lastFrame = 0;
  private particleElapsed = 0;
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private contextPointerStart: { x: number; y: number } | null = null;
  private currentWorld?: MiningWorld;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly interactions: GpuInteractions,
    private readonly assets: SceneAssets,
  ) {
    this.scene = createSceneEnvironment(assets.instantiate('floor'));
    this.renderer = this.createRenderer();
    this.cameraController = new SceneCameraController(canvas, this.camera, this.reducedMotion);
    const toolArea = assets.instantiate('toolArea');
    toolArea.name = 'tool-area';
    toolArea.position.copy(TOOL_AREA_POSITION);
    this.scene.add(toolArea);
    this.workbench = createWorkbench(assets.instantiate('workbench'));
    this.workbench.root.position.copy(toolStationPosition('workbench'));
    this.scene.add(this.workbench.root);
    this.rigWorkbench = createRigWorkbench(assets.instantiateRigWorkbench());
    this.rigWorkbench.root.position.copy(toolStationPosition('rigWorkbench'));
    this.scene.add(this.rigWorkbench.root);
    this.computer = assets.instantiate('computer');
    this.computer.position.copy(toolStationPosition('computer'));
    this.scene.add(this.computer);
    this.gpuVisuals = new GpuVisuals(
      this.scene,
      (id) => this.gpuHomePose(id),
      this.workbench.gpuMount,
      assets.instantiate('gpuFallback'),
      (id) => this.interactions.telemetry(id),
    );
    this.particles = this.createParticles();
    this.scene.add(this.particles);
    this.resetCamera();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('dblclick', this.handleDoubleClick);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
    canvas.addEventListener('pointerdown', this.handleContextPointerDown);
    canvas.addEventListener('pointermove', this.handleGpuHover);
    canvas.addEventListener('pointerdown', this.clearGpuHover);
    canvas.addEventListener('pointerleave', this.clearGpuHover);
    canvas.addEventListener('pointercancel', this.clearGpuHover);
    canvas.addEventListener('wheel', this.clearGpuHover);
    this.resize();
    void this.gpuVisuals.loadModel();
    void this.loadBitcoin();
    this.renderer.setAnimationLoop((time) => this.animate(time));
  }

  update(
    world: MiningWorld,
    mining: boolean,
    paused: boolean,
    inspectedGpuId: number | null,
    inspectedRigId: number | null,
    viewedPlotId: number,
    viewedRigId: number,
    cameraPreset: CameraPreset,
    selectedToolStationId: ToolStationId | null,
    activeGpuIds: readonly number[] = [],
    selectedGpuId: number | null = null,
    computerOpen = false,
  ): void {
    this.currentWorld = world;
    const inspection =
      inspectedGpuId !== null && isGpuUnlocked(world, inspectedGpuId) ? inspectedGpuId : null;
    const rigInspection =
      inspectedRigId !== null && isRigUnlocked(world, inspectedRigId) ? inspectedRigId : null;
    const inspectionChanged = inspection !== this.inspectedGpuId;
    const plotChanged = viewedPlotId !== this.viewedPlotId;
    const rigChanged = viewedRigId !== this.viewedRigId;
    const cameraPresetChanged = cameraPreset !== this.cameraPreset;
    const toolStationChanged = selectedToolStationId !== this.selectedToolStationId;
    const computerOpenChanged = computerOpen !== this.computerOpen;
    this.inspectedGpuId = inspection;
    this.selectedGpuId = selectedGpuId;
    this.isMining = mining;
    this.isPaused = paused;
    this.activeGpuIds = activeGpuIds;
    this.viewedPlotId = viewedPlotId;
    this.viewedRigId = viewedRigId;
    this.cameraPreset = cameraPreset;
    this.selectedToolStationId = selectedToolStationId;
    this.computerOpen = computerOpen;
    this.syncPlots(world);
    this.syncRigSlotTiles(world);
    this.syncRigs(world);
    this.gpuVisuals.sync(world, inspection);
    this.syncRigWorkbench(world, selectedToolStationId, rigInspection);
    this.syncLiquidHoses(world);
    this.updateAppearance(world);
    if (
      inspectionChanged ||
      plotChanged ||
      rigChanged ||
      cameraPresetChanged ||
      toolStationChanged ||
      computerOpenChanged
    ) {
      const focus = resolveCameraFocus({
        viewedRigId,
        cameraPreset,
        inspectedGpuId: inspection,
        selectedToolStationId,
        computerOpen,
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
    this.canvas.removeEventListener('dblclick', this.handleDoubleClick);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
    this.canvas.removeEventListener('pointerdown', this.handleContextPointerDown);
    this.canvas.removeEventListener('pointermove', this.handleGpuHover);
    this.canvas.removeEventListener('pointerdown', this.clearGpuHover);
    this.canvas.removeEventListener('pointerleave', this.clearGpuHover);
    this.canvas.removeEventListener('pointercancel', this.clearGpuHover);
    this.canvas.removeEventListener('wheel', this.clearGpuHover);
    this.gpuVisuals.dispose();
    // Clones share their model's geometry and materials; only the template owns them.
    disposeObject(this.scene, true);
    if (this.bitcoin) {
      disposeObject(this.bitcoin);
    }
    this.rigs.clear();
    this.rigSlotTiles.clear();
    this.plots.clear();
    this.renderer.dispose();
    this.assets.dispose();
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
      const plot = createRigPlot(id, this.assets.instantiate('plot'));
      plot.position.copy(rigPlotCenter(id));
      this.plots.set(id, plot);
      this.scene.add(plot);
    }
  }

  private syncRigSlotTiles(world: MiningWorld): void {
    const rigIds = new Set<number>();
    for (const plot of world.plots) {
      for (const rig of plot.rigs) {
        rigIds.add(rig.id);
        const current = this.rigSlotTiles.get(rig.id);
        if (current) {
          current.setUnlocked(rig.unlocked);
          continue;
        }

        const tile = createRigSlotTile(rig.id, rig.unlocked, this.assets.instantiate('rigSlot'));
        tile.root.position.copy(rigPosition(rig.id));
        tile.root.position.y = -0.42;
        this.rigSlotTiles.set(rig.id, tile);
        this.scene.add(tile.root);
      }
    }

    for (const [id, tile] of this.rigSlotTiles) {
      if (rigIds.has(id)) {
        continue;
      }
      this.scene.remove(tile.root);
      disposeObject(tile.root);
      this.rigSlotTiles.delete(id);
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
        const setupKey = `${rigSetupKey(rig.setup)}:${rig.gpus.length}:${rig.rigProductId}`;
        const current = this.rigs.get(rig.id);
        if (current?.setupKey === setupKey) {
          continue;
        }
        if (current) {
          this.scene.remove(current.root);
          disposeObject(current.root);
        }

        const miningRig = createGpuMiningRig(
          rig.id,
          this.assets.instantiateRig(
            rig.setup,
            rig.gpus.length,
            rig.rigProductId === 'rig-8-frame-bracket',
          ),
          setupKey,
        );
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

  private syncRigWorkbench(
    world: MiningWorld,
    selectedToolStationId: ToolStationId | null,
    inspectedRigId: number | null,
  ): void {
    this.rigWorkbench.outline.visible = selectedToolStationId === 'rigWorkbench';
    if (inspectedRigId === null) {
      this.clearRigPreview();
      return;
    }
    const rig = getRig(world, inspectedRigId);
    const gpuMountKey = rig.gpus
      .map((gpu) => (isGpuUnlocked(world, gpu.id) && !gpu.onWorkbench ? gpu.modelId : 'empty'))
      .join(':');
    const setupKey = `${rigSetupKey(rig.setup)}:${gpuMountKey}:${this.gpuVisuals.modelRevision}`;
    if (this.previewRigId === rig.id && this.previewRigSetupKey === setupKey) {
      return;
    }
    this.clearRigPreview();
    const model = this.assets.instantiateRig(
      rig.setup,
      rig.gpus.length,
      rig.rigProductId === 'rig-8-frame-bracket',
    );
    model.userData['rigId'] = rig.id;
    fitRigOnWorkbench(model);
    this.attachWorkbenchGpus(model, world, rig.id);
    this.rigWorkbench.rigMount.add(model);
    this.previewRigId = rig.id;
    this.previewRigSetupKey = setupKey;
  }

  private clearRigPreview(): void {
    for (const model of [...this.rigWorkbench.rigMount.children]) {
      this.rigWorkbench.rigMount.remove(model);
      disposeObject(model);
    }
    this.previewRigId = null;
    this.previewRigSetupKey = '';
  }

  private attachWorkbenchGpus(model: THREE.Group, world: MiningWorld, rigId: number): void {
    model.updateMatrixWorld(true);
    const modelRotation = model.getWorldQuaternion(new THREE.Quaternion()).invert();
    const connections: LiquidGpuConnection[] = [];
    for (let index = 0; index < getRig(world, rigId).gpus.length; index++) {
      const gpuId = gpuIdForRigSlot(rigId, index);
      const unlocked = isGpuUnlocked(world, gpuId);
      const mounted = unlocked && !getGpu(world, gpuId).onWorkbench;
      const socket = model.getObjectByName(`gpu-slot-${String(index + 1).padStart(2, '0')}`);
      if (!socket) {
        continue;
      }
      const cable = model.getObjectByName(`slot-cable-${index + 1}`);
      if (cable) {
        cable.visible = mounted;
      }
      const indicator = model
        .getObjectByName(`slot-indicator-${index + 1}`)
        ?.getObjectByProperty('isMesh', true);
      if (
        indicator instanceof THREE.Mesh &&
        indicator.material instanceof THREE.MeshStandardMaterial
      ) {
        const color = mounted ? 0xb8f575 : 0x283630;
        indicator.material.color.set(color);
        indicator.material.emissive.set(color);
      }
      if (!mounted) {
        continue;
      }
      const position = model.worldToLocal(socket.getWorldPosition(new THREE.Vector3()));
      const rotation = modelRotation
        .clone()
        .multiply(socket.getWorldQuaternion(new THREE.Quaternion()));
      const gpu = this.gpuVisuals.createWorkbenchPreview(gpuId);
      gpu.position.copy(position);
      gpu.quaternion.copy(rotation);
      model.add(gpu);
      if (gpuHasLiquidCooling(getGpu(world, gpuId).modelId)) {
        connections.push({ slotIndex: index, gpu });
      }
    }
    const hoses = createRigLiquidHoses(model, connections);
    if (hoses) model.add(hoses);
  }

  private syncLiquidHoses(world: MiningWorld): void {
    for (const [rigId, rig] of this.rigs) {
      const state = getRig(world, rigId);
      const connections: LiquidGpuConnection[] = [];
      if (state.setup.coolingMethodId === 'liquid') {
        for (const [slotIndex, gpu] of state.gpus.entries()) {
          if (!isGpuUnlocked(world, gpu.id) || !gpuHasLiquidCooling(gpu.modelId)) {
            continue;
          }
          const mounted = this.gpuVisuals.getMountedGpuObject(gpu.id);
          if (mounted) connections.push({ slotIndex, gpu: mounted });
        }
      }
      const key = `${this.gpuVisuals.modelRevision}:${connections.map(({ slotIndex }) => slotIndex).join(',')}`;
      if (rig.liquidHoseKey === key) continue;
      rig.liquidHoseKey = key;
      if (rig.liquidHoses) {
        rig.model.remove(rig.liquidHoses);
        disposeObject(rig.liquidHoses);
        rig.liquidHoses = undefined;
      }
      const hoses = createRigLiquidHoses(rig.model, connections);
      if (hoses) {
        rig.model.add(hoses);
        rig.liquidHoses = hoses;
      }
    }
  }

  private gpuHomePose(id: number): GpuPose {
    const rig = this.rigs.get(rigIdForGpu(id))!;
    const slot = rig.slots[gpuSlotIndex(id)]!;
    return {
      position: rig.root.localToWorld(slot.position.clone()),
      rotation: rig.root.getWorldQuaternion(new THREE.Quaternion()).multiply(slot.orientation),
    };
  }

  private updateAppearance(world: MiningWorld): void {
    for (const [rigId, rig] of this.rigs) {
      for (const [index, slot] of rig.slots.entries()) {
        const gpuId = gpuIdForRigSlot(rigId, index);
        const unlocked = isGpuUnlocked(world, gpuId);
        const inspecting = gpuId === this.inspectedGpuId;
        const selected = gpuId === this.selectedGpuId;
        const stopped = unlocked && getGpu(world, gpuId).stopped;
        const mining = this.isMining && this.activeGpuIds.includes(gpuId) && !stopped;
        const color = !unlocked
          ? 0x283630
          : stopped
            ? 0xe68c5a
            : selected || inspecting
              ? 0xe7c77e
              : 0xb8f575;
        slot.indicator.material.color.set(color);
        slot.indicator.material.emissive.set(color);
        slot.indicator.material.emissiveIntensity = mining ? 2 : unlocked ? 0.45 : 0;
        slot.outline.visible = selected || inspecting || mining;
        slot.cable.visible = unlocked && !inspecting;
      }
    }

    const miningOnBench =
      this.isMining &&
      this.inspectedGpuId !== null &&
      this.activeGpuIds.includes(this.inspectedGpuId);
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
    if (!this.isPaused) {
      this.gpuVisuals.update(delta, this.isMining, this.reducedMotion.matches, this.activeGpuIds);
    }
    if (this.currentWorld) {
      if (this.previewRigId !== null) {
        this.syncRigWorkbench(this.currentWorld, this.selectedToolStationId, this.previewRigId);
      }
      this.syncLiquidHoses(this.currentWorld);
    }
    this.cameraController.update(delta);
    this.particles.visible = this.isMining;
    if (this.isMining && !this.isPaused) {
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
    const gpus = this.gpuVisuals.objects.filter((gpu) =>
      this.activeGpuIds.includes(gpu.userData['gpuId']),
    );
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
    this.previousClickedGpuId = this.lastClickedGpuId;
    this.lastClickedGpuId = null;
    this.previousClickedRigId = this.lastClickedRigId;
    this.previousRigClickPosition.copy(this.lastRigClickPosition);
    this.previousRigClickTime = this.lastRigClickTime;
    this.lastClickedRigId = null;
    if (!this.cameraController.finishPointer(event)) {
      return;
    }
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    if (this.raycaster.intersectObject(this.computer, true).length) {
      this.clearGpuHover();
      this.interactions.openComputer();
      return;
    }
    const gpuId = this.findGpuAtPointer(event);
    if (gpuId !== undefined) {
      this.lastClickedGpuId = gpuId;
      this.interactions.select(gpuId);
      return;
    }
    const rigId = this.findRigAtPointer(event);
    if (rigId !== undefined) {
      this.lastClickedRigId = rigId;
      this.lastRigClickPosition.set(event.clientX, event.clientY);
      this.lastRigClickTime = event.timeStamp;
      this.interactions.viewRig(rigId);
    }
  };

  private readonly handleContextMenu = (event: MouseEvent): void => {
    event.preventDefault();
    const start = this.contextPointerStart;
    this.contextPointerStart = null;
    if (
      start &&
      Math.hypot(event.clientX - start.x, event.clientY - start.y) > CAMERA.maxClickMovementPx
    ) {
      this.interactions.contextMenu(null, event.clientX, event.clientY);
      return;
    }
    const target = this.findContextTargetAtPointer(event);
    this.clearGpuHover();
    this.interactions.contextMenu(target ?? null, event.clientX, event.clientY);
  };

  private readonly handleContextPointerDown = (event: PointerEvent): void => {
    this.contextPointerStart = event.button === 2 ? { x: event.clientX, y: event.clientY } : null;
  };

  private readonly handleDoubleClick = (event: MouseEvent): void => {
    const gpuId = this.lastClickedGpuId;
    const rigId = this.previousClickedRigId;
    // I due pointerup hanno già verificato hit e trascinamento usando coordinate precise.
    if (event.button === 0 && gpuId !== null && gpuId === this.previousClickedGpuId) {
      this.clearGpuHover();
      this.interactions.inspect(gpuId);
      return;
    }
    const clickDistance = Math.hypot(
      event.clientX - this.previousRigClickPosition.x,
      event.clientY - this.previousRigClickPosition.y,
    );
    if (
      event.button === 0 &&
      event.detail === 2 &&
      rigId !== null &&
      event.timeStamp - this.previousRigClickTime <= 600 &&
      clickDistance <= 8
    ) {
      this.clearGpuHover();
      this.interactions.inspectRig(rigId);
    }
  };

  private readonly handleGpuHover = (event: PointerEvent): void => {
    if (event.buttons !== 0 || event.pointerType === 'touch') {
      this.clearGpuHover();
      return;
    }
    this.interactions.hover(this.findGpuAtPointer(event) ?? null, event.clientX, event.clientY);
  };

  private readonly clearGpuHover = (): void => {
    this.interactions.hover(null, 0, 0);
  };

  private findGpuAtPointer(event: Pick<MouseEvent, 'clientX' | 'clientY'>): number | undefined {
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
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData['gpuId'] === undefined) {
        object = object.parent;
      }
      if (object) {
        return object.userData['gpuId'] as number;
      }
    }
    return undefined;
  }

  private findRigAtPointer(event: Pick<MouseEvent, 'clientX' | 'clientY'>): number | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const rigRoots: THREE.Object3D[] = Array.from(this.rigs.values(), (rig) => rig.root);
    if (this.previewRigId !== null) {
      rigRoots.push(this.rigWorkbench.rigMount);
    }
    const hits = this.raycaster.intersectObjects(rigRoots, true);
    for (const hit of hits) {
      let object: THREE.Object3D | null = hit.object;
      while (object && object.userData['rigId'] === undefined) {
        object = object.parent;
      }
      if (object) {
        return object.userData['rigId'] as number;
      }
    }
    return undefined;
  }

  private findContextTargetAtPointer(
    event: Pick<MouseEvent, 'clientX' | 'clientY'>,
  ): { kind: 'gpu'; id: number } | undefined {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const rigRoots: THREE.Object3D[] = Array.from(this.rigs.values(), (rig) => rig.root);
    if (this.previewRigId !== null) {
      rigRoots.push(this.rigWorkbench.rigMount);
    }
    const targets = [...this.gpuVisuals.objects, this.workbench.root, ...rigRoots];
    return this.currentWorld
      ? resolveSceneContextTarget(this.raycaster.intersectObjects(targets, true), this.currentWorld)
      : undefined;
  }
}

export function resolveSceneContextTarget(
  hits: readonly THREE.Intersection[],
  world: MiningWorld,
): { kind: 'gpu'; id: number } | undefined {
  for (const hit of hits) {
    let object: THREE.Object3D | null = hit.object;
    while (object) {
      const gpuId = object.userData['gpuId'];
      if (typeof gpuId === 'number') {
        return isGpuUnlocked(world, gpuId) ? { kind: 'gpu', id: gpuId } : undefined;
      }
      const rigId = object.userData['rigId'];
      if (typeof rigId === 'number') {
        break;
      }
      object = object.parent;
    }
  }
  return undefined;
}

function rigSetupKey(setup: MiningWorld['plots'][number]['rigs'][number]['setup']): string {
  return `${setup.fanId}:${setup.fanCount}:${setup.dustSystemId}:${setup.coolingMethodId}`;
}
