# Trail show-on-map & camera-fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a saved trail draws it on the map (line + directional arrows + start/end dots), fits the camera to it, and shows a slim info card with a close button that clears the selection.

**Architecture:** Rendering and camera-fit are rnmapbox-specific, exposed as SDK-neutral additions to the map-provider port (`TrailOverlay` component + `CameraController.fitBounds`) and implemented only in the mapbox adapter. Selection is session-only state in `mapStore`; a loader hook resolves the full `Trail` from `trailsRepository`. `MapScreen` loads once and passes the trail to both `MapCanvas` (geometry) and `TrailInfoCard` (summary). Pure geometry helpers are TDD'd; rendering is device-verified.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript, expo-router, `@rnmapbox/maps`, Zustand 5, Jest.

## Global Constraints

- **Map-provider seam is inviolable.** Only `src/map/providers/mapbox/` may import `@rnmapbox/maps`. Shared store/UI talk to the port (`src/map/provider/types.ts`). New provider concepts are declared on the port as neutral shapes, never leaked as SDK types into shared code. Verify: `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/"` → empty.
- **Persistence seam is inviolable.** Only `src/data/db/*` may import `expo-sqlite`/`drizzle-orm`. Consumers import `trailsRepository` from the `src/data/trails` barrel and domain types from `src/data/trails/types`. Verify: `grep -rn "drizzle-orm\|expo-sqlite" src app | grep -v "src/data/db/"` → empty.
- **Persist the minimum.** `selectedTrailId` is session-only; it must not appear in `mapStore`'s `partialize`.
- **Comments (AGENTS.md):** no change-narrating comments; code self-documenting; comment only non-obvious *why*.
- **Pure logic is TDD'd** (`src/**/__tests__/`, test written first); native rendering/gestures/camera are device-verified, not unit-tested.
- **Token values (verbatim, from Kotlin `MapLayer`):** `trailLineWidth = 4`, `arrowSpacing = 100`, `arrowSize = 0.8`, `endpointRadius = 8`, `endpointStrokeWidth = 2.5`, camera padding `top = 100`, `sides = 100`, `bottom = 300`, `trailFitDurationMs = 1000`. Trail line color = existing theme token `trailLine` (`#9C27B0`); endpoint stroke = white.
- **Gates:** `npx tsc --noEmit` clean; `npx jest` all pass; the two seam greps empty. Because Task 4 adds a new asset import (Metro transform), the final verification must include a real bundle: `npx expo export --platform android`.

## File Structure

- Create `src/map/geo.ts` — pure geometry helpers (`boundsForPoints`, `toLineCoordinates`, `endpointCoordinates`).
- Create `src/map/__tests__/geo.test.ts` — Jest specs for the helpers.
- Modify `src/store/mapStore.ts` — replace `setSelectedTrailId` with `selectTrail` / `clearSelectedTrail`.
- Modify `src/store/__tests__/mapStore.test.ts` — specs for the new actions.
- Modify `src/map/provider/types.ts` — `TrailOverlayProps`, `MapComponents.TrailOverlay`, `CameraController.fitBounds`.
- Modify `src/theme/tokens.ts` — new `MapTokens`.
- Create `src/assets/trail-arrow.png` — white directional-arrow icon.
- Modify `src/map/providers/mapbox/adapter.tsx` — implement `TrailOverlay`; add `fitBounds` to the Camera controller.
- Create `src/map/useSelectedTrail.ts` — impure loader hook (stale-guarded).
- Modify `src/map/MapCanvas.tsx` — accept `trail` prop; render `TrailOverlay`; fire `fitBounds`.
- Create `src/trails/TrailInfoCard.tsx` — slim presentational info card.
- Modify `src/map/MapScreen.tsx` — load the trail once; pass to `MapCanvas`; render `TrailInfoCard`.
- Modify `src/trails/TrailListItem.tsx` — whole-card `onSelect`, delete stays separate.
- Modify `app/(tabs)/trails.tsx` — `onSelect` → `selectTrail` + navigate to Map tab.

---

### Task 1: Pure geometry helpers

**Files:**
- Create: `src/map/geo.ts`
- Test: `src/map/__tests__/geo.test.ts`

**Interfaces:**
- Consumes: `GpxPoint` from `src/data/trails/types` (`{ lat: number; lng: number; ele: number | null }`).
- Produces:
  - `boundsForPoints(points: GpxPoint[]): { ne: [number, number]; sw: [number, number] } | null` — `ne = [maxLng, maxLat]`, `sw = [minLng, minLat]`; `null` for empty input.
  - `toLineCoordinates(points: GpxPoint[]): [number, number][]` — `[lng, lat]` pairs in order.
  - `endpointCoordinates(points: GpxPoint[]): [number, number][]` — `[first, last]` as `[lng, lat]`; `[]` for empty input.

- [ ] **Step 1: Write the failing test**

Create `src/map/__tests__/geo.test.ts`:

```ts
import { boundsForPoints, toLineCoordinates, endpointCoordinates } from '../geo'
import { GpxPoint } from '../../data/trails/types'

const p = (lat: number, lng: number): GpxPoint => ({ lat, lng, ele: null })

describe('toLineCoordinates', () => {
  test('maps points to [lng, lat] pairs in order', () => {
    expect(toLineCoordinates([p(1, 2), p(3, 4)])).toEqual([
      [2, 1],
      [4, 3],
    ])
  })
  test('empty input -> empty array', () => {
    expect(toLineCoordinates([])).toEqual([])
  })
})

describe('endpointCoordinates', () => {
  test('returns first and last as [lng, lat]', () => {
    expect(endpointCoordinates([p(1, 2), p(3, 4), p(5, 6)])).toEqual([
      [2, 1],
      [6, 5],
    ])
  })
  test('single point -> start equals end', () => {
    expect(endpointCoordinates([p(1, 2)])).toEqual([
      [2, 1],
      [2, 1],
    ])
  })
  test('empty input -> empty array', () => {
    expect(endpointCoordinates([])).toEqual([])
  })
})

describe('boundsForPoints', () => {
  test('computes ne (max) and sw (min) across points', () => {
    expect(boundsForPoints([p(1, 2), p(5, -3), p(3, 4)])).toEqual({
      ne: [4, 5],
      sw: [-3, 1],
    })
  })
  test('single point -> ne equals sw', () => {
    expect(boundsForPoints([p(1, 2)])).toEqual({ ne: [2, 1], sw: [2, 1] })
  })
  test('empty input -> null', () => {
    expect(boundsForPoints([])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/map/__tests__/geo.test.ts`
Expected: FAIL — cannot find module `../geo`.

- [ ] **Step 3: Write minimal implementation**

Create `src/map/geo.ts`:

```ts
import { GpxPoint } from '../data/trails/types'

export function toLineCoordinates(points: GpxPoint[]): [number, number][] {
  return points.map((point) => [point.lng, point.lat])
}

export function endpointCoordinates(points: GpxPoint[]): [number, number][] {
  if (points.length === 0) return []
  const first = points[0]
  const last = points[points.length - 1]
  return [
    [first.lng, first.lat],
    [last.lng, last.lat],
  ]
}

export function boundsForPoints(
  points: GpxPoint[],
): { ne: [number, number]; sw: [number, number] } | null {
  if (points.length === 0) return null
  let minLng = points[0].lng
  let maxLng = points[0].lng
  let minLat = points[0].lat
  let maxLat = points[0].lat
  for (const point of points) {
    if (point.lng < minLng) minLng = point.lng
    if (point.lng > maxLng) maxLng = point.lng
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/map/__tests__/geo.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/map/geo.ts src/map/__tests__/geo.test.ts
git commit -m "feat: pure geometry helpers for trail bounds & coordinates"
```

---

### Task 2: Store selection actions

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts`

**Interfaces:**
- Consumes: existing `MapStore` (has `selectedTrailId: number | null`, `followMode: FollowMode`).
- Produces (replacing `setSelectedTrailId`):
  - `selectTrail(id: number): void` — sets `{ selectedTrailId: id, followMode: 'off' }`.
  - `clearSelectedTrail(): void` — sets `{ selectedTrailId: null }`.

- [ ] **Step 1: Write the failing test**

In `src/store/__tests__/mapStore.test.ts`, add inside the `describe('store actions', …)` block (after the `setCameraHeading` test, before the `northPressed from compass follow …` test):

```ts
  test('selectTrail selects the trail and turns follow off', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selectedTrailId: null })
    useMapStore.getState().selectTrail(7)
    expect(useMapStore.getState().selectedTrailId).toBe(7)
    expect(useMapStore.getState().followMode).toBe('off')
  })
  test('clearSelectedTrail clears the selection and leaves follow untouched', () => {
    useMapStore.setState({ selectedTrailId: 7, followMode: 'position' })
    useMapStore.getState().clearSelectedTrail()
    expect(useMapStore.getState().selectedTrailId).toBeNull()
    expect(useMapStore.getState().followMode).toBe('position')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: FAIL — `selectTrail` / `clearSelectedTrail` are not functions.

- [ ] **Step 3: Write minimal implementation**

In `src/store/mapStore.ts`:

In the `MapStore` interface, replace the line:

```ts
  setSelectedTrailId: (id: number | null) => void
```

with:

```ts
  selectTrail: (id: number) => void
  clearSelectedTrail: () => void
```

In the store creator, replace the line:

```ts
      setSelectedTrailId: (id) => set({ selectedTrailId: id }),
```

with:

```ts
      selectTrail: (id) => set({ selectedTrailId: id, followMode: 'off' }),
      clearSelectedTrail: () => set({ selectedTrailId: null }),
```

Update the `selectedTrailId` field comment to describe its role (the currently-shown trail; session-only, drives the overlay + info card).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: PASS (new + existing).

- [ ] **Step 5: Verify no stale references**

Run: `grep -rn "setSelectedTrailId" src app`
Expected: no output (the only definition and reference are gone).

- [ ] **Step 6: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat: selectTrail/clearSelectedTrail map-store actions"
```

---

### Task 3: Port additions + map tokens

**Files:**
- Modify: `src/map/provider/types.ts`
- Modify: `src/theme/tokens.ts`

**Interfaces:**
- Produces:
  - `TrailOverlayProps` (neutral) and `MapComponents.TrailOverlay: React.ComponentType<TrailOverlayProps>`.
  - `CameraController.fitBounds(ne, sw, padding, duration)`.
  - `MapTokens` extended with the token values from Global Constraints.

- [ ] **Step 1: Extend the port types**

In `src/map/provider/types.ts`:

Add, after the `CameraProps` interface:

```ts
export interface TrailOverlayProps {
  // Trail polyline as [lng, lat] pairs, in trail order.
  line: [number, number][]
  // [start, end] as [lng, lat]; drawn as dot markers.
  endpoints: [number, number][]
  color: string
  lineWidth: number
  // require()'d PNG handle for the directional arrow icon (RN-neutral).
  arrowImage: number
  arrowSpacing: number
  arrowSize: number
  endpointRadius: number
  endpointStrokeColor: string
  endpointStrokeWidth: number
}
```

Add `fitBounds` to `CameraController`:

```ts
export interface CameraController {
  resetNorth(animated: boolean): void
  // One-shot fit to a geographic box (used to frame a selected trail). padding is
  // [top, right, bottom, left] in points; duration in ms. Like resetNorth, only meaningful
  // when follow is off (an imperative camera move is a no-op while rnmapbox is following).
  fitBounds(
    ne: [number, number],
    sw: [number, number],
    padding: [number, number, number, number],
    duration: number,
  ): void
}
```

Add `TrailOverlay` to `MapComponents`:

```ts
export interface MapComponents {
  View: React.ComponentType<MapViewProps>
  Camera: React.ForwardRefExoticComponent<CameraProps & React.RefAttributes<CameraController>>
  Terrain: React.ComponentType<TerrainProps>
  UserPuck: React.ComponentType<{}>
  TrailOverlay: React.ComponentType<TrailOverlayProps>
}
```

- [ ] **Step 2: Extend the map tokens**

In `src/theme/tokens.ts`, add these keys to the `MapTokens` object (before the closing `} as const`):

```ts
  trailLineWidth: 4,
  arrowSpacing: 100,
  arrowSize: 0.8,
  endpointRadius: 8,
  endpointStrokeWidth: 2.5,
  cameraPadding: { top: 100, sides: 100, bottom: 300 },
  trailFitDurationMs: 1000,
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: FAIL only in `src/map/providers/mapbox/adapter.tsx` (its `MapComponents` object is now missing `TrailOverlay`, and its `CameraController` is missing `fitBounds`). No other errors. This confirms the port change is picked up; Task 4 resolves the adapter.

- [ ] **Step 4: Commit**

```bash
git add src/map/provider/types.ts src/theme/tokens.ts
git commit -m "feat: port TrailOverlay + Camera.fitBounds; trail/camera map tokens"
```

---

### Task 4: Arrow asset + mapbox adapter (TrailOverlay + fitBounds)

**Files:**
- Create: `src/assets/trail-arrow.png`
- Modify: `src/map/providers/mapbox/adapter.tsx`

**Interfaces:**
- Consumes: `TrailOverlayProps`, `CameraController` (with `fitBounds`) from `../../provider/types`.
- Produces: a `mapboxProvider.components.TrailOverlay` implementation and a `Camera` controller exposing `fitBounds`.

**Note (device-verified):** this task renders native map layers and has no unit test; it is verified on-device in the final verification. It DOES introduce a new asset import, so it must be exercised by a real bundle.

- [ ] **Step 1: Generate the arrow asset**

Run (draws a white right-pointing triangle on transparent 48×48; base orientation points east so line-placement rotates it along the path):

```bash
magick -size 48x48 xc:none -fill white -draw "polygon 12,10 12,38 40,24" src/assets/trail-arrow.png
```

Verify it exists and is a PNG:

```bash
file src/assets/trail-arrow.png
```

Expected: `PNG image data, 48 x 48`.

- [ ] **Step 2: Implement `TrailOverlay` and `fitBounds` in the adapter**

In `src/map/providers/mapbox/adapter.tsx`:

Extend the imported types:

```ts
import type {
  MapProvider, MapViewProps, CameraProps, TerrainProps, CameraController, TrailOverlayProps,
} from '../../provider/types'
```

Add `fitBounds` to the Camera's `useImperativeHandle` (alongside `resetNorth`):

```ts
    useImperativeHandle(ref, () => ({
      resetNorth: (animated: boolean) =>
        inner.current?.setCamera({ heading: 0, animationDuration: animated ? 300 : 0 }),
      fitBounds: (ne, sw, padding, duration) =>
        inner.current?.fitBounds(ne, sw, padding, duration),
    }))
```

Add the `TrailOverlay` component (after `UserPuck`, before `mapboxProvider`):

```tsx
const TrailOverlay = ({
  line, endpoints, color, lineWidth, arrowImage, arrowSpacing, arrowSize,
  endpointRadius, endpointStrokeColor, endpointStrokeWidth,
}: TrailOverlayProps) => {
  const lineShape = {
    type: 'Feature' as const,
    geometry: { type: 'LineString' as const, coordinates: line },
    properties: {},
  }
  const endpointShape = {
    type: 'FeatureCollection' as const,
    features: endpoints.map((coord) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: coord },
      properties: {},
    })),
  }
  return (
    <>
      <Mapbox.Images images={{ 'trail-arrow': arrowImage }} />
      <Mapbox.ShapeSource id="trail-line-source" shape={lineShape}>
        <Mapbox.LineLayer
          id="trail-line"
          style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
        />
        <Mapbox.SymbolLayer
          id="trail-arrows"
          style={{
            symbolPlacement: 'line',
            symbolSpacing: arrowSpacing,
            iconImage: 'trail-arrow',
            iconSize: arrowSize,
            iconAllowOverlap: true,
            iconRotationAlignment: 'map',
          }}
        />
      </Mapbox.ShapeSource>
      <Mapbox.ShapeSource id="trail-endpoints-source" shape={endpointShape}>
        <Mapbox.CircleLayer
          id="trail-endpoints"
          style={{
            circleColor: color,
            circleRadius: endpointRadius,
            circleStrokeColor: endpointStrokeColor,
            circleStrokeWidth: endpointStrokeWidth,
          }}
        />
      </Mapbox.ShapeSource>
    </>
  )
}
```

Add `TrailOverlay` to the exported components:

```ts
  components: { View, Camera, Terrain, UserPuck, TrailOverlay },
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (adapter now satisfies the port; no errors).

- [ ] **Step 4: Commit**

```bash
git add src/assets/trail-arrow.png src/map/providers/mapbox/adapter.tsx
git commit -m "feat: mapbox TrailOverlay (line/arrows/endpoints) + Camera.fitBounds"
```

---

### Task 5: Selected-trail loader hook

**Files:**
- Create: `src/map/useSelectedTrail.ts`

**Interfaces:**
- Consumes: `useMapStore` (`selectedTrailId`), `trailsRepository` from `src/data/trails`, `Trail` from `src/data/trails/types`.
- Produces: `useSelectedTrail(): Trail | null`.

**Note (device-verified):** impure I/O hook; no unit test. The stale-guard is verified on-device by selecting trails in quick succession.

- [ ] **Step 1: Implement the hook**

Create `src/map/useSelectedTrail.ts`:

```ts
import { useEffect, useState } from 'react'
import { Trail, trailsRepository } from '../data/trails'
import { useMapStore } from '../store/mapStore'

export function useSelectedTrail(): Trail | null {
  const selectedTrailId = useMapStore((s) => s.selectedTrailId)
  const [trail, setTrail] = useState<Trail | null>(null)

  useEffect(() => {
    if (selectedTrailId == null) {
      setTrail(null)
      return
    }
    let active = true
    trailsRepository.getTrail(selectedTrailId).then((loaded) => {
      if (active) setTrail(loaded)
    })
    return () => {
      active = false
    }
  }, [selectedTrailId])

  return trail
}
```

- [ ] **Step 2: Verify types + seam**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `grep -rn "drizzle-orm\|expo-sqlite" src app | grep -v "src/data/db/"`
Expected: empty (the hook imports the barrel + types, not the engine).

- [ ] **Step 3: Commit**

```bash
git add src/map/useSelectedTrail.ts
git commit -m "feat: useSelectedTrail loader hook with stale-guard"
```

---

### Task 6: MapCanvas renders the overlay and fits the camera

**Files:**
- Modify: `src/map/MapCanvas.tsx`

**Interfaces:**
- Consumes: `useSelectedTrail`'s `Trail` (passed as a prop by `MapScreen` in Task 8), `boundsForPoints`/`toLineCoordinates`/`endpointCoordinates` (Task 1), `MapTokens` (Task 3), `TrailOverlay` from `components` (Task 4), theme `trailLine` color.
- Produces: `MapCanvas({ trail }: { trail: Trail | null })` — renders the overlay and fires the one-shot fit.

**Note (device-verified):** rendering + camera behavior; no unit test.

- [ ] **Step 1: Update MapCanvas**

Rewrite `src/map/MapCanvas.tsx` to accept the `trail` prop, render `TrailOverlay`, and fire `fitBounds` on selection. Full file:

```tsx
import React, { useEffect, useRef } from 'react'
import { StyleSheet } from 'react-native'
import { useMapProvider, useMapCapabilities } from './provider'
import type { CameraController } from './provider/types'
import { useMapStore, followCameraProps } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'
import { useTheme } from '../theme/useTheme'
import { Trail } from '../data/trails'
import { boundsForPoints, toLineCoordinates, endpointCoordinates } from './geo'
import trailArrow from '../assets/trail-arrow.png'

export function MapCanvas({ trail }: { trail: Trail | null }) {
  const { components } = useMapProvider()
  const caps = useMapCapabilities()
  const c = useTheme()
  const styleId = useMapStore((s) => s.mapStyleId)
  const style = caps.styles.find((s) => s.id === styleId) ?? caps.styles[0]
  const { View: MapView, Camera, Terrain, UserPuck, TrailOverlay } = components

  const followMode = useMapStore((s) => s.followMode)
  const cameraPitch = useMapStore((s) => s.cameraPitch)
  const pitchAnimated = useMapStore((s) => s.pitchAnimated)
  const disableFollow = useMapStore((s) => s.disableFollow)
  const setCameraHeading = useMapStore((s) => s.setCameraHeading)
  const northResetNonce = useMapStore((s) => s.northResetNonce)
  const cameraRef = useRef<CameraController>(null)

  useEffect(() => {
    if (northResetNonce > 0) cameraRef.current?.resetNorth(true)
  }, [northResetNonce])

  const points = trail?.geometry.points ?? []
  const hasTrail = points.length >= 2

  // Frame the selected trail once when it loads (follow is already off — selectTrail set it).
  useEffect(() => {
    if (!hasTrail) return
    const bounds = boundsForPoints(points)
    if (!bounds) return
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [trail])

  const follow = followCameraProps(followMode)
  const manualPitch =
    followMode === 'off'
      ? { pitch: cameraPitch, animationDuration: pitchAnimated ? 300 : 0 }
      : {}

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      styleURL={style.url}
      onCameraChanged={(e) => setCameraHeading(e.heading)}
    >
      <Camera
        ref={cameraRef}
        {...follow}
        {...manualPitch}
        onUserTrackingModeChange={(following) => {
          if (!following) disableFollow()
        }}
      />
      {caps.supportsTerrain && <Terrain exaggeration={MapTokens.terrainExaggeration} />}
      <UserPuck />
      {hasTrail && (
        <TrailOverlay
          line={toLineCoordinates(points)}
          endpoints={endpointCoordinates(points)}
          color={c.trailLine}
          lineWidth={MapTokens.trailLineWidth}
          arrowImage={trailArrow}
          arrowSpacing={MapTokens.arrowSpacing}
          arrowSize={MapTokens.arrowSize}
          endpointRadius={MapTokens.endpointRadius}
          endpointStrokeColor="#FFFFFF"
          endpointStrokeWidth={MapTokens.endpointStrokeWidth}
        />
      )}
    </MapView>
  )
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: FAIL only in `src/map/MapScreen.tsx` (it still renders `<MapCanvas />` without the now-required `trail` prop). Task 8 resolves this. No other errors.

- [ ] **Step 3: Commit**

```bash
git add src/map/MapCanvas.tsx
git commit -m "feat: MapCanvas renders trail overlay and fits camera on selection"
```

---

### Task 7: TrailInfoCard

**Files:**
- Create: `src/trails/TrailInfoCard.tsx`

**Interfaces:**
- Consumes: `Trail` from `src/data/trails/types`, `DifficultyBadge`, `formatDistance`/`formatElevation`, theme tokens.
- Produces: `TrailInfoCard({ trail, onClose }: { trail: Trail; onClose: () => void })` — absolutely-positioned bottom card.

**Note (device-verified):** presentational RN component; no unit test.

- [ ] **Step 1: Implement the card**

Create `src/trails/TrailInfoCard.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Trail } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'

export function TrailInfoCard({ trail, onClose }: { trail: Trail; onClose: () => void }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.container, { bottom: insets.bottom + 16 }]} pointerEvents="box-none">
      <View style={[styles.card, { backgroundColor: c.panelBackground }]}>
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{trail.name}</Text>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.metrics, { color: c.onSurfaceVariant }]}>
            {formatDistance(trail.metrics.distanceMeters)} • {formatElevation(trail.metrics.elevationGainMeters)} gain
          </Text>
        </View>
        <Pressable accessibilityLabel="Close trail info" onPress={onClose} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={22} color={c.panelContent} />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 0, right: 0 },
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16, elevation: 8 },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  metrics: { fontSize: 13 },
  close: { padding: 8 },
})
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: same single pre-existing error in `MapScreen.tsx` from Task 6; no new errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/trails/TrailInfoCard.tsx
git commit -m "feat: slim on-map TrailInfoCard with close affordance"
```

---

### Task 8: MapScreen wiring

**Files:**
- Modify: `src/map/MapScreen.tsx`

**Interfaces:**
- Consumes: `useSelectedTrail` (Task 5), `MapCanvas` (Task 6, now requires `trail`), `TrailInfoCard` (Task 7), `useMapStore.clearSelectedTrail` (Task 2).
- Produces: the composed screen — one load, passed to both consumers.

- [ ] **Step 1: Wire MapScreen**

Rewrite `src/map/MapScreen.tsx`:

```tsx
import { useRef } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { LayersSheet } from './LayersSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore } from '../store/mapStore'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const trail = useSelectedTrail()
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas trail={trail} />
          <MapControls onOpenLayers={() => sheetRef.current?.present()} />
          {trail && <TrailInfoCard trail={trail} onClose={clearSelectedTrail} />}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
```

- [ ] **Step 2: Verify types + tests**

Run: `npx tsc --noEmit`
Expected: PASS (the `MapCanvas` prop error from Task 6 is now resolved; no errors).

Run: `npx jest`
Expected: PASS (all suites).

- [ ] **Step 3: Commit**

```bash
git add src/map/MapScreen.tsx
git commit -m "feat: MapScreen loads selected trail once; renders overlay + info card"
```

---

### Task 9: List item selection + navigate to Map tab

**Files:**
- Modify: `src/trails/TrailListItem.tsx`
- Modify: `app/(tabs)/trails.tsx`

**Interfaces:**
- Consumes: `useMapStore.selectTrail` (Task 2), `useRouter` (already imported in `trails.tsx`).
- Produces: `TrailListItem` with an `onSelect(id)` prop; tapping a card selects the trail and switches to the Map tab. The delete button remains an independent hit target.

**Note (device-verified):** navigation + gesture; no unit test.

- [ ] **Step 1: Make the card body pressable**

In `src/trails/TrailListItem.tsx`:

Change the component signature and wrap the card body (NOT the delete button) in a `Pressable`. The delete `Pressable` stays a sibling so its press does not also select. Full file:

```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { TrailSummary } from '../data/trails/types'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { useTheme } from '../theme/useTheme'
import { DifficultyBadge } from './DifficultyBadge'

export function TrailListItem({
  trail,
  onSelect,
  onDelete,
}: {
  trail: TrailSummary
  onSelect: (id: number) => void
  onDelete: (id: number) => void
}) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable
        accessibilityLabel={`Show ${trail.name} on map`}
        onPress={() => onSelect(trail.id)}
        style={styles.body}
      >
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{trail.name}</Text>
          <DifficultyBadge difficulty={trail.difficulty} />
          <Text style={[styles.metrics, { color: c.onSurfaceVariant }]}>
            {formatDistance(trail.metrics.distanceMeters)} • {formatElevation(trail.metrics.elevationGainMeters)} gain
          </Text>
        </View>
      </Pressable>
      <Pressable accessibilityLabel="Delete trail" onPress={() => onDelete(trail.id)} hitSlop={8} style={styles.delete}>
        <Ionicons name="trash-outline" size={22} color={c.danger} />
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 12, marginHorizontal: 16 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, marginLeft: 12, gap: 4 },
  name: { fontSize: 16, fontWeight: '700' },
  metrics: { fontSize: 13 },
  delete: { padding: 8, marginLeft: 4 },
})
```

- [ ] **Step 2: Wire selection + navigation in the list screen**

In `app/(tabs)/trails.tsx`:

Add the store action near the other store selectors (after `removeTrail`):

```ts
  const selectTrail = useMapStore((s) => s.selectTrail)
```

Add the import for the map store at the top (with the other `../../src` imports):

```ts
import { useMapStore } from '../../src/store/mapStore'
```

Add a select handler (near `confirmDelete`):

```ts
  const onSelect = useCallback(
    (id: number) => {
      selectTrail(id)
      router.navigate('/')
    },
    [selectTrail, router],
  )
```

Pass it to the list item — change the `renderItem` line:

```tsx
          renderItem={({ item }) => (
            <TrailListItem trail={item} onSelect={onSelect} onDelete={() => confirmDelete(item)} />
          )}
```

- [ ] **Step 3: Verify types + tests**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx jest`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/trails/TrailListItem.tsx "app/(tabs)/trails.tsx"
git commit -m "feat: tap a trail to show it on the map"
```

---

## Final Verification (whole slice)

- [ ] **Gates:**
  - `npx tsc --noEmit` → clean.
  - `npx jest` → all pass.
  - `grep -rn "@rnmapbox" src app | grep -v "src/map/providers/"` → empty.
  - `grep -rn "drizzle-orm\|expo-sqlite" src app | grep -v "src/data/db/"` → empty.
- [ ] **Bundle (Metro/asset):** `npx expo export --platform android` → completes without error (exercises the new `trail-arrow.png` import; `tsc`/`jest` do NOT bundle).
- [ ] **Device-verify on SWWC4HEIYHZPQWZX** (the user drives via adb; note that `router.navigate('/')` switching to the Map tab, native rendering, and camera behavior only work in a running app):
  - Tapping a trail card switches to the Map tab.
  - The trail draws: purple line (round caps/joins), directional arrows along it, white-stroked start/end dots.
  - The camera fits the whole trail, with the bottom padding leaving the trail visible above the info card.
  - The info card shows name, difficulty, distance • gain; the close button clears the overlay + card.
  - Selecting a second trail re-fits to the new trail.
  - The delete button on a card still deletes and does NOT navigate.

## Self-Review (author checklist — completed)

- **Spec coverage:** overlay (Task 4/6), camera fit (Task 3/4/6), selection state (Task 2), loader + stale-guard (Task 5), info card + dismiss (Task 7/8), list-tap + navigate (Task 9), tokens/asset (Task 3/4), pure helpers TDD (Task 1) — all mapped.
- **Placeholder scan:** none.
- **Type consistency:** `boundsForPoints` → `{ne, sw}` consumed by `fitBounds(ne, sw, [top,sides,bottom,sides], duration)`; `TrailOverlayProps` fields match adapter destructuring and MapCanvas call site; `selectTrail`/`clearSelectedTrail` signatures consistent across store, tests, MapScreen, and trails.tsx.
