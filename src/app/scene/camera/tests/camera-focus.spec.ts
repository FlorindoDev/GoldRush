import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GAME_BALANCE } from '../../../config/game-balance';
import { rigPosition } from '../../environment/scene-layout';
import { toolStationPosition } from '../../tools/tool-stations';
import { resolveCameraFocus, rigCameraFocus } from '../camera-focus';

const CAMERA = GAME_BALANCE.camera.scene;

describe('camera focus', () => {
  it.each(['front', 'top'] as const)(
    'frames the viewed rig using the %s preset',
    (cameraPreset) => {
      const focus = resolveCameraFocus({
        viewedRigId: 7,
        cameraPreset,
        inspectedGpuId: null,
        selectedToolStationId: null,
      });
      const expectedTarget = rigPosition(7).add(new THREE.Vector3(...CAMERA.rigTarget));
      expect(focus.target.toArray()).toEqual(expectedTarget.toArray());
      expect(focus.offset.toArray()).toEqual(
        cameraPreset === 'top' ? CAMERA.rigTopOffset : CAMERA.rigFrontOffset,
      );
    },
  );

  it.each(['front', 'top'] as const)(
    'frames the selected station using the %s preset',
    (cameraPreset) => {
      const focus = resolveCameraFocus({
        viewedRigId: 7,
        cameraPreset,
        inspectedGpuId: null,
        selectedToolStationId: 'workbench',
      });
      const station = GAME_BALANCE.toolStations.workbench;
      const expectedTarget = toolStationPosition('workbench').add(
        new THREE.Vector3(...station.focusTargetOffset),
      );
      expect(focus.target.toArray()).toEqual(expectedTarget.toArray());
      expect(focus.offset.toArray()).toEqual(
        cameraPreset === 'top' ? CAMERA.toolTopOffset : station.cameraOffset,
      );
    },
  );

  it('focuses the workbench during GPU inspection and resets to the front of the viewed rig', () => {
    const focus = resolveCameraFocus({
      viewedRigId: 7,
      cameraPreset: 'top',
      inspectedGpuId: 1,
      selectedToolStationId: null,
    });
    const station = GAME_BALANCE.toolStations.workbench;
    expect(focus.target.toArray()).toEqual(
      toolStationPosition('workbench')
        .add(new THREE.Vector3(...station.focusTargetOffset))
        .toArray(),
    );
    expect(focus.offset.toArray()).toEqual(CAMERA.toolTopOffset);
    const reset = rigCameraFocus(7, 'front');
    expect(reset.target.toArray()).toEqual(
      rigPosition(7)
        .add(new THREE.Vector3(...CAMERA.rigTarget))
        .toArray(),
    );
    expect(reset.offset.toArray()).toEqual(CAMERA.rigFrontOffset);
  });

  it('focuses the explicitly selected RIG bench while a GPU bench is also open', () => {
    const focus = resolveCameraFocus({
      viewedRigId: 7,
      cameraPreset: 'front',
      inspectedGpuId: 1,
      selectedToolStationId: 'rigWorkbench',
    });
    const station = GAME_BALANCE.toolStations.rigWorkbench;
    expect(focus.target.toArray()).toEqual(
      toolStationPosition('rigWorkbench')
        .add(new THREE.Vector3(...station.focusTargetOffset))
        .toArray(),
    );
    expect(focus.offset.toArray()).toEqual(station.cameraOffset);
  });

  it('returns to the GPU workbench after inspecting a GPU from the closed computer', () => {
    const focus = resolveCameraFocus({
      viewedRigId: 7,
      cameraPreset: 'front',
      inspectedGpuId: 1,
      selectedToolStationId: 'computer',
      computerOpen: false,
    });
    const station = GAME_BALANCE.toolStations.workbench;
    expect(focus.target.toArray()).toEqual(
      toolStationPosition('workbench')
        .add(new THREE.Vector3(...station.focusTargetOffset))
        .toArray(),
    );
  });

  it('keeps the camera on the computer while it is open', () => {
    const focus = resolveCameraFocus({
      viewedRigId: 7,
      cameraPreset: 'front',
      inspectedGpuId: null,
      selectedToolStationId: 'computer',
      computerOpen: true,
    });
    const station = GAME_BALANCE.toolStations.computer;
    expect(focus.target.toArray()).toEqual(
      toolStationPosition('computer')
        .add(new THREE.Vector3(...station.focusTargetOffset))
        .toArray(),
    );
  });
});
