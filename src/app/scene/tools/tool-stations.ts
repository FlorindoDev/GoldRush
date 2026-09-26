import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
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
    label: 'Banco GPU',
    ...GAME_BALANCE.toolStations.workbench,
  },
  rigWorkbench: {
    id: 'rigWorkbench',
    label: 'Banco RIG',
    ...GAME_BALANCE.toolStations.rigWorkbench,
  },
  computer: {
    id: 'computer',
    label: 'Computer',
    ...GAME_BALANCE.toolStations.computer,
  },
} as const satisfies Record<string, ToolStationDefinition>;

type ToolStation = (typeof TOOL_STATION_DEFINITIONS)[keyof typeof TOOL_STATION_DEFINITIONS];

export type ToolStationId = keyof typeof TOOL_STATION_DEFINITIONS;
export const TOOL_STATIONS: readonly ToolStation[] = Object.values(TOOL_STATION_DEFINITIONS);

export const TOOL_SLOT_POSITIONS: readonly Position2D[] =
  GAME_BALANCE.layout.toolArea.slotPositions;

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
