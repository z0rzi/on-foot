# North (reset-bearing) button — implementation notes

Handoff notes for when we build the deferred North-reset button. Written 2026-08-20
after a cleanup pass that removed the *unwired* plumbing that had been pre-laid for
this feature — so this file records what was removed, why, and how to bring it back
**with a consumer** rather than as speculative scaffolding.

## What was just cleaned up (and how it relates to this feature)

All of the following were faithful 1:1 ports of the Kotlin app's map vocabulary that
had been added ahead of their consumers. They were removed to keep the codebase honest
(`AGENTS.md` → "no unwired plumbing"); each is listed here so re-adding it is trivial.

- **`onCameraChanged` on the provider port + adapter** (commit `8cb6a41`) — the channel
  for observing live camera `heading`/`pitch`. **This feature needs it back** (see below):
  the North button's visibility is a function of the camera heading. Re-add it narrowly
  (heading is all we need) *together with* the store consumer + test.
- **Imperative `CameraHandle` / `setCamera`** (commit `8cb6a41`) — removed because the
  camera is driven declaratively now. The North *reset* is a one-shot bearing change; do
  it declaratively (a `heading` prop that animates to 0), **not** by resurrecting the
  generic imperative passthrough. See "Reset behaviour" below.
- **`MapTokens.bearingThreshold` (= 1)** — the dead-zone that stops the button flickering
  near north. Re-add this exact constant when wiring visibility (it had no consumer, so it
  was removed; it is a real parameter of this feature).
- **`MapTokens.terrainTileSize`** — unrelated; removed as a duplicate of
  `TERRAIN_DEM.tileSize` in `providers/mapbox/styles.ts` (the value the adapter actually
  uses). Not relevant to this feature; noted only so the removal isn't a mystery.

## How it works in the Kotlin reference (the behaviour to port)

- **Visibility** — `ui/map/MapControlsColumn.kt:80`:
  ```kotlin
  val shouldShowNorthButton = abs(cameraBearing) > MapBehavior.bearingThreshold  // 1.0°
  ```
  i.e. show the button whenever the *map camera* is rotated more than 1° off north.
- **Heading source** — the puck/device bearing comes from an
  `OnIndicatorBearingChangedListener` (`MapContent.kt:270-276`), but note the *button*
  keys off `cameraBearing` (the map's rotation), not the device heading. In practice the
  camera bearing is what rotates in `PositionAndBearing`/compass mode and after a manual
  rotate gesture.
- **Reset action** — `onNorthButtonClick` → `viewModel.onNorthButtonClicked(...)`
  (`MapScreen.kt:287`), which issues a `MapCameraCommand.SetBearing(0)` animated move
  (`MapScreen.kt:250`) and, when following with bearing, demotes the follow mode.
- **Tokens** — `bearingThreshold = 1.0`, `bearingReset = 0.0`, `cameraBearingDefault = 0.0`
  (`ui/map/MapTokens.kt:41-48`).

## Current RN scaffold that already exists

- **`MapControls.tsx`** already renders the button, but gated on a hardcoded stub:
  ```tsx
  const heading = 0                          // <- replace with real camera heading
  {heading !== 0 && (
    <ControlButton accessibilityLabel="Reset north" onPress={() => {}}>  // <- wire onPress
      <NorthIcon .../>
    </ControlButton>
  )}
  ```
- **`mapStore.ts`** already has `northPressed()` → `demoteBearing(followMode)` (turns
  `positionAndBearing` into `position`, which is north-up). The pure `demoteBearing` helper
  is already tested. This covers the *follow-with-bearing* case; the *manual-rotation while
  `off`* case still needs a bearing reset (below).
- **`NorthIcon`** asset exists (`src/assets/icons/north.tsx`).
- **Puck bearing** is already enabled (`adapter.tsx` UserPuck: `puckBearing="heading"`),
  so the arrow already tracks device heading — no work needed there.

## Recommended implementation (seam-respecting, declarative, TDD)

Keep the map SDK behind the port; put policy in pure helpers; observe heading declaratively.

1. **Re-add heading observation to the port (narrow).** On `MapViewProps` add
   `onCameraChanged?: (e: { heading: number }) => void` (or a more specific
   `onHeadingChanged`). Map it in `adapter.tsx` from Mapbox's `onCameraChanged`
   (`e.properties.heading`). Keep it minimal — only what the feature consumes.
2. **Store (pure logic first, TDD).**
   - Add session-only `cameraHeading: number` + `setCameraHeading(h)`.
   - Re-add `MapTokens.bearingThreshold = 1`.
   - Add a pure, exported, unit-tested helper, e.g.
     `shouldShowNorthButton(heading, threshold)` returning
     `Math.abs(normalizeDeg(heading)) > threshold`, where `normalizeDeg` maps to
     `(-180, 180]` so 359° reads as -1°. Test the wrap-around cases.
3. **Reset behaviour — do it declaratively (this is the right shape for the removed
   `setCamera`).** Mirror how pitch is handled today (`cameraPitch` + `pitchAnimated`
   consumed by `MapCanvas`):
   - When `followMode === 'positionAndBearing'` → `northPressed()` already demotes to
     `position` (north-up). Good.
   - When `followMode === 'off'` and the user rotated → add a `cameraHeading` reset:
     set a controlled `heading: 0` with an animated duration on the `<Camera>` for the
     off case (parallel to `manualPitch` in `MapCanvas.tsx`). Have the North button call a
     single `resetNorth()` action that covers both cases.
4. **Wire `MapControls.tsx`.** Replace `const heading = 0` with a selector that returns the
   *derived boolean* so the component only re-renders when visibility flips:
   ```tsx
   const showNorth = useMapStore((s) => shouldShowNorthButton(s.cameraHeading, MapTokens.bearingThreshold))
   ```
   Set the button's `onPress` to `resetNorth`.
5. **Wire `MapCanvas.tsx`.** Pass `onCameraChanged={(e) => setCameraHeading(e.heading)}` to
   `MapView`, and (for the `off` reset) feed the controlled `heading`/animation like
   `manualPitch`.

## Gotchas

- **Per-frame updates.** `onCameraChanged` fires very frequently. Storing raw `cameraHeading`
  every frame means a `setState` per frame. Two mitigations: (a) select the *derived boolean*
  in the component (step 4) so re-renders only happen on threshold crossings; (b) optionally
  gate `setCameraHeading` to skip sub-degree deltas. Measure before over-optimising.
- **Angle normalisation.** Heading is 0–360; the "off north" test must handle wrap-around
  (359° ⇒ show). Hence the `normalizeDeg` helper — cover it with tests.
- **Two distinct cases.** Follow-with-bearing resets via follow-mode demotion (declarative,
  already built); manual rotation while `off` resets via an animated controlled `heading`.
  A single `resetNorth()` action should branch on `followMode` so the button is one control.
- **Don't reach for imperative `setCamera`.** The declarative controlled-`heading` approach
  (like `cameraPitch`) avoids the rnmapbox "imperative move is a no-op while following"
  trap that bit us during the follow-camera work.
