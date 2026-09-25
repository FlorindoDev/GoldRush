import * as THREE from 'three';
import { GAME_BALANCE } from '../../../src/app/config/game-balance';
import { createBox, createLabelTexture } from './mesh-primitives';
import { TOOL_AREA_DEPTH, TOOL_AREA_WIDTH } from '../../../src/app/scene/environment/scene-layout';
import { TOOL_SLOT_POSITIONS, TOOL_STATIONS } from '../../../src/app/scene/tools/tool-stations';
import { createDashedOutline } from './dashed-outline';

const TOOL_SLOT_SIZE = {
  width: GAME_BALANCE.layout.toolArea.slotWidth,
  depth: GAME_BALANCE.layout.toolArea.slotDepth,
};
const COLORS = GAME_BALANCE.scene.surfaces.tools;

interface StationSlotOptions {
  position: readonly [x: number, z: number];
  emptySlotLabel?: string;
  hasStation: boolean;
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
  floor.add(createBox([TOOL_AREA_WIDTH, 0.08, TOOL_AREA_DEPTH], COLORS.floor, [0, -0.49, 0]));
  floor.add(
    createDashedOutline({
      width: TOOL_AREA_WIDTH,
      depth: TOOL_AREA_DEPTH,
      color: COLORS.floorOutline,
      dashSize: COLORS.floorDashSize,
      gapSize: COLORS.floorGapSize,
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
    options.hasStation ? COLORS.station : COLORS.empty,
    [x, -0.4375, z],
    true,
  );
  tile.castShadow = false;
  area.add(
    tile,
    createDashedOutline({
      ...TOOL_SLOT_SIZE,
      color: COLORS.slotOutline,
      dashSize: COLORS.slotDashSize,
      gapSize: COLORS.slotGapSize,
      y: -0.405,
      x,
      z,
    }),
  );

  if (options.emptySlotLabel) {
    area.add(createLabel({ text: options.emptySlotLabel, width: 1.25, height: 0.22, x, z }));
  }
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
