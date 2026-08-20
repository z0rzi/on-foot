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
} as const
