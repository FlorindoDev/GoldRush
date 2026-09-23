import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { easeTransition, transitionProgress } from './scene-transition';

const MAX_CLICK_MOVEMENT = 5;
const PAN_LIMIT = 2.5;

interface CameraTransition {
  readonly fromPosition: THREE.Vector3;
  readonly toPosition: THREE.Vector3;
  readonly fromTarget: THREE.Vector3;
  readonly toTarget: THREE.Vector3;
  elapsed: number;
}

export class SceneCameraController {
  private readonly controls: OrbitControls;
  private transition?: CameraTransition;
  private pointerId?: number;
  private readonly pointerDown = new THREE.Vector2();
  private readonly pointerPosition = new THREE.Vector2();
  private readonly panAnchor = new THREE.Vector3();
  private readonly panCorrection = new THREE.Vector3();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly reducedMotion: MediaQueryList,
  ) {
    this.controls = new OrbitControls(camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = true;
    this.controls.panSpeed = 0.6;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 32;
    this.controls.minPolarAngle = 0.3;
    this.controls.maxPolarAngle = Math.PI / 2.3;

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('wheel', this.cancelTransition, { passive: true });
  }

  reset(target: THREE.Vector3, offset: THREE.Vector3): void {
    this.transition = undefined;
    this.panAnchor.copy(target);
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(offset);
    this.controls.update();
  }

  focus(target: THREE.Vector3, offset: THREE.Vector3): void {
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.panAnchor.copy(target);
    this.transition = {
      fromPosition: this.camera.position.clone(),
      toPosition: target.clone().add(offset),
      fromTarget: this.controls.target.clone(),
      toTarget: target,
      elapsed: 0,
    };
  }

  update(delta: number): void {
    this.updateTransition(delta);
    this.controls.update();
    if (!this.transition) {
      this.constrainPan();
    }
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    // Leave space for the editor on desktop without changing the orbit target.
    this.camera.setViewOffset(width, height, width >= 1000 ? width * 0.12 : 0, 0, width, height);
    this.camera.updateProjectionMatrix();
  }

  finishPointer(event: PointerEvent): boolean {
    if (event.pointerId !== this.pointerId) {
      return false;
    }
    this.pointerId = undefined;
    this.pointerPosition.set(event.clientX, event.clientY);
    return (
      event.button === 0 && this.pointerDown.distanceTo(this.pointerPosition) <= MAX_CLICK_MOVEMENT
    );
  }

  dispose(): void {
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('wheel', this.cancelTransition);
  }

  private updateTransition(delta: number): void {
    const transition = this.transition;
    if (!transition) {
      return;
    }

    transition.elapsed += delta;
    const progress = transitionProgress(transition.elapsed, this.reducedMotion.matches);
    const eased = easeTransition(progress);
    this.camera.position.lerpVectors(transition.fromPosition, transition.toPosition, eased);
    this.controls.target.lerpVectors(transition.fromTarget, transition.toTarget, eased);
    if (progress === 1) {
      this.transition = undefined;
    }
  }

  private constrainPan(): void {
    const target = this.controls.target;
    this.panCorrection.set(
      THREE.MathUtils.clamp(target.x, this.panAnchor.x - PAN_LIMIT, this.panAnchor.x + PAN_LIMIT) -
        target.x,
      THREE.MathUtils.clamp(target.y, this.panAnchor.y - PAN_LIMIT, this.panAnchor.y + PAN_LIMIT) -
        target.y,
      THREE.MathUtils.clamp(target.z, this.panAnchor.z - PAN_LIMIT, this.panAnchor.z + PAN_LIMIT) -
        target.z,
    );
    target.add(this.panCorrection);
    this.camera.position.add(this.panCorrection);
  }

  private readonly cancelTransition = (): void => {
    this.transition = undefined;
    this.panAnchor.copy(this.controls.target);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary) {
      return;
    }
    this.pointerId = event.pointerId;
    this.pointerDown.set(event.clientX, event.clientY);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) {
      return;
    }
    this.pointerPosition.set(event.clientX, event.clientY);
    if (this.pointerDown.distanceTo(this.pointerPosition) > MAX_CLICK_MOVEMENT) {
      this.cancelTransition();
    }
  };

  private readonly handlePointerCancel = (): void => {
    this.pointerId = undefined;
  };
}
