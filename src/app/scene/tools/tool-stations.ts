import * as THREE from 'three';
import { TOOL_AREA_POSITION } from '../environment/scene-layout';

type Position2D = readonly [x: number, z: number];
type Position3D = readonly [x: number, y: number, z: number];

interface ToolStationDefinition {
  readonly id: string;
  readonly label: string;
  readonly slotIndex: number;
  readonly focusTargetOffset: Position3D;
  readonly cameraOffset: Position3D;
}

const TOOL_STATION_DEFINITIONS = {
  workbench: {
    id: 'workbench',
    label: 'Workbench',
    slotIndex: 0,
    focusTargetOffset: [-0.2, 1.65, 0],
    cameraOffset: [5.5, 5, 10],
  },
} as const satisfies Record<string, ToolStationDefinition>;

type ToolStation = (typeof TOOL_STATION_DEFINITIONS)[keyof typeof TOOL_STATION_DEFINITIONS];

export type ToolStationId = keyof typeof TOOL_STATION_DEFINITIONS;
export const TOOL_STATIONS: readonly ToolStation[] = Object.values(TOOL_STATION_DEFINITIONS);

export const TOOL_SLOT_POSITIONS: readonly Position2D[] = [
  [-4.2, 3.8],
  [4.2, 3.8],
  [-4.2, -3.8],
  [4.2, -3.8],
];

export interface ToolStationCamera {
  target: THREE.Vector3;
  offset: THREE.Vector3;
}

export function isToolStationId(id: string): id is ToolStationId {
  return Object.hasOwn(TOOL_STATION_DEFINITIONS, id);
}

export function getToolStation(id: ToolStationId): ToolStation {
  return TOOL_STATION_DEFINITIONS[id];
}

export function toolStationPosition(id: ToolStationId): THREE.Vector3 {
  const station = getToolStation(id);
  const [x, z] = TOOL_SLOT_POSITIONS[station.slotIndex];
  return TOOL_AREA_POSITION.clone().add(new THREE.Vector3(x, 0, z));
}

export function toolStationCamera(id: ToolStationId): ToolStationCamera {
  const station = getToolStation(id);
  return {
    target: toolStationPosition(id).add(new THREE.Vector3(...station.focusTargetOffset)),
    offset: new THREE.Vector3(...station.cameraOffset),
  };
}
