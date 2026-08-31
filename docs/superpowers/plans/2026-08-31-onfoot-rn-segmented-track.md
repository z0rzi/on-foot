# Segmented Track (Real Breaks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make trails and activities a sequence of segments so that pausing a recording (or a real `<trkseg>` break in a GPX file) produces a genuine gap — not drawn as a bridge line, not counted toward distance/elevation — rendered as separate lines joined by a dashed connector.

**Architecture:** Geometry `{ points }` becomes `{ segments: Point[][] }` for both activities and trails. Distance/elevation are summed per segment (gap excluded structurally). Recording stamps each stored fix with a `segment` index driven by the session's `current_segment`, incremented on resume. Rendering computes per-segment lines + dashed connectors in shared provider-agnostic code; the rnmapbox adapter draws them as GeoJSON `MultiLineString`s (dashed via `lineDasharray`). Saved geometry JSON is upcast on read, so no destructive migration.

**Tech Stack:** React Native (Expo v57), TypeScript (strict), Zustand, drizzle-orm + expo-sqlite, @rnmapbox/maps, Jest (jest-expo preset).

## Global Constraints

- **Persistence seam:** only `src/data/db/*` imports expo-sqlite/drizzle. New durable state goes through the `ActivitiesRepository` port and its sqlite implementation. Persist the minimum.
- **Map-provider seam is inviolable:** only `src/map/providers/mapbox/` imports a map SDK. Segmentation is computed in shared code; the port is extended semantically (a line becomes one-or-more lines, plus a dashed connector line).
- **Pure logic is TDD'd; native rendering / GPS is device-verified.** Geometry helpers, metrics, grouping, serialization and session transforms get Jest tests written first.
- **No change-narrating comments.** Comments describe current state, not edits.
- **Test runner:** `npm test` (Jest). Type check: `npx tsc --noEmit`. Migrations: `npm run db:generate`.
- **Commit style:** Conventional Commits, lowercase, scoped (e.g. `feat(recording): …`, `refactor(map): …`), matching the repo's history.

---

## File Structure

**Pure logic (TDD):**
- `src/data/trails/gpx/metrics.ts` — add `metricsForSegments`.
- `src/map/geo.ts` — add `segmentLines`, `connectorLines`, `overallEndpoints`, `flattenSegments`.
- `src/data/activities/types.ts` — `ActivityGeometry` → segments; `RecordingSession.currentSegment`.
- `src/data/trails/types.ts` — `TrailGeometry` → segments.
- `src/data/activities/mapping.ts` — segment (de)serialize + upcast, `groupPointsBySegment`, `lastTrackPoint`, `activityMetricsFromSegments`, `buildNewActivityInput(segments)`, `pointsToInsertValues(+segment)`, `RecordingSessionRow.currentSegment`, `RecordingPointRow.segment`.
- `src/data/trails/mapping.ts` — segment (de)serialize + upcast.
- `src/data/trails/gpx/parse.ts` — return `segments`.
- `src/recording/session.ts` — `applyResume` increments `currentSegment`.
- `src/recording/recordingStore.ts` — `liveGeometry.segments`, `startSegment`.

**Persistence:**
- `src/data/db/schema.ts` — `recording_points.segment`, `recording_sessions.current_segment`.
- `src/data/db/migrations/*` — generated migration `0005`.
- `src/data/activities/repository.ts` + `src/data/db/activitiesRepository.ts` — `appendPoints(+segment)`, `getSessionSegments`, `markResumed(+currentSegment)`.

**Controllers / screens / UI:**
- `src/recording/recordingController.ts`, `src/recording/locationTask.ts` — segment plumbing.
- `app/activity/save.tsx`, `app/trail/new.tsx` — consume segments.
- `src/recording/RecordingInfoSheet.tsx` — live metrics from segments.

**Rendering seam:**
- `src/map/provider/types.ts`, `src/map/providers/mapbox/adapter.tsx` — MultiLineString + dashed connectors.
- `src/theme/tokens.ts` — `connectorDashArray`.
- `src/map/MapOverlays.tsx`, `src/map/MapCanvas.tsx` — segment rendering + bounds.
- `src/trails/TrailInfoSheet.tsx`, `src/map/offline/OfflineLayerChooser.tsx` — `flattenSegments` for offline bounds.

---

### Task 1: Segment metrics helper

**Files:**
- Modify: `src/data/trails/gpx/metrics.ts`
- Test: `src/data/trails/__tests__/metrics.test.ts`

**Interfaces:**
- Consumes: existing `computeMetrics(points: GpxPoint[]): TrailMetrics`, `haversineMeters`.
- Produces: `metricsForSegments(segments: GpxPoint[][]): TrailMetrics` — distance/gain/loss summed per segment; elevation is `null` only when no segment has elevation data.

- [ ] **Step 1: Write the failing test** — append to `src/data/trails/__tests__/metrics.test.ts` (add `metricsForSegments` to the import from `../gpx/metrics`):

```ts
describe('metricsForSegments', () => {
  const seg = (lngs: number[], eles: (number | null)[]): GpxPoint[] =>
    lngs.map((lng, i) => ({ lat: 0, lng, ele: eles[i] }))

  it('sums per-segment distance and excludes the gap between segments', () => {
    const a = seg([0, 0.001], [null, null])
    const b = seg([1, 1.001], [null, null]) // far away; gap must NOT be counted
    const twoSeg = metricsForSegments([a, b])
    const oneEach = computeMetrics(a).distanceMeters + computeMetrics(b).distanceMeters
    expect(twoSeg.distanceMeters).toBeCloseTo(oneEach, 6)
    // A single flat segment spanning the gap would be far larger:
    expect(computeMetrics([...a, ...b]).distanceMeters).toBeGreaterThan(twoSeg.distanceMeters * 10)
  })

  it('sums elevation gain/loss per segment', () => {
    const a = seg([0, 0.001], [100, 110]) // +10
    const b = seg([1, 1.001], [200, 190]) // -10
    const m = metricsForSegments([a, b])
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(10)
  })

  it('elevation is null only when no segment has elevation', () => {
    const flat = seg([0, 0.001], [null, null])
    expect(metricsForSegments([flat]).elevationGainMeters).toBeNull()
  })

  it('a single segment equals computeMetrics of that segment', () => {
    const a = seg([0, 0.001, 0.002], [100, 110, 105])
    expect(metricsForSegments([a])).toEqual(computeMetrics(a))
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- metrics.test.ts` → FAIL (`metricsForSegments is not a function`).

- [ ] **Step 3: Implement** — add to `src/data/trails/gpx/metrics.ts`:

```ts
export function metricsForSegments(segments: GpxPoint[][]): TrailMetrics {
  let distanceMeters = 0
  let gain = 0
  let loss = 0
  let hasElevation = false
  for (const segment of segments) {
    const m = computeMetrics(segment)
    distanceMeters += m.distanceMeters
    if (m.elevationGainMeters !== null) {
      hasElevation = true
      gain += m.elevationGainMeters
      loss += m.elevationLossMeters ?? 0
    }
  }
  return {
    distanceMeters,
    elevationGainMeters: hasElevation ? gain : null,
    elevationLossMeters: hasElevation ? loss : null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- metrics.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/trails/gpx/metrics.ts src/data/trails/__tests__/metrics.test.ts
git commit -m "feat(trails): add metricsForSegments (per-segment distance/elevation)"
```

---

### Task 2: Geo segment helpers

**Files:**
- Modify: `src/map/geo.ts`
- Test: `src/map/__tests__/geo.test.ts`

**Interfaces:**
- Consumes: existing `toLineCoordinates(points: GpxPoint[]): [number, number][]`.
- Produces:
  - `segmentLines(segments: GpxPoint[][]): [number, number][][]` — one `[lng,lat]` line per segment with ≥2 points; shorter segments dropped.
  - `connectorLines(segments: GpxPoint[][]): [number, number][][]` — for each adjacent pair of **non-empty** segments, the pair `[last(prev), first(cur)]`.
  - `overallEndpoints(segments: GpxPoint[][]): [number, number][]` — `[start, end]` (first point of first non-empty segment, last point of last non-empty); `[]` if all empty.
  - `flattenSegments<T>(segments: T[][]): T[]`.

- [ ] **Step 1: Write the failing test** — append to `src/map/__tests__/geo.test.ts` (add the four names to the import from `../geo`):

```ts
describe('segment helpers', () => {
  const segA = [p(1, 1), p(1, 2), p(1, 3)]
  const segB = [p(2, 5), p(2, 6)]

  test('segmentLines maps each ≥2-point segment to a line, drops shorter ones', () => {
    expect(segmentLines([segA, [p(9, 9)], segB])).toEqual([
      [[1, 1], [2, 1], [3, 1]],
      [[5, 2], [6, 2]],
    ])
  })
  test('connectorLines joins last-of-prev to first-of-next across non-empty segments', () => {
    expect(connectorLines([segA, segB])).toEqual([[[3, 1], [5, 2]]])
  })
  test('connectorLines is empty for a single segment', () => {
    expect(connectorLines([segA])).toEqual([])
  })
  test('connectorLines skips empty segments', () => {
    expect(connectorLines([segA, [], segB])).toEqual([[[3, 1], [5, 2]]])
  })
  test('overallEndpoints returns first-of-first and last-of-last non-empty', () => {
    expect(overallEndpoints([[], segA, segB])).toEqual([[1, 1], [6, 2]])
  })
  test('overallEndpoints of all-empty is empty', () => {
    expect(overallEndpoints([[], []])).toEqual([])
  })
  test('flattenSegments concatenates in order', () => {
    expect(flattenSegments([segA, segB])).toHaveLength(5)
  })
})
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -- geo.test.ts` → FAIL (functions undefined).

- [ ] **Step 3: Implement** — add to `src/map/geo.ts`:

```ts
export function segmentLines(segments: GpxPoint[][]): [number, number][][] {
  return segments.filter((s) => s.length >= 2).map(toLineCoordinates)
}

export function connectorLines(segments: GpxPoint[][]): [number, number][][] {
  const nonEmpty = segments.filter((s) => s.length > 0)
  const connectors: [number, number][][] = []
  for (let i = 1; i < nonEmpty.length; i++) {
    const prev = nonEmpty[i - 1]
    const cur = nonEmpty[i]
    const from = prev[prev.length - 1]
    const to = cur[0]
    connectors.push([[from.lng, from.lat], [to.lng, to.lat]])
  }
  return connectors
}

export function overallEndpoints(segments: GpxPoint[][]): [number, number][] {
  const nonEmpty = segments.filter((s) => s.length > 0)
  if (nonEmpty.length === 0) return []
  const first = nonEmpty[0][0]
  const lastSeg = nonEmpty[nonEmpty.length - 1]
  const last = lastSeg[lastSeg.length - 1]
  return [
    [first.lng, first.lat],
    [last.lng, last.lat],
  ]
}

export function flattenSegments<T>(segments: T[][]): T[] {
  return segments.flat()
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -- geo.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/geo.ts src/map/__tests__/geo.test.ts
git commit -m "feat(map): add segment line/connector/endpoint geo helpers"
```

---

### Task 3: Segment geometry model + mapping (activities & trails)

**Files:**
- Modify: `src/data/activities/types.ts`, `src/data/trails/types.ts`, `src/data/activities/mapping.ts`, `src/data/trails/mapping.ts`
- Test: `src/data/activities/__tests__/mapping.test.ts`, `src/data/trails/__tests__/mapping.test.ts`

**Interfaces:**
- Produces (activities):
  - `ActivityGeometry = { segments: TrackPoint[][] }`
  - `RecordingSession` gains `currentSegment: number`; `RecordingSessionRow` gains `currentSegment: number`; `RecordingPointRow`/`RecordingPointInsertValues` gain `segment: number`.
  - `deserializeActivityGeometry(json): { segments }` — upcasts legacy `{ points }` to one segment.
  - `groupPointsBySegment(rows: RecordingPointRow[]): TrackPoint[][]` — groups by `segment`, ascending; preserves row order within a segment.
  - `lastTrackPoint(segments: TrackPoint[][]): TrackPoint | null`.
  - `activityMetricsFromSegments(segments, startedAt, endedAt, pausedMs): ActivityMetrics`.
  - `buildNewActivityInput(session, segments: TrackPoint[][], form): NewActivityInput` → `geometry: { segments }`.
  - `pointsToInsertValues(sessionId, segment, points): RecordingPointInsertValues[]`.
  - `rowToSession` maps `currentSegment`.
- Produces (trails):
  - `TrailGeometry = { segments: GpxPoint[][]; waypoints: GpxWaypoint[] }`
  - `deserializeGeometry(json): { segments, waypoints }` — upcasts legacy `{ points }`.

- [ ] **Step 1: Write the failing tests.**

In `src/data/activities/__tests__/mapping.test.ts` — replace the `pts`-based geometry expectations with segment shapes. Change these blocks:

Replace `describe('activity geometry (de)serialize', …)` with:

```ts
const segs: TrackPoint[][] = [
  [{ lat: 0, lng: 0, ele: 100, t: 1000 }, { lat: 0, lng: 0.001, ele: 110, t: 4000 }],
  [{ lat: 0, lng: 0.5, ele: 105, t: 60000 }],
]

describe('activity geometry (de)serialize', () => {
  it('round-trips segments', () => {
    expect(deserializeActivityGeometry(serializeActivityGeometry({ segments: segs }))).toEqual({ segments: segs })
  })
  it('upcasts legacy { points } to a single segment', () => {
    expect(deserializeActivityGeometry(JSON.stringify({ points: pts }))).toEqual({ segments: [pts] })
  })
  it('legacy empty points -> no segments', () => {
    expect(deserializeActivityGeometry(JSON.stringify({ points: [] }))).toEqual({ segments: [] })
  })
  it('defaults missing geometry to { segments: [] }', () => {
    expect(deserializeActivityGeometry('{}')).toEqual({ segments: [] })
  })
})

describe('groupPointsBySegment', () => {
  it('groups rows by segment ascending, preserving order within a segment', () => {
    const rows = [
      { id: 1, sessionId: 1, lat: 0, lng: 0, ele: null, t: 10, segment: 0 },
      { id: 2, sessionId: 1, lat: 0, lng: 1, ele: null, t: 20, segment: 0 },
      { id: 3, sessionId: 1, lat: 0, lng: 2, ele: null, t: 30, segment: 1 },
    ]
    expect(groupPointsBySegment(rows)).toEqual([
      [{ lat: 0, lng: 0, ele: null, t: 10 }, { lat: 0, lng: 1, ele: null, t: 20 }],
      [{ lat: 0, lng: 2, ele: null, t: 30 }],
    ])
  })
})

describe('lastTrackPoint', () => {
  it('returns the last point of the last non-empty segment', () => {
    expect(lastTrackPoint(segs)).toEqual({ lat: 0, lng: 0.5, ele: 105, t: 60000 })
  })
  it('is null for no points', () => {
    expect(lastTrackPoint([])).toBeNull()
  })
})
```

Update the `rowToSession` describe to include `currentSegment`:

```ts
describe('rowToSession', () => {
  it('maps a recording session row including pause + segment fields', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 })
  })
  it('maps a paused session on a later segment', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2 })
  })
})
```

Replace the `activityMetricsFromPoints` describe with `activityMetricsFromSegments` (same numbers; one segment):

```ts
describe('activityMetricsFromSegments', () => {
  it('computes distance, moving duration, elevation over segments', () => {
    const m = activityMetricsFromSegments([pts], 1000, 7000, 2000)
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.durationSeconds).toBe(4)
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(5)
  })
  it('excludes the break leg between segments from distance', () => {
    const near = [{ lat: 0, lng: 0, ele: null, t: 0 }, { lat: 0, lng: 0.001, ele: null, t: 1000 }]
    const far = [{ lat: 0, lng: 1, ele: null, t: 2000 }, { lat: 0, lng: 1.001, ele: null, t: 3000 }]
    const twoSeg = activityMetricsFromSegments([near, far], 0, 3000, 0)
    const oneSeg = activityMetricsFromSegments([[...near, ...far]], 0, 3000, 0)
    expect(twoSeg.distanceMeters).toBeLessThan(oneSeg.distanceMeters)
  })
  it('never returns a negative duration', () => {
    expect(activityMetricsFromSegments([pts], 7000, 1000, 0).durationSeconds).toBe(0)
  })
})
```

Replace the `buildNewActivityInput` describe:

```ts
describe('buildNewActivityInput', () => {
  const session = { id: 9, startedAt: 1000, linkedTrailId: 42, pausedAt: 7000, pausedMs: 2000, currentSegment: 0 }
  const form = { name: 'Morning walk', effort: 'moderate' as const, comments: 'nice' }
  it('assembles the input; endedAt is the pause moment, geometry is segments', () => {
    const input = buildNewActivityInput(session, [pts], form)
    expect(input).toMatchObject({
      name: 'Morning walk', effort: 'moderate', comments: 'nice',
      linkedTrailId: 42, startedAt: 1000, endedAt: 7000,
      geometry: { segments: [pts] },
    })
    expect(input.metrics.durationSeconds).toBe(4)
  })
  it('falls back to the last point time when not paused', () => {
    const input = buildNewActivityInput({ ...session, pausedAt: null }, [pts], form)
    expect(input.endedAt).toBe(7000)
  })
})
```

Update the `inputToActivityValues / pointsToInsertValues` describe: change `geometry: { points: pts }` → `geometry: { segments: [pts] }`, the `JSON.parse(v.geometry)` expectation to `{ segments: [pts] }`, and the `pointsToInsertValues` call to include a segment:

```ts
  it('maps points to per-row insert values with segment', () => {
    expect(pointsToInsertValues(7, 2, [pts[0]])).toEqual([{ sessionId: 7, segment: 2, lat: 0, lng: 0, ele: 100, t: 1000 }])
  })
```

Update `rowToSummary / rowToActivity`: change the row's `geometry` to `JSON.stringify({ segments: [pts] })` and the `a.geometry` expectation to `{ segments: [pts] }`.

Update imports at the top of the file to add `activityMetricsFromSegments, groupPointsBySegment, lastTrackPoint` and drop `activityMetricsFromPoints`.

In `src/data/trails/__tests__/mapping.test.ts`:

```ts
test('geometry round-trips segments through JSON', () => {
  const g = { segments: [[{ lat: 1, lng: 2, ele: null }]], waypoints: [] }
  expect(deserializeGeometry(serializeGeometry(g))).toEqual(g)
})

test('deserializeGeometry upcasts legacy { points } to one segment', () => {
  expect(deserializeGeometry('{"points":[{"lat":1,"lng":2,"ele":10}],"waypoints":[]}'))
    .toEqual({ segments: [[{ lat: 1, lng: 2, ele: 10 }]], waypoints: [] })
})

test('deserializeGeometry defaults missing arrays to empty', () => {
  expect(deserializeGeometry('{}')).toEqual({ segments: [], waypoints: [] })
})
```

Update `ROW.geometry` to `'{"segments":[[{"lat":1,"lng":2,"ele":10}]],"waypoints":[]}'`; update the `rowToTrail` geometry expectation to `{ segments: [[{ lat: 1, lng: 2, ele: 10 }]], waypoints: [] }`; update `inputToInsertValues` test's `geometry: { points: [], waypoints: [] }` → `geometry: { segments: [], waypoints: [] }` and its expected serialized string to `'{"segments":[],"waypoints":[]}'`.

Two more test fixtures reference the changed shapes and must be updated in the same commit so `tsc` stays consistent (Jest itself would still pass):
- `src/store/__tests__/trailsStore.test.ts:24` — change `geometry: { points: [], waypoints: [] }` → `geometry: { segments: [], waypoints: [] }`.
- `src/recording/__tests__/resume.test.ts:3` — add `currentSegment: 0` to the `session` fixture literal.

- [ ] **Step 2: Run to verify it fails** — `npm test -- activities/__tests__/mapping.test.ts trails/__tests__/mapping.test.ts` → FAIL.

- [ ] **Step 3: Implement.**

`src/data/activities/types.ts`:

```ts
export interface ActivityGeometry { segments: TrackPoint[][] }
```

and add `currentSegment: number` to `RecordingSession`:

```ts
export interface RecordingSession {
  id: number
  startedAt: number
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
  currentSegment: number
}
```

`src/data/trails/types.ts`:

```ts
export interface TrailGeometry { segments: GpxPoint[][]; waypoints: GpxWaypoint[] }
```

`src/data/activities/mapping.ts` — apply these edits:

- Import: `import { computeMetrics, metricsForSegments } from '../trails/gpx/metrics'` (keep `movingDurationMs`).
- `RecordingSessionRow`: add `currentSegment: number`.
- `RecordingPointRow` and `RecordingPointInsertValues`: add `segment: number`.
- Serialize/deserialize:

```ts
export function serializeActivityGeometry(geometry: ActivityGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeActivityGeometry(json: string): ActivityGeometry {
  const parsed = JSON.parse(json) as { segments?: TrackPoint[][]; points?: TrackPoint[] }
  if (parsed.segments) return { segments: parsed.segments }
  if (parsed.points) return { segments: parsed.points.length ? [parsed.points] : [] }
  return { segments: [] }
}
```

- `rowToSession`: add `currentSegment: row.currentSegment` to the returned object.
- Add grouping + last-point helpers:

```ts
export function groupPointsBySegment(rows: RecordingPointRow[]): TrackPoint[][] {
  const bySegment = new Map<number, TrackPoint[]>()
  for (const row of rows) {
    const list = bySegment.get(row.segment) ?? []
    list.push(rowToTrackPoint(row))
    bySegment.set(row.segment, list)
  }
  return [...bySegment.keys()].sort((a, b) => a - b).map((k) => bySegment.get(k)!)
}

export function lastTrackPoint(segments: TrackPoint[][]): TrackPoint | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    if (seg.length > 0) return seg[seg.length - 1]
  }
  return null
}
```

- Replace `activityMetricsFromPoints` with `activityMetricsFromSegments`:

```ts
export function activityMetricsFromSegments(
  segments: TrackPoint[][],
  startedAt: number,
  endedAt: number,
  pausedMs: number,
): ActivityMetrics {
  const m = metricsForSegments(segments)
  return {
    distanceMeters: m.distanceMeters,
    durationSeconds: Math.round(movingDurationMs(startedAt, endedAt, pausedMs) / 1000),
    elevationGainMeters: m.elevationGainMeters,
    elevationLossMeters: m.elevationLossMeters,
  }
}
```

- Replace `buildNewActivityInput`:

```ts
export function buildNewActivityInput(
  session: RecordingSession,
  segments: TrackPoint[][],
  form: ActivityFormFields,
): NewActivityInput {
  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  return {
    name: form.name,
    effort: form.effort,
    comments: form.comments,
    linkedTrailId: session.linkedTrailId,
    geometry: { segments },
    metrics: activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs),
    startedAt: session.startedAt,
    endedAt,
  }
}
```

- Replace `pointsToInsertValues`:

```ts
export function pointsToInsertValues(
  sessionId: number,
  segment: number,
  points: TrackPoint[],
): RecordingPointInsertValues[] {
  return points.map((p) => ({ sessionId, segment, lat: p.lat, lng: p.lng, ele: p.ele, t: p.t }))
}
```

(Keep the now-unused `computeMetrics` import out — only `metricsForSegments` and `movingDurationMs` are used.)

`src/data/trails/mapping.ts` — replace serialize/deserialize:

```ts
export function serializeGeometry(geometry: TrailGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeGeometry(json: string): TrailGeometry {
  const parsed = JSON.parse(json) as {
    segments?: GpxPoint[][]; points?: GpxPoint[]; waypoints?: GpxWaypoint[]
  }
  const segments = parsed.segments ?? (parsed.points?.length ? [parsed.points] : [])
  return { segments, waypoints: parsed.waypoints ?? [] }
}
```

Add `import { GpxPoint, GpxWaypoint } from '../types'` if not already importing those names (they come via `TrailGeometry`; import explicitly for the cast).

- [ ] **Step 4: Run to verify it passes** — `npm test -- activities/__tests__/mapping.test.ts trails/__tests__/mapping.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/activities/types.ts src/data/trails/types.ts src/data/activities/mapping.ts src/data/trails/mapping.ts src/data/activities/__tests__/mapping.test.ts src/data/trails/__tests__/mapping.test.ts src/store/__tests__/trailsStore.test.ts src/recording/__tests__/resume.test.ts
git commit -m "feat(data): model activity/trail geometry as segments with legacy upcast"
```

---

### Task 4: GPX parse → segments

**Files:**
- Modify: `src/data/trails/gpx/parse.ts`, `app/trail/new.tsx`
- Test: `src/data/trails/__tests__/parse.test.ts`

**Interfaces:**
- Produces: `GpxParseResult = { segments: GpxPoint[][]; waypoints; title }` — one segment per `<trkseg>`, or one per `<rte>` when routes exist; empty segments dropped.
- Consumes (in `new.tsx`): `metricsForSegments` (Task 1), `TrailGeometry.segments` (Task 3).

- [ ] **Step 1: Write the failing test** — edit `src/data/trails/__tests__/parse.test.ts`: change `r.points` expectations to `r.segments`. Specifically:

```ts
test('track: segments, elevation, waypoints, and track-name title', () => {
  const r = parseGpx(TRACK)
  expect(r.segments).toEqual([[
    { lat: 1.0, lng: 2.0, ele: 100 },
    { lat: 1.1, lng: 2.1, ele: 110 },
  ]])
  expect(r.waypoints).toEqual([{ lat: 1.0, lng: 2.0, ele: null, name: 'WP', description: 'hi' }])
  expect(r.title).toBe('Track Name')
})

test('route points win over track points; one segment per route', () => {
  expect(parseGpx(ROUTE_AND_TRACK).segments).toEqual([[
    { lat: 5.0, lng: 6.0, ele: null },
    { lat: 5.1, lng: 6.1, ele: null },
  ]])
})

test('namespace prefixes are stripped from tags', () => {
  const r = parseGpx(NAMESPACED)
  expect(r.segments).toEqual([[{ lat: 3.0, lng: 4.0, ele: 50 }]])
  expect(r.title).toBe('NS Track')
})

test('each track segment is its own segment, in document order', () => {
  expect(parseGpx(MULTI_SEG).segments).toEqual([
    [{ lat: 1.0, lng: 1.0, ele: null }, { lat: 2.0, lng: 2.0, ele: null }],
    [{ lat: 3.0, lng: 3.0, ele: null }],
  ])
})

test('each route is its own segment, in document order, winning over tracks', () => {
  expect(parseGpx(MULTI_RTE).segments).toEqual([
    [{ lat: 1.0, lng: 1.0, ele: null }, { lat: 2.0, lng: 2.0, ele: null }],
    [{ lat: 3.0, lng: 3.0, ele: null }],
  ])
})
```

(Leave the title-fallback and missing-lat tests unchanged.)

- [ ] **Step 2: Run to verify it fails** — `npm test -- parse.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `src/data/trails/gpx/parse.ts` change the result type and point extraction:

```ts
export interface GpxParseResult {
  segments: GpxPoint[][]
  waypoints: GpxWaypoint[]
  title: string | null
}
```

```ts
  const routes = asArray(gpx.rte)
  const segments: GpxPoint[][] =
    routes.length > 0
      ? routes.map((rte: any) => asArray(rte.rtept).map(toPoint))
      : asArray(gpx.trk).flatMap((trk: any) =>
          asArray(trk.trkseg).map((seg: any) => asArray(seg.trkpt).map(toPoint)),
        )
  const nonEmpty = segments.filter((s) => s.length > 0)
```

and `return { segments: nonEmpty, waypoints, title }`.

Then update `app/trail/new.tsx`:
- import `metricsForSegments` instead of `computeMetrics`.
- `setGeometry({ segments: parsed.segments, waypoints: parsed.waypoints })`
- `setMetrics(metricsForSegments(parsed.segments))`

- [ ] **Step 4: Run to verify it passes** — `npm test -- parse.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/trails/gpx/parse.ts app/trail/new.tsx src/data/trails/__tests__/parse.test.ts
git commit -m "feat(trails): parse each GPX trkseg/rte as its own segment"
```

---

### Task 5: Session resume opens the next segment

**Files:**
- Modify: `src/recording/session.ts`
- Test: `src/recording/__tests__/session.test.ts`

**Interfaces:**
- Consumes: `RecordingSession.currentSegment` (Task 3).
- Produces: `applyResume(session, now)` returns `{ ..., currentSegment: session.currentSegment + 1 }`.

- [ ] **Step 1: Write the failing test** — update `src/recording/__tests__/session.test.ts`: add `currentSegment: 0` to `base`, and assert the increment:

```ts
const base: RecordingSession = { id: 1, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 }
```

```ts
describe('applyResume', () => {
  it('accumulates the just-ended pause into pausedMs, clears pausedAt, opens next segment', () => {
    expect(applyResume({ ...base, pausedAt: 5000, pausedMs: 1000 }, 8000)).toEqual({
      ...base,
      pausedAt: null,
      pausedMs: 4000,
      currentSegment: 1,
    })
  })
  it('increments the segment on each resume across cycles', () => {
    const afterFirst = applyResume({ ...base, pausedAt: 3000 }, 4000) // seg 1
    const paused2 = applyPause(afterFirst, 9000)
    expect(applyResume(paused2, 11000)).toEqual({ ...base, pausedAt: null, pausedMs: 3000, currentSegment: 2 })
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- session.test.ts` → FAIL.

- [ ] **Step 3: Implement** — in `src/recording/session.ts`:

```ts
export function applyResume(session: RecordingSession, now: number): RecordingSession {
  return {
    ...session,
    pausedAt: null,
    pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
    currentSegment: session.currentSegment + 1,
  }
}
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- session.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/recording/session.ts src/recording/__tests__/session.test.ts
git commit -m "feat(recording): open a new segment on resume"
```

---

### Task 6: Recording store holds live segments

**Files:**
- Modify: `src/recording/recordingStore.ts`
- Test: `src/recording/__tests__/recordingStore.test.ts`

**Interfaces:**
- Produces:
  - `liveGeometry: { segments: TrackPoint[][] }`
  - `beginSession(session)` → `{ segments: [[]] }` (one open segment)
  - `appendLivePoints(points)` → append into the last segment (no-op on `[]`, same reference)
  - `startSegment()` → push a new empty segment
  - `hydrate(session, segments: TrackPoint[][])`
- Consumes: `RecordingSession.currentSegment` in the test fixtures (Task 3).

- [ ] **Step 1: Write the failing test** — update `src/recording/__tests__/recordingStore.test.ts`:
  - Add `currentSegment: 0` to `recordingSession` and `currentSegment: 1` to `pausedSession`.
  - `beforeEach`: `useRecordingStore.setState({ session: null, liveGeometry: { segments: [] } })`.
  - Rewrite the geometry assertions:

```ts
  it('beginSession sets the session (recording) + one open empty segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[]])
  })
  it('hydrate loads a session + its segments', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1), p(2)]])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1), p(2)]])
  })
  it('setSession replaces the session without touching geometry', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1)]])
    useRecordingStore.getState().setSession(pausedSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('paused')
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1)]])
  })
  it('appendLivePoints appends into the last segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints([p(1), p(2)])
    useRecordingStore.getState().appendLivePoints([p(3)])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1), p(2), p(3)]])
  })
  it('startSegment then appendLivePoints writes into the new segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints([p(1)])
    useRecordingStore.getState().startSegment()
    useRecordingStore.getState().appendLivePoints([p(2)])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1)], [p(2)]])
  })
  it('appendLivePoints with [] is a no-op (same reference)', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    const before = useRecordingStore.getState().liveGeometry
    useRecordingStore.getState().appendLivePoints([])
    expect(useRecordingStore.getState().liveGeometry).toBe(before)
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1)]])
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().session).toBeNull()
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([])
  })
```

- [ ] **Step 2: Run to verify it fails** — `npm test -- recordingStore.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `src/recording/recordingStore.ts`:

```ts
const EMPTY_GEOMETRY: ActivityGeometry = { segments: [] }

interface RecordingStore {
  session: RecordingSession | null
  liveGeometry: ActivityGeometry
  beginSession: (session: RecordingSession) => void
  hydrate: (session: RecordingSession, segments: TrackPoint[][]) => void
  setSession: (session: RecordingSession) => void
  appendLivePoints: (points: TrackPoint[]) => void
  startSegment: () => void
  reset: () => void
}

export const useRecordingStore = create<RecordingStore>((set) => ({
  session: null,
  liveGeometry: EMPTY_GEOMETRY,
  beginSession: (session) => set({ session, liveGeometry: { segments: [[]] } }),
  hydrate: (session, segments) => set({ session, liveGeometry: { segments } }),
  setSession: (session) => set({ session }),
  appendLivePoints: (points) =>
    set((s) => {
      if (points.length === 0) return {}
      const segments = s.liveGeometry.segments
      const last = segments.length > 0 ? segments[segments.length - 1] : []
      const head = segments.length > 0 ? segments.slice(0, -1) : []
      return { liveGeometry: { segments: [...head, [...last, ...points]] } }
    }),
  startSegment: () => set((s) => ({ liveGeometry: { segments: [...s.liveGeometry.segments, []] } })),
  reset: () => set({ session: null, liveGeometry: EMPTY_GEOMETRY }),
}))
```

- [ ] **Step 4: Run to verify it passes** — `npm test -- recordingStore.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/recording/recordingStore.ts src/recording/__tests__/recordingStore.test.ts
git commit -m "feat(recording): hold live geometry as segments + startSegment"
```

---

### Task 7: DB schema + migration 0005

**Files:**
- Modify: `src/data/db/schema.ts`
- Generate: `src/data/db/migrations/0005_*.sql`, `.../meta/_journal.json`, `.../migrations.js`

**Interfaces:**
- Produces: `recording_points.segment` (`INTEGER NOT NULL DEFAULT 0`), `recording_sessions.current_segment` (`INTEGER NOT NULL DEFAULT 0`).

- [ ] **Step 1: Edit the schema** — in `src/data/db/schema.ts`, add to `recordingSessions` (after `pausedMs`):

```ts
    currentSegment: integer('current_segment').notNull().default(0),
```

and add to `recordingPoints` (after `t`):

```ts
  segment: integer('segment').notNull().default(0),
```

- [ ] **Step 2: Generate the migration**

Run: `npm run db:generate`
Expected: creates `src/data/db/migrations/0005_*.sql` with two `ALTER TABLE … ADD … integer DEFAULT 0 NOT NULL` statements, appends an entry to `meta/_journal.json`, and adds `m0005` to `migrations.js`.

- [ ] **Step 3: Verify the generated SQL** — open the new `0005_*.sql`; confirm it contains exactly the two additive `ALTER TABLE` statements (`recording_sessions` → `current_segment`, `recording_points` → `segment`) and no `DROP`/`CREATE TABLE`. Confirm `migrations.js` imports and lists `m0005`.

- [ ] **Step 4: Run the suite** — `npm test` → PASS (no test asserts on migrations; this confirms nothing else broke from the schema import).

- [ ] **Step 5: Commit**

```bash
git add src/data/db/schema.ts src/data/db/migrations/
git commit -m "feat(db): add segment columns for segmented recording (migration 0005)"
```

---

### Task 8: Recording repository — segment-aware append & read

**Files:**
- Modify: `src/data/activities/repository.ts`, `src/data/db/activitiesRepository.ts`

**Interfaces:**
- Produces (port):
  - `appendPoints(sessionId: number, segment: number, points: TrackPoint[]): Promise<void>`
  - `getSessionSegments(sessionId: number): Promise<TrackPoint[][]>` (replaces `getSessionPoints`)
  - `markResumed(sessionId: number, pausedMs: number, currentSegment: number): Promise<void>`
- Consumes: `groupPointsBySegment`, `pointsToInsertValues(sessionId, segment, points)` (Task 3); `recordingPoints.segment`, `recordingSessions.currentSegment` (Task 7).

- [ ] **Step 1: Update the port** — `src/data/activities/repository.ts`:

```ts
  appendPoints(sessionId: number, segment: number, points: TrackPoint[]): Promise<void>
  getSessionSegments(sessionId: number): Promise<TrackPoint[][]>
  ...
  markResumed(sessionId: number, pausedMs: number, currentSegment: number): Promise<void>
```

- [ ] **Step 2: Update the sqlite implementation** — `src/data/db/activitiesRepository.ts`:

```ts
  async appendPoints(sessionId, segment, points) {
    if (points.length === 0) return
    await db.insert(recordingPoints).values(pointsToInsertValues(sessionId, segment, points))
  },
  async getSessionSegments(sessionId) {
    const rows = await db
      .select()
      .from(recordingPoints)
      .where(eq(recordingPoints.sessionId, sessionId))
      .orderBy(asc(recordingPoints.segment), asc(recordingPoints.t), asc(recordingPoints.id))
    return groupPointsBySegment(rows as RecordingPointRow[])
  },
  ...
  async markResumed(sessionId, pausedMs, currentSegment) {
    await db.update(recordingSessions)
      .set({ pausedAt: null, pausedMs, currentSegment })
      .where(eq(recordingSessions.id, sessionId))
  },
```

Update the imports from `../activities/mapping` to add `groupPointsBySegment` and drop `rowToTrackPoint` if it becomes unused (it is used inside `groupPointsBySegment` now, not here).

- [ ] **Step 3: Run the suite** — `npm test` → PASS (repository has no unit test; the store/mapping tests confirm the shared helpers). This step verifies nothing else regressed.

- [ ] **Step 4: Typecheck the data layer** — `npx tsc --noEmit` will still report errors in not-yet-updated callers (controllers, save screen); confirm the only errors are in `recordingController.ts`, `locationTask.ts`, `app/activity/save.tsx` (fixed in Tasks 9–10), not in `src/data/db/*` or `src/data/activities/*`.

- [ ] **Step 5: Commit**

```bash
git add src/data/activities/repository.ts src/data/db/activitiesRepository.ts
git commit -m "feat(recording): persist and read points grouped by segment"
```

---

### Task 9: Controllers & location task — segment plumbing

**Files:**
- Modify: `src/recording/recordingController.ts`, `src/recording/locationTask.ts`

**Interfaces:**
- Consumes: `appendPoints(sessionId, segment, points)`, `getSessionSegments`, `markResumed(id, pausedMs, currentSegment)` (Task 8); `startSegment`, `hydrate(session, segments)` (Task 6); `applyResume` (Task 5).

- [ ] **Step 1: Update `startRecording`** — the initial `beginSession` literal gains `currentSegment: 0`:

```ts
  useRecordingStore.getState().beginSession({ id: sessionId, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 })
```

- [ ] **Step 2: Update `resumeRecording`** — persist the new segment and open it in the store:

```ts
export async function resumeRecording(): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt == null) return
  const next = applyResume(session, Date.now())
  await activitiesRepository.markResumed(session.id, next.pausedMs, next.currentSegment)
  useRecordingStore.getState().setSession(next)
  useRecordingStore.getState().startSegment()
  if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
    await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
  }
}
```

- [ ] **Step 3: Update `resumeIfActive`** — hydrate from segments and append the immediate fix into the current segment:

```ts
  if (action === 'resume' && session) {
    const segments = await activitiesRepository.getSessionSegments(session.id)
    useRecordingStore.getState().hydrate(session, segments)
    if (!(await Location.hasStartedLocationUpdatesAsync(RECORDING_TASK))) {
      await Location.startLocationUpdatesAsync(RECORDING_TASK, RECORDING_OPTIONS)
    }
    try {
      const now = await Location.getCurrentPositionAsync({ accuracy: RECORDING_OPTIONS.accuracy })
      const point = toTrackPoint(now)
      await activitiesRepository.appendPoints(session.id, session.currentSegment, [point])
      useRecordingStore.getState().appendLivePoints([point])
    } catch {
      // No immediate fix available; the next background batch will connect the gap.
    }
  } else if (action === 'paused' && session) {
    const segments = await activitiesRepository.getSessionSegments(session.id)
    useRecordingStore.getState().hydrate(session, segments)
  }
```

- [ ] **Step 4: Update `locationTask.ts`** — stamp the active session's current segment:

```ts
  const points = locations.map(toTrackPoint)
  await activitiesRepository.appendPoints(session.id, session.currentSegment, points)
  useRecordingStore.getState().appendLivePoints(points)
```

- [ ] **Step 5: Run the suite + commit** — `npm test` → PASS. Then:

```bash
git add src/recording/recordingController.ts src/recording/locationTask.ts
git commit -m "feat(recording): stamp fixes with current segment; open segment on resume"
```

---

### Task 10: Save screen consumes segments

**Files:**
- Modify: `app/activity/save.tsx`

**Interfaces:**
- Consumes: `getSessionSegments` (Task 8); `activityMetricsFromSegments`, `buildNewActivityInput(session, segments, form)`, `lastTrackPoint` (Task 3).

- [ ] **Step 1: Update state + load** — change the points state to segments:

```ts
  const [segments, setSegments] = useState<TrackPoint[][]>([])
  ...
      const loadedSegments = await activitiesRepository.getSessionSegments(loaded.id)
      if (!active) return
      setSession(loaded)
      setSegments(loadedSegments)
      setLoading(false)
```

- [ ] **Step 2: Update metrics + save**:

```ts
  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  const metrics = activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs)
```

and in `onSave`:

```ts
        await saveActivity(session.id, buildNewActivityInput(session, segments, { name, effort, comments }))
```

Update the import line to `import { activityMetricsFromSegments, buildNewActivityInput, lastTrackPoint } from '../../src/data/activities/mapping'`.

- [ ] **Step 3: Run the suite** — `npm test` → PASS (no screen test; confirms no shared regression).

- [ ] **Step 4: Commit**

```bash
git add app/activity/save.tsx
git commit -m "feat(recording): build saved activity from segments"
```

---

### Task 11: Live stats sheet from segments

**Files:**
- Modify: `src/recording/RecordingInfoSheet.tsx`

**Interfaces:**
- Consumes: `metricsForSegments` (Task 1); `liveGeometry.segments` (Task 6).

- [ ] **Step 1: Update the metric source**:

```ts
  const segments = useRecordingStore((s) => s.liveGeometry.segments)
  ...
  const metrics = metricsForSegments(segments)
```

Change the import from `computeMetrics` to `metricsForSegments` (keep `formatDistance, formatElevation`): `import { metricsForSegments, formatDistance, formatElevation } from '../data/trails/gpx/metrics'`.

- [ ] **Step 2: Run the suite** — `npm test` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/recording/RecordingInfoSheet.tsx
git commit -m "feat(recording): live distance/elevation exclude break legs"
```

---

### Task 12: Provider port + rnmapbox adapter — MultiLineString & dashed connectors

**Files:**
- Modify: `src/map/provider/types.ts`, `src/map/providers/mapbox/adapter.tsx`, `src/theme/tokens.ts`

**Interfaces:**
- Produces (port):
  - `TrailOverlayProps`: `line` → `lines: [number, number][][]`; add `connectors: [number, number][][]` and `connectorDashArray: number[]`.
  - `RouteLineProps`: `line` → `lines: [number, number][][]`; add `connectors: [number, number][][]` and `connectorDashArray: number[]`.
- Produces (tokens): `MapTokens.connectorDashArray: number[]`.

- [ ] **Step 1: Add the token** — in `src/theme/tokens.ts`, add near the line-width tokens:

```ts
  connectorDashArray: [2, 2],
```

- [ ] **Step 2: Update the port types** — `src/map/provider/types.ts`:

```ts
export interface TrailOverlayProps {
  // Track segments as a MultiLineString: each entry is one segment's [lng, lat] pairs, in order.
  lines: [number, number][][]
  // Dashed connectors bridging consecutive segment endpoints; carry no distance.
  connectors: [number, number][][]
  connectorDashArray: number[]
  // [start, end] as [lng, lat]; drawn as dot markers.
  endpoints: [number, number][]
  color: string
  lineWidth: number
  arrowImage?: number
  arrowSpacing?: number
  arrowSize?: number
  endpointRadius: number
  endpointStrokeColor: string
  endpointStrokeWidth: number
}

export interface RouteLineProps {
  lines: [number, number][][]
  connectors: [number, number][][]
  connectorDashArray: number[]
  color: string
  lineWidth: number
}
```

- [ ] **Step 3: Update the adapter** — `src/map/providers/mapbox/adapter.tsx`. Add a small helper and rewrite both components. Above the components:

```ts
const multiLine = (lines: [number, number][][]) => ({
  type: 'Feature' as const,
  geometry: { type: 'MultiLineString' as const, coordinates: lines },
  properties: {},
})
```

Rewrite `TrailOverlay` — the solid layer becomes a MultiLineString and a dashed connector source is added; endpoints/arrows unchanged:

```tsx
const TrailOverlay = ({
  lines, connectors, connectorDashArray, endpoints, color, lineWidth, arrowImage, arrowSpacing, arrowSize,
  endpointRadius, endpointStrokeColor, endpointStrokeWidth,
}: TrailOverlayProps) => {
  const endpointShape = {
    type: 'FeatureCollection' as const,
    features: endpoints.map((coord) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: coord },
      properties: {},
    })),
  }
  const lineChildren = [
    <Mapbox.LineLayer
      key="line"
      id="trail-line"
      style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
    />,
    arrowImage != null ? (
      <Mapbox.SymbolLayer
        key="arrows"
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
    ) : null,
  ].filter((el): el is React.ReactElement => el != null)
  return (
    <>
      {arrowImage != null && <Mapbox.Images images={{ 'trail-arrow': arrowImage }} />}
      {lines.length > 0 && (
        <Mapbox.ShapeSource id="trail-line-source" shape={multiLine(lines)}>
          {lineChildren}
        </Mapbox.ShapeSource>
      )}
      {connectors.length > 0 && (
        <Mapbox.ShapeSource id="trail-connector-source" shape={multiLine(connectors)}>
          <Mapbox.LineLayer
            id="trail-connector"
            style={{ lineColor: color, lineWidth, lineDasharray: connectorDashArray, lineCap: 'round' }}
          />
        </Mapbox.ShapeSource>
      )}
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

Rewrite `RouteLine`:

```tsx
const RouteLine = ({ lines, connectors, connectorDashArray, color, lineWidth }: RouteLineProps) => (
  <>
    {lines.length > 0 && (
      <Mapbox.ShapeSource id="route-line-source" shape={multiLine(lines)}>
        <Mapbox.LineLayer
          id="route-line"
          style={{ lineColor: color, lineWidth, lineCap: 'round', lineJoin: 'round' }}
        />
      </Mapbox.ShapeSource>
    )}
    {connectors.length > 0 && (
      <Mapbox.ShapeSource id="route-connector-source" shape={multiLine(connectors)}>
        <Mapbox.LineLayer
          id="route-connector"
          style={{ lineColor: color, lineWidth, lineDasharray: connectorDashArray, lineCap: 'round' }}
        />
      </Mapbox.ShapeSource>
    )}
  </>
)
```

- [ ] **Step 4: Run the suite** — `npm test` → PASS (tokens test in `theme/__tests__/tokens.test.ts` may enumerate keys; if it asserts an exact key set, add `connectorDashArray` there). If it fails, update that test to include the new token, then re-run.

- [ ] **Step 5: Commit**

```bash
git add src/map/provider/types.ts src/map/providers/mapbox/adapter.tsx src/theme/tokens.ts src/theme/__tests__/tokens.test.ts
git commit -m "feat(map): render segmented tracks as MultiLineString with dashed connectors"
```

---

### Task 13: Wire segment rendering + flatten-for-bounds across consumers

**Files:**
- Modify: `src/map/MapOverlays.tsx`, `src/map/MapCanvas.tsx`, `src/trails/TrailInfoSheet.tsx`, `src/map/offline/OfflineLayerChooser.tsx`

**Interfaces:**
- Consumes: `segmentLines`, `connectorLines`, `overallEndpoints`, `flattenSegments` (Task 2); new `TrailOverlay`/`RouteLine` props + `MapTokens.connectorDashArray` (Task 12); `geometry.segments`, `liveGeometry.segments` (Tasks 3, 6).

- [ ] **Step 1: Update `MapOverlays.tsx`** — change `OverlayRoute` and the render:

```tsx
import { segmentLines, connectorLines, overallEndpoints } from './geo'
import type { GpxPoint } from '../data/trails/types'
import type { TrackPoint } from '../data/activities/types'

export type OverlayRoute = { segments: GpxPoint[][]; kind: 'trail' | 'activity' }

export function MapOverlays({
  route,
  liveSegments,
  showLiveTrack,
}: {
  route: OverlayRoute | null
  liveSegments: TrackPoint[][]
  showLiveTrack: boolean
}) {
  const { components } = useMapProvider()
  const c = useTheme()
  const { TrailOverlay, RouteLine } = components

  const routeSegments = route?.segments ?? null
  const routeKind = route?.kind ?? null
  const routeLines = useMemo(() => (routeSegments ? segmentLines(routeSegments) : null), [routeSegments])
  const routeConnectors = useMemo(() => (routeSegments ? connectorLines(routeSegments) : null), [routeSegments])
  const routeEndpoints = useMemo(() => (routeSegments ? overallEndpoints(routeSegments) : null), [routeSegments])
  const liveLines = useMemo(() => segmentLines(liveSegments), [liveSegments])
  const liveConnectors = useMemo(() => connectorLines(liveSegments), [liveSegments])

  return (
    <>
      {routeLines && routeConnectors && routeEndpoints && routeLines.length > 0 &&
        (routeKind === 'activity' ? (
          <TrailOverlay
            lines={routeLines}
            connectors={routeConnectors}
            connectorDashArray={MapTokens.connectorDashArray}
            endpoints={routeEndpoints}
            color={c.activityLine}
            lineWidth={MapTokens.trailLineWidth}
            endpointRadius={MapTokens.endpointRadius}
            endpointStrokeColor={c.trailEndpointStroke}
            endpointStrokeWidth={MapTokens.endpointStrokeWidth}
          />
        ) : (
          <TrailOverlay
            lines={routeLines}
            connectors={routeConnectors}
            connectorDashArray={MapTokens.connectorDashArray}
            endpoints={routeEndpoints}
            color={c.trailLine}
            lineWidth={MapTokens.trailLineWidth}
            arrowImage={trailArrow}
            arrowSpacing={MapTokens.arrowSpacing}
            arrowSize={MapTokens.arrowSize}
            endpointRadius={MapTokens.endpointRadius}
            endpointStrokeColor={c.trailEndpointStroke}
            endpointStrokeWidth={MapTokens.endpointStrokeWidth}
          />
        ))}
      {showLiveTrack && (
        <RouteLine
          lines={liveLines}
          connectors={liveConnectors}
          connectorDashArray={MapTokens.connectorDashArray}
          color={c.recordingLine}
          lineWidth={MapTokens.recordingLineWidth}
        />
      )}
    </>
  )
}
```

- [ ] **Step 2: Update `MapCanvas.tsx`** — read segments, flatten for gates/bounds, pass live segments:

```tsx
import { boundsForPoints, flattenSegments } from './geo'
...
  const segments = trail?.geometry.segments ?? []
  const hasTrail = flattenSegments(segments).length >= 2

  const activitySegments = activity?.geometry.segments ?? []
  const hasActivity = flattenSegments(activitySegments).length >= 2

  const recording = useRecordingStore((s) => recordingPhase(s.session) === 'recording')
  const liveSegments = useRecordingStore((s) => s.liveGeometry.segments)
  const showLiveTrack = recording && flattenSegments(liveSegments).length >= 2

  const route: OverlayRoute | null = hasActivity
    ? { segments: activitySegments, kind: 'activity' }
    : hasTrail
      ? { segments, kind: 'trail' }
      : null
```

In the two fit-bounds effects, replace `trail.geometry.points` / `activity.geometry.points` with the flattened form:

```tsx
    const flat = flattenSegments(trail.geometry.segments)
    if (flat.length < 2) return
    const bounds = boundsForPoints(flat)
```

(and the analogous `activity` effect using `flattenSegments(activity.geometry.segments)`).

Finally, pass `liveSegments` to `MapOverlays`:

```tsx
      <MapOverlays route={route} liveSegments={liveSegments} showLiveTrack={showLiveTrack} />
```

- [ ] **Step 3: Update offline-bounds callers** — in `src/trails/TrailInfoSheet.tsx` and `src/map/offline/OfflineLayerChooser.tsx`, import `flattenSegments` from `../map/geo` / `../geo` respectively and change:

```ts
boundsForTrail(flattenSegments(trail.geometry.segments), OFFLINE_MARGIN_KM)
```

- [ ] **Step 4: Run the suite** — `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/map/MapOverlays.tsx src/map/MapCanvas.tsx src/trails/TrailInfoSheet.tsx src/map/offline/OfflineLayerChooser.tsx
git commit -m "feat(map): draw segmented routes + live track; flatten segments for bounds"
```

---

### Task 14: Full typecheck, suite, and device verification

**Files:** none (verification only).

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` → no errors. Fix any residual references to `.points`/`getSessionPoints`/`activityMetricsFromPoints` the earlier tasks missed (search: `grep -rn "geometry.points\|getSessionPoints\|activityMetricsFromPoints\|liveGeometry.points" src app`). Commit any fixes with `fix(recording): …`.

- [ ] **Step 2: Full test suite** — `npm test` → all green.

- [ ] **Step 3: Device-verify** (physical device / emulator with GPS; the map + GPS are not unit-tested):
  - Record, pause a while, walk elsewhere, resume: the map shows two separate lines joined by a **dashed connector** (no solid bridge); **Distance** does not include the break leg.
  - Multiple pause/resume cycles → multiple segments + connectors.
  - Save the activity, reopen from the list → same segments/connector; saved distance matches the live value.
  - Import a GPX with multiple `<trkseg>` → the trail renders with gaps at the real breaks; distance excludes them; arrows still render.
  - A legacy (pre-migration) trail and activity still render as a single line with unchanged distance (upcast path).
  - Kill the app mid-recording, relaunch → the live track rehydrates as segments and recording continues.

- [ ] **Step 4: Finish the branch** — hand off to `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage:**
- Model (`segments` for activity & trail) → Task 3. ✓
- Read-time upcast, no destructive geometry migration → Task 3 (`deserialize*`). ✓
- Migration 0005 (`recording_points.segment`, `recording_sessions.current_segment`) → Task 7. ✓
- `currentSegment` on session; `applyResume` increments → Tasks 3, 5. ✓
- Repository `appendPoints(+segment)`, `getSessionSegments`, `markResumed(+currentSegment)`, `groupPointsBySegment` → Tasks 3, 8. ✓
- `metricsForSegments`, `activityMetricsFromSegments` (gap excluded) → Tasks 1, 3. ✓
- Save flow (`endedAt` via `lastTrackPoint`, build from segments) → Tasks 3, 10. ✓
- GPX per-`trkseg`/`rte` segments → Task 4. ✓
- Rendering: `geo` helpers, port MultiLineString + dashed connectors, `MapTokens.connectorDashArray`, MapOverlays/MapCanvas, live track → Tasks 2, 12, 13. ✓
- Offline bounds via `flattenSegments` → Task 13. ✓
- Recording store live segments + `startSegment` → Task 6. ✓
- Controllers/task plumbing incl. resume-after-kill immediate fix in current segment → Task 9. ✓
- Out-of-scope items (auto-break, waypoints-on-activities) → not built, per spec. ✓

**Placeholder scan:** none — every step has concrete code or an exact command.

**Type consistency:** `ActivityGeometry.segments` / `TrailGeometry.segments`, `RecordingSession.currentSegment`, `RecordingPointRow.segment`, `appendPoints(sessionId, segment, points)`, `getSessionSegments`, `markResumed(sessionId, pausedMs, currentSegment)`, `pointsToInsertValues(sessionId, segment, points)`, `buildNewActivityInput(session, segments, form)`, `metricsForSegments`/`activityMetricsFromSegments`, `segmentLines`/`connectorLines`/`overallEndpoints`/`flattenSegments`, and the `lines`/`connectors`/`connectorDashArray` port props are used identically across producing and consuming tasks.
