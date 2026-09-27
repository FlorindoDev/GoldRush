import * as THREE from 'three';
import { GAME_BALANCE } from '../../config/game-balance';
import { rigPosition } from '../environment/scene-layout';
import { toolStationCamera, type ToolStationId } from '../tools/tool-stations';
import type { CameraPreset } from './camera-preset';

const CAMERA = GAME_BALANCE.camera.scene;

export interface CameraFocus {
  readonly target: THREE.Vector3;
  readonly offset: THREE.Vector3;
}

interface CameraFocusState {
  readonly viewedRigId: number;
  readonly cameraPreset: CameraPreset;
  readonly inspectedGpuId: number | null;
  readonly selectedToolStationId: ToolStationId | null;
  readonly computerOpen?: boolean;
}

export function rigCameraFocus(rigId: number, preset: CameraPreset): CameraFocus {
  return {
    target: rigPosition(rigId).add(new THREE.Vector3(...CAMERA.rigTarget)),
    offset: new THREE.Vector3(...(preset === 'top' ? CAMERA.rigTopOffset : CAMERA.rigFrontOffset)),
  };
}

export function resolveCameraFocus(state: CameraFocusState): CameraFocus {
  const selectedToolStationId =
    state.selectedToolStationId === 'computer' && !state.computerOpen
      ? null
      : state.selectedToolStationId;
  const stationId = selectedToolStationId ?? (state.inspectedGpuId !== null ? 'workbench' : null);
  if (stationId === null) {
    return rigCameraFocus(state.viewedRigId, state.cameraPreset);
  }

  const focus = toolStationCamera(stationId);
  return {
    target: focus.target,
    offset:
      state.cameraPreset === 'top' ? new THREE.Vector3(...CAMERA.toolTopOffset) : focus.offset,
  };
}
