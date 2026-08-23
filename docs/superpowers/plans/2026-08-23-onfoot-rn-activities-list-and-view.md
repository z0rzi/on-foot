# Activities: list, view-on-map, linked trail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user browse saved activities and view any one on the single map (with its full record + a link to its trail), closing the record→save→review loop.

**Architecture:** One interactive map (the Map tab) whose mode is *derived* — Free / Trail / Recording / **Activity** — mutually exclusive. Selecting an activity from the Activities tab draws it on that map in Activity mode: a top chip + an expandable bottom sheet (collapsed summary → expanded record) + the recorded track overlay. Session-only selection; recording always wins. Overlays are independent, mode-driven layers (the sheet owns only the record) so a future above-sheet elevation graph drops into a reserved slot without a refactor.

**Tech Stack:** Expo SDK 57, React Native, TypeScript, expo-router, Zustand, expo-sqlite + drizzle-orm, @gorhom/bottom-sheet, @rnmapbox/maps (behind the provider seam).

## Global Constraints

- **Read the versioned Expo docs** (https://docs.expo.dev/versions/v57.0.0/) before writing native-facing code.
- **Map-provider seam inviolable:** only `src/map/providers/<provider>/` imports a map SDK. New provider concepts are declared on the port (`src/map/provider/types.ts`), never leaked as literals into shared code.
- **Persistence seam:** only `src/data/db/*` imports expo-sqlite / drizzle-orm. Pure modules import domain types from `src/data/activities/types` (leaf), never the barrel `src/data/activities` (which wires SQLite).
- **Pure logic is TDD'd** (`src/**/__tests__/`, tests written first); **native rendering / gestures / camera are device-verified**, not unit-tested.
- **Persist the minimum:** `selectedActivityId` is session-only (NOT in `partialize`).
- **Modes are mutually exclusive:** selecting an activity clears any trail; selecting a trail clears any activity. Recording takes precedence over both.
- **Comments describe current state only** — no change-narration comments.
- **No new dependencies** — everything needed is already installed.
- Full suite must stay green: `npx tsc --noEmit` clean and `npx jest` all-pass after every task.

---

### Task 1: Delete an activity — persistence seam + store action

Adds the ability to delete a saved activity: a repository port method, its SQLite implementation, and a store action mirroring `removeTrail`. Activity geometry is a JSON column on the `activities` row, so this is a single-row delete — no child cleanup, no migration.

**Files:**
- Modify: `src/data/activities/repository.ts` (add `deleteActivity` to the port)
- Modify: `src/data/db/activitiesRepository.ts` (implement `deleteActivity`)
- Modify: `src/store/activitiesStore.ts` (add `removeActivity`)
- Create: `src/store/__tests__/activitiesStore.test.ts`

**Interfaces:**
- Consumes: existing `ActivitiesRepository`, `ActivitySummary`, `NewActivityInput`.
- Produces:
  - `ActivitiesRepository.deleteActivity(id: number): Promise<void>`
  - `useActivitiesStore` gains `removeActivity: (id: number) => Promise<void>`

- [ ] **Step 1: Write the failing store test**

Create `src/store/__tests__/activitiesStore.test.ts` (mirrors `trailsStore.test.ts` — mocks the barrel):

```ts
jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    listSummaries: jest.fn(),
    getActivity: jest.fn(),
    saveActivity: jest.fn(),
    deleteActivity: jest.fn(),
  },
}))

import { useActivitiesStore } from '../activitiesStore'
import { ActivitySummary } from '../../data/activities/types'
import { activitiesRepository } from '../../data/activities'

const fakeRepo = activitiesRepository as jest.Mocked<typeof activitiesRepository>

const summary = (id: number): ActivitySummary => ({
  id, name: `A${id}`, effort: 'easy',
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  linkedTrailId: null, startedAt: id, createdAt: id,
})

beforeEach(() => {
  jest.clearAllMocks()
  useActivitiesStore.setState({ activities: [] })
})

test('loadActivities caches summaries from the repository', async () => {
  fakeRepo.listSummaries.mockResolvedValue([summary(2), summary(1)])
  await useActivitiesStore.getState().loadActivities()
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2, 1])
})

test('removeActivity deletes via the repository and reloads the cache', async () => {
  useActivitiesStore.setState({ activities: [summary(1), summary(2)] })
  fakeRepo.deleteActivity.mockResolvedValue(undefined)
  fakeRepo.listSummaries.mockResolvedValue([summary(2)])
  await useActivitiesStore.getState().removeActivity(1)
  expect(fakeRepo.deleteActivity).toHaveBeenCalledWith(1)
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2])
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/store/__tests__/activitiesStore.test.ts`
Expected: FAIL — `removeActivity` is not a function / `deleteActivity` missing on mock type.

- [ ] **Step 3: Add `deleteActivity` to the repository port**

In `src/data/activities/repository.ts`, add to the `ActivitiesRepository` interface (after `getActivity`):

```ts
  deleteActivity(id: number): Promise<void>
```

- [ ] **Step 4: Implement `deleteActivity` in the SQLite repository**

In `src/data/db/activitiesRepository.ts`, add this method to `sqliteActivitiesRepository` (after `getActivity`):

```ts
  async deleteActivity(id) {
    await db.delete(activities).where(eq(activities.id, id))
  },
```

(`activities` and `eq` are already imported in that file.)

- [ ] **Step 5: Add `removeActivity` to the store**

In `src/store/activitiesStore.ts`, add to the interface and the implementation, mirroring `removeTrail`:

```ts
// in ActivitiesStore interface:
  removeActivity: (id: number) => Promise<void>
```
```ts
// in the create() body, after saveActivity:
  removeActivity: async (id) => {
    await activitiesRepository.deleteActivity(id)
    await get().loadActivities()
  },
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx jest src/store/__tests__/activitiesStore.test.ts`
Expected: PASS (both tests).

- [ ] **Step 7: Verify the whole suite + types**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/data/activities/repository.ts src/data/db/activitiesRepository.ts src/store/activitiesStore.ts src/store/__tests__/activitiesStore.test.ts
git commit -m "feat: delete a saved activity (repository + store)"
```

---

### Task 2: Map store — activity selection, generalized pending-fit, and `mapMode`

Adds session-only activity selection to the map store, generalizes the trail-only `pendingFitTrailId` into a `pendingFit` that frames either a trail or an activity, and adds a pure `mapMode` selector. Updates the existing store tests and the one `MapCanvas` reference to `pendingFitTrailId` so the tree stays green (the activity *rendering* comes in Task 6).

**Files:**
- Modify: `src/store/mapStore.ts`
- Modify: `src/store/__tests__/mapStore.test.ts`
- Modify: `src/map/MapCanvas.tsx` (translate the trail-fit reference to the new `pendingFit` shape)

**Interfaces:**
- Consumes: existing `MapStore`.
- Produces:
  - `type MapMode = 'free' | 'trail' | 'recording' | 'activity'`
  - `mapMode(input: { recording: boolean; selectedActivityId: number | null; selectedTrailId: number | null }): MapMode` (pure, exported)
  - `interface PendingFit { kind: 'trail' | 'activity'; id: number }`
  - store state: `selectedActivityId: number | null`, `pendingFit: PendingFit | null` (replaces `pendingFitTrailId`)
  - store actions: `selectActivity(id: number)`, `clearSelectedActivity()`; `selectTrail`/`selectActivity` set `pendingFit`; `clearSelectedTrail`/`clearSelectedActivity` clear it.

- [ ] **Step 1: Write the failing tests**

In `src/store/__tests__/mapStore.test.ts`, add a new `describe` block for `mapMode` (near the other pure-function describes) and extend the store-actions block. First add the import:

```ts
// add mapMode to the existing import from '../mapStore'
```

Add the pure-selector tests:

```ts
describe('mapMode', () => {
  test('recording takes precedence over any selection', () =>
    expect(mapMode({ recording: true, selectedActivityId: 5, selectedTrailId: 9 })).toBe('recording'))
  test('activity selected (no recording) -> activity', () =>
    expect(mapMode({ recording: false, selectedActivityId: 5, selectedTrailId: null })).toBe('activity'))
  test('activity wins over a trail selection', () =>
    expect(mapMode({ recording: false, selectedActivityId: 5, selectedTrailId: 9 })).toBe('activity'))
  test('trail selected (no activity) -> trail', () =>
    expect(mapMode({ recording: false, selectedActivityId: null, selectedTrailId: 9 })).toBe('trail'))
  test('nothing selected -> free', () =>
    expect(mapMode({ recording: false, selectedActivityId: null, selectedTrailId: null })).toBe('free'))
})
```

Update the `beforeEach` in the `store actions` describe to the new field names (replace `pendingFitTrailId: null` with `selectedActivityId: null` and `pendingFit: null`):

```ts
  beforeEach(() => {
    useMapStore.setState({
      followMode: 'off',
      mapStyleId: 'standard',
      previousMapStyleId: null,
      selectedTrailId: null,
      selectedActivityId: null,
      cameraPitch: 0,
      pitchAnimated: false,
      cameraHeading: 0,
      northResetNonce: 0,
      pendingFit: null,
    })
  })
```

Replace the existing `selectTrail`, `clearSelectedTrail`, and `clearPendingFit` tests, and add activity-selection tests:

```ts
  test('selectTrail selects the trail, clears any activity, turns follow off, and marks it pending fit', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selectedActivityId: 3, pendingFit: null })
    useMapStore.getState().selectTrail(7)
    expect(useMapStore.getState().selectedTrailId).toBe(7)
    expect(useMapStore.getState().selectedActivityId).toBeNull()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'trail', id: 7 })
  })
  test('selectActivity selects the activity, clears any trail, turns follow off, and marks it pending fit', () => {
    useMapStore.setState({ followMode: 'positionAndBearing', selectedTrailId: 9, pendingFit: null })
    useMapStore.getState().selectActivity(4)
    expect(useMapStore.getState().selectedActivityId).toBe(4)
    expect(useMapStore.getState().selectedTrailId).toBeNull()
    expect(useMapStore.getState().followMode).toBe('off')
    expect(useMapStore.getState().pendingFit).toEqual({ kind: 'activity', id: 4 })
  })
  test('clearSelectedTrail clears the trail selection and pending fit, leaving follow untouched', () => {
    useMapStore.setState({ selectedTrailId: 7, pendingFit: { kind: 'trail', id: 7 }, followMode: 'position' })
    useMapStore.getState().clearSelectedTrail()
    expect(useMapStore.getState().selectedTrailId).toBeNull()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('clearSelectedActivity clears the activity selection and pending fit, leaving follow untouched', () => {
    useMapStore.setState({ selectedActivityId: 4, pendingFit: { kind: 'activity', id: 4 }, followMode: 'position' })
    useMapStore.getState().clearSelectedActivity()
    expect(useMapStore.getState().selectedActivityId).toBeNull()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().followMode).toBe('position')
  })
  test('clearPendingFit clears the pending fit without touching the selection', () => {
    useMapStore.setState({ selectedTrailId: 7, pendingFit: { kind: 'trail', id: 7 } })
    useMapStore.getState().clearPendingFit()
    expect(useMapStore.getState().pendingFit).toBeNull()
    expect(useMapStore.getState().selectedTrailId).toBe(7)
  })
```

Update the `partialize` test to the new field names:

```ts
  test('partialize persists only mapStyleId and selectedTrailId', () => {
    const partialize = useMapStore.persist.getOptions().partialize!
    useMapStore.setState({ selectedTrailId: 7 })
    const partial = partialize({ ...useMapStore.getState() } as any)
    expect(partial).toEqual({ mapStyleId: useMapStore.getState().mapStyleId, selectedTrailId: 7 })
    expect(partial).not.toHaveProperty('selectedActivityId')
    expect(partial).not.toHaveProperty('pendingFit')
    expect(partial).not.toHaveProperty('followMode')
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/store/__tests__/mapStore.test.ts`
Expected: FAIL — `mapMode` undefined; `selectActivity`/`clearSelectedActivity`/`pendingFit` missing.

- [ ] **Step 3: Add the `mapMode` selector and `PendingFit` type**

In `src/store/mapStore.ts`, add near the other pure helpers (e.g. after `resolveQuickSwitch`):

```ts
export type MapMode = 'free' | 'trail' | 'recording' | 'activity'

// The single map's mode, derived (never stored) so it can't drift from reality. Recording takes
// precedence over any selection; a selected activity outranks a selected trail (they are mutually
// exclusive in the store, but the order fixes the degenerate case defensively).
export function mapMode(input: {
  recording: boolean
  selectedActivityId: number | null
  selectedTrailId: number | null
}): MapMode {
  if (input.recording) return 'recording'
  if (input.selectedActivityId != null) return 'activity'
  if (input.selectedTrailId != null) return 'trail'
  return 'free'
}

// A pending one-shot camera fit for whichever selection requested it, consumed once its geometry
// loads (see MapCanvas). Generalized over trail and activity so both frame identically.
export interface PendingFit {
  kind: 'trail' | 'activity'
  id: number
}
```

- [ ] **Step 4: Update the store state, actions, and partialize**

In the `MapStore` interface: replace `pendingFitTrailId: number | null` with:

```ts
  selectedActivityId: number | null
  pendingFit: PendingFit | null
```
and add to the action signatures:
```ts
  selectActivity: (id: number) => void
  clearSelectedActivity: () => void
```

In the `create(...)` initializer: replace `pendingFitTrailId: null` with `selectedActivityId: null` and `pendingFit: null`, and update the selection actions:

```ts
      selectTrail: (id) =>
        set({ selectedTrailId: id, selectedActivityId: null, followMode: 'off', pendingFit: { kind: 'trail', id } }),
      clearSelectedTrail: () => set({ selectedTrailId: null, pendingFit: null }),
      selectActivity: (id) =>
        set({ selectedActivityId: id, selectedTrailId: null, followMode: 'off', pendingFit: { kind: 'activity', id } }),
      clearSelectedActivity: () => set({ selectedActivityId: null, pendingFit: null }),
      clearPendingFit: () => set({ pendingFit: null }),
```

Leave `partialize` unchanged — it already persists only `mapStyleId` and `selectedTrailId`, so `selectedActivityId` stays session-only.

Update the comment on `selectedTrailId` to note the mutual exclusion, and remove the stale `pendingFitTrailId` comment, replacing it with one on `selectedActivityId` (session-only) and `pendingFit`.

- [ ] **Step 5: Update the `MapCanvas` reference to the new pending-fit shape**

In `src/map/MapCanvas.tsx`, replace the pending-fit selector and the trail-fit guard:

```ts
// replace: const pendingFitTrailId = useMapStore((s) => s.pendingFitTrailId)
const pendingFit = useMapStore((s) => s.pendingFit)
```
and in the trail-fit `useEffect`, change the guard and deps:
```ts
  useEffect(() => {
    if (trail == null || pendingFit?.kind !== 'trail' || pendingFit.id !== trail.id) return
    if (trail.geometry.points.length < 2) return
    const bounds = boundsForPoints(trail.geometry.points)
    if (!bounds) return
    clearPendingFit()
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [trail, pendingFit, clearPendingFit])
```

- [ ] **Step 6: Run the tests + full suite**

Run: `npx jest src/store/__tests__/mapStore.test.ts && npx tsc --noEmit && npx jest`
Expected: the map-store tests pass; tsc clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/store/mapStore.ts src/store/__tests__/mapStore.test.ts src/map/MapCanvas.tsx
git commit -m "feat: add activity selection, mapMode selector, and generalized pending-fit to the map store"
```

---

### Task 3: Activity track styling — theme color + optional arrows on the overlay port

The recorded activity track reuses the `TrailOverlay` port but with **no direction arrows** and a distinct `activityLine` color. This task makes the port's arrow props optional (a seam-respecting extension) so the same component renders a trail (with arrows) or an activity (without), and adds the `activityLine` theme color.

**Files:**
- Modify: `src/map/provider/types.ts` (make arrow props optional on `TrailOverlayProps`)
- Modify: `src/map/providers/mapbox/adapter.tsx` (render arrows only when `arrowImage` is provided)
- Modify: `src/theme/colors.ts` (add `activityLine` to `AppColors` + both palettes)

**Interfaces:**
- Consumes: existing `TrailOverlayProps`, `AppColors`.
- Produces:
  - `TrailOverlayProps` with `arrowImage?`, `arrowSpacing?`, `arrowSize?` optional; when `arrowImage` is omitted, no arrow layer renders.
  - `AppColors.activityLine: string`.

- [ ] **Step 1: Make the arrow props optional on the port**

In `src/map/provider/types.ts`, in `TrailOverlayProps`, change the three arrow fields to optional:

```ts
  // Directional arrows are optional: omit arrowImage to render a plain trail line + endpoints
  // (used for recorded activity tracks, where arrows on noisy GPS look cluttered).
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
```

(Leave `line`, `endpoints`, `color`, `lineWidth`, `endpointRadius`, `endpointStrokeColor`, `endpointStrokeWidth` required.)

- [ ] **Step 2: Render arrows conditionally in the adapter**

In `src/map/providers/mapbox/adapter.tsx`, change the `TrailOverlay` so the `Images` + arrow `SymbolLayer` render only when `arrowImage` is defined. Replace the `<Mapbox.Images .../>` line and the arrow `SymbolLayer` with a guarded fragment:

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
      {arrowImage != null && <Mapbox.Images images={{ 'trail-arrow': arrowImage }} />}
      <Mapbox.ShapeSource id="trail-line-source" shape={lineShape}>
        <Mapbox.LineLayer
          id="trail-line"
          style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
        />
        {arrowImage != null && (
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
        )}
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

- [ ] **Step 3: Add the `activityLine` theme color**

In `src/theme/colors.ts`:
- Add to the `AppColors` interface (after `recordingLine`): `activityLine: string`
- Add to `lightColors` (after `recordingLine: '#FF5722',`): `activityLine: '#00897B',`
- Add to `darkColors` (after `recordingLine: '#FF7043',`): `activityLine: '#4DB6AC',`

- [ ] **Step 4: Verify types + suite**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean (existing `TrailOverlay` callers still satisfy the now-looser props); all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/map/provider/types.ts src/map/providers/mapbox/adapter.tsx src/theme/colors.ts
git commit -m "feat: support arrow-less trail overlay + add activityLine color for activity tracks"
```

---

### Task 4: Presentation helpers — activity formatters + `EffortBadge`

Pure formatters (TDD'd) for the activity date and the one-line `distance · duration` summary, plus an `EffortBadge` component mirroring `DifficultyBadge`. Consumed by the list (Task 5) and the sheet (Task 7).

**Files:**
- Modify: `src/activities/format.ts`
- Modify: `src/activities/__tests__/format.test.ts`
- Create: `src/activities/EffortBadge.tsx`

**Interfaces:**
- Consumes: `ActivityMetrics` (`src/data/activities/types`), `formatDistance`/`formatDuration`, `effortColor`/`effortLabel` + `Effort`.
- Produces:
  - `formatActivityDate(startedAt: number): string` → e.g. `"Aug 22, 2026"`
  - `formatActivitySummary(metrics: ActivityMetrics): string` → e.g. `"4.2 km · 1h 5m"`
  - `<EffortBadge effort={Effort} />`

- [ ] **Step 1: Write the failing formatter tests**

In `src/activities/__tests__/format.test.ts`, add:

```ts
import { formatActivityDate, formatActivitySummary } from '../format'
import { ActivityMetrics } from '../../data/activities/types'

describe('formatActivityDate', () => {
  test('formats a timestamp as "Mon D, YYYY" in local time', () => {
    // Construct with local components so the assertion is timezone-independent.
    const ts = new Date(2026, 7, 22, 10, 30).getTime() // Aug = month index 7
    expect(formatActivityDate(ts)).toBe('Aug 22, 2026')
  })
  test('formats a single-digit day without padding', () => {
    const ts = new Date(2026, 0, 5, 9, 0).getTime() // Jan 5
    expect(formatActivityDate(ts)).toBe('Jan 5, 2026')
  })
})

describe('formatActivitySummary', () => {
  const metrics = (distanceMeters: number, durationSeconds: number): ActivityMetrics => ({
    distanceMeters, durationSeconds, elevationGainMeters: null, elevationLossMeters: null,
  })
  test('joins distance and duration with a middot', () => {
    expect(formatActivitySummary(metrics(4200, 3900))).toBe('4.2 km · 1h 5m')
  })
  test('sub-kilometre distance and short duration', () => {
    expect(formatActivitySummary(metrics(850, 90))).toBe('850 m · 1m 30s')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/activities/__tests__/format.test.ts`
Expected: FAIL — `formatActivityDate` / `formatActivitySummary` not exported.

- [ ] **Step 3: Implement the formatters**

In `src/activities/format.ts`, add (keep the existing `formatDuration`):

```ts
import { ActivityMetrics } from '../data/activities/types'
import { formatDistance } from '../data/trails/gpx/metrics'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatActivityDate(startedAt: number): string {
  const d = new Date(startedAt)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatActivitySummary(metrics: ActivityMetrics): string {
  return `${formatDistance(metrics.distanceMeters)} · ${formatDuration(metrics.durationSeconds)}`
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/activities/__tests__/format.test.ts`
Expected: PASS (all four new tests + the existing `formatDuration` tests).

- [ ] **Step 5: Create `EffortBadge`**

Create `src/activities/EffortBadge.tsx` (mirrors `src/trails/DifficultyBadge.tsx`):

```tsx
import { Text } from 'react-native'
import { Effort } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { effortColor, effortLabel } from './effort'

export function EffortBadge({ effort }: { effort: Effort }) {
  const c = useTheme()
  return (
    <Text style={{ color: effortColor(effort, c), fontSize: 12, fontWeight: '600' }}>
      {effortLabel(effort)}
    </Text>
  )
}
```

- [ ] **Step 6: Verify types + suite**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/activities/format.ts src/activities/__tests__/format.test.ts src/activities/EffortBadge.tsx
git commit -m "feat: add activity date/summary formatters and EffortBadge"
```

---

### Task 5: Activities tab — list screen

Replaces the `app/(tabs)/activities.tsx` placeholder with a list (mirroring the Trails tab): newest-first cards showing name, effort badge, `distance · duration`, and date; tap selects the activity and jumps to the Map tab; a delete icon confirms then removes. Selecting is blocked while a recording is in progress (recording owns the map).

**Files:**
- Create: `src/activities/ActivityListItem.tsx`
- Modify: `app/(tabs)/activities.tsx`

**Interfaces:**
- Consumes: `useActivitiesStore` (`activities`, `loadActivities`, `removeActivity`), `useMapStore` (`selectActivity`, `selectedActivityId`, `clearSelectedActivity`), `useRecordingStore` + `recordingPhase`, `EffortBadge`, `formatActivitySummary`, `formatActivityDate`, `ActivitySummary`.
- Produces: `<ActivityListItem activity onSelect onDelete />`; the Activities screen.

- [ ] **Step 1: Create `ActivityListItem`**

Create `src/activities/ActivityListItem.tsx` (mirrors `src/trails/TrailListItem.tsx`, minus the edit action — activities are not edited in this slice):

```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ActivitySummary } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { EffortBadge } from './EffortBadge'
import { formatActivityDate, formatActivitySummary } from './format'

export function ActivityListItem({
  activity,
  onSelect,
  onDelete,
}: {
  activity: ActivitySummary
  onSelect: (id: number) => void
  onDelete: (id: number) => void
}) {
  const c = useTheme()
  return (
    <View style={[styles.card, { backgroundColor: c.surface }]}>
      <Pressable
        accessibilityLabel={`Show ${activity.name} on map`}
        onPress={() => onSelect(activity.id)}
        style={styles.body}
      >
        <View style={[styles.thumb, { backgroundColor: c.background }]}>
          <Ionicons name="walk-outline" size={28} color={c.onSurfaceVariant} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: c.onSurface }]} numberOfLines={1}>{activity.name}</Text>
          <EffortBadge effort={activity.effort} />
          <Text style={[styles.meta, { color: c.onSurfaceVariant }]}>
            {formatActivitySummary(activity.metrics)}
          </Text>
          <Text style={[styles.meta, { color: c.onSurfaceVariant }]}>
            {formatActivityDate(activity.startedAt)}
          </Text>
        </View>
      </Pressable>
      <Pressable accessibilityLabel="Delete activity" onPress={() => onDelete(activity.id)} hitSlop={8} style={styles.action}>
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
  meta: { fontSize: 13 },
  action: { padding: 8, marginLeft: 4 },
})
```

- [ ] **Step 2: Replace the Activities screen**

Replace `app/(tabs)/activities.tsx` entirely (mirrors `app/(tabs)/trails.tsx` structure, without the GPX import footer):

```tsx
import { useCallback, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect, useRouter } from 'expo-router'
import { useActivitiesStore } from '../../src/store/activitiesStore'
import { useMapStore } from '../../src/store/mapStore'
import { useRecordingStore, recordingPhase } from '../../src/recording/recordingStore'
import { ActivityListItem } from '../../src/activities/ActivityListItem'
import { useTheme } from '../../src/theme/useTheme'
import { ActivitySummary } from '../../src/data/activities/types'

export default function ActivitiesScreen() {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const activities = useActivitiesStore((s) => s.activities)
  const loadActivities = useActivitiesStore((s) => s.loadActivities)
  const removeActivity = useActivitiesStore((s) => s.removeActivity)
  const selectActivity = useMapStore((s) => s.selectActivity)
  const clearSelectedActivity = useMapStore((s) => s.clearSelectedActivity)

  useFocusEffect(useCallback(() => { loadActivities() }, [loadActivities]))

  const onSelect = useCallback(
    (id: number) => {
      // Recording owns the map; viewing a past activity is only possible when idle.
      if (recordingPhase(useRecordingStore.getState().session) !== 'idle') return
      selectActivity(id)
      router.navigate('/')
    },
    [selectActivity, router],
  )

  const confirmDelete = useCallback(
    (activity: ActivitySummary) => {
      Alert.alert(
        'Delete Activity',
        `Are you sure you want to delete "${activity.name}"? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              if (useMapStore.getState().selectedActivityId === activity.id) clearSelectedActivity()
              await removeActivity(activity.id)
            },
          },
        ],
      )
    },
    [removeActivity, clearSelectedActivity],
  )

  return (
    <View style={[styles.screen, { backgroundColor: c.background, paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: c.onSurface }]}>Activities</Text>
      {activities.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.onSurfaceVariant, fontSize: 16 }}>No activities recorded yet.</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          keyExtractor={(a) => String(a.id)}
          renderItem={({ item }) => (
            <ActivityListItem activity={item} onSelect={onSelect} onDelete={() => confirmDelete(item)} />
          )}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', paddingHorizontal: 16, paddingVertical: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 8, paddingVertical: 8 },
})
```

- [ ] **Step 3: Verify types + suite**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean; all tests pass.

- [ ] **Step 4: Device-verify**

On the device (Metro running): open the Activities tab. The saved activity from Slice 2 appears with its name, effort badge, `distance · duration`, and date, newest first. Tapping the trash icon shows the confirm dialog and (on Delete) removes it. Tapping a card navigates to the Map tab. (The map's Activity-mode display is wired in Tasks 6–7; for now the tap navigates and sets the selection.)

- [ ] **Step 5: Commit**

```bash
git add src/activities/ActivityListItem.tsx "app/(tabs)/activities.tsx"
git commit -m "feat: activities tab lists saved activities with delete and select-to-map"
```

---

### Task 6: Map — render the selected activity track + `useSelectedActivity`

Loads the full selected `Activity` (with geometry) via a hook mirroring `useSelectedTrail`, and renders its recorded track on the map: a `TrailOverlay` with endpoints, **no arrows**, in `activityLine` color, with a one-shot camera fit driven by `pendingFit.kind === 'activity'`. Since modes are mutually exclusive, `MapCanvas` draws exactly one overlay (activity takes precedence over trail if both are somehow set).

**Files:**
- Create: `src/map/useSelectedActivity.ts`
- Modify: `src/map/MapCanvas.tsx`

**Interfaces:**
- Consumes: `activitiesRepository.getActivity`, `useMapStore` (`selectedActivityId`, `clearSelectedActivity`, `pendingFit`, `clearPendingFit`), `useActivitiesStore.activities` (to re-resolve after list changes), `Activity` type, `TrailOverlay`, geo helpers, `activityLine` color.
- Produces:
  - `useSelectedActivity(): Activity | null`
  - `MapCanvas` accepts a new `activity: Activity | null` prop and renders its track.

- [ ] **Step 1: Create `useSelectedActivity`**

Create `src/map/useSelectedActivity.ts` (mirrors `src/map/useSelectedTrail.ts`):

```ts
import { useEffect, useState } from 'react'
import { Activity, activitiesRepository } from '../data/activities'
import { useMapStore } from '../store/mapStore'
import { useActivitiesStore } from '../store/activitiesStore'

export function useSelectedActivity(): Activity | null {
  const selectedActivityId = useMapStore((s) => s.selectedActivityId)
  const clearSelectedActivity = useMapStore((s) => s.clearSelectedActivity)
  const activities = useActivitiesStore((s) => s.activities)
  const [activity, setActivity] = useState<Activity | null>(null)

  useEffect(() => {
    if (selectedActivityId == null) {
      setActivity(null)
      return
    }
    let active = true
    activitiesRepository.getActivity(selectedActivityId).then((loaded) => {
      if (!active) return
      if (loaded == null) clearSelectedActivity()
      setActivity(loaded)
    })
    return () => {
      active = false
    }
  }, [selectedActivityId, activities, clearSelectedActivity])

  return activity
}
```

- [ ] **Step 2: Render the activity track in `MapCanvas`**

In `src/map/MapCanvas.tsx`:

Add the `Activity` import (alongside the existing `Trail` import):
```ts
import { Activity } from '../data/activities/types'
```

Change the component signature to accept the activity:
```tsx
export function MapCanvas({ trail, activity }: { trail: Trail | null; activity: Activity | null }) {
```

After the existing `points`/`hasTrail` lines, add the activity geometry:
```ts
  const activityPoints = activity?.geometry.points ?? []
  const hasActivity = activityPoints.length >= 2
```

Add an activity-fit effect mirroring the trail-fit effect (place it right after the trail-fit `useEffect`):
```tsx
  useEffect(() => {
    if (activity == null || pendingFit?.kind !== 'activity' || pendingFit.id !== activity.id) return
    if (activity.geometry.points.length < 2) return
    const bounds = boundsForPoints(activity.geometry.points)
    if (!bounds) return
    clearPendingFit()
    const { top, sides, bottom } = MapTokens.cameraPadding
    cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [top, sides, bottom, sides], MapTokens.trailFitDurationMs)
  }, [activity, pendingFit, clearPendingFit])
```

Replace the trail overlay JSX block (the `{hasTrail && (<TrailOverlay .../>)}`) with a mutually-exclusive branch that draws the activity when present, otherwise the trail:
```tsx
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
```

(The activity `TrailOverlay` omits `arrowImage`/`arrowSpacing`/`arrowSize`, so no arrow layer renders — Task 3.)

- [ ] **Step 3: Verify types**

Run: `npx tsc --noEmit`
Expected: FAIL — `MapScreen` does not yet pass the `activity` prop to `MapCanvas`. This is expected and fixed in Task 7. (Do not "fix" it here by editing MapScreen — that is Task 7's deliverable.)

> Note to implementer: because `MapCanvas`'s prop is now required, `MapScreen` will not typecheck until Task 7 wires it. Commit this task's files; the suite is validated at the end of Task 7. If you prefer a green tsc at each commit, you may add `activity={null}` at the single `<MapCanvas .../>` call site in `src/map/MapScreen.tsx` as a placeholder and let Task 7 replace it — but do not add any other MapScreen logic here.

- [ ] **Step 4: Commit**

```bash
git add src/map/useSelectedActivity.ts src/map/MapCanvas.tsx
git commit -m "feat: render the selected activity track on the map (endpoints, no arrows, activityLine)"
```

---

### Task 7: Activity mode — top chip, info sheet, and MapScreen wiring

Completes Activity mode: a top chip identifying the viewed activity (with ✕ to exit), an expandable bottom sheet (collapsed summary → expanded full record + "View linked trail"), and `MapScreen` deriving `mapMode` to compose the layers, hide the record button in Activity mode, and pass the activity into `MapCanvas`.

**Files:**
- Create: `src/map/ActivityModeChip.tsx`
- Create: `src/map/ActivityInfoSheet.tsx`
- Modify: `src/map/MapScreen.tsx`

**Interfaces:**
- Consumes: `useSelectedTrail`, `useSelectedActivity`, `useMapStore` (`selectedActivityId`, `selectedTrailId`, `clearSelectedActivity`, `clearSelectedTrail`, `selectTrail`), `useRecordingStore` + `recordingPhase`, `mapMode`, `useTrailsStore` (`trails`, `loadTrails`), `Activity`, formatters, `EffortBadge`, `formatElevation`/`formatDistance`/`formatDuration`.
- Produces: `<ActivityModeChip activity onExit />`, `<ActivityInfoSheet activity onViewLinkedTrail />`, and the fully-composed `MapScreen`.

- [ ] **Step 1: Create the top chip**

Create `src/map/ActivityModeChip.tsx`:

```tsx
import { Ionicons } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Activity } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

export function ActivityModeChip({ activity, onExit }: { activity: Activity; onExit: () => void }) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.wrap, { top: insets.top + MapTokens.controlsSpacing }]} pointerEvents="box-none">
      <View style={[styles.chip, { backgroundColor: c.activityLine }]}>
        <Ionicons name="walk" size={16} color="#FFFFFF" />
        <Text style={styles.label} numberOfLines={1}>Viewing activity · {activity.name}</Text>
        <Pressable accessibilityLabel="Exit activity view" onPress={onExit} hitSlop={8}>
          <Ionicons name="close" size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 16 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%',
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, elevation: 6,
  },
  label: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, flexShrink: 1 },
})
```

- [ ] **Step 2: Create the info sheet**

Create `src/map/ActivityInfoSheet.tsx`. It uses the non-modal `BottomSheet` (always present while in Activity mode; two snap points → collapsed summary / expanded record; cannot be swiped away — exit is via the chip). It reads the linked trail from `trailsStore` (loading it on mount) to decide whether to show "View linked trail":

```tsx
import { useEffect, useMemo } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import { Ionicons } from '@expo/vector-icons'
import { Activity } from '../data/activities/types'
import { useTheme } from '../theme/useTheme'
import { useTrailsStore } from '../store/trailsStore'
import { EffortBadge } from '../activities/EffortBadge'
import { formatActivityDate, formatActivitySummary, formatDuration } from '../activities/format'
import { formatDistance, formatElevation } from '../data/trails/gpx/metrics'

export function ActivityInfoSheet({
  activity,
  onViewLinkedTrail,
}: {
  activity: Activity
  onViewLinkedTrail: (trailId: number) => void
}) {
  const c = useTheme()
  const snapPoints = useMemo(() => ['16%', '55%'], [])
  const trails = useTrailsStore((s) => s.trails)
  const loadTrails = useTrailsStore((s) => s.loadTrails)

  useEffect(() => { loadTrails() }, [loadTrails])

  const linkedTrail =
    activity.linkedTrailId != null ? trails.find((t) => t.id === activity.linkedTrailId) : undefined

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
      handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={[styles.name, { color: c.panelContent }]} numberOfLines={1}>{activity.name}</Text>
        <View style={styles.summaryRow}>
          <EffortBadge effort={activity.effort} />
          <Text style={[styles.summary, { color: c.onSurfaceVariant }]}>
            {formatActivitySummary(activity.metrics)}  ·  {formatActivityDate(activity.startedAt)}
          </Text>
        </View>

        <View style={[styles.metrics, { backgroundColor: c.surface }]}>
          <Metric label="Distance" value={formatDistance(activity.metrics.distanceMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Duration" value={formatDuration(activity.metrics.durationSeconds)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Elev. Gain" value={formatElevation(activity.metrics.elevationGainMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
          <Metric label="Elev. Loss" value={formatElevation(activity.metrics.elevationLossMeters)} color={c.onSurface} muted={c.onSurfaceVariant} />
        </View>

        {activity.comments != null && (
          <Text style={[styles.comments, { color: c.panelContent }]}>{activity.comments}</Text>
        )}

        {linkedTrail && (
          <Pressable
            accessibilityLabel="View linked trail"
            onPress={() => onViewLinkedTrail(linkedTrail.id)}
            style={[styles.linkBtn, { borderColor: c.trailLine }]}
          >
            <Ionicons name="trail-sign-outline" size={18} color={c.trailLine} />
            <Text style={[styles.linkLabel, { color: c.trailLine }]} numberOfLines={1}>
              View linked trail: {linkedTrail.name}
            </Text>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheet>
  )
}

function Metric({ label, value, color, muted }: { label: string; value: string; color: string; muted: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: muted }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  name: { fontSize: 18, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summary: { fontSize: 13, flexShrink: 1 },
  metrics: { flexDirection: 'row', justifyContent: 'space-evenly', borderRadius: 12, padding: 12 },
  metricItem: { alignItems: 'center' },
  metricValue: { fontSize: 15, fontWeight: '700' },
  metricLabel: { fontSize: 11, marginTop: 2 },
  comments: { fontSize: 14, lineHeight: 20 },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  linkLabel: { fontSize: 15, fontWeight: '600', flexShrink: 1 },
})
```

- [ ] **Step 3: Wire `MapScreen`**

Replace `src/map/MapScreen.tsx` with the composed version (derives `mapMode`; renders the chip + sheet + activity overlay in Activity mode; keeps `TrailInfoCard` for Trail mode; hides `RecordButton` in Activity mode):

```tsx
import { useRef, useState } from 'react'
import { View } from 'react-native'
import { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { MapProviderProvider } from './provider'
import { mapboxProvider } from './providers/mapbox'
import { MapCanvas } from './MapCanvas'
import { MapControls } from './MapControls'
import { RecordButton } from './RecordButton'
import { LayersSheet } from './LayersSheet'
import { ActivityModeChip } from './ActivityModeChip'
import { ActivityInfoSheet } from './ActivityInfoSheet'
import { useLocationPermission } from './useLocationPermission'
import { useSelectedTrail } from './useSelectedTrail'
import { useSelectedActivity } from './useSelectedActivity'
import { TrailInfoCard } from '../trails/TrailInfoCard'
import { useMapStore, mapMode } from '../store/mapStore'
import { useRecordingStore, recordingPhase } from '../recording/recordingStore'
import { MapTokens } from '../theme/tokens'

export function MapScreen() {
  const sheetRef = useRef<BottomSheetModal>(null)
  useLocationPermission()
  const trail = useSelectedTrail()
  const activity = useSelectedActivity()
  const clearSelectedTrail = useMapStore((s) => s.clearSelectedTrail)
  const clearSelectedActivity = useMapStore((s) => s.clearSelectedActivity)
  const selectTrail = useMapStore((s) => s.selectTrail)
  const selectedActivityId = useMapStore((s) => s.selectedActivityId)
  const selectedTrailId = useMapStore((s) => s.selectedTrailId)
  const recording = useRecordingStore((s) => recordingPhase(s.session) !== 'idle')
  const mode = mapMode({ recording, selectedActivityId, selectedTrailId })
  // Measured height of the trail info card, so the controls sit clear above it while it is shown.
  const [cardHeight, setCardHeight] = useState(0)

  const trailLift = mode === 'trail' && trail ? cardHeight + MapTokens.controlsSpacing : 0

  return (
    <MapProviderProvider provider={mapboxProvider}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1 }}>
          <MapCanvas trail={mode === 'trail' ? trail : null} activity={mode === 'activity' ? activity : null} />
          {mode !== 'activity' && <RecordButton extraBottom={trailLift} />}
          <MapControls
            onOpenLayers={() => sheetRef.current?.present()}
            extraBottom={trailLift}
          />
          {mode === 'trail' && trail && (
            <TrailInfoCard trail={trail} onClose={clearSelectedTrail} onHeightChange={setCardHeight} />
          )}
          {mode === 'activity' && activity && (
            <>
              <ActivityModeChip activity={activity} onExit={clearSelectedActivity} />
              <ActivityInfoSheet activity={activity} onViewLinkedTrail={(id) => selectTrail(id)} />
            </>
          )}
        </View>
        <LayersSheet ref={sheetRef} />
      </BottomSheetModalProvider>
    </MapProviderProvider>
  )
}
```

- [ ] **Step 4: Verify types + suite**

Run: `npx tsc --noEmit && npx jest`
Expected: tsc clean (the `MapCanvas` `activity` prop is now supplied); all tests pass.

- [ ] **Step 5: Device-verify the full flow**

On the device (Metro running):
1. Activities tab → tap an activity → jumps to the Map tab; the recorded track draws in the teal `activityLine` color with start/end dots and **no arrows**; the camera frames the whole track; the top chip shows `Viewing activity · {name}` and the bottom sheet shows the summary.
2. Drag the sheet up → the full record appears (four metrics, comments, and — if linked — "View linked trail: {name}").
3. The record (play) button is **hidden** in Activity mode.
4. Tap the chip ✕ → returns to Free mode (no track, record button back).
5. If the activity was linked to a trail: expand → "View linked trail" → the activity clears and the linked trail draws (Trail mode, purple + arrows + `TrailInfoCard`).
6. Select a trail from the Trails tab, then an activity from the Activities tab → only the activity shows (mutual exclusion).
7. Delete the currently-displayed activity from the list → it disappears from the map.

- [ ] **Step 6: Commit**

```bash
git add src/map/ActivityModeChip.tsx src/map/ActivityInfoSheet.tsx src/map/MapScreen.tsx
git commit -m "feat: activity mode on the map — top chip, expandable info sheet, linked-trail navigation"
```

---

## Self-Review

**Spec coverage:**
- One map, explicit derived modes → `mapMode` (Task 2), composed in `MapScreen` (Task 7). ✓
- Mutual exclusion (activity clears trail & vice-versa) → `selectTrail`/`selectActivity` (Task 2), verified in tests + device step 6. ✓
- Recording wins / can't enter Activity mode while recording → `mapMode` precedence (Task 2) + list `onSelect` guard (Task 5). ✓
- Activity mode hides record button → `MapScreen` `{mode !== 'activity' && ...}` (Task 7). ✓
- Top chip + expandable sheet (collapsed summary / expanded record) → Tasks 7. ✓
- Track overlay: endpoints, no arrows, distinct color → optional arrows on port (Task 3) + `MapCanvas` activity branch (Task 6). ✓
- Camera fit → generalized `pendingFit` (Task 2) + activity-fit effect (Task 6). ✓
- Activities tab launcher list, newest-first, name/effort/stats/date, delete-with-confirm → Task 5 (+ formatters/badge Task 4). ✓
- Tap → select + navigate to map → Task 5. ✓
- "View linked trail" only when set AND exists → `ActivityInfoSheet` linkedTrail lookup (Task 7). ✓
- Delete clears the displayed activity → Task 5 `confirmDelete` + `useSelectedActivity` null-guard (Task 6). ✓
- Session-only `selectedActivityId` (not persisted) → Task 2 (partialize unchanged) + test. ✓
- Persistence seam: `deleteActivity` in `src/data/db` only → Task 1. ✓
- Future-proofing (independent overlay layers; sheet owns only the record; reserved above-sheet slot) → the chip, sheet, and overlay are separate siblings in `MapScreen`; the sheet contains only the record. ✓ (No graph/marker code — correctly out of scope.)

**Placeholder scan:** No TBD/TODO; every code step has concrete content. ✓

**Type consistency:** `mapMode`, `PendingFit`, `selectedActivityId`, `pendingFit`, `selectActivity`, `clearSelectedActivity`, `deleteActivity`, `removeActivity`, `formatActivityDate`, `formatActivitySummary`, `EffortBadge`, `ActivityListItem`, `useSelectedActivity`, `ActivityModeChip`, `ActivityInfoSheet` are used consistently across tasks. `MapCanvas` prop `activity: Activity | null` is added in Task 6 and supplied in Task 7 (the interim tsc break is called out explicitly). `TrackPoint[]` is structurally assignable to the geo helpers' `GpxPoint[]` param (both share `lat`/`lng`/`ele`), so no cast is needed. ✓
