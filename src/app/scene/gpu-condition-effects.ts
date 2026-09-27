import * as THREE from 'three';
import { GAME_BALANCE } from '../config/game-balance';
import { disposeObject } from './resources/dispose-object';

export interface GpuVisualCondition {
  readonly dustPercent: number;
  readonly temperatureCelsius: number;
}

const config = GAME_BALANCE.gpu.maintenance;

/** Effetti per istanza: geometrie e texture del modello restano condivise e intatte. */
export class GpuConditionEffects {
  readonly root = new THREE.Group();
  private readonly dust = { value: 0 };
  private readonly heat = { value: 0 };
  private readonly worldToLocal = { value: new THREE.Matrix4() };
  private readonly materials: THREE.Material[] = [];
  private readonly dustCloud = createCloud('gpu-dust-cloud', 72, 0xd1bd95);
  private readonly heatPlume = createCloud('gpu-heat-plume', 20, 0xaaa494);
  private readonly size: THREE.Vector3;
  private readonly center: THREE.Vector3;
  private readonly up = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private elapsed = 0;
  private cleaningBurst = 0;
  private previousDust: number | undefined;

  constructor(model: THREE.Object3D) {
    const bounds = new THREE.Box3().setFromObject(model);
    this.size = bounds.getSize(new THREE.Vector3());
    this.center = bounds.getCenter(new THREE.Vector3());
    this.root.name = 'gpu-condition-effects';
    this.root.add(this.dustCloud, this.heatPlume);
    this.prepareMaterials(model);
  }

  update(condition: GpuVisualCondition, delta: number, reducedMotion: boolean): void {
    const dust = THREE.MathUtils.clamp(condition.dustPercent / 100, 0, 1);
    if (this.previousDust !== undefined && this.previousDust > dust + 0.001) {
      this.cleaningBurst = 1.2;
    }
    this.previousDust = dust;
    this.dust.value = dust;
    this.heat.value = THREE.MathUtils.clamp(
      (condition.temperatureCelsius - config.heatEffectStartCelsius) /
        (GAME_BALANCE.gpu.limits.temperatureCelsius - config.heatEffectStartCelsius),
      0,
      1,
    );
    this.dustCloud.visible = !reducedMotion && (dust > 0.025 || this.cleaningBurst > 0);
    this.heatPlume.visible = !reducedMotion && this.heat.value > 0;
    this.cleaningBurst = Math.max(0, this.cleaningBurst - delta);
    this.root.updateWorldMatrix(true, false);
    this.worldToLocal.value.copy(this.root.matrixWorld).invert();
    if (reducedMotion) {
      return;
    }
    this.elapsed += delta;
    // Le scie salgono verso l'alto anche con la scheda montata in verticale nel rig.
    this.root.getWorldQuaternion(this.rotation).invert();
    this.up.set(0, 1, 0).applyQuaternion(this.rotation);
    if (this.dustCloud.visible) {
      this.animateCloud(this.dustCloud, false);
    }
    if (this.heatPlume.visible) {
      this.animateCloud(this.heatPlume, true);
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    disposeObject(this.root);
    this.materials.forEach((material) => material.dispose());
    this.materials.length = 0;
  }

  private prepareMaterials(model: THREE.Object3D): void {
    const copies = new Map<THREE.Material, THREE.Material>();
    const copy = (original: THREE.Material): THREE.Material => {
      if (!(original instanceof THREE.MeshStandardMaterial)) {
        return original;
      }
      const existing = copies.get(original);
      if (existing) {
        return existing;
      }
      const material = original.clone();
      material.onBeforeCompile = (shader) => {
        shader.uniforms['gpuDust'] = this.dust;
        shader.uniforms['gpuHeat'] = this.heat;
        shader.uniforms['gpuWorldToLocal'] = this.worldToLocal;
        shader.vertexShader =
          'uniform mat4 gpuWorldToLocal;\nvarying vec3 gpuSurfacePosition;\nvarying vec3 gpuSurfaceNormal;\n' +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          gpuSurfacePosition = (gpuWorldToLocal * modelMatrix * vec4(transformed, 1.0)).xyz;
          gpuSurfaceNormal = normalize(mat3(gpuWorldToLocal * modelMatrix) * objectNormal);`,
        );
        shader.fragmentShader =
          `uniform float gpuDust;
          uniform float gpuHeat;
          varying vec3 gpuSurfacePosition;
          varying vec3 gpuSurfaceNormal;
          float gpuDustHash(vec3 p) {
            return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
          }
          float gpuDustNoise(vec3 p) {
            vec3 cell = floor(p);
            vec3 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(mix(gpuDustHash(cell), gpuDustHash(cell + vec3(1, 0, 0)), f.x),
                  mix(gpuDustHash(cell + vec3(0, 1, 0)), gpuDustHash(cell + vec3(1, 1, 0)), f.x), f.y),
              mix(mix(gpuDustHash(cell + vec3(0, 0, 1)), gpuDustHash(cell + vec3(1, 0, 1)), f.x),
                  mix(gpuDustHash(cell + vec3(0, 1, 1)), gpuDustHash(cell + vec3(1, 1, 1)), f.x), f.y), f.z);
          }
          ` + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `
          #include <color_fragment>
          float dustPatch = gpuDustNoise(gpuSurfacePosition * 14.0) * 0.6 +
            gpuDustNoise(gpuSurfacePosition * 58.0) * 0.4;
          float deposit = 0.35 + max(0.0, normalize(gpuSurfaceNormal).y) * 0.65;
          float coating = gpuDust * deposit * (0.3 + dustPatch * 0.8);
          float powderSpeckles = smoothstep(0.62, 0.86, dustPatch) * gpuDust * deposit;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.43, 0.39, 0.31), min(coating, 0.88));
          diffuseColor.rgb += vec3(0.055, 0.047, 0.033) * powderSpeckles;
        `,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `
          #include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.16, 0.025, 0.004) * gpuHeat;
        `,
        );
      };
      material.customProgramCacheKey = () => 'gpu-condition-v2';
      copies.set(original, material);
      this.materials.push(material);
      return material;
    };
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.material = Array.isArray(object.material)
          ? object.material.map(copy)
          : copy(object.material);
      }
    });
  }

  private animateCloud(cloud: THREE.Points, heat: boolean): void {
    const positions = cloud.geometry.getAttribute('position');
    const opacity = cloud.geometry.getAttribute('particleOpacity');
    const sizes = cloud.geometry.getAttribute('particleSize');
    const burst = this.cleaningBurst / 1.2;
    const dustEmission = Math.pow(this.dust.value, 0.7);
    const intensity = heat ? this.heat.value : Math.max(dustEmission, burst);
    const density = heat ? 1 : Math.max(dustEmission, burst);
    for (let i = 0; i < positions.count; i++) {
      const seed = i * 2.39996;
      const phase =
        (i / positions.count + this.elapsed * (heat ? 0.35 : 0.16 + dustEmission * 0.35)) % 1;
      const cleaningSpread = burst > 0 ? 0.75 + (1 - burst) * 0.45 : 0;
      const spread = heat ? 0.23 + phase * 0.35 : 0.28 + dustEmission * 0.62 + cleaningSpread;
      const rise = heat
        ? 0.08 + phase * (0.8 + this.heat.value)
        : phase * (0.35 + dustEmission * 0.35) + (burst > 0 ? (1 - burst) * 0.8 : 0);
      positions.setXYZ(
        i,
        this.center.x + Math.sin(seed + phase * 1.5) * this.size.x * spread + this.up.x * rise,
        this.center.y + this.size.y * 0.55 + this.up.y * rise,
        this.center.z + Math.cos(seed * 1.7 + phase) * this.size.z * spread + this.up.z * rise,
      );
      opacity.setX(
        i,
        i / positions.count < density
          ? Math.sin(phase * Math.PI) * intensity * (heat ? 0.24 : 0.78)
          : 0,
      );
      sizes.setX(
        i,
        heat ? 0.32 + phase * 0.7 : 0.022 + dustEmission * 0.05 + burst * 0.035 + (i % 4) * 0.008,
      );
    }
    positions.needsUpdate = true;
    opacity.needsUpdate = true;
    sizes.needsUpdate = true;
  }
}

function createCloud(name: string, count: number, color: number): THREE.Points {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute('particleOpacity', new THREE.BufferAttribute(new Float32Array(count), 1));
  geometry.setAttribute('particleSize', new THREE.BufferAttribute(new Float32Array(count), 1));
  const material = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color(color) } },
    vertexShader: `
      attribute float particleOpacity;
      attribute float particleSize;
      varying float opacity;
      void main() {
        opacity = particleOpacity;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(particleSize * 700.0 / max(1.0, -mvPosition.z), 1.0, 110.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      varying float opacity;
      void main() {
        float radius = length(gl_PointCoord - 0.5) * 2.0;
        if (radius > 1.0) discard;
        float edge = pow(1.0 - radius, 2.0);
        gl_FragColor = vec4(tint, edge * opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.name = name;
  cloud.visible = false;
  cloud.frustumCulled = false;
  cloud.raycast = () => {};
  return cloud;
}
