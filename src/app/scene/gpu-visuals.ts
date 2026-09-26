import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPU_MODEL_PATH } from '../assets/models/gpu/gpu-model-path';
import { GAME_BALANCE } from '../config/game-balance';
import { GPU_MODELS_BY_ID, type GpuModelId } from '../config/gpu-config';
import type { GpuFanModelId } from '../config/fan-config';
import type { GpuFanKit } from '../game/gpu-maintenance';
import { GPU_COUNT, getGpu, getRig, isGpuUnlocked, type MiningWorld } from '../game/mining-world';
import {
  gpuFanSpeedRatio,
  gpuMaxFanSpeedRpm,
  gpuTemperature,
  isGpuOperational,
  type GpuOperatingState,
} from '../game/gpu-operation';
import type { GpuTelemetry } from '../game/gpu-telemetry';
import type { RigSetup } from '../config/rig-config';
import { GpuConditionEffects } from './gpu-condition-effects';
import { easeTransition, transitionProgress } from './animation/scene-transition';
import { fitGpuModel, gpuSceneWidth, styleGpuModel } from './models/gpu-model';
import { disposeObject } from './resources/dispose-object';

const ANIMATION = GAME_BALANCE.animation;
const GPU_MODEL_WIDTH = gpuSceneWidth(GAME_BALANCE.models.startingGpuId);

export interface GpuPose {
  readonly position: THREE.Vector3;
  readonly rotation: THREE.Quaternion;
}

interface GpuTransfer {
  readonly from: GpuPose;
  readonly to: GpuPose;
  elapsed: number;
}

interface GpuVisual {
  readonly root: THREE.Group;
  fans: THREE.Object3D[];
  installedFanKit?: GpuFanKit;
  operational: boolean;
  state: GpuOperatingState;
  rigSetup: RigSetup;
  effects?: GpuConditionEffects;
  mixer?: THREE.AnimationMixer;
  transfer?: GpuTransfer;
}

export class GpuVisuals {
  private readonly gpus = new Map<number, GpuVisual>();
  private readonly stockRotors = new WeakMap<
    THREE.Object3D,
    { children: THREE.Object3D[]; diameter: number }
  >();
  private readonly fanAssets = new Map<GpuFanModelId, THREE.Group>();
  private readonly loadingFans = new Set<GpuFanModelId>();
  private readonly modelAssets = new Map<GpuModelId, THREE.Group>();
  private readonly loadingModels = new Set<GpuModelId>();
  private template: THREE.Group;
  private clips: THREE.AnimationClip[] = [];
  private inspectedGpuId: number | null = null;
  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly homePose: (gpuId: number) => GpuPose,
    private readonly inspectionMount: THREE.Object3D,
    initialTemplate: THREE.Group,
    private readonly readTelemetry?: (id: number) => GpuTelemetry,
  ) {
    this.template = initialTemplate;
    fitGpuModel(this.template, GPU_MODEL_WIDTH);
  }

  /** Snapshot for picking and particle placement; instance lifecycle stays in this class. */
  get objects(): readonly THREE.Group[] {
    return Array.from(this.gpus.values(), (gpu) => gpu.root);
  }

  createWorkbenchPreview(gpuId: number): THREE.Group {
    const source = this.gpus.get(gpuId)?.root.children[0];
    const preview = source instanceof THREE.Group ? source.clone(true) : this.template.clone(true);
    preview.name = `gpu-workbench-preview-${gpuId}`;
    const materials = new Map<THREE.Material, THREE.Material>();
    const cloneMaterial = (material: THREE.Material): THREE.Material => {
      let clone = materials.get(material);
      if (!clone) {
        clone = material.clone();
        const mappedMaterial = clone as THREE.Material & { map?: THREE.Texture };
        if (mappedMaterial.map) {
          mappedMaterial.map = mappedMaterial.map.clone();
          mappedMaterial.map.needsUpdate = true;
        }
        materials.set(material, clone);
      }
      return clone;
    };
    preview.traverse((object) => {
      if (!(object instanceof THREE.Mesh || object instanceof THREE.LineSegments)) {
        return;
      }
      object.geometry = object.geometry.clone();
      object.material = Array.isArray(object.material)
        ? object.material.map(cloneMaterial)
        : cloneMaterial(object.material);
      object.castShadow = object instanceof THREE.Mesh;
      object.receiveShadow = object instanceof THREE.Mesh;
    });
    return preview;
  }

  sync(world: MiningWorld, inspectedGpuId: number | null): void {
    for (const [id, gpu] of this.gpus) {
      const state = getGpu(world, id);
      const modelChanged = gpu.state.modelId !== state.modelId;
      gpu.state = state;
      if (modelChanged) this.attachModel(gpu);
      this.updateFanKit(gpu);
      gpu.rigSetup = getRig(world, state.rigId).setup;
      gpu.operational = isGpuOperational(gpu.state);
      if (!isGpuUnlocked(world, id)) {
        this.removeGpu(id, gpu);
        continue;
      }
      if (id !== this.inspectedGpuId && !gpu.transfer) {
        const pose = this.homePose(id);
        gpu.root.position.copy(pose.position);
        gpu.root.quaternion.copy(pose.rotation);
      }
    }

    for (let id = 1; id <= GPU_COUNT; id++) {
      if (!isGpuUnlocked(world, id) || this.gpus.has(id)) {
        continue;
      }
      const pose = this.homePose(id);
      const root = new THREE.Group();
      root.name = `gpu-${id}`;
      root.userData['gpuId'] = id;
      root.position.copy(pose.position);
      root.quaternion.copy(pose.rotation);
      const state = getGpu(world, id);
      const rigSetup = getRig(world, state.rigId).setup;
      const gpu: GpuVisual = {
        root,
        fans: [],
        state,
        rigSetup,
        operational: isGpuOperational(state),
      };
      this.attachModel(gpu);
      this.updateFanKit(gpu);
      this.gpus.set(id, gpu);
      this.scene.add(root);
    }

    if (inspectedGpuId !== this.inspectedGpuId) {
      this.inspectedGpuId = inspectedGpuId;
      for (const [id, gpu] of this.gpus) {
        this.transferGpu(id, gpu);
      }
    }
  }

  update(
    delta: number,
    mining: boolean,
    reducedMotion: boolean,
    activeGpuIds: readonly number[] = [],
  ): void {
    for (const [id, gpu] of this.gpus) {
      this.updateTransfer(gpu, delta, reducedMotion);
      const telemetry = this.readTelemetry?.(id);
      gpu.effects?.update(
        telemetry ?? {
          dustPercent: gpu.state.dustPercent,
          temperatureCelsius: gpuTemperature(gpu.state, Date.now(), gpu.rigSetup),
          fanKit: gpu.state.fanKit,
        },
        delta,
        reducedMotion,
      );
      if (
        !mining ||
        reducedMotion ||
        !gpu.operational ||
        (activeGpuIds.length > 0 && !activeGpuIds.includes(id))
      ) {
        continue;
      }
      const fanSpeed =
        telemetry?.fanSpeed ??
        gpu.state.targetFanSpeedPercent ??
        GPU_MODELS_BY_ID[gpu.state.modelId].specifications.mining.fanSpeedPercent;
      const modelMaxRpm = GPU_MODELS_BY_ID[gpu.state.modelId].specifications.limits.fanSpeedRpm;
      const kitMaxRpm = gpuMaxFanSpeedRpm(gpu.state.fanKit, gpu.state.modelId);
      const fanKitSpeedRatio = modelMaxRpm > 0 ? kitMaxRpm / modelMaxRpm : kitMaxRpm > 0 ? 1 : 0;
      const fanRatio =
        gpuFanSpeedRatio(fanSpeed, gpu.state.fanKit, gpu.state.modelId) * fanKitSpeedRatio;
      gpu.mixer?.update(delta * ANIMATION.gpuMixerTimeScale * fanRatio);
      for (const fan of gpu.fans) {
        const axis: unknown = fan.userData['animationAxis'];
        if (axis === 'x' || axis === 'y' || axis === 'z') {
          fan.rotation[axis] -= delta * ANIMATION.gpuFanRadiansPerSecond * fanRatio;
        } else if (fan.name === 'Spin') {
          fan.rotation.z -= delta * ANIMATION.gpuFanRadiansPerSecond * fanRatio;
        } else {
          fan.rotation.y -= delta * ANIMATION.gpuFanRadiansPerSecond * fanRatio;
        }
      }
    }
  }

  async loadModel(): Promise<void> {
    if (this.disposed) {
      return;
    }
    try {
      const gltf = await new GLTFLoader().loadAsync(GPU_MODEL_PATH);
      if (this.disposed) {
        disposeObject(gltf.scene);
        return;
      }
      const previous = this.template;
      fitGpuModel(gltf.scene, GPU_MODEL_WIDTH);
      styleGpuModel(gltf.scene);
      this.template = new THREE.Group();
      this.template.add(gltf.scene);
      this.clips = gltf.animations;
      for (const gpu of this.gpus.values()) {
        this.attachModel(gpu);
        this.updateFanKit(gpu);
      }
      disposeObject(previous);
    } catch {
      // The preloaded compact GLB remains selectable if the primary GPU asset fails.
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    for (const [id, gpu] of this.gpus) {
      this.removeGpu(id, gpu);
    }
    disposeObject(this.template);
    for (const asset of this.fanAssets.values()) disposeObject(asset);
    for (const asset of this.modelAssets.values()) disposeObject(asset);
    this.clips = [];
  }

  private attachModel(gpu: GpuVisual): void {
    gpu.effects?.dispose();
    gpu.mixer?.stopAllAction();
    gpu.mixer = undefined;
    gpu.root.clear();
    const model = this.modelAssets.get(gpu.state.modelId);
    if (!model && gpu.state.modelId !== GAME_BALANCE.models.startingGpuId) {
      this.loadGpuAsset(gpu.state.modelId);
    }
    const clone = (model ?? this.template).clone(true);
    clone.userData['sharedGpu'] = true;
    gpu.effects = new GpuConditionEffects(clone);
    gpu.root.add(clone, gpu.effects.root);
    gpu.fans = [];
    gpu.installedFanKit = 'stock';
    clone.traverse((object) => {
      if (
        object.name === 'Spin' ||
        object.name === 'gpu-fan-rotor' ||
        object.name.startsWith('fan-rotor')
      ) {
        gpu.fans.push(object);
      }
    });
    if (!model && this.clips.length) {
      const mixer = new THREE.AnimationMixer(clone);
      this.clips.forEach((clip) => mixer.clipAction(clip).play());
      gpu.mixer = mixer;
    }
  }

  private updateFanKit(gpu: GpuVisual): void {
    const kit = gpu.state.fanKit;
    if (gpu.installedFanKit === kit || !gpu.fans.length) return;
    if (kit === 'stock') {
      for (const fan of gpu.fans) {
        const stock = this.stockRotors.get(fan)?.children;
        if (stock) {
          fan.clear();
          fan.add(...stock);
        }
      }
      gpu.installedFanKit = kit;
      return;
    }
    const id = kit as GpuFanModelId;
    const rotor = this.fanAssets.get(id)?.getObjectByName('gpu-fan-rotor');
    if (!rotor) {
      this.loadFanAsset(id);
      return;
    }
    const replacementSize = new THREE.Box3().setFromObject(rotor).getSize(new THREE.Vector3());
    const replacementDiameter = Math.max(replacementSize.x, replacementSize.y);
    for (const fan of gpu.fans) {
      let stock = this.stockRotors.get(fan);
      if (!stock) {
        const original = fan.clone(true);
        original.position.set(0, 0, 0);
        original.rotation.set(0, 0, 0);
        original.scale.set(1, 1, 1);
        const size = new THREE.Box3().setFromObject(original).getSize(new THREE.Vector3());
        stock = { children: [...fan.children], diameter: Math.max(size.x, size.y, size.z) };
        this.stockRotors.set(fan, stock);
      }
      const diameter = stock.diameter;
      if (diameter <= 0 || replacementDiameter <= 0) continue;
      fan.clear();
      const installed = rotor.clone(true);
      installed.scale.setScalar(diameter / replacementDiameter);
      if (fan.userData['animationAxis'] === 'y') installed.rotation.x = -Math.PI / 2;
      fan.add(installed);
    }
    gpu.installedFanKit = kit;
  }

  private loadGpuAsset(id: GpuModelId): void {
    if (this.loadingModels.has(id) || this.disposed) return;
    this.loadingModels.add(id);
    void new GLTFLoader()
      .loadAsync(`assets/models/gpus/${id}.glb`)
      .then(({ scene }) => {
        if (this.disposed) {
          disposeObject(scene);
          return;
        }
        fitGpuModel(scene, gpuSceneWidth(id));
        styleGpuModel(scene);
        const template = new THREE.Group();
        template.add(scene);
        this.modelAssets.set(id, template);
        for (const gpu of this.gpus.values()) {
          if (gpu.state.modelId === id) {
            this.attachModel(gpu);
            this.updateFanKit(gpu);
          }
        }
      })
      .catch(() => {
        /* Il fallback resta visibile se il modello non è disponibile. */
      })
      .finally(() => this.loadingModels.delete(id));
  }

  private loadFanAsset(id: GpuFanModelId): void {
    if (this.loadingFans.has(id) || this.disposed) return;
    this.loadingFans.add(id);
    void new GLTFLoader()
      .loadAsync(`assets/models/fans/gpu-fan-${id}.glb`)
      .then(({ scene }) => {
        if (this.disposed) {
          disposeObject(scene);
          return;
        }
        this.fanAssets.set(id, scene);
        for (const gpu of this.gpus.values()) this.updateFanKit(gpu);
      })
      .catch(() => {})
      .finally(() => this.loadingFans.delete(id));
  }

  private removeGpu(id: number, gpu: GpuVisual): void {
    this.scene.remove(gpu.root);
    gpu.mixer?.stopAllAction();
    gpu.effects?.dispose();
    disposeObject(gpu.root, true);
    this.gpus.delete(id);
  }

  private transferGpu(id: number, gpu: GpuVisual): void {
    const to =
      id === this.inspectedGpuId
        ? {
            position: this.inspectionMount.getWorldPosition(new THREE.Vector3()),
            rotation: this.inspectionMount.getWorldQuaternion(new THREE.Quaternion()),
          }
        : this.homePose(id);
    if (
      gpu.root.position.distanceToSquared(to.position) < 0.0001 &&
      gpu.root.quaternion.angleTo(to.rotation) < 0.001
    ) {
      gpu.transfer = undefined;
      return;
    }
    gpu.transfer = {
      from: { position: gpu.root.position.clone(), rotation: gpu.root.quaternion.clone() },
      to,
      elapsed: 0,
    };
  }

  private updateTransfer(gpu: GpuVisual, delta: number, reducedMotion: boolean): void {
    const transfer = gpu.transfer;
    if (!transfer) {
      return;
    }
    transfer.elapsed += delta;
    const progress = transitionProgress(transfer.elapsed, reducedMotion);
    const eased = easeTransition(progress);
    gpu.root.position.lerpVectors(transfer.from.position, transfer.to.position, eased);
    gpu.root.position.y += Math.sin(progress * Math.PI) * ANIMATION.gpuTransferArcHeight;
    gpu.root.quaternion.slerpQuaternions(transfer.from.rotation, transfer.to.rotation, eased);
    if (progress === 1) {
      gpu.transfer = undefined;
    }
  }
}
