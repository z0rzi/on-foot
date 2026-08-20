export const MapTokens = {
  locationZoom: 15,
  pitchToggle: 60,
  pitchMin: 0,
  pitchMax: 85,
  pitchSensitivity: 0.3,
  // Min travel (px) for a pan on the layers button to count as a swipe (quick-switch) vs a tap.
  layerSwipeThreshold: 20,
  controlSize: 36,
  controlIconSize: 20,
  controlsSpacing: 12,
  overlayPadding: 16,
  // Dead-zone (deg): the North button shows only when the camera is rotated more than this off north.
  bearingThreshold: 1,
  terrainExaggeration: 1.0,
  trailLineWidth: 4,
  arrowSpacing: 100,
  arrowSize: 0.8,
  endpointRadius: 8,
  endpointStrokeWidth: 2.5,
  cameraPadding: { top: 100, sides: 100, bottom: 300 },
  trailFitDurationMs: 1000,
} as const
