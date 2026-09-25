import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { group, mesh, box, cylinder, ring } from './primitives.mjs';

export const COIN_MODELS = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    ticker: 'BTC',
    color: 0xf2b647,
    algorithm: 'SHA-256',
    source: 'https://bitcoin.org/en/how-it-works',
  },
  {
    id: 'litecoin',
    name: 'Litecoin',
    ticker: 'LTC',
    color: 0xaac3de,
    symbol: 'L',
    algorithm: 'Scrypt',
    source: 'https://litecoin.info/docs/key-concepts/proof-of-work',
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    ticker: 'DOGE',
    color: 0xcfad4a,
    symbol: 'D',
    algorithm: 'Scrypt',
    source: 'https://dogecoin.com/dogepedia/how-tos/mining-dogecoin/',
  },
  {
    id: 'monero',
    name: 'Monero',
    ticker: 'XMR',
    color: 0xec7b35,
    symbol: 'M',
    algorithm: 'RandomX',
    source: 'https://www.getmonero.org/get-started/mining/',
  },
  {
    id: 'ethereum-classic',
    name: 'Ethereum Classic',
    ticker: 'ETC',
    color: 0x62bb87,
    symbol: 'diamond',
    algorithm: 'Etchash',
    source: 'https://www.ethereumclassic.org/faqs/miners/',
  },
  {
    id: 'kaspa',
    name: 'Kaspa',
    ticker: 'KAS',
    color: 0x73cfc3,
    symbol: 'K',
    algorithm: 'kHeavyHash',
    source: 'https://kaspa.org/',
  },
  {
    id: 'ravencoin',
    name: 'Ravencoin',
    ticker: 'RVN',
    color: 0xe57341,
    symbol: 'raven',
    algorithm: 'KAWPOW',
    source: 'https://ravencoin.org/about/',
  },
  {
    id: 'ergo',
    name: 'Ergo',
    ticker: 'ERG',
    color: 0xe0e4e7,
    symbol: 'sigma',
    algorithm: 'Autolykos',
    source: 'https://learn.ergoplatform.com/mining/',
  },
];

export async function loadBitcoinMaster() {
  const { scene } = await new GLTFLoader().loadAsync('/source/bitcoin/scene.gltf');
  const bounds = new THREE.Box3().setFromObject(scene);
  const size = bounds.getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(0.9 / Math.max(size.x, size.y));
  scene.updateMatrixWorld(true);
  const center = new THREE.Box3().setFromObject(scene).getCenter(new THREE.Vector3());
  scene.position.sub(center);
  scene.updateMatrixWorld(true);
  return scene;
}

export function createCoin(spec, targetSize) {
  const root = group(`coin-${spec.ticker.toLowerCase()}`);
  const metal = new THREE.MeshStandardMaterial({
    color: spec.color,
    metalness: 0.8,
    roughness: 0.34,
  });
  const face = new THREE.MeshStandardMaterial({
    color: spec.color,
    metalness: 0.48,
    roughness: 0.45,
  });
  const relief = new THREE.MeshStandardMaterial({
    color: spec.id === 'ergo' ? 0x202529 : 0xf9f3dc,
    metalness: 0.6,
    roughness: 0.35,
  });
  const body = cylinder(root, 0.45, 0.075, metal, [0, 0, 0], 64);
  body.rotation.x = Math.PI / 2;
  for (let i = 0; i < 64; i++) {
    const angle = (i * Math.PI) / 32;
    const edge = box(root, [0.012, 0.021, 0.07], relief, [
      Math.cos(angle) * 0.442,
      Math.sin(angle) * 0.442,
      0,
    ]);
    edge.rotation.z = angle;
  }
  for (const side of [-1, 1]) {
    const faceRoot = group('coin-face', [0, 0, side * 0.039]);
    faceRoot.rotation.y = side < 0 ? Math.PI : 0;
    root.add(faceRoot);
    const inset = cylinder(faceRoot, 0.393, 0.005, face, [0, 0, 0], 64);
    inset.rotation.x = Math.PI / 2;
    ring(faceRoot, 0.405, 0.013, relief, [0, 0, 0.004]);
    addSymbol(faceRoot, spec.symbol, relief);
  }
  root.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  root.scale.set(targetSize.x / size.x, targetSize.y / size.y, targetSize.z / size.z);
  root.userData = { ticker: spec.ticker, algorithm: spec.algorithm, shape: 'bitcoin-standard' };
  return root;
}

function addSymbol(root, symbol, material) {
  if (symbol === 'diamond' || symbol === 'raven' || symbol === 'sigma') {
    const polygons =
      symbol === 'diamond'
        ? [
            [
              [0, 0.27],
              [-0.14, 0.025],
              [0, -0.055],
              [0.14, 0.025],
            ],
            [
              [-0.14, -0.015],
              [0, -0.11],
              [0.14, -0.015],
              [0, -0.27],
            ],
          ]
        : symbol === 'raven'
          ? [
              [
                [-0.17, -0.25],
                [-0.08, 0.1],
                [0.04, 0.26],
                [0.19, 0.2],
                [0.25, 0.08],
                [0.09, 0.08],
                [0.035, -0.25],
              ],
            ]
          : [
              [
                [-0.17, 0.24],
                [0.17, 0.24],
                [0.17, 0.16],
                [-0.045, 0.16],
                [0.1, 0],
                [-0.045, -0.16],
                [0.17, -0.16],
                [0.17, -0.24],
                [-0.17, -0.24],
                [-0.17, -0.17],
                [0, 0],
                [-0.17, 0.17],
              ],
            ];
    for (const polygon of polygons) {
      const shape = new THREE.Shape(polygon.map(([x, y]) => new THREE.Vector2(x, y)));
      shape.closePath();
      mesh(
        root,
        new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false }),
        material,
        [0, 0, 0.006],
      );
    }
    return;
  }
  const outlines = {
    L: [
      [-0.14, 0.24],
      [-0.04, 0.24],
      [-0.04, -0.15],
      [0.17, -0.15],
      [0.17, -0.24],
      [-0.14, -0.24],
    ],
    M: [
      [-0.22, -0.22],
      [-0.22, 0.23],
      [-0.13, 0.23],
      [0, -0.01],
      [0.13, 0.23],
      [0.22, 0.23],
      [0.22, -0.22],
      [0.12, -0.22],
      [0.12, 0.04],
      [0, -0.15],
      [-0.12, 0.04],
      [-0.12, -0.22],
    ],
    K: [
      [-0.18, -0.24],
      [-0.18, 0.24],
      [-0.08, 0.24],
      [-0.08, 0.04],
      [0.09, 0.24],
      [0.21, 0.24],
      [0.015, 0.01],
      [0.22, -0.24],
      [0.09, -0.24],
      [-0.08, -0.04],
      [-0.08, -0.24],
    ],
    D: [
      [-0.17, -0.24],
      [-0.17, 0.24],
      [0.03, 0.24],
      [0.18, 0.13],
      [0.21, 0],
      [0.18, -0.13],
      [0.03, -0.24],
    ],
  };
  const shape = new THREE.Shape(outlines[symbol].map(([x, y]) => new THREE.Vector2(x, y)));
  shape.closePath();
  if (symbol === 'D') {
    const hole = new THREE.Path(
      [
        [-0.065, -0.15],
        [0.005, -0.15],
        [0.09, -0.08],
        [0.1, 0],
        [0.09, 0.08],
        [0.005, 0.15],
        [-0.065, 0.15],
      ].map(([x, y]) => new THREE.Vector2(x, y)),
    );
    hole.closePath();
    shape.holes.push(hole);
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false });
  mesh(root, geometry, material, [0, 0, 0.006]);
  if (symbol === 'L' || symbol === 'D') {
    const slash = box(root, [symbol === 'D' ? 0.37 : 0.26, 0.032, 0.014], material, [
      symbol === 'D' ? -0.025 : -0.025,
      -0.03,
      0.022,
    ]);
    slash.rotation.z = symbol === 'D' ? 0 : 0.36;
  }
}
