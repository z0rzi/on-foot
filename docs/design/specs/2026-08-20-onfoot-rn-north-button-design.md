# North (reset-bearing) Button — Design

**Date:** 2026-08-20
**Status:** Approved (pending spec review)
**Scope:** Wire the already-scaffolded North button on the map so it appears when the map
is rotated off north and, on tap, resets the camera bearing to north — a faithful port of
the Kotlin app's behaviour. Companion notes: `north-button-indications.md`.

## Goal

The map control column already renders a North (`NorthIcon`, "Reset north") button, gated
on a hardcoded `heading = 0` stub with a no-op `onPress`. Make it real:

1. **Visible** whenever the live map camera bearing is more than `bearingThreshold` (1°)
   off north — in compass-follow *or* after a manual rotate gesture while follow is `off`.
2. **On tap:**
   - `positionAndBearing` (compass follow) → demote to `position` (north-up follow); the
     follow viewport snaps bearing to north.
   - `off` (map manually rotated) → animate the camera bearing back to 0, staying `off`.

This mirrors Kotlin `MapViewModel.onNorthButtonClicked` (MapViewModel.kt:261-296) and the
visibility rule `abs(cameraBearing) > MapBehavior.bearingThreshold` (MapControlsColumn.kt:80).

## Global constraints

- Provider seam intact: only `providers/mapbox/` imports the SDK; store/UI provider-agnostic.
- Pure logic is TDD'd (Jest first); imperative camera + observation wiring is device-verified.
- Persist the minimum: `cameraHeading` and `northResetNonce` are session-only.

## Architecture & data flow

The button lives in `MapControls`; the `Camera` lives in `MapCanvas`. Rather than
prop-drill a camera ref through `MapScreen` into both (which would hand a map-camera handle
to the UI layer and regrow the ref the declarative refactor removed), the reset is
**mediated through the store**, keeping `MapControls` a dumb store-driven UI and the
imperative surface co-located with the `Camera`:

```
MapView.onCameraChanged({heading}) ─▶ store.setCameraHeading(h) ─▶ store.cameraHeading
                                                                        │
MapControls selects shouldShowNorthButton(cameraHeading, bearingThreshold)  (visibility)
        │ onPress
        ▼
store.northPressed()
   ├─ if positionAndBearing → followMode = position           (declarative; snaps north)
   └─ else                  → northResetNonce += 1            (transient signal)
                                        │
MapCanvas useEffect([northResetNonce]) ─▶ cameraRef.current.resetNorth(true)   (off case)
```

The off-case reset is imperative (`setCamera({heading:0, animated})`). The "imperative move
is a no-op while following" trap does **not** apply: this path only runs when follow is
`off`, so the camera obeys.

## Components & changes

### Provider port — `src/map/provider/types.ts` (re-adds, now with consumers)
- `MapViewProps.onCameraChanged?: (e: { heading: number }) => void` — heading only (narrow).
- `export interface CameraController { resetNorth(animated: boolean): void }`.
- `Camera` becomes `React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>`.

### Mapbox adapter — `src/map/providers/mapbox/adapter.tsx`
- `View`: map Mapbox's `onCameraChanged` (`MapState`) →
  `onCameraChanged?.({ heading: e?.properties?.heading ?? 0 })`.
- `Camera`: back to `forwardRef` + `useImperativeHandle` exposing
  `resetNorth: (animated) => inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 })`.
  Keep the existing `followUserMode` / `onUserTrackingModeChange` neutral-shape mapping.

### Store — `src/store/mapStore.ts`
- Pure, exported, unit-tested helpers:
  - `normalizeDeg(deg: number): number` → maps any angle to `(-180, 180]` (so 359° ⇒ −1°).
  - `shouldShowNorthButton(heading: number, threshold: number): boolean` →
    `Math.abs(normalizeDeg(heading)) > threshold`.
- Session-only state: `cameraHeading: number` (init 0), `northResetNonce: number` (init 0).
- Actions:
  - `setCameraHeading(h: number)` → `set({ cameraHeading: h })`.
  - Evolve existing `northPressed()`:
    ```ts
    northPressed: () => set((s) =>
      s.followMode === 'positionAndBearing'
        ? { followMode: demoteBearing(s.followMode) }
        : { northResetNonce: s.northResetNonce + 1 }
    )
    ```
- `partialize` unchanged (still only `mapStyleId`).

### Token — `src/theme/tokens.ts`
- Re-add `bearingThreshold: 1` (now consumed by `shouldShowNorthButton`).

### Map canvas — `src/map/MapCanvas.tsx`
- `const cameraRef = useRef<CameraController>(null)`; attach to `<Camera ref={cameraRef} …>`.
- `<MapView onCameraChanged={(e) => setCameraHeading(e.heading)} …>`.
- `const northResetNonce = useMapStore((s) => s.northResetNonce)`;
  `useEffect(() => { if (northResetNonce > 0) cameraRef.current?.resetNorth(true) }, [northResetNonce])`.

### Controls — `src/map/MapControls.tsx`
- Remove the `const heading = 0` stub and the `heading !== 0` gate.
- `const showNorth = useMapStore((s) => shouldShowNorthButton(s.cameraHeading, MapTokens.bearingThreshold))`.
- Render the North button when `showNorth`; `onPress` → `northPressed` (add the selector).

## Testing

- **Jest (pure, TDD first)** in `src/store/__tests__/mapStore.test.ts`:
  - `normalizeDeg`: 0→0, 90→90, 180→180, 181→−179, 359→−1, 360→0, −1→−1, 720→0.
  - `shouldShowNorthButton`: 0→false, 0.5→false (below 1°), 2→true, 358→true (wrap: 358°≈−2°), 359→false (1° = at threshold, not beyond), −2→true.
  - `northPressed`: from `positionAndBearing` → `followMode==='position'`, nonce unchanged;
    from `off` → nonce incremented, `followMode` unchanged; from `position` → nonce
    incremented (harmless), `followMode` unchanged.
  - `setCameraHeading` sets `cameraHeading`.
- **Device-verified:** rotate the map with a two-finger gesture while `off` → button
  appears → tap → animates back to north, button disappears; enter compass-follow
  (`positionAndBearing`) → button appears → tap → drops to north-up 2D `position` follow;
  facing exactly north shows no button.

## Non-goals

- No custom on-screen rotate control (rotation stays the native Mapbox gesture).
- No persistence of heading/nonce.
- No change to location-button follow cycling, pitch, or layer behaviour.
