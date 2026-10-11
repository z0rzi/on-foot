# Recording Pause Mode — Design

**Status:** Approved design (Slice 1 of 2)
**Branch:** `feat/recording-live-stats` (continues the live-stats work)
**Date:** 2026-08-30

## Goal

Add a **paused** state to hike recording. While recording, the only control is
**Pause** (hold-to-pause). Pausing stops GPS and freezes the stats. From paused,
the hiker can **Resume** or **Stop**. Stop opens the save form. Paused time is
excluded from the activity's duration and pace ("moving time"), matching the
behaviour hikers expect from a lunch/rest break.

This also dissolves bug **#18** at the root: today, stopping sets the session's
`endedAt` (phase `saving`) and navigates to the save screen; backing out of that
screen leaves the map in a dead `saving` state (record button returns `null`,
stats sheet frozen, no way back). With pause mode, `endedAt` is written only at
the final save, so the map is never stuck — Stop→save→back returns to a live,
controllable **paused** map.

## Scope

This is **Slice 1 of 2**, both on the same branch:

- **Slice 1 (this spec):** the pause state machine, controls, moving-*time*
  stats, and the #18 fix. The recorded track stays a single continuous line for
  now, so a break leg is temporarily included in **distance** (and therefore in
  distance-derived pace). Moving *time* is already correct.
- **Slice 2 (follow-up, separate spec/plan):** segment the track at pauses — a
  real gap instead of a bridge line (GeoJSON MultiLineString on the provider
  port) and exclusion of break legs from distance. This is the groundwork the
  elevation-graph feature will reuse. Deferred here to keep Slice 1 free of
  durable columns nothing yet reads.

**Out of scope (both slices):** auto-pause on no movement (manual pause only);
trail-relative progress (the parked "feature B"); the elevation graph.

## Global Constraints

- **Persistence seam:** only `src/data/db/*` imports expo-sqlite/drizzle. New
  durable state goes through the `ActivitiesRepository` port and its sqlite
  implementation. Persist the minimum.
- **Map-provider seam:** unchanged in this slice — no map-SDK code is touched.
- **Pure logic is TDD'd; native rendering / GPS is device-verified.** State
  derivation and session transitions are pure functions with Jest tests written
  first; the location-task GPS behaviour, gestures, and control rendering are
  verified on-device.
- **No change-narrating comments.** Comments describe current state, not edits.

## Data Model

`recording_sessions` gains two columns (drizzle migration `0004`):

| column | type | meaning |
| --- | --- | --- |
| `paused_at` | `INTEGER` (nullable) | timestamp the current pause began; `null` while moving |
| `paused_ms` | `INTEGER NOT NULL DEFAULT 0` | accumulated paused time across all prior pause/resume cycles |

`RecordingSession` (and `RecordingSessionRow`) gain `pausedAt: number | null`
and `pausedMs: number`; `rowToSession` maps them.

No changes to `recording_points` in this slice (the `break` marker belongs to
Slice 2). The vestigial `endedAt` column on `recording_sessions` is kept (never
written on a live session anymore — see Save Flow) to avoid a destructive
migration.

## Phase & Derived State (pure, TDD'd)

`RecordingPhase` becomes **`'idle' | 'recording' | 'paused'`** (`'saving'` is
removed everywhere it is referenced):

```
recordingPhase(session):
  !session              -> 'idle'
  session.pausedAt != null -> 'paused'
  else                  -> 'recording'
```

Moving-time helper drives every live stat and the saved duration:

```
movingElapsedMs(session, now):
  const end = session.pausedAt ?? session.endedAt ?? now
  return Math.max(0, end - session.startedAt - session.pausedMs)
```

- Recording: tracks live (`now` advances).
- Paused: frozen at `pausedAt`.
- At save: `end = pausedAt`, so duration = moving time.

## Transitions (pure helpers + thin controller)

Pure session transforms (unit-tested), returning the next session object:

```
applyPause(session, now)  -> { ...session, pausedAt: now }
applyResume(session, now) -> { ...session, pausedAt: null,
                               pausedMs: session.pausedMs + (now - session.pausedAt) }
```

Controller (`recordingController.ts`) wraps them with persistence + GPS:

- **`pauseRecording()`** — load active session; if it is `recording`
  (`pausedAt == null`, `endedAt == null`): `stopLocationUpdatesAsync`
  (GPS fully off — the OS recording notification drops), persist via
  `markPaused(id, now)`, `setSession(applyPause(...))`.
- **`resumeRecording()`** — load active session; if it is `paused`: compute
  `next = applyResume(session, now)`, persist via `markResumed(id, next.pausedMs)`
  (sets `paused_at = null`, `paused_ms = next.pausedMs`), restart
  `startLocationUpdatesAsync`, `setSession(next)`. Multiple pause/resume cycles
  accumulate into `pausedMs`.
- **`stopToSave(linkedTrailId)`** — the paused Stop action. Persists the current
  followed-trail selection as the session's `linkedTrailId` via
  `markLinkedTrail(id, linkedTrailId)` (the **only** Stop-time write — it is
  `linkedTrailId`, never `endedAt`, so #18 stays fixed), reflects it in the store
  (`setSession`), then the caller navigates to `/activity/save`. The session
  stays paused. This preserves the existing "whatever trail is followed at the
  end is linked, last one wins" behaviour that `stopRecording` used to provide.
- **`stopRecording()` is removed** (its endedAt-at-stop write is what caused #18).
  `discardRecording()` is unchanged.

`ActivitiesRepository` gains `markPaused(id, pausedAt)`, `markResumed(id, pausedMs)`,
and `markLinkedTrail(id, linkedTrailId)`; `markStopped` is removed (no caller
remains).

## Location Task

`locationTask.ts` guard becomes: ignore batches when there is no session **or**
the session is paused (`session.pausedAt != null`) — defensive, since GPS is off
during pause so no batches should arrive.

## Resume-after-kill

`ResumeAction` becomes **`'none' | 'resume' | 'paused'`** (`'save'` removed):

```
resumeActionFor(session):
  !session              -> 'none'
  session.pausedAt != null -> 'paused'
  else                  -> 'resume'
```

`resumeIfActive()` handles the new `'paused'` action: hydrate the session and its
points, but do **not** start GPS — the map renders the paused controls. The
`'resume'` branch is unchanged (hydrate + start GPS + bridge fix). `useResumeRecording`
drops its `action === 'save'` navigation (there is no persisted `saving` session
anymore); a killed-while-paused session relaunches to the paused map, from which
the hiker taps Stop to reach the save form.

## Save Flow

The save screen (`app/activity/save.tsx`) is reached only via the paused **Stop**
button, so the session is paused (`pausedAt` set, `endedAt` still `null`).

- The activity's end time is derived from `pausedAt ?? lastPoint.t ?? startedAt`
  (the pause moment — confirmed acceptable even if the hiker waits before tapping
  Stop). The `linkedTrailId` comes from the session (written at Stop by
  `stopToSave`).
- `activityMetricsFromPoints(points, startedAt, endedAt, pausedMs)` gains a
  `pausedMs` argument and computes `durationSeconds` as moving time
  (`(endedAt - startedAt - pausedMs) / 1000`, floored at 0). `buildNewActivityInput`
  and the save screen's preview both route through it so they agree.
- `onSave` writes the activity (with `endedAt`) and deletes the session in one
  transaction (unchanged `saveActivity`), resets, and goes home. `onDiscard`
  discards. Backing out returns to the live **paused** map.

Because `endedAt` is written only inside this terminal save transaction (which
also deletes the session row), a persisted live session never carries `endedAt`.
The map therefore has no dead `saving` state — **bug #18 is fixed structurally.**

## UI

### Recording
One floating control, bottom-left: **hold-to-pause**. The existing ring button
is repurposed — pause icon (⏸), accessibility label "Pause recording (press and
hold)", the hold gesture drives the ring and on completion calls
`pauseRecording()`. No other button is shown while recording.

### Paused
- The hold-to-pause button is replaced by **two floating tap buttons**,
  bottom-left, riding above the sheet like the record button:
  - **Resume** (play icon) → `resumeRecording()`.
  - **Stop** (stop icon) → `stopToSave(linkedTrailId)` (from the current map
    selection), then `router.push('/activity/save')`.
  These live in a small dedicated `PausedControls` component; `MapScreen` renders
  `RecordButton` for `idle`/`recording` and `PausedControls` for `paused`.
- A prominent top **"⏸ Paused" chip** makes the GPS-off state loud. `MapModeChip`
  is extended so its exit affordance is optional (`onExit?`); the paused chip
  uses it with the pause icon, label "Paused", `recordingLine` colour, and no
  exit button.
- The stats sheet (`RecordingInfoSheet`) freezes: duration and pace/speed use
  `movingElapsedMs`; the header shows **"⏸ Paused"** instead of "● Recording";
  the 1-second ticker runs only while `recording`. The **"Following · {trail}"**
  pill stays interactive (change/remove the followed trail while paused, same as
  recording).

`RecordButton` drops its `phase === 'saving'` early-return (no such phase) and
its `stopRecording` import; the record path is `idle → startRecording`,
`recording → hold → pauseRecording`.

## Testing

**TDD (pure, Jest first):**
- `recordingPhase` — idle / recording / paused (`recordingStore.test.ts`).
- `movingElapsedMs` — live (recording), frozen (paused), and end-at-save cases,
  including `pausedMs` accumulation and the `max(0, …)` clamp.
- `applyPause` / `applyResume` — single and multiple cycles; `pausedMs` sums.
- `resumeActionFor` — none / resume / paused (`resume.test.ts`).
- `activityMetricsFromPoints` — `durationSeconds` excludes `pausedMs`
  (`mapping.test.ts`).

**Device-verify:**
- Hold-to-pause ring gesture pauses; Resume/Stop tap buttons appear; top "Paused"
  chip shows.
- GPS genuinely stops on pause (OS recording notification disappears) and
  restarts on resume (notification returns; track continues).
- Moving time excludes a real break (pause a few minutes, resume; duration does
  not jump by the break length; pace reflects moving time).
- Multiple pause/resume cycles accumulate correctly.
- Stop → save form → **back** returns to the live paused map with Resume/Stop
  available (bug #18).
- App killed while paused → relaunch lands on the paused map (not an auto-opened
  save form); Resume and Stop both work.
- Following-trail pill still changes/removes the trail while paused.
