# Segmented Track — Real Breaks in Trails & Activities — Design

**Status:** Approved design
**Branch:** `feat/segmented-track`
**Date:** 2026-08-31

## Goal

Make a trail or activity a sequence of **segments** instead of one continuous
line. Pausing a recording ends the current segment; resuming starts a new one.
The break leg — the gap between where the hiker stopped and where they resumed —
is no longer drawn as a straight bridge line, nor counted toward distance or
elevation. On the map the segments render as separate lines joined by a **dashed
connector** (visual continuity only; it carries no distance).

This is the **Slice 2** the pause-mode spec
(`2026-08-30-onfoot-rn-recording-pause-mode-design.md`) explicitly deferred:
"segment the track at pauses — a real gap instead of a bridge line (GeoJSON
MultiLineString on the provider port) and exclusion of break legs from distance."
Moving *time* is already correct (Slice 1); this slice fixes *distance* and the
visual.

## Scope

Both trails and activities become segment-based, and GPX import honours real
`<trkseg>` breaks. The geometry shape is left ready for the future
"waypoints on activities" feature (trails already carry `waypoints`; activities
gain nothing unused now, but the container shape does not need reshaping later).

**Out of scope / deliberate non-goals:**
- Auto-breaking on GPS signal loss — only an explicit user pause makes a break.
- The crash-recovery "immediate fix" on app-restart-while-recording stays in the
  **current** segment (it bridges a data gap, not a user break — unchanged
  behaviour, its distance handling is not this slice's concern).
- Waypoints on activities (model is left ready, not built).

## Global Constraints

- **Persistence seam:** only `src/data/db/*` imports expo-sqlite/drizzle. New
  durable state goes through the `ActivitiesRepository` port and its sqlite
  implementation. Persist the minimum.
- **Map-provider seam is inviolable:** segmentation is computed in shared,
  provider-agnostic code (`geo.ts` + `MapOverlays`); the provider port is
  extended semantically (a polyline becomes one-or-more lines, plus a dashed
  connector line) and only `src/map/providers/mapbox/` touches the SDK. No
  provider literals leak into shared code.
- **Pure logic is TDD'd; native rendering / GPS is device-verified.** Geometry
  helpers, metrics, grouping, serialization and session transforms are pure
  functions with Jest tests written first; map rendering and GPS are verified
  on-device.
- **No change-narrating comments.** Comments describe current state, not edits.

## Data Model

A **segment** is a contiguous run of points. Geometry becomes a list of segments:

- `ActivityGeometry`: `{ points: TrackPoint[] }` → **`{ segments: TrackPoint[][] }`**
- `TrailGeometry`: `{ points, waypoints }` → **`{ segments: GpxPoint[][]; waypoints }`**

`TrackPoint` / `GpxPoint` are unchanged.

### Stored geometry (activities & trails) — read-time upcast, no SQL change

The `geometry` column is opaque JSON, so there is **no destructive migration**
for saved trails/activities. `serialize*` writes `{ segments, … }`.
`deserialize*` accepts both shapes and upcasts legacy rows on read:

```
deserializeActivityGeometry(json):
  parsed.segments present -> { segments: parsed.segments }
  parsed.points present    -> { segments: parsed.points.length ? [parsed.points] : [] }
  else                     -> { segments: [] }

deserializeGeometry(json):   // trail — same, plus waypoints
  segments = parsed.segments ?? (parsed.points?.length ? [parsed.points] : [])
  return { segments, waypoints: parsed.waypoints ?? [] }
```

A legacy single-line row therefore becomes one segment; the next save rewrites it
in the new shape.

### Recording — migration `0005`

Recording is normalized rows, so this slice adds a drizzle migration `0005`:

| table | column | type | meaning |
| --- | --- | --- | --- |
| `recording_points` | `segment` | `INTEGER NOT NULL DEFAULT 0` | which segment this fix belongs to |
| `recording_sessions` | `current_segment` | `INTEGER NOT NULL DEFAULT 0` | the segment new fixes are stamped with |

`RecordingSession` (and `RecordingSessionRow`) gain `currentSegment: number`;
`rowToSession` maps it. An in-flight session upgraded across this migration keeps
its existing points in segment `0` (a rare edge; that one session's pre-upgrade
pause still bridges — acceptable).

## Session Transitions (pure)

`session.ts` `applyResume` also opens the next segment:

```
applyResume(session, now) -> {
  ...session,
  pausedAt: null,
  pausedMs: session.pausedMs + (now - (session.pausedAt ?? now)),
  currentSegment: session.currentSegment + 1,
}
```

`applyPause` is unchanged. A new session starts at `currentSegment: 0`.

## Recording Repository & Flow

`ActivitiesRepository`:

- `appendPoints(sessionId, points)` → **`appendPoints(sessionId, segment, points)`**
  — stamps each inserted row with `segment`.
- `getSessionPoints(sessionId): TrackPoint[]` → **`getSessionSegments(sessionId): TrackPoint[][]`**
  — reads points ordered by `(segment, t, id)` and groups them into segments
  via a pure `groupPointsBySegment(rows)` helper (in `mapping.ts`, unit-tested).
  Empty segments are not represented (no rows → no array).
- `markResumed(sessionId, pausedMs)` → **`markResumed(sessionId, pausedMs, currentSegment)`**
  — persists `paused_at = null`, `paused_ms`, and `current_segment`.

Controller / task:

- `resumeRecording()` computes `next = applyResume(session, now)`, persists via
  `markResumed(id, next.pausedMs, next.currentSegment)`, restarts GPS, sets store.
- `locationTask.ts` appends batches with the active session's `currentSegment`.
- `resumeIfActive()` hydrates the store from `getSessionSegments`; the
  immediate-fix on the `'resume'` branch appends into the session's **current**
  segment (unchanged bridging within one segment).

## Recording Store

`liveGeometry` becomes `{ segments: TrackPoint[][] }`:

- `beginSession` → `{ segments: [[]] }` (one open current segment).
- `appendLivePoints(points)` → append into the **last** segment (create one if
  none); no-op on empty input.
- **new `startSegment()`** → push a new empty `[]`; called by `resumeRecording`,
  keeping store segment indices aligned with the DB `segment` numbers.
- `hydrate(session, segments)` sets `segments` directly.

## Metrics

`computeMetrics(points)` stays as the per-segment primitive. New:

```
metricsForSegments(segments):
  fold computeMetrics over each segment; sum distanceMeters / gain / loss;
  elevation is null only when no segment has elevation data.
```

The break gap is excluded structurally — each segment is measured independently,
so no cross-segment leg is ever summed. `activityMetricsFromPoints(...)` becomes
`activityMetricsFromSegments(segments, startedAt, endedAt, pausedMs)` and routes
distance/elevation through `metricsForSegments`; `durationSeconds` (moving time)
is unchanged. Live stats (`RecordingInfoSheet`) and the save preview both use it,
so they agree.

## Save Flow

`app/activity/save.tsx` loads `getSessionSegments`. `endedAt` is
`session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt`, where
`lastTrackPoint` returns the last point of the last non-empty segment.
`buildNewActivityInput(session, segments, form)` builds `geometry: { segments }`
and measures via `activityMetricsFromSegments`.

## GPX Import

`parseGpx` returns **`segments: GpxPoint[][]`** — one segment per `<trkseg>`
(or one per `<rte>` when routes are present), honouring real breaks; empty
segments are dropped. `waypoints` and `title` are unchanged. `app/trail/new.tsx`
builds `{ segments, waypoints }` and measures via `metricsForSegments`.

## Rendering

### Shared geometry helpers (`geo.ts`, provider-agnostic, TDD'd)

- `segmentLines(segments)` → `[number,number][][]` — one `[lng,lat]` line per
  segment with ≥2 points.
- `connectorLines(segments)` → `[number,number][][]` — for each consecutive pair
  of non-empty segments, the pair `[last(prev), first(cur)]` (a dashed connector).
- `overallEndpoints(segments)` → `[start, end]` — first point of the first
  non-empty segment and last point of the last non-empty segment.
- `flattenSegments(segments)` → `Point[]` — for bounds/fit and offline tile
  bounds (`boundsForPoints` / `boundsForTrail` keep their flat-points signature).

### Provider port (`src/map/provider/types.ts`)

The polyline components move from a single `line` to a MultiLineString plus a
dashed connector line:

- `TrailOverlayProps`: `line` → **`lines: [number,number][][]`**; add
  **`connectors: [number,number][][]`** and **`connectorDashArray: number[]`**.
  (`endpoints`, `color`, widths, arrows unchanged.)
- `RouteLineProps`: `line` → **`lines`**; add **`connectors`** and
  **`connectorDashArray`**.

### rnmapbox adapter (`src/map/providers/mapbox/adapter.tsx`)

- Solid track: a `MultiLineString` `ShapeSource` + `LineLayer` (native gaps
  between segments). Arrows (`SymbolLayer`, `symbolPlacement: 'line'`) and
  endpoints (`CircleLayer`) unchanged.
- Connectors: a second `MultiLineString` `ShapeSource` + `LineLayer` with
  `lineDasharray: connectorDashArray`, same colour. Each component uses its own
  distinct `ShapeSource` ids (`trail-connector-source`, `route-connector-source`),
  so no id collisions. A component whose `lines`/`connectors` is empty renders no
  source for it (avoid empty GeoJSON geometry).

### `MapOverlays` / `MapCanvas`

- `OverlayRoute` becomes `{ segments; kind }`. `MapOverlays` computes
  `segmentLines` / `connectorLines` / `overallEndpoints` and hands them to the
  provider components; z-order (recording line above route) is unchanged.
- The live recording track uses the same path (a paused-then-resumed live track
  shows the dashed break too). `showLiveTrack` gates on total live points ≥ 2.
- `MapCanvas` reads `geometry.segments`; `hasTrail` / `hasActivity` gate on total
  point count ≥ 2; fit-bounds uses `boundsForPoints(flattenSegments(segments))`.

### Other flat-points consumers

`TrailInfoSheet` and `OfflineLayerChooser` pass
`flattenSegments(trail.geometry.segments)` to `boundsForTrail`. New tokens:
`MapTokens.connectorDashArray`.

## Testing

**TDD (pure, Jest first):**
- `geo`: `segmentLines` (skips <2-point segments), `connectorLines` (only between
  non-empty consecutive segments; none for a single segment), `overallEndpoints`,
  `flattenSegments`.
- `metrics`: `metricsForSegments` — break gap excluded; per-segment elevation;
  elevation null iff no segment has data; single-segment equals `computeMetrics`.
- `mapping`: `deserialize*` upcasts legacy `{points}` → one segment and passes
  through `{segments}`; serialize round-trip; `groupPointsBySegment` groups and
  orders; `buildNewActivityInput` / `activityMetricsFromSegments` over segments;
  `lastTrackPoint`.
- `gpx/parse`: multi-`<trkseg>` file → multiple segments; single track → one
  segment; `<rte>` files → one segment per route.
- `session`: `applyResume` increments `currentSegment` (and single/multi cycles).
- `recordingStore`: `appendLivePoints` appends into the last segment;
  `startSegment` opens a new one; `beginSession` starts one open segment.

**Device-verify:**
- Record, pause a while, walk elsewhere, resume: the map shows two separate lines
  joined by a dashed connector — no solid bridge — and Distance does **not**
  include the break leg (contrast with the pre-change single-line behaviour).
- Multiple pause/resume cycles produce multiple segments/connectors.
- Save the activity, reopen it from the list: segments and connector render the
  same; distance matches the live value.
- Import a GPX with multiple `<trkseg>`: the trail renders with gaps at the real
  breaks and distance excludes them.
- A legacy (pre-migration) trail/activity still renders as a single line and its
  distance is unchanged.
