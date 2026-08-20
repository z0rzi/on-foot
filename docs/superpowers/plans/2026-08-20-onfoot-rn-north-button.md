# North (reset-bearing) Button Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the scaffolded map North button so it appears when the map is rotated off north and, on tap, resets the camera bearing to north (demoting compass-follow, or one-shot rotating back to north when follow is off).

**Architecture:** Live camera heading is observed via a narrow `onCameraChanged` on the provider port and stored in Zustand; the button's visibility is a pure derived boolean. The tap goes through the store: compass-follow demotes declaratively, while the off-case reset is a store-mediated one-shot imperative `resetNorth()` on the Camera (co-located in `MapCanvas`, not drilled into the UI). The imperative "no-op while following" trap does not apply because the imperative path only runs when follow is off.

**Tech Stack:** TypeScript, Zustand 5, @rnmapbox/maps behind the provider seam, react-native-gesture-handler (unaffected), Jest.

## Global Constraints

- Provider seam inviolable: only `src/map/providers/mapbox/` imports the SDK; store/UI stay provider-agnostic behind `src/map/provider/`.
- Pure logic is TDD'd (Jest first); imperative camera + observation wiring is device-verified.
- Persist the minimum: `cameraHeading` and `northResetNonce` are session-only (`partialize` stays `{ mapStyleId }`).
- Spec: `docs/superpowers/specs/2026-08-20-onfoot-rn-north-button-design.md`.

## File Structure

- `src/store/mapStore.ts` — pure helpers `normalizeDeg`/`shouldShowNorthButton`; state `cameraHeading`/`northResetNonce`; actions `setCameraHeading`, evolved `northPressed`.
- `src/store/__tests__/mapStore.test.ts` — pure-helper + store-action tests.
- `src/map/provider/types.ts` — re-add narrow `onCameraChanged`; add `CameraController`; `Camera` back to a ref-exposing component.
- `src/map/providers/mapbox/adapter.tsx` — map heading events; expose `resetNorth` imperatively.
- `src/map/MapCanvas.tsx` — hold camera ref, feed heading to store, fire `resetNorth` on nonce.
- `src/map/MapControls.tsx` — derived-boolean visibility, wire `onPress`.
- `src/theme/tokens.ts` — re-add `bearingThreshold`.

---

### Task 1: Pure heading helpers

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Produces: `normalizeDeg(deg: number): number` (maps any angle to `(-180, 180]`), `shouldShowNorthButton(heading: number, threshold: number): boolean`.

- [ ] **Step 1: Write the failing tests** — add to `src/store/__tests__/mapStore.test.ts` (import `normalizeDeg, shouldShowNorthButton` in the existing top import from `../mapStore`):

```ts
describe('normalizeDeg', () => {
  test('passes through in-range angles', () => {
    expect(normalizeDeg(0)).toBe(0)
    expect(normalizeDeg(90)).toBe(90)
    expect(normalizeDeg(180)).toBe(180)
    expect(normalizeDeg(-1)).toBe(-1)
  })
  test('wraps out-of-range angles into (-180, 180]', () => {
    expect(normalizeDeg(181)).toBe(-179)
    expect(normalizeDeg(359)).toBe(-1)
    expect(normalizeDeg(360)).toBe(0)
    expect(normalizeDeg(720)).toBe(0)
  })
})

describe('shouldShowNorthButton', () => {
  test('hidden within the dead-zone (<= threshold)', () => {
    expect(shouldShowNorthButton(0, 1)).toBe(false)
    expect(shouldShowNorthButton(0.5, 1)).toBe(false)
    expect(shouldShowNorthButton(359, 1)).toBe(false) // 359° = 1° off = at threshold
  })
  test('shown when rotated beyond the threshold, including wrap-around', () => {
    expect(shouldShowNorthButton(2, 1)).toBe(true)
    expect(shouldShowNorthButton(-2, 1)).toBe(true)
    expect(shouldShowNorthButton(358, 1)).toBe(true) // 358° ≈ -2°
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest mapStore -t "normalizeDeg|shouldShowNorthButton"`
Expected: FAIL (`normalizeDeg`/`shouldShowNorthButton` are not exported).

- [ ] **Step 3: Implement the helpers** — add near the other pure helpers in `src/store/mapStore.ts` (e.g. after `clampPitch`):

```ts
// Normalize any angle (degrees) to the half-open range (-180, 180], so 359° reads as -1°.
export function normalizeDeg(deg: number): number {
  const m = ((deg % 360) + 360) % 360 // [0, 360)
  return m > 180 ? m - 360 : m
}

// The North button shows when the map camera is rotated more than `threshold` degrees off
// north (either direction). Pure so it can drive a re-render-cheap derived selector.
export function shouldShowNorthButton(heading: number, threshold: number): boolean {
  return Math.abs(normalizeDeg(heading)) > threshold
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest mapStore -t "normalizeDeg|shouldShowNorthButton"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat: add normalizeDeg and shouldShowNorthButton helpers"
```

---

### Task 2: Store heading state + evolved northPressed

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Consumes: `demoteBearing` (already in `mapStore.ts`).
- Produces: store state `cameraHeading: number`, `northResetNonce: number`; actions `setCameraHeading(h: number): void` and evolved `northPressed(): void` (demotes compass-follow, else bumps `northResetNonce`).

- [ ] **Step 1: Update the `store actions` `beforeEach`** in `src/store/__tests__/mapStore.test.ts` to seed the new fields:

```ts
    useMapStore.setState({
      followMode: 'off',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selectedTrailId: null,
      cameraPitch: 0,
      pitchAnimated: false,
      cameraHeading: 0,
      northResetNonce: 0,
    })
```

- [ ] **Step 2: Write the failing tests** — add inside the `describe('store actions', …)` block (the existing `northPressed demotes bearing follow` test stays and still passes):

```ts
  test('setCameraHeading updates cameraHeading', () => {
    useMapStore.getState().setCameraHeading(42)
    expect(useMapStore.getState().cameraHeading).toBe(42)
  })
  test('northPressed from compass follow demotes to position without bumping the nonce', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('position')
    expect(useMapStore.getState().northResetNonce).toBe(0)
  })
  test('northPressed while off bumps the reset nonce without changing follow', () => {
    useMapStore.setState({ followMode: 'off', northResetNonce: 0 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().northResetNonce).toBe(1)
  })
  test('northPressed while position bumps the reset nonce (harmless)', () => {
    useMapStore.setState({ followMode: 'position', northResetNonce: 5 })
    useMapStore.getState().northPressed()
    expect(useMapStore.getState().northResetNonce).toBe(6)
  })
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest mapStore -t "setCameraHeading|northPressed"`
Expected: FAIL (`setCameraHeading` undefined; `northResetNonce` undefined; evolved `northPressed` not yet implemented).

- [ ] **Step 4: Implement the state + actions** in `src/store/mapStore.ts`:

Add to the `MapStore` interface (near `cameraPitch`):
```ts
  cameraHeading: number
  northResetNonce: number
```
Add to the interface's action list (near `northPressed`):
```ts
  setCameraHeading: (h: number) => void
```
Add to the initial state (near `cameraPitch: 0`):
```ts
      cameraHeading: 0,
      northResetNonce: 0,
```
Replace the existing `northPressed` action and add `setCameraHeading`:
```ts
      // Compass-follow → demote to north-up Position (follow viewport snaps bearing to north).
      // Otherwise (off / manually-rotated) → signal MapCanvas to one-shot rotate the camera north.
      northPressed: () =>
        set((s) =>
          s.followMode === 'positionAndBearing'
            ? { followMode: demoteBearing(s.followMode) }
            : { northResetNonce: s.northResetNonce + 1 },
        ),
      setCameraHeading: (h) => set({ cameraHeading: h }),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx jest mapStore`
Expected: PASS (all store tests, including the pre-existing ones).

- [ ] **Step 6: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat: store camera heading and evolve northPressed for reset-north"
```

---

### Task 3: Provider port + Mapbox adapter (heading events + resetNorth)

**Files:**
- Modify: `src/map/provider/types.ts`
- Modify: `src/map/providers/mapbox/adapter.tsx`

**Interfaces:**
- Produces: `MapViewProps.onCameraChanged?: (e: { heading: number }) => void`; `interface CameraController { resetNorth(animated: boolean): void }`; `Camera` is a `ForwardRefExoticComponent<CameraProps & RefAttributes<CameraController>>` whose ref exposes `resetNorth`.

- [ ] **Step 1: Update the port types** in `src/map/provider/types.ts`.

Add `onCameraChanged` back to `MapViewProps`:
```ts
export interface MapViewProps {
  styleURL: string
  onCameraChanged?: (e: { heading: number }) => void
  children?: React.ReactNode
  style?: any
}
```
Add the controller interface (near `MapComponents`):
```ts
export interface CameraController {
  resetNorth(animated: boolean): void
}
```
Change the `Camera` field of `MapComponents`:
```ts
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
```

- [ ] **Step 2: Update the Mapbox adapter** in `src/map/providers/mapbox/adapter.tsx`.

Update the imports:
```ts
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
import Mapbox, { type MapState } from '@rnmapbox/maps'
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController,
} from '../../provider/types'
```
Add the heading mapping to `View` (add the `onCameraChanged` prop; keep the existing props):
```tsx
const View = ({ styleURL, onCameraChanged, style, children }: MapViewProps) => (
  <Mapbox.MapView
    style={style}
    styleURL={styleURL}
    scaleBarEnabled={false}
    logoEnabled={false}
    attributionEnabled={false}
    compassEnabled={false}
    onCameraChanged={(e: MapState) => onCameraChanged?.({ heading: e?.properties?.heading ?? 0 })}
  >
    {children}
  </Mapbox.MapView>
)
```
Replace the `Camera` component with a ref-exposing one:
```tsx
// The camera is driven declaratively (follow props / pitch). The one imperative affordance is
// resetNorth — a one-shot rotate to bearing 0, only ever called when follow is off (so the
// rnmapbox "imperative move is a no-op while following" trap does not apply).
const Camera = forwardRef<CameraController, CameraProps>(
  ({ followUserMode, onUserTrackingModeChange, ...rest }, ref) => {
    const inner = useRef<Mapbox.Camera>(null)
    useImperativeHandle(ref, () => ({
      resetNorth: (animated: boolean) =>
        inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 }),
    }))
    return (
      <Mapbox.Camera
        ref={inner}
        {...rest}
        followUserMode={followUserMode as unknown as Mapbox.UserTrackingMode | undefined}
        onUserTrackingModeChange={
          onUserTrackingModeChange
            ? (e) => onUserTrackingModeChange(!!e?.nativeEvent?.payload?.followUserLocation)
            : undefined
        }
      />
    )
  },
)
```

- [ ] **Step 3: Verify the types compile**

Run: `npx tsc --noEmit`
Expected: clean (no errors). `mapboxProvider.components.Camera` now satisfies the ref-exposing `MapComponents.Camera` type.

- [ ] **Step 4: Commit**

```bash
git add src/map/provider/types.ts src/map/providers/mapbox/adapter.tsx
git commit -m "feat: port narrow onCameraChanged heading event and Camera resetNorth"
```

---

### Task 4: MapCanvas — observe heading, fire resetNorth

**Files:**
- Modify: `src/map/MapCanvas.tsx`

**Interfaces:**
- Consumes: `useMapStore` `setCameraHeading`/`northResetNonce` (Task 2); `CameraController` + `onCameraChanged` (Task 3).

- [ ] **Step 1: Add the imports** at the top of `src/map/MapCanvas.tsx`:

```ts
import React, { useEffect, useRef } from 'react'
import type { CameraController } from './provider/types'
```
(Merge with the existing `react` import — the file currently does `import React from 'react'`.)

- [ ] **Step 2: Wire the ref, heading observation, and reset effect.** Inside `MapCanvas`, add the selectors + ref + effect alongside the existing store selectors:

```tsx
  const setCameraHeading = useMapStore((s) => s.setCameraHeading)
  const northResetNonce = useMapStore((s) => s.northResetNonce)
  const cameraRef = useRef<CameraController>(null)

  // The North button (in MapControls) signals an off-mode reset by bumping northResetNonce;
  // fire the one-shot imperative rotate-to-north here, where the Camera ref lives.
  useEffect(() => {
    if (northResetNonce > 0) cameraRef.current?.resetNorth(true)
  }, [northResetNonce])
```
Update the `MapView` opening tag to feed heading into the store:
```tsx
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={style.url}
      onCameraChanged={(e) => setCameraHeading(e.heading)}
    >
```
Attach the ref to `Camera` (keep the existing spread props and `onUserTrackingModeChange`):
```tsx
      <Camera
        ref={cameraRef}
        {...follow}
        {...manualPitch}
        onUserTrackingModeChange={(following) => {
          if (!following) disableFollow()
        }}
      />
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/map/MapCanvas.tsx
git commit -m "feat: observe camera heading and fire reset-north in MapCanvas"
```

---

### Task 5: MapControls — visibility + tap wiring, and the bearingThreshold token

**Files:**
- Modify: `src/theme/tokens.ts`
- Modify: `src/map/MapControls.tsx`

**Interfaces:**
- Consumes: `shouldShowNorthButton` (Task 1), `cameraHeading`/`northPressed` (Task 2), `MapTokens.bearingThreshold`.

- [ ] **Step 1: Re-add the token** in `src/theme/tokens.ts` (insert in the `MapTokens` object, e.g. after `overlayPadding: 16,`):

```ts
  bearingThreshold: 1,
```

- [ ] **Step 2: Update the store import** in `src/map/MapControls.tsx` to include the helper:

```ts
import { useMapStore, nextPitchOnToggle, clampPitch, shouldShowNorthButton } from '../store/mapStore'
```

- [ ] **Step 3: Replace the heading stub with real state + action.** Remove these lines:

```tsx
  // Heading tracking is Phase 2 — the tracked heading is hardcoded to 0 for now,
  // so the North button stays hidden until Phase 2 wires up real bearing.
  const heading = 0
```
and add, with the other selectors near the top of `MapControls`:
```tsx
  const northPressed = useMapStore((s) => s.northPressed)
  // Derived boolean selector: re-renders only when visibility flips, though heading streams in.
  const showNorth = useMapStore((s) => shouldShowNorthButton(s.cameraHeading, MapTokens.bearingThreshold))
```

- [ ] **Step 4: Wire the button.** Replace the North `ControlButton` block:

```tsx
      {heading !== 0 && (
        <ControlButton accessibilityLabel="Reset north" onPress={() => {}}>
          <NorthIcon size={MapTokens.controlIconSize} color={c.controlContent} />
        </ControlButton>
      )}
```
with:
```tsx
      {showNorth && (
        <ControlButton accessibilityLabel="Reset north" onPress={northPressed}>
          <NorthIcon size={MapTokens.controlIconSize} color={c.controlContent} />
        </ControlButton>
      )}
```

- [ ] **Step 5: Verify types + full suite**

Run: `npx tsc --noEmit && npx jest`
Expected: `tsc` clean; all Jest suites pass.

- [ ] **Step 6: Commit**

```bash
git add src/theme/tokens.ts src/map/MapControls.tsx
git commit -m "feat: show and wire the North reset-bearing button"
```

---

### Task 6: Device verification

**Files:** none (manual verification on device `SWWC4HEIYHZPQWZX`; Metro already running with `adb reverse`).

- [ ] **Step 1: Reload the app** (Fast Refresh, or shake → Reload) with On Foot foregrounded.
- [ ] **Step 2: Off-mode rotation** — with follow off, two-finger-rotate the map. Expected: North button appears once past ~1°.
- [ ] **Step 3: Off-mode reset** — tap the North button. Expected: camera animates back to north; button disappears.
- [ ] **Step 4: Compass follow** — tap the location button until compass-follow (`positionAndBearing`, arrow icon); turn the device. Expected: North button appears.
- [ ] **Step 5: Compass reset** — tap North. Expected: drops to north-up 2D `position` follow (button hides; 2D label).
- [ ] **Step 6: No false positive** — when facing/aligned north, the button is hidden.

---

## Self-Review

**Spec coverage:**
- Visibility rule (`abs > bearingThreshold`, incl. off-rotation) → Tasks 1 (`shouldShowNorthButton`), 4 (heading feed), 5 (selector + token). ✓
- Tap: compass demote → Task 2 (`northPressed`); off one-shot rotate → Tasks 2 (nonce), 3 (`resetNorth`), 4 (effect). ✓
- Narrow port re-adds with consumers → Task 3. ✓
- Session-only state, `partialize` unchanged → Task 2. ✓
- Testing split (pure TDD vs device) → Tasks 1–2 (Jest), Task 6 (device). ✓

**Placeholder scan:** none — every code step has concrete content.

**Type consistency:** `normalizeDeg`/`shouldShowNorthButton` (Task 1) used verbatim in Task 5; `cameraHeading`/`northResetNonce`/`setCameraHeading`/`northPressed` (Task 2) match usages in Tasks 4–5; `CameraController.resetNorth(animated)` (Task 3) matches Task 4's `cameraRef.current?.resetNorth(true)`; `onCameraChanged: (e: { heading }) ` (Task 3) matches Task 4's `(e) => setCameraHeading(e.heading)`. ✓
