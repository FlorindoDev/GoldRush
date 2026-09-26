export const CAMERA_CONFIG = {
  scene: {
    fieldOfViewDegrees: 36,
    near: 0.1,
    far: 100,
    panSpeed: 0.6,
    panLimit: 2.5,
    minDistance: 7,
    maxDistance: 32,
    minPolarAngleRadians: 0.3,
    maxPolarAngleRadians: Math.PI / 2.3,
    maxClickMovementPx: 5,
    editorOffsetMinWidthPx: 1000,
    editorOffsetWidthRatio: 0.12,
    rigTarget: [0, 1, -1.5] as const,
    rigFrontOffset: [12, 10, 23] as const,
    rigTopOffset: [0, 35, 8.4] as const,
    toolTopOffset: [0, 18, 3.8] as const,
  },
  bitcoinPreview: {
    fieldOfViewDegrees: 34,
    near: 0.1,
    far: 10,
    position: [0, 0.08, 3.1] as const,
    exposure: 1.2,
  },
} as const;

export const ANIMATION_CONFIG = {
  transitionSeconds: 1.1,
  gpuTransferArcHeight: 1.4,
  gpuFanRadiansPerSecond: 18,
  gpuMixerTimeScale: 3,
  particleCount: 28,
  particleHeight: 3,
  particlePhaseSpeed: 1.3,
} as const;

export const SCENE_CONFIG = {
  gpuModelWidth: 2.4,
  maxPixelRatio: 2,
  exposure: 1.45,
  groundSize: 240,
  // Materiali esportati nei GLB della scena.
  surfaces: {
    plot: {
      color: 0x24342a,
      outline: 0x76906f,
      dashSize: 0.28,
      gapSize: 0.16,
    },
    rigSlot: {
      unlockedColor: 0x526c4b,
      lockedColor: 0x26342a,
      outline: 0x87967e,
      dashSize: 0.22,
      gapSize: 0.15,
    },
    tools: {
      floor: 0x26372d,
      station: 0x3b5845,
      empty: 0x2b3a30,
      floorOutline: 0x9bb582,
      slotOutline: 0x789276,
      floorDashSize: 0.34,
      floorGapSize: 0.2,
      slotDashSize: 0.2,
      slotGapSize: 0.14,
    },
  },
} as const;

export const LAYOUT_CONFIG = {
  plots: {
    rigColumnSpacing: 11.2,
    rigRowSpacing: 6.6,
    rigSlotWidth: 10,
    rigSlotDepth: 5.4,
    gridOriginX: -10,
    gridColumns: 3,
    gap: 5.4,
    width: 23.6,
    depth: 20.4,
    rigSlotSpacing: 1.12,
  },
  toolArea: {
    width: 16,
    depth: 18,
    position: [50.5, 0, -25.2] as const,
    slotPositions: [
      [-4.2, 3.8],
      [4.2, 3.8],
      [-4.2, -3.8],
      [4.2, -3.8],
    ] as const,
    slotWidth: 6.5,
    slotDepth: 4.8,
  },
  workbench: {
    width: 5,
    depth: 3.6,
    surfaceY: 1.8,
    bitcoinTrayPosition: [1.6, 1.87, 1.04] as const,
  },
} as const;

export const TOOL_STATIONS_CONFIG = {
  workbench: {
    slotIndex: 0,
    focusTargetOffset: [-0.2, 1.65, 0] as const,
    cameraOffset: [5.5, 5, 10] as const,
  },
  rigWorkbench: {
    slotIndex: 1,
    focusTargetOffset: [0, 1.38, 0] as const,
    cameraOffset: [7.5, 6, 10] as const,
  },
} as const;
