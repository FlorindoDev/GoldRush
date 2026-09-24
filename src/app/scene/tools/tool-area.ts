import * as THREE from 'three';
import { createBox, createLabelTexture } from '../geometry/mesh-primitives';
import { TOOL_AREA_DEPTH, TOOL_AREA_WIDTH } from '../environment/scene-layout';
import { TOOL_SLOT_POSITIONS, TOOL_STATIONS } from './tool-stations';

const TOOL_SLOT_SIZE = { width: 6.5, depth: 4.8 };
const FLOOR_COLORS = { station: 0x3b5845, empty: 0x2b3a30 };

interface StationSlotOptions {
  position: readonly [x: number, z: number];
  emptySlotLabel?: string;
  hasStation: boolean;
}

interface DashedOutlineOptions {
  width: number;
  depth: number;
  color: number;
  dashSize: number;
  gapSize: number;
  y: number;
  x?: number;
  z?: number;
}

interface FloorLabelOptions {
  text: string;
  width: number;
  height: number;
  x: number;
  z: number;
}

export function createToolArea(): THREE.Group {
  const area = new THREE.Group();
  area.name = 'tool-area';
  area.add(createFloor(), createFloorLabel());

  const stationsBySlot = new Map<number, (typeof TOOL_STATIONS)[number]>(
    TOOL_STATIONS.map((station) => [station.slotIndex, station] as const),
  );
  TOOL_SLOT_POSITIONS.forEach((position, slotIndex) => {
    const station = stationsBySlot.get(slotIndex);
    const emptySlotLabel = station ? undefined : formatEmptySlotLabel(slotIndex);
    addStationSlot(area, { position, emptySlotLabel, hasStation: station !== undefined });
  });

  return area;
}

function createFloor(): THREE.Group {
  const floor = new THREE.Group();
  floor.add(createBox([TOOL_AREA_WIDTH, 0.08, TOOL_AREA_DEPTH], 0x26372d, [0, -0.49, 0]));
  floor.add(
    createDashedOutline({
      width: TOOL_AREA_WIDTH,
      depth: TOOL_AREA_DEPTH,
      color: 0x9bb582,
      dashSize: 0.34,
      gapSize: 0.2,
      y: -0.43,
    }),
  );
  return floor;
}

function createFloorLabel(): THREE.Mesh {
  return createLabel({
    text: 'TOOLS',
    width: 2.1,
    height: 0.3,
    x: 0,
    z: TOOL_AREA_DEPTH / 2 - 0.55,
  });
}

function addStationSlot(area: THREE.Group, options: StationSlotOptions): void {
  const [x, z] = options.position;
  const tile = createBox(
    [TOOL_SLOT_SIZE.width, 0.025, TOOL_SLOT_SIZE.depth],
    options.hasStation ? FLOOR_COLORS.station : FLOOR_COLORS.empty,
    [x, -0.4375, z],
    true,
  );
  tile.castShadow = false;
  area.add(
    tile,
    createDashedOutline({
      ...TOOL_SLOT_SIZE,
      color: 0x789276,
      dashSize: 0.2,
      gapSize: 0.14,
      y: -0.405,
      x,
      z,
    }),
  );

  if (options.emptySlotLabel) {
    area.add(createLabel({ text: options.emptySlotLabel, width: 1.25, height: 0.22, x, z }));
  }
}

function createDashedOutline(options: DashedOutlineOptions): THREE.LineSegments {
  const geometry = new THREE.BoxGeometry(options.width, 0.025, options.depth);
  const outline = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineDashedMaterial({
      color: options.color,
      dashSize: options.dashSize,
      gapSize: options.gapSize,
      transparent: true,
      opacity: 0.75,
    }),
  );
  geometry.dispose();
  outline.computeLineDistances();
  outline.position.set(options.x ?? 0, options.y, options.z ?? 0);
  return outline;
}

function createLabel(options: FloorLabelOptions): THREE.Mesh {
  const label = new THREE.Mesh(
    new THREE.PlaneGeometry(options.width, options.height),
    new THREE.MeshBasicMaterial({ map: createLabelTexture(options.text) }),
  );
  label.rotation.x = -Math.PI / 2;
  label.position.set(options.x, -0.39, options.z);
  return label;
}

function formatEmptySlotLabel(index: number): string {
  return `SLOT ${String(index + 1).padStart(2, '0')}`;
}
