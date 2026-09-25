import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GPU_MODEL_PATH } from '../assets/models/gpu/gpu-model-path';
import { GAME_BALANCE } from '../config/game-balance';
import { GPU_COUNT, getGpu, isGpuUnlocked, type MiningWorld } from '../game/mining-world';
import {
  gpuFanSpeedRatio,
  gpuMaxFanSpeedRpm,
  gpuTemperature,
  isGpuOperational,
  type GpuOperatingState,
} from '../game/gpu-operation';
import type { GpuTelemetry } from '../game/gpu-telemetry';
import { GpuConditionEffects } from './gpu-condition-effects';
import { easeTransition, transitionProgress } from './animation/scene-transition';
import { fitGpuModel, styleGpuModel } from './models/gpu-model';
import { disposeObject } from './resources/dispose-object';

const ANIMATION = GAME_BALANCE.animation;
const GPU_MODEL_WIDTH = GAME_BALANCE.scene.gpuModelWidth;

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
  operational: boolean;
  state: GpuOperatingState;
  effects?: GpuConditionEffects;
  mixer?: THREE.AnimationMixer;
  transfer?: GpuTransfer;
}

export class GpuVisuals {
  private readonly gpus = new Map<number, GpuVisual>();
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

  sync(world: MiningWorld, inspectedGpuId: number | null): void {
    for (const [id, gpu] of this.gpus) {
      gpu.state = getGpu(world, id);
      gpu.operational = isGpuOperational(gpu.state);
      if (!isGpuUnlocked(world, id)) {
        this.removeGpu(id, gpu);
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
      const gpu: GpuVisual = { root, fans: [], state, operational: isGpuOperational(state) };
      this.attachModel(gpu);
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
          temperatureCelsius: gpuTemperature(gpu.state, Date.now()),
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
        GAME_BALANCE.gpu.mining.fanSpeedPercent;
      const modelMaxRpm = GAME_BALANCE.gpu.limits.fanSpeedRpm;
      const kitMaxRpm = gpuMaxFanSpeedRpm(gpu.state.fanKit);
      const fanKitSpeedRatio = modelMaxRpm > 0 ? kitMaxRpm / modelMaxRpm : kitMaxRpm > 0 ? 1 : 0;
      const fanRatio = gpuFanSpeedRatio(fanSpeed, gpu.state.fanKit) * fanKitSpeedRatio;
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
    this.clips = [];
  }

  private attachModel(gpu: GpuVisual): void {
    gpu.effects?.dispose();
    gpu.mixer?.stopAllAction();
    gpu.mixer = undefined;
    gpu.root.clear();
    const clone = this.template.clone(true);
    clone.userData['sharedGpu'] = true;
    gpu.effects = new GpuConditionEffects(clone);
    gpu.root.add(clone, gpu.effects.root);
    gpu.fans = [];
    clone.traverse((object) => {
      if (
        object.name === 'Spin' ||
        object.name === 'gpu-fan-rotor' ||
        object.name.startsWith('fan-rotor')
      ) {
        gpu.fans.push(object);
      }
    });
    if (this.clips.length) {
      const mixer = new THREE.AnimationMixer(clone);
      this.clips.forEach((clip) => mixer.clipAction(clip).play());
      gpu.mixer = mixer;
    }
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
