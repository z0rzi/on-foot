# Live Segment Representation — Root-Fix Refactor — Design

**Status:** Approved (follow-up to segmented-track)
**Branch:** `feat/segmented-track`
**Date:** 2026-09-01

## Problem

The segmented-track feature introduced two different encodings for "which
segment a recorded point belongs to":

- **DB / persistence:** points are keyed by an explicit integer
  (`recording_points.segment`), driven by `recording_sessions.current_segment`.
- **Live store:** `liveGeometry.segments: TrackPoint[][]` keys points
  **positionally**, by array index.

`getSessionSegments` compacts empty segments away, discarding the explicit
key. So after hydration the store's positional-last array can fail to
correspond to `session.currentSegment` — e.g. a crash right after a resume
(new segment has no persisted points yet) or an empty middle segment. The
immediate-fix append then lands in the wrong visual segment relative to the
DB. This was patched with a `currentSegment + 1 > segments.length` heuristic
(a workaround, not a root fix) and a related edge was parked.

## Fix (root cause)

Make the **live store mirror the DB row shape**: hold a flat list of points,
each tagged with its explicit `segment`. Derive the grouped `Point[][]` only
at the rendering/metrics edge via the existing pure `groupPointsBySegment`.
The **saved** geometry model (`ActivityGeometry = { segments: Point[][] }`)
is correct and stays unchanged — this refactor touches only the live
recording representation and its reads.

With one shared encoding, store/DB alignment is automatic: an append is
tagged with `session.currentSegment`, exactly as the DB row is. The whole
"positional index drift" bug class disappears, and with it the reconciliation
heuristic and the `startSegment` action.

## Changes

- **Types** (`data/activities/types.ts`): add
  `LiveTrackPoint extends TrackPoint { segment: number }`.
- **Mapping** (`data/activities/mapping.ts`): `groupPointsBySegment` accepts
  `LiveTrackPoint[]` (structurally satisfied by `RecordingPointRow[]` too) and
  strips to `TrackPoint[][]`, ascending by segment, empties compacted. Add
  `rowToLivePoint(row): LiveTrackPoint`.
- **Repository** (`activities/repository.ts` + sqlite impl): replace
  `getSessionSegments(id): TrackPoint[][]` with
  `getSessionPoints(id): LiveTrackPoint[]` (ordered by `(segment, t, id)`,
  mapped via `rowToLivePoint`). `appendPoints`/`markResumed` unchanged.
- **Store** (`recordingStore.ts`): canonical state becomes
  `livePoints: LiveTrackPoint[]`. `beginSession` → `livePoints: []`;
  `appendLivePoints(segment, points)` tags each point and pushes (empty input
  is a no-op returning the same reference); `hydrate(session, points)`;
  `reset` → `[]`. **Remove `startSegment`** and the `liveGeometry` wrapper.
- **Controllers** (`recordingController.ts`, `locationTask.ts`):
  `appendLivePoints(session.currentSegment, points)` everywhere a fix is
  appended. `resumeRecording` drops the `startSegment()` call. `resumeIfActive`
  hydrates from `getSessionPoints` and **drops the reconciliation heuristic**;
  its immediate fix uses `appendLivePoints(session.currentSegment, [point])`.
- **Consumers** derive grouped segments at the edge:
  - `MapCanvas`: `livePoints` from the store → `groupPointsBySegment` (memoised)
    → `liveSegments` passed to `MapOverlays` (its `Point[][]` prop is unchanged);
    `showLiveTrack` gates on `livePoints.length >= 2`.
  - `RecordingInfoSheet`: `groupPointsBySegment(livePoints)` → `metricsForSegments`.
- **Save screen** (`app/activity/save.tsx`):
  `groupPointsBySegment(await getSessionPoints(id))` → `segments`, then
  unchanged `buildNewActivityInput` / `lastTrackPoint`.

`recording_sessions.current_segment` and `applyResume`'s increment stay — the
session remains the source of truth for the current segment across restarts.
No DB migration (row shape unchanged).

## Testing

- **TDD (store):** `beginSession` empties; `appendLivePoints(seg, pts)` tags and
  appends; a second segment index produces a distinct group when grouped;
  empty-input no-op keeps the same reference; `hydrate` sets tagged points;
  `reset` clears.
- **TDD (mapping):** `rowToLivePoint`; `groupPointsBySegment` over
  `LiveTrackPoint[]` (ascending, compacts empties) — existing test retained.
- **Device-verify:** pause/resume breaks still render as separate dotted-joined
  segments; distance excludes gaps; crash mid-recording and crash-right-after-
  resume both rehydrate with the break in the correct segment (the case the old
  heuristic guarded); save/reopen matches live.
