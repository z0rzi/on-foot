# Recording Live Stats & Trail Following Design

**Date:** 2026-08-26
**Branch:** `feat/recording-live-stats`
**Status:** Approved — ready for implementation plan

## Goal

Make the *recording* state a first-class, informative mode:

1. **Keep the followed trail visible.** While recording, the currently-selected trail
   stays drawn on the map (today it is hidden), so the hiker can eyeball their position
   against the route and switch to a different trail mid-hike just by selecting it.
2. **Show live hike stats.** Replace the (currently absent) recording UI's info surface
   with a sheet that reports the hike in progress — time walked, distance, elevation
   gained, and average pace *or* speed.

This is a prerequisite for the later elevation-graph overlay, which will hang off this
recording sheet and reuse the along-track math introduced by feature B.

## Background

Recording exists today but is visually bare. From the current code:

- `mapMode({ recording, selection })` in `src/store/mapStore.ts` returns
  `'recording'` while a session is active — recording beats selection. The selection
  itself still lives in the store during recording (that is how the stop button reads
  the linked trail).
- `MapScreen.tsx` passes `trail={mode === 'trail' ? trail : null}` to `MapCanvas`, so
  the selected trail is **hidden** during recording. Only the live track (`RouteLine`,
  `c.recordingLine`) and the `RecordButton` show. There is **no info sheet** in
  recording mode.
- `RecordButton.doStop()` captures `linkedTrailId` from `mapStore.selection` *at stop*
  (last-one-wins) and passes it to `stopRecording(linkedTrailId)`.
- Live geometry accumulates in `recordingStore.liveGeometry: ActivityGeometry`
  (`appendLivePoints`). `RecordingSession { id, startedAt, endedAt, linkedTrailId }`;
  phase is derived by `recordingPhase(session)`, never stored.
- Metrics are computed by `computeMetrics(points): TrailMetrics` in
  `src/data/trails/gpx/metrics.ts` (distance, elevation gain/loss; nulls when no point
  has elevation). Formatters `formatDistance`, `formatElevation` live there too.
- Both the trail and activity sheets render inside `MapInfoSheet` (a
  `@gorhom/bottom-sheet` with snap points `['16%','55%']`) and use `MetricsGrid`.

The feature therefore adds two things and reuses everything else: **render the selected
trail during recording** and **a new live-stats sheet**. No new "followed trail" state is
introduced — the followed trail *is* the live selection.

## Architecture

### State & mode

No change to the recording state model. The "followed trail" is simply the current
`selection` when its `kind === 'trail'`:

- `MapScreen` resolves the trail to draw as
  `trailToShow = (mode === 'trail' || mode === 'recording') ? selectedTrail : null`
  and passes it to `MapCanvas`. The selected trail's geometry must load whenever
  `selection.kind === 'trail'`, independent of recording (confirm `useSelectedTrail`
  does not gate on `mapMode`).
- Changing the followed trail mid-hike needs no new mechanism: tapping a different trail
  changes `selection`, which changes `trailToShow`. Tapping empty map deselects → the
  trail line disappears (free recording).
- **Linking at stop is unchanged.** Whatever is selected at stop links to the saved
  activity (`RecordButton.doStop`), last-one-wins. If the hiker followed several trails,
  only the last is linked — accepted.

`trailToShow` is extracted as a **pure helper** (`mode`, `selectedTrail`) so it can be
unit-tested.

### The recording sheet — `src/recording/RecordingInfoSheet.tsx`

Rendered by `MapScreen` when `mode === 'recording'`, inside the shared `MapInfoSheet`
chrome (same snap points as the trail/activity sheets). Contents:

- **Header:** a "● Recording" indicator; and `Following · <trail name>` when
  `selection.kind === 'trail'` (hidden entirely during free recording).
- **`MetricsGrid` — four tiles:**
  1. **Duration** — time walked, ticking live every second.
  2. **Distance** — distance so far.
  3. **Elevation gain** — gain so far ("—" when the GPS provides no elevation).
  4. **Pace / Speed** — a single tile the user taps to toggle between average pace
     (min/km) and average speed (km/h); the tile's label switches with it.
- **No stop control in the sheet.** Stopping stays on the existing `RecordButton`; the
  sheet is read-only.

There is no separate mode chip for recording — the sheet header carries the recording
and following state.

### Map rendering & z-order

- The selected trail renders during recording via `trailToShow` (above).
- **Invariant: the activity (recording) line is always drawn above the trail line — never
  under.** Both coexist only during recording. The mapbox adapter
  (`src/map/providers/mapbox/`) must order the recording `RouteLine` layer above the
  trail overlay layers. This is a provider-seam rendering detail, device-verified.

### Live metrics & math

- Distance / elevation gain come from `computeMetrics(recordingStore.liveGeometry.points)`
  — reused as-is (elevation gain is `null` → "—" when no point has elevation).
- **Duration** = `now − session.startedAt`, driven by a 1-second interval owned by the
  sheet (cleared on unmount). Only the sheet re-renders on the tick.
- New **pure, TDD'd** formatters alongside `metrics.ts`:
  - `formatDuration(seconds): string` — e.g. `1:23:45` / `12:03`.
  - `formatPace(distanceMeters, durationSeconds): string` — min/km; "—" when distance or
    duration is 0 (guard divide-by-zero).
  - `formatSpeed(distanceMeters, durationSeconds): string` — km/h; "—" when duration is 0.

### Persistence — pace/speed preference

The pace-vs-speed choice is a display preference and **is persisted** across restarts. A
small persisted preferences slice holds it — `src/settings/preferencesStore.ts`
(Zustand + `persist`, mirroring `mapStore`'s persistence setup and `partialize`):

```ts
type PaceSpeedMode = 'pace' | 'speed'
// state:   paceSpeedMode: PaceSpeedMode   (persisted)
// action:  togglePaceSpeed(): void
```

Everything else (recording session, live geometry, the duration tick) stays in-memory as
today.

## Data flow

```
GPS point → recordingStore.appendLivePoints → liveGeometry.points
      │
      ▼
RecordingInfoSheet (mode === 'recording')
      ├─ computeMetrics(liveGeometry.points)      → distance, elevation gain
      ├─ 1s tick: now − session.startedAt         → duration
      ├─ preferencesStore.paceSpeedMode           → formatPace | formatSpeed
      └─ selection.kind === 'trail'               → "Following · <name>"

selection ── trailToShow(mode, selectedTrail) ──► MapCanvas trail  (drawn under the
                                                                    recording line)
```

## Error handling & edge cases

- **No elevation from GPS:** `computeMetrics` returns `null` gain → tile shows "—"
  (existing `formatElevation` behaviour).
- **Zero distance / zero duration** (just started): pace and speed show "—" (formatter
  guards), duration shows `0:00`.
- **Free recording (no trail selected):** no trail line, header omits the "Following"
  line, no errors.
- **Trail deselected mid-recording:** trail line disappears; sheet keeps showing stats.
- **App relaunch mid-recording:** existing `useResumeRecording` / `resumeIfActive`
  behaviour is unchanged; the sheet renders from the rehydrated live geometry and
  `startedAt`.

## Testing

**Pure logic — TDD, Jest:**

- `formatDuration`: sub-hour (`12:03`), over-hour (`1:23:45`), zero (`0:00`).
- `formatPace`: normal value; zero distance → "—"; zero duration → "—".
- `formatSpeed`: normal value; zero duration → "—".
- `trailToShow(mode, selectedTrail)`: returns the trail for `'trail'` and `'recording'`,
  `null` for `'free'`/`'activity'`, `null` when no trail selected.
- `preferencesStore.togglePaceSpeed` flips `'pace' ⇄ 'speed'`.

**Device-verified (native/rendering):**

- Recording sheet renders; duration ticks each second; distance/elevation/pace update as
  points arrive.
- Selected trail stays visible during recording; selecting a different trail swaps the
  drawn trail; the recording line is always above the trail line.
- Free recording shows no trail line and no "Following" header.
- Pace/Speed tile toggles and the choice survives an app restart.

## Non-goals / future work

- **Trail-relative progress** (% complete, distance/elevation remaining) — feature B;
  needs live-position-to-trail projection (the along-track math shared with the elevation
  graph).
- **Off-route detection / alerts** — later.
- **Elevation-graph overlay** — parked; resumes after this feature and mounts on this
  recording sheet.
- **Changing the stop/linking behaviour** — stays capture-at-stop, last-one-wins.
