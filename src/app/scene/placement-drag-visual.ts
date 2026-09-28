import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeObject } from './resources/dispose-object';

type PlacementKind = 'rig' | 'gpu';

/** Mostra il vero GLB vicino al cursore e lo lascia oscillare attorno al punto di presa. */
export class PlacementDragVisual {
  private readonly anchor = new THREE.Group();
  private readonly pendulum = new THREE.Group();
  private readonly cursor = new THREE.Vector2();
  private readonly target = new THREE.Vector3();
  private readonly velocity = new THREE.Vector2();
  private readonly angle = new THREE.Vector2();
  private dragKey: string | null = null;
  private loadRevision = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly loader: Pick<GLTFLoader, 'loadAsync'> = new GLTFLoader(),
  ) {
    this.anchor.name = 'placement-drag-preview';
    this.pendulum.name = 'placement-pendulum';
    this.anchor.add(this.pendulum);
  }

  get active(): boolean {
    return this.dragKey !== null;
  }

  get key(): string | null {
    return this.dragKey;
  }

  begin(
    stockId: number,
    modelPath: string,
    kind: PlacementKind,
    clientX: number,
    clientY: number,
  ): void {
    const key = `stock:${stockId}`;
    if (this.dragKey === key) {
      this.move(clientX, clientY);
      return;
    }
    this.start(key, clientX, clientY);
    const revision = ++this.loadRevision;
    void this.loader
      .loadAsync(modelPath)
      .then(({ scene: model }) => {
        if (revision !== this.loadRevision || this.dragKey !== key) {
          disposeObject(model);
          return;
        }
        this.attachModel(model, kind);
      })
      .catch(() => {
        // Il drag resta valido se il file 3D non si carica.
      });
  }

  beginExisting(
    key: string,
    model: THREE.Group,
    kind: PlacementKind,
    clientX: number,
    clientY: number,
  ): void {
    this.start(key, clientX, clientY);
    this.attachModel(model, kind);
  }

  move(clientX: number, clientY: number): void {
    if (!this.active) return;
    const dx = clientX - this.cursor.x;
    const dy = clientY - this.cursor.y;
    this.velocity.x = THREE.MathUtils.clamp(this.velocity.x - dy * 0.025, -5, 5);
    this.velocity.y = THREE.MathUtils.clamp(this.velocity.y - dx * 0.025, -5, 5);
    this.cursor.set(clientX, clientY);
    this.updateTarget();
  }

  update(delta: number, reducedMotion: boolean): void {
    if (!this.active) return;
    this.updateTarget();
    this.anchor.position.copy(this.target);
    this.anchor.quaternion.copy(this.camera.quaternion);
    if (reducedMotion) {
      this.velocity.set(0, 0);
      this.angle.set(0, 0);
    } else {
      for (const axis of ['x', 'y'] as const) {
        this.velocity[axis] += (-28 * this.angle[axis] - 7 * this.velocity[axis]) * delta;
        this.angle[axis] = THREE.MathUtils.clamp(
          this.angle[axis] + this.velocity[axis] * delta,
          -0.42,
          0.42,
        );
      }
    }
    this.pendulum.rotation.set(this.angle.x, 0, this.angle.y);
  }

  stop(): void {
    this.dragKey = null;
    this.loadRevision++;
    this.scene.remove(this.anchor);
    for (const child of [...this.pendulum.children]) {
      this.pendulum.remove(child);
      disposeObject(child);
    }
  }

  private start(key: string, clientX: number, clientY: number): void {
    this.stop();
    this.dragKey = key;
    this.cursor.set(clientX, clientY);
    this.velocity.set(0, 0);
    this.angle.set(0, 0);
    this.scene.add(this.anchor);
    this.updateTarget();
    this.anchor.position.copy(this.target);
  }

  private updateTarget(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const pointer = new THREE.Vector3(
      ((this.cursor.x - rect.left) / rect.width) * 2 - 1,
      -((this.cursor.y - rect.top) / rect.height) * 2 + 1,
      0.5,
    ).unproject(this.camera);
    this.target.copy(
      pointer.sub(this.camera.position).normalize().multiplyScalar(12).add(this.camera.position),
    );
  }

  private attachModel(model: THREE.Group, kind: PlacementKind): void {
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const modelSize = kind === 'rig' ? 2.1 : 1.65;
    const scale = modelSize / Math.max(size.x, size.y, size.z, 0.001);
    const holder = new THREE.Group();
    holder.scale.setScalar(scale);
    model.position.sub(center);
    holder.add(model);
    holder.position.y = -modelSize * 0.14;
    holder.rotation.y = -0.35;
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.renderOrder = 1000;
      object.castShadow = false;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        material.depthTest = false;
        material.depthWrite = false;
        material.transparent = true;
        material.opacity = 0.96;
        material.needsUpdate = true;
      }
    });
    this.pendulum.add(holder);
  }
}
