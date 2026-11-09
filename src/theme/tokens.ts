export const MapTokens = {
  locationZoom: 15,
  pitchToggle: 60,
  pitchMin: 0,
  pitchMax: 85,
  pitchSensitivity: 0.3,
  // Min travel (px) for a pan on the layers button to count as a swipe (quick-switch) vs a tap.
  layerSwipeThreshold: 20,
  controlSize: 36,
  // The control buttons' and the record button's shadow, on their opaque surfaces.
  controlShadow: {
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  controlIconSize: 20,
  controlsSpacing: 12,
  recordButtonSize: 48,
  recordIconSize: 24,
  // Room between the overlays (controls column, record button) and the sheet's top edge.
  overlaySheetGap: 12,
  overlayPadding: 16,
  // The pill's and the card's shadow. A box shadow is drawn outside the shape only, so it leaves their
  // translucent surfaces clean, where an Android elevation shadow shows through as a dark smear.
  floatingShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
  // Dead-zone (deg): the North button shows only when the camera is rotated more than this off north.
  bearingThreshold: 1,
  terrainExaggeration: 1.0,
  trailLineWidth: 4,
  recordingLineWidth: 5,
  connectorDashArray: [0, 2],
  arrowSpacing: 100,
  arrowSize: 0.4,
  // Scale factor for the location puck's bearing image (a high-resolution source scaled down).
  puckBearingScale: 0.4,
  endpointRadius: 8,
  endpointStrokeWidth: 2.5,
  // Room the camera leaves around a framed or followed subject, past the pill and the sheet.
  cameraEdgeMargin: 24,
  cameraSidePadding: 100,
  trailFitDurationMs: 1000,
  // How long the camera must stay still before its framing is recorded as the last camera.
  cameraRestMs: 500,
  // How long launch waits on the map store's hydration, under the splash, before mounting the map
  // on the defaults.
  hydrationBoundMs: 2000,
  holdToStopMs: 1000,
  recordRingWidth: 3,
} as const
