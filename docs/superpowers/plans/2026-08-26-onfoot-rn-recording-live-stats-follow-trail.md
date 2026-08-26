# Recording Live Stats & Trail Following Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recording state informative — keep the followed (selected) trail drawn on the map while recording, and show a live hike-stats sheet (duration, distance, elevation gain, pace/speed).

**Architecture:** No new "followed trail" state — the followed trail *is* the current map selection, which already survives recording; we just stop hiding it. A new `RecordingInfoSheet` renders inside the shared `MapInfoSheet` chrome when `mapMode === 'recording'`. Live stats come from the existing `recordingStore.liveGeometry` via `computeMetrics`, a 1-second duration tick, and a persisted pace/speed display preference.

**Tech Stack:** React Native, TypeScript, Zustand (+persist/AsyncStorage), `@gorhom/bottom-sheet`, `@rnmapbox/maps` (behind the provider seam), Jest (`jest-expo`).

## Global Constraints

- **Map-provider seam is inviolable:** only `src/map/providers/<provider>/` may import a map SDK. Nothing in this plan imports `@rnmapbox/maps`; the z-order change is JSX child-order in the provider-agnostic `MapCanvas`.
- **Z-order invariant:** the activity (recording) line is always drawn **above** the trail line — never under.
- **Pure logic is TDD'd** (`src/**/__tests__/`, tests written first); **native rendering is device-verified**, not unit-tested.
- **Persist the minimum:** only the pace/speed display preference is persisted; the recording session and live geometry stay in-memory (unchanged).
- **DRY / respect existing patterns:** reuse the existing `formatDuration` in `src/activities/format.ts`; do not create a second one. Mirror the mapStore persist setup for the new preferences store, and the `nextFollowMode` pure-helper pattern for the toggle.
- **Linking behaviour is unchanged:** the trail linked to the saved activity is still captured at stop (last-one-wins) in `RecordButton.doStop`.
- **Copy (verbatim):** header `● Recording` and `Following · <trail name>`; metric tile labels `Duration`, `Distance`, `Elev. Gain`, and the toggle tile `Pace (min/km)` / `Speed (km/h)`.
- **Comments:** describe current state only, sparingly; no change-narrating comments.

---

### Task 1: Pace & speed formatters

**Files:**
- Modify: `src/activities/format.ts`
- Test: `src/activities/__tests__/format.test.ts` (append; create if it does not exist)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `formatPace(distanceMeters: number, durationSeconds: number): string` — average pace `M:SS` (min/km, no unit suffix); `'—'` when distance ≤ 0 or duration ≤ 0.
  - `formatSpeed(distanceMeters: number, durationSeconds: number): string` — average speed as a one-decimal number string (km/h, no unit suffix); `'—'` when duration ≤ 0.

- [ ] **Step 1: Write the failing tests**

Append to `src/activities/__tests__/format.test.ts` (add the import for `formatPace, formatSpeed` to the existing `from '../format'` import if the file already imports from it):

```ts
import { formatPace, formatSpeed } from '../format'

describe('formatPace', () => {
  it('formats min/km as M:SS', () => {
    expect(formatPace(1000, 480)).toBe('8:00') // 480 s/km
    expect(formatPace(2000, 480)).toBe('4:00') // 240 s/km
    expect(formatPace(1000, 510)).toBe('8:30')
  })
  it('zero-pads seconds', () => {
    expect(formatPace(1000, 489)).toBe('8:09')
  })
  it('carries rounded 60 seconds up to the next minute', () => {
    expect(formatPace(1000, 119.6)).toBe('2:00')
  })
  it('returns — when distance or duration is non-positive', () => {
    expect(formatPace(0, 480)).toBe('—')
    expect(formatPace(1000, 0)).toBe('—')
  })
})

describe('formatSpeed', () => {
  it('formats km/h to one decimal', () => {
    expect(formatSpeed(1000, 360)).toBe('10.0') // 1 km in 0.1 h
    expect(formatSpeed(2400, 3600)).toBe('2.4')
  })
  it('returns — when duration is non-positive', () => {
    expect(formatSpeed(1000, 0)).toBe('—')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/activities/__tests__/format.test.ts -t 'formatPace|formatSpeed'`
Expected: FAIL — `formatPace`/`formatSpeed` are not exported.

- [ ] **Step 3: Implement the formatters**

Add to `src/activities/format.ts`:

```ts
export function formatPace(distanceMeters: number, durationSeconds: number): string {
  if (distanceMeters <= 0 || durationSeconds <= 0) return '—'
  const secPerKm = durationSeconds / (distanceMeters / 1000)
  let minutes = Math.floor(secPerKm / 60)
  let seconds = Math.round(secPerKm % 60)
  if (seconds === 60) {
    minutes += 1
    seconds = 0
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatSpeed(distanceMeters: number, durationSeconds: number): string {
  if (durationSeconds <= 0) return '—'
  const kmh = distanceMeters / 1000 / (durationSeconds / 3600)
  return kmh.toFixed(1)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/activities/__tests__/format.test.ts`
Expected: PASS (new and any pre-existing format tests).

- [ ] **Step 5: Commit**

```bash
git add src/activities/format.ts src/activities/__tests__/format.test.ts
git commit -m "feat(activities): add pace and speed formatters"
```

---

### Task 2: `trailToShow` map helper

**Files:**
- Modify: `src/store/mapStore.ts`
- Test: `src/store/__tests__/mapStore.test.ts` (append)

**Interfaces:**
- Consumes: `MapMode` (already exported from `mapStore.ts`).
- Produces: `trailToShow<T>(mode: MapMode, selectedTrail: T | null): T | null` — returns `selectedTrail` when `mode` is `'trail'` or `'recording'`, otherwise `null`. Generic so `mapStore` need not import the `Trail` domain type.

- [ ] **Step 1: Write the failing tests**

Append to `src/store/__tests__/mapStore.test.ts` (add `trailToShow` to the existing `from '../mapStore'` import):

```ts
import { trailToShow } from '../mapStore'

describe('trailToShow', () => {
  const trail = { id: 1 }
  it('shows the selected trail when viewing a trail', () => {
    expect(trailToShow('trail', trail)).toBe(trail)
  })
  it('shows the selected trail while recording (the followed trail)', () => {
    expect(trailToShow('recording', trail)).toBe(trail)
  })
  it('shows nothing in free or activity mode', () => {
    expect(trailToShow('free', trail)).toBeNull()
    expect(trailToShow('activity', trail)).toBeNull()
  })
  it('shows nothing when no trail is selected', () => {
    expect(trailToShow('recording', null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/store/__tests__/mapStore.test.ts -t trailToShow`
Expected: FAIL — `trailToShow` is not exported.

- [ ] **Step 3: Implement the helper**

Add to `src/store/mapStore.ts`, directly below the `mapMode` function:

```ts
// The trail to draw on the map: the selected trail is shown both when viewing it and while
// recording (so the followed trail stays visible), never in free or activity mode.
export function trailToShow<T>(mode: MapMode, selectedTrail: T | null): T | null {
  return mode === 'trail' || mode === 'recording' ? selectedTrail : null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: PASS (new and existing mapStore tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts
git commit -m "feat(map): add trailToShow helper (draw selected trail while recording)"
```

---

### Task 3: Persisted pace/speed preference store

**Files:**
- Create: `src/settings/preferencesStore.ts`
- Test: `src/settings/__tests__/preferencesStore.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PaceSpeedMode = 'pace' | 'speed'`
  - `nextPaceSpeedMode(mode: PaceSpeedMode): PaceSpeedMode` — pure flip.
  - `usePreferencesStore` — Zustand store with `paceSpeedMode: PaceSpeedMode` (default `'pace'`, persisted) and `togglePaceSpeed: () => void`.

- [ ] **Step 1: Write the failing test**

Create `src/settings/__tests__/preferencesStore.test.ts`:

```ts
import { nextPaceSpeedMode } from '../preferencesStore'

describe('nextPaceSpeedMode', () => {
  it('flips pace to speed and back', () => {
    expect(nextPaceSpeedMode('pace')).toBe('speed')
    expect(nextPaceSpeedMode('speed')).toBe('pace')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/settings/__tests__/preferencesStore.test.ts`
Expected: FAIL — module `../preferencesStore` does not exist.

- [ ] **Step 3: Implement the store**

Create `src/settings/preferencesStore.ts` (mirrors the persist setup in `src/store/mapStore.ts` and the `nextFollowMode` pure-helper pattern):

```ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type PaceSpeedMode = 'pace' | 'speed'

export function nextPaceSpeedMode(mode: PaceSpeedMode): PaceSpeedMode {
  return mode === 'pace' ? 'speed' : 'pace'
}

interface PreferencesStore {
  paceSpeedMode: PaceSpeedMode
  togglePaceSpeed: () => void
}

export const usePreferencesStore = create<PreferencesStore>()(
  persist(
    (set) => ({
      paceSpeedMode: 'pace',
      togglePaceSpeed: () => set((s) => ({ paceSpeedMode: nextPaceSpeedMode(s.paceSpeedMode) })),
    }),
    {
      name: 'onfoot-preferences',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ paceSpeedMode: s.paceSpeedMode }),
    },
  ),
)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/settings/__tests__/preferencesStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/settings/preferencesStore.ts src/settings/__tests__/preferencesStore.test.ts
git commit -m "feat(settings): add persisted pace/speed preference store"
```

---

### Task 4: Recording info sheet + tappable metric tile

**Files:**
- Create: `src/recording/RecordingInfoSheet.tsx`
- Modify: `src/map/MetricsGrid.tsx`

**Interfaces:**
- Consumes: `formatPace`, `formatSpeed` (Task 1); `usePreferencesStore` (Task 3); existing `computeMetrics`, `formatDistance`, `formatElevation` (`src/data/trails/gpx/metrics.ts`); existing `formatDuration` (`src/activities/format.ts`); existing `MapInfoSheet`, `MetricsGrid` (`src/map/`); `useRecordingStore` (`src/recording/recordingStore.ts`).
- Produces: `RecordingInfoSheet({ followedTrailName: string | null, animatedPosition?: SharedValue<number> })` — mounted by `MapScreen` in Task 5.

This is a rendering task: **device-verified**, not unit-tested. Pure inputs it depends on are covered by Tasks 1 and 3.

- [ ] **Step 1: Extend `MetricsGrid` with an optional tap handler**

`MetricsGrid` currently renders each item as a `View`. Add optional `onPress`/`accessibilityLabel` per item so the pace/speed tile can toggle, keeping every existing caller (trail & activity sheets pass no `onPress`) unchanged. Replace the body of `src/map/MetricsGrid.tsx` with:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme/useTheme'

export function MetricsGrid({
  items,
}: {
  items: { label: string; value: string; onPress?: () => void; accessibilityLabel?: string }[]
}) {
  const c = useTheme()
  return (
    <View style={[styles.metrics, { backgroundColor: c.surface }]}>
      {items.map((item) => {
        const body = (
          <>
            <Text style={[styles.metricValue, { color: c.onSurface }]}>{item.value}</Text>
            <Text style={[styles.metricLabel, { color: c.onSurfaceVariant }]}>{item.label}</Text>
          </>
        )
        return item.onPress ? (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            accessibilityLabel={item.accessibilityLabel}
            style={styles.metricItem}
          >
            {body}
          </Pressable>
        ) : (
          <View key={item.label} style={styles.metricItem}>
            {body}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 12 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 2 },
})
```

- [ ] **Step 2: Create the recording sheet**

Create `src/recording/RecordingInfoSheet.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { useTheme } from '../theme/useTheme'
import { useRecordingStore } from './recordingStore'
import { usePreferencesStore } from '../settings/preferencesStore'
import { computeMetrics, formatDistance, formatElevation } from '../data/trails/gpx/metrics'
import { formatDuration, formatPace, formatSpeed } from '../activities/format'
import { MapInfoSheet } from '../map/MapInfoSheet'
import { MetricsGrid } from '../map/MetricsGrid'

export function RecordingInfoSheet({
  followedTrailName,
  animatedPosition,
}: {
  followedTrailName: string | null
  animatedPosition?: SharedValue<number>
}) {
  const c = useTheme()
  const session = useRecordingStore((s) => s.session)
  const points = useRecordingStore((s) => s.liveGeometry.points)
  const paceSpeedMode = usePreferencesStore((s) => s.paceSpeedMode)
  const togglePaceSpeed = usePreferencesStore((s) => s.togglePaceSpeed)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const durationSeconds = Math.max(0, (now - (session?.startedAt ?? now)) / 1000)
  const metrics = computeMetrics(points)

  const paceSpeedTile =
    paceSpeedMode === 'pace'
      ? { label: 'Pace (min/km)', value: formatPace(metrics.distanceMeters, durationSeconds) }
      : { label: 'Speed (km/h)', value: formatSpeed(metrics.distanceMeters, durationSeconds) }

  return (
    <MapInfoSheet animatedPosition={animatedPosition}>
      <View style={styles.header}>
        <Text style={[styles.recording, { color: c.recordingLine }]}>● Recording</Text>
        {followedTrailName != null && (
          <Text style={[styles.following, { color: c.onSurfaceVariant }]} numberOfLines={1}>
            Following · {followedTrailName}
          </Text>
        )}
      </View>

      <MetricsGrid
        items={[
          { label: 'Duration', value: formatDuration(durationSeconds) },
          { label: 'Distance', value: formatDistance(metrics.distanceMeters) },
          { label: 'Elev. Gain', value: formatElevation(metrics.elevationGainMeters) },
          { ...paceSpeedTile, onPress: togglePaceSpeed, accessibilityLabel: 'Toggle pace or speed' },
        ]}
      />
    </MapInfoSheet>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  recording: { fontSize: 16, fontWeight: '700' },
  following: { fontSize: 13, flexShrink: 1 },
})
```

Note: `computeMetrics` takes `GpxPoint[]`; `TrackPoint` is structurally assignable (it only adds `t`), so `liveGeometry.points` passes without conversion.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean — including the two existing `MetricsGrid` callers (`src/map/ActivityInfoSheet.tsx`, `src/trails/TrailInfoSheet.tsx`), which still compile because `onPress`/`accessibilityLabel` are optional.

- [ ] **Step 4: Run the suite**

Run: `npx jest`
Expected: green (no test regressions from the `MetricsGrid` change).

- [ ] **Step 5: Commit**

```bash
git add src/recording/RecordingInfoSheet.tsx src/map/MetricsGrid.tsx
git commit -m "feat(recording): live-stats sheet with tappable pace/speed tile"
```

---

### Task 5: Wire recording view into the map (sheet, followed trail, z-order)

**Files:**
- Modify: `src/map/MapScreen.tsx`
- Modify: `src/map/MapCanvas.tsx`

**Interfaces:**
- Consumes: `trailToShow` (Task 2); `RecordingInfoSheet` (Task 4); existing `useSelectedTrail`, `mapMode`, `controlsAnimatedBottom`/`sheetTop` in `MapScreen`.
- Produces: the integrated recording experience. **Device-verified.**

- [ ] **Step 1: Draw the followed trail while recording**

In `src/map/MapScreen.tsx`, import `trailToShow`:

```tsx
import { useMapStore, mapMode, trailToShow } from '../store/mapStore'
```

and change the `MapCanvas` line so the selected trail is drawn in both trail and recording modes:

```tsx
<MapCanvas trail={trailToShow(mode, trail)} activity={mode === 'activity' ? activity : null} />
```

- [ ] **Step 2: Mount the recording sheet and anchor the controls above it**

In `src/map/MapScreen.tsx`, import the sheet:

```tsx
import { RecordingInfoSheet } from '../recording/RecordingInfoSheet'
```

Add the recording branch alongside the existing `mode === 'trail'` / `mode === 'activity'` branches (inside the root `<View>`, after the activity branch):

```tsx
{mode === 'recording' && (
  <RecordingInfoSheet followedTrailName={trail?.name ?? null} animatedPosition={sheetTop} />
)}
```

Update the two control anchors so they ride above the sheet during recording too:

```tsx
{mode !== 'activity' && (
  <RecordButton animatedBottom={mode === 'trail' || mode === 'recording' ? controlsAnimatedBottom : undefined} />
)}
<MapControls
  onOpenLayers={() => sheetRef.current?.present()}
  animatedBottom={mode !== 'free' ? controlsAnimatedBottom : undefined}
/>
```

- [ ] **Step 3: Enforce the z-order invariant in `MapCanvas`**

In `src/map/MapCanvas.tsx`, the live recording `RouteLine` is currently rendered **before** the trail/activity `TrailOverlay`, which would place it **under** the trail once both are drawn. Move the `RouteLine` block to render **after** the overlay block so the recording line sits on top. The children order inside `<MapView>` becomes:

```tsx
<Camera ... />
{caps.supportsTerrain && <Terrain exaggeration={MapTokens.terrainExaggeration} />}
<UserPuck scale={MapTokens.puckBearingScale} />
{hasActivity ? (
  <TrailOverlay
    line={toLineCoordinates(activityPoints)}
    endpoints={endpointCoordinates(activityPoints)}
    color={c.activityLine}
    lineWidth={MapTokens.trailLineWidth}
    endpointRadius={MapTokens.endpointRadius}
    endpointStrokeColor={c.trailEndpointStroke}
    endpointStrokeWidth={MapTokens.endpointStrokeWidth}
  />
) : hasTrail ? (
  <TrailOverlay
    line={toLineCoordinates(points)}
    endpoints={endpointCoordinates(points)}
    color={c.trailLine}
    lineWidth={MapTokens.trailLineWidth}
    arrowImage={trailArrow}
    arrowSpacing={MapTokens.arrowSpacing}
    arrowSize={MapTokens.arrowSize}
    endpointRadius={MapTokens.endpointRadius}
    endpointStrokeColor={c.trailEndpointStroke}
    endpointStrokeWidth={MapTokens.endpointStrokeWidth}
  />
) : null}
{showLiveTrack && (
  <RouteLine line={liveLine} color={c.recordingLine} lineWidth={MapTokens.recordingLineWidth} />
)}
```

(Only the position of the `showLiveTrack && <RouteLine .../>` block moves — from above the overlay ternary to below it. No other lines change.)

- [ ] **Step 4: Type-check and run the suite**

Run: `npx tsc --noEmit && npx jest`
Expected: `tsc` clean; jest green.

- [ ] **Step 5: Commit**

```bash
git add src/map/MapScreen.tsx src/map/MapCanvas.tsx
git commit -m "feat(map): show followed trail + live-stats sheet while recording, above the trail line"
```

- [ ] **Step 6: Device verification** (build/run on device — required; `tsc`/`jest` are not sufficient for rendering, gestures, or layer order)

Verify on the phone:
1. **Trail selected → record:** the trail line stays drawn; the sheet replaces the trail info and shows `● Recording` + `Following · <trail name>`.
2. **Live stats:** Duration ticks each second; Distance / Elev. Gain / Pace update as you move (Elev. Gain shows `—` if GPS reports no elevation).
3. **Pace/Speed tile:** tapping toggles between `Pace (min/km)` and `Speed (km/h)`; the choice survives an app restart.
4. **Z-order:** the recording (orange) line is drawn **above** the trail (purple) line where they overlap.
5. **Change trail mid-hike:** selecting a different trail (via the normal selection path) swaps the drawn trail; deselecting removes it.
6. **Free recording:** starting with no trail selected shows the sheet with no `Following` line and no trail on the map — no errors.
7. **Controls & stop:** `MapControls` and the `RecordButton` ride above the sheet; long-press still stops and opens the save screen; the linked trail on the saved activity is whatever was selected at stop.

---

## Self-Review

**1. Spec coverage:**
- Keep followed trail visible while recording → Tasks 2 (helper) + 5 (wiring). ✓
- Change trail mid-hike / free recording → covered by leaning on existing selection (Task 5 device-verify steps 5–6). ✓
- Live stats sheet (Duration/Distance/Elev. Gain/Pace|Speed) → Tasks 1, 4. ✓
- Pace/Speed toggle, persisted → Tasks 3, 4. ✓
- Z-order invariant → Task 5 step 3 + verify step 4. ✓
- Pure formatters + `trailToShow` TDD'd → Tasks 1, 2, 3. ✓
- Linking-at-stop unchanged → no task touches `RecordButton.doStop` (stated in Global Constraints). ✓
- Header copy `● Recording` / `Following · <name>` → Task 4. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps; every code step has full code. ✓

**3. Type consistency:** `formatPace`/`formatSpeed` signatures identical across Tasks 1 and 4; `trailToShow` signature identical across Tasks 2 and 5; `PaceSpeedMode`, `usePreferencesStore`, `togglePaceSpeed`, `paceSpeedMode` consistent across Tasks 3 and 4; `RecordingInfoSheet` prop shape identical across Tasks 4 and 5. ✓

**Deviations from spec (intentional, DRY / existing-pattern):**
- Reuse existing `formatDuration` (spec loosely implied creating it). Its output is the existing `1h 23m` / `12m 3s` / `45s` style, consistent with the activity sheet.
- `formatPace`/`formatSpeed` live in `src/activities/format.ts` (with `formatDuration`), not "alongside metrics.ts".
- The toggle is unit-tested via the pure `nextPaceSpeedMode` helper (mirrors `nextFollowMode`), rather than exercising the persisted store directly.
- Z-order is achieved by `MapCanvas` JSX child-order (provider-agnostic), needing no mapbox-adapter change.
