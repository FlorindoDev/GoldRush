import * as THREE from 'three';

export interface LiquidGpuConnection {
  readonly slotIndex: number;
  readonly gpu: THREE.Object3D;
}

/** Collega i raccordi delle GPU montate ai due collettori e alla pompa del RIG. */
export function createRigLiquidHoses(
  model: THREE.Group,
  connections: readonly LiquidGpuConnection[],
): THREE.Group | null {
  const coolingMount = model.getObjectByName('cooling-mount');
  if (!coolingMount?.getObjectByName('cooling-liquid')) return null;

  const mounted = connections.flatMap(({ slotIndex, gpu }) => {
    const inlet = gpu.getObjectByName('coolant-in');
    const outlet = gpu.getObjectByName('coolant-out');
    const socket = model.getObjectByName(`gpu-slot-${String(slotIndex + 1).padStart(2, '0')}`);
    return inlet && outlet && socket ? [{ slotIndex, inlet, outlet, socket }] : [];
  });
  if (mounted.length === 0) return null;

  model.updateMatrixWorld(true);
  const hoses = new THREE.Group();
  hoses.name = 'rig-liquid-hoses';
  const supply = new THREE.MeshStandardMaterial({ color: 0x52cfe2, roughness: 0.45 });
  const returnLine = new THREE.MeshStandardMaterial({ color: 0x263b49, roughness: 0.55 });
  const manifoldStartX = Math.min(...mounted.map(({ socket }) => socket.position.x + 0.25));

  for (const [name, port, z, y, material] of [
    ['in', new THREE.Vector3(1.08, 0.63, -0.16), -0.3, 2.9, supply],
    ['out', new THREE.Vector3(1.08, 0.63, 0.16), 0.3, 2.98, returnLine],
  ] as const) {
    const pump = model.worldToLocal(coolingMount.localToWorld(port.clone()));
    addHose(
      hoses,
      `coolant-manifold-${name}`,
      [
        new THREE.Vector3(manifoldStartX, y, z),
        new THREE.Vector3(2.75, y, z),
        new THREE.Vector3(3.25, 2.65, z),
        new THREE.Vector3(4.35, 1.2, z),
        pump,
      ],
      0.045,
      material,
    );
    for (const { slotIndex, inlet, outlet, socket } of mounted) {
      const source = model.worldToLocal(
        (name === 'in' ? inlet : outlet).getWorldPosition(new THREE.Vector3()),
      );
      const target = new THREE.Vector3(socket.position.x + 0.25, y, z);
      addHose(
        hoses,
        `coolant-hose-slot-${slotIndex + 1}-${name}`,
        [
          source,
          source.clone().add(new THREE.Vector3(0.08, 0.28, 0)),
          target.clone().add(new THREE.Vector3(0.16, 0.12, 0)),
          target,
        ],
        0.028,
        material,
      );
    }
  }
  return hoses;
}

function addHose(
  root: THREE.Group,
  name: string,
  points: THREE.Vector3[],
  radius: number,
  material: THREE.MeshStandardMaterial,
): void {
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, radius, 6);
  const hose = new THREE.Mesh(geometry, material);
  hose.name = name;
  hose.castShadow = true;
  root.add(hose);
}
