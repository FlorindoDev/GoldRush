import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CRYPTO_CONFIG } from '../../../config/crypto-config';
import { GAME_BALANCE } from '../../../config/game-balance';

const CAMERA = GAME_BALANCE.camera.bitcoinPreview;

@Component({
  selector: 'app-crypto-model',
  templateUrl: './bitcoin-model.component.html',
  styleUrl: './bitcoin-model.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinModelComponent implements AfterViewInit, OnDestroy {
  readonly crypto = input<(typeof CRYPTO_CONFIG)[number]>(CRYPTO_CONFIG[0]);
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly failed = signal(false);
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(
    CAMERA.fieldOfViewDegrees,
    1,
    CAMERA.near,
    CAMERA.far,
  );
  private renderer?: THREE.WebGLRenderer;
  private model?: THREE.Group;
  private destroyed = false;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas().nativeElement,
        alpha: true,
        antialias: true,
      });
      this.renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, GAME_BALANCE.scene.maxPixelRatio),
      );
      this.renderer.setSize(48, 48, false);
      this.renderer.setClearColor(0x000000, 0);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = CAMERA.exposure;
      this.addLighting();
      this.camera.position.set(...CAMERA.position);

      const gltf = await new GLTFLoader().loadAsync(`assets/models/coins/${this.crypto().id}.glb`);
      if (this.destroyed) {
        this.disposeModel(gltf.scene);
        return;
      }

      this.model = gltf.scene;
      this.fitModel(this.model);
      this.model.rotation.y = -0.3;
      this.scene.add(this.model);
      this.renderer.render(this.scene, this.camera);
    } catch {
      if (!this.destroyed) {
        this.failed.set(true);
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.model) {
      this.disposeModel(this.model);
    }
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
  }

  private addLighting(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    keyLight.position.set(-2, 3, 4);
    this.scene.add(keyLight);
  }

  private fitModel(model: THREE.Group): void {
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const scale = 1.5 / Math.max(size.x, size.y);
    model.scale.setScalar(scale);
    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  }

  private disposeModel(model: THREE.Object3D): void {
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) {
        return;
      }
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.dispose();
      }
    });
  }
}
