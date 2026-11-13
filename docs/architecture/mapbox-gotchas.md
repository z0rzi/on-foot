# rnmapbox gotchas

How `@rnmapbox/maps` behaves on Android where its types and docs do not say. Each one passed `tsc`
and `jest` (the SDK is mocked) and surfaced only on the phone. Read this before changing the camera,
a source or a layer under `src/map/`; a reviewer checks a map change against it. A new one found on
a device is added here in the change that handles it.

## The camera

- **A camera move is dropped while follow is active**, imperative or declarative. A store action
  that runs a one-shot camera op (recenter, select, a cluster fit, north) turns follow off in the
  same commit, and the op runs a frame later (`src/map/MapCanvas.tsx`, `src/store/mapStore.ts`).
- **A declarative `pitch` prop is a camera stop of its own.** rnmapbox sends it with the commit's
  props, unordered with an imperative `fitBounds`; landing after the fit, it cancels or tilts it.
  The pitch travels inside the fit (`CameraController.fitBounds` takes `pitch`), and only a pitch
  control's pitch is declarative (`manualPitchProps` in `src/store/mapStore.ts`). Found 2026-09-08
  (a fit from 3D stayed tilted) and again 2026-11-12 (a cluster fit from 2D follow never moved).
- **A manual pan, zoom or tilt cancels tracking.** `onUserTrackingModeChange` drops the app's
  follow mode to match (`src/map/MapCanvas.tsx`).
- **Before the map has loaded, `onCameraChanged` reports the style's default camera**, and no
  change when the initial camera lands; camera changes are forwarded only once loaded. Its payload
  can also be empty (`properties` missing) while there is no camera state
  (`src/map/providers/mapbox/adapter.tsx`, `camera.ts`).

## Sources and layers

- **A `ShapeSource` gives its id only to its direct children.** A layer inside a wrapper component
  gets none: nothing is drawn, and logcat says `Source composite missing for layer <id>`. A layer
  that is not a direct child of its source names `sourceID` itself.
- **A layer mounted after the style loads goes on top of the stack**, whatever its child order,
  unless given `aboveLayerID`, `belowLayerID` or `layerIndex`. Stacking is held by invisible anchor
  layers, one per slot (`src/map/providers/mapbox/adapter.tsx`, `tiers.ts`).
- **With terrain on, symbol and circle layers draw above every line layer**, whatever their place
  in the style.
- **Once any puck image is custom, the unset slots get no image** and Mapbox logs an error per
  re-render; fill them with a transparent pixel (`adapter.tsx`).

## Events

- **A press's screen point arrives in dp on Android**: rnmapbox converts the SDK's physical pixels
  (`src/map/providers/mapbox/mapPress.ts`).

## Finding the next one

Mapbox reports style, source and layer errors in logcat, not in the JS console of a release build:
`adb logcat -d -v time | grep -i mapbox`, or the device-check toolkit's preflight.
