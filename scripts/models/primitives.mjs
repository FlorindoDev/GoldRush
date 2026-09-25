import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const materials = {
  frame: material('Anodized graphite', 0x354343, 0.7),
  black: material('Rubber and ABS', 0x131c20, 0.1),
  steel: material('Brushed aluminium', 0xa7b8bd, 0.8),
  pcb: material('Circuit board', 0x204e43, 0.2),
  gold: material('Contacts', 0xd4ab58, 0.7),
  lime: material('Lime accents', 0xb8f575, 0.3),
  blue: material('Coolant blue', 0x52cfe2, 0.4),
  orange: material('Industrial orange', 0xec9450, 0.3),
  white: material('Ceramic white', 0xd9e2dd, 0.25),
  copper: material('Copper heat pipes', 0xb97142, 0.85),
  filter: material('Filter fibres', 0x87948c, 0.05),
  glass: new THREE.MeshStandardMaterial({
    name: 'Tinted acrylic',
    color: 0x92dae0,
    metalness: 0.1,
    roughness: 0.2,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  }),
};

function material(name, color, metalness) {
  return new THREE.MeshStandardMaterial({ name, color, metalness, roughness: 0.5 });
}

export function group(name, position = [0, 0, 0]) {
  const root = new THREE.Group();
  root.name = name;
  root.position.set(...position);
  return root;
}

export function mesh(root, geometry, mat, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, mat);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  root.add(object);
  return object;
}

export function box(root, size, mat, position = [0, 0, 0]) {
  return mesh(root, new THREE.BoxGeometry(...size), mat, position);
}

export function cylinder(root, radius, height, mat, position = [0, 0, 0], segments = 16) {
  return mesh(root, new THREE.CylinderGeometry(radius, radius, height, segments), mat, position);
}

export function ring(root, radius, tube, mat, position = [0, 0, 0]) {
  return mesh(root, new THREE.TorusGeometry(radius, tube, 6, 32), mat, position);
}

export function pipe(root, points, radius, mat) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  return mesh(root, new THREE.TubeGeometry(curve, 20, radius, 6, false), mat);
}

export function bolt(root, position, radius = 0.035) {
  const screw = cylinder(root, radius, 0.028, materials.steel, position, 6);
  screw.rotation.x = Math.PI / 2;
  return screw;
}

export function panelFrame(root, width, height, depth, mat, position = [0, 0, 0], rail = 0.07) {
  const frame = group('panel-frame', position);
  for (const x of [-1, 1]) {
    box(frame, [rail, height, depth], mat, [(x * (width - rail)) / 2, 0, 0]);
  }
  for (const y of [-1, 1]) {
    box(frame, [width, rail, depth], mat, [0, (y * (height - rail)) / 2, 0]);
  }
  root.add(frame);
  return frame;
}

// Merge only static siblings. Socket transforms and separate rotors remain editable in GLB.
export function batchMeshes(root) {
  for (const child of [...root.children]) {
    if (child.isGroup) {
      batchMeshes(child);
    }
  }
  const batches = new Map();
  for (const child of [...root.children]) {
    if (!child.isMesh || Array.isArray(child.material)) {
      continue;
    }
    const key = `${child.material.uuid}:${Boolean(child.geometry.index)}`;
    const list = batches.get(key) ?? [];
    list.push(child);
    batches.set(key, list);
  }
  for (const children of batches.values()) {
    const mat = children[0].material;
    if (children.length < 2) {
      continue;
    }
    const geometries = children.map((child) => {
      child.updateMatrix();
      return child.geometry.clone().applyMatrix4(child.matrix);
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((geometry) => geometry.dispose());
    if (!merged) {
      throw new Error(`Cannot merge ${root.name}`);
    }
    for (const child of children) {
      root.remove(child);
      child.geometry.dispose();
    }
    mesh(root, merged, mat).name = mat.name;
  }
  return root;
}
