# Field diagnostics: the debug log sees four things it is blind to — Design

**Status:** Built, [[2026-11-11-field-diagnostics]].
**From:** [[T-4-progressive-route-rendering]] (step 1 of the owner's ruling of 26/10),
[[T-84-relaunch-old-camera]], [[T-89-puck-heading-freezes]], [[T-95-new-recording-takes-no-fixes]].
**Date:** 2026-11-11

Written while the owner was away. Every ruling an owner would normally take is listed under
**Decisions taken without the owner** and is theirs to overturn.

Terms are the glossary's: **Fix**, **Last camera**, **Follow**, **Segment**.

## Problem Statement

Four open tickets are stuck on the same sentence: the debug log cannot say. A relaunch that frames
the wrong camera (T-84) leaves no entry naming what the launch chose or what asked for a fit. A
frozen puck arrow (T-89) is drawn natively and leaves nothing at all. A recording that takes no
fixes (T-95) is silent on the two paths where a delivery can vanish before `fix batch`. And the
cost of selecting a long trail (T-4) is one number, 657 ms, whose split decides whether the next
big feature ([[T-26-all-activities-on-map]]) needs a simplified geometry.

None of these is fixed here. This adds the entries that let the next hike, or the next device
check, name the cause.

## Solution

Debug-log entries only. No behaviour visible to the user changes, nothing is persisted beyond the
log, and no entry carries a coordinate.

### 1. Route timing (T-4)

Two entries per route shown, each written where its cost runs:

- `map` / `route loaded` `{ kind: 'trail' | 'activity', points, ms }`: the load of the selected
  entity, which is the SQLite read and the `JSON.parse` of its stored geometry, timed around the
  loader where the map loads its selection (`useSelectedEntity`). Both block the JS thread and
  neither can be deferred, so they are one figure. Only the map's selection writes it: the edit
  screen, the trail actions menu and the personal factor's reads do not. An activity's load
  includes the read of its linked trail. Nothing under `src/data/` imports the log.
- `map` / `route derived` `{ kind, points, ms }`: the profile and banding pass of
  `useRouteDisplay` (`src/map/useRouteDisplay.ts`), timed around `routeDisplay`, logged from an
  effect, never from render. The live track's derivation while recording is not logged: it re-runs
  per fix batch and would flood the log.

`ms` is rounded to one decimal; `points` is the point count over every segment.

### 2. Launch camera and fits (T-84)

- `map` / `launch camera` `{ kind: 'restore' | 'follow', mode, from }`, once per launch in
  `MapLaunchGate`: what `launchCamera` decided. `mode` is the follow mode or null on a restore;
  `from` is whether a last camera was used as the starting point. The existing warn entries
  (`persisted launch camera ignored`, the two hydration fallbacks) stay as they are; a launch
  that fell back on a failed or timed-out hydration, where `launchCamera` is not consulted, still
  writes the entry, as `follow` / `position` / `from: false`, so every launch has exactly one.
- `map` / `fit requested` `{ by: 'select' | 'recenter', kind }`, in the map store's two actions
  that set `pendingFit` (`src/store/mapStore.ts`).
- `map` / `fit fired` `{ kind }`, in `MapCanvas` when the deferred fit runs.

Read with the `launch` entries already there, a relaunch that fits shows which action asked for it
and how long after the cold start.

### 3. Heading (T-89)

The puck's arrow is turned by Mapbox's native location component (`puckBearing="heading"`), which
JS cannot read: rnmapbox exposes no bearing callback for the puck. So the log watches the same
sensor through a second reader and records whether the phone's compass is still turning:

- The location port gains `watchHeading(listener): Promise<() => void>`, a magnetic compass
  heading in degrees with the platform's accuracy grade, backed by `expo-location`'s heading
  watch inside `src/location/`. Map and recording code never import the SDK. The magnetic
  heading is the one read: the true heading is absent whenever the platform has no position to
  correct it with, and a freeze shows on either.
- A hook mounted with the map watches it **only while a recording is in the recording phase and
  the app is active**, and writes:
  - `map` / `heading watch` `{ on: boolean }` when the watch starts and stops;
  - `map` / `heading sample` `{ updates, spreadDeg, accuracy, movedM }` every five minutes: how
    many heading updates arrived in the window, the spread of their values, the last accuracy
    grade, and the distance recorded in the window;
  - `map` / `heading stalled` (warn) `{ silentS, movedM }` once when no update has arrived since
    the last one (or since the watch began), that was at least 60 s ago, and the recording has
    moved at least 50 m since; and `heading resumed` on the next update. Silence and distance
    are both measured from the last update, so a slow walker trips the rule later and one
    standing still never does.
- `map` / `puck mounted` and `puck unmounted`, from the map-side component that renders the port's
  `UserPuck`, not from the Mapbox adapter.

The stall rule and the window summary are pure functions, tested first. The thresholds live with
them as named constants. The rule is checked every 10 s.

On Android the heading watch sends a reading only when the compass has turned about 2° since the
last one (`LocationModule.kt`, `DEGREE_DELTA`). One reading is therefore a compass that turned,
a constant compass is silence, and silence is the whole rule: the spread of the readings is
information in the sample, not a stall. A phone held perfectly steady along a straight line is
silent too and reads as a stall; a walk's sway is normally well over 2°.

What this can and cannot say: if the owner sees a frozen arrow while the log shows the heading
turning, the freeze is inside Mapbox's location component, and the fix is on the map side
(remount the puck, or drive its bearing from the port). If the log shows `heading stalled`, the
sensor or the OS stopped delivering, and the map is not the cause. It never observes the drawn
arrow itself.

### 4. Deliveries that vanish (T-95)

A delivery can disappear before `fix batch` on two JS paths, both silent today:

- `defineBackgroundFixHandler` (`src/location/expoLocation.ts`) returns without a word when the
  task manager hands it an `error`, or a body with no location. The port's handler grows a second
  callback, `onDeliveryFault(fault: 'error' | 'empty', error?)`, and `locationTask.ts` logs
  `capture` / `delivery fault` (warn) `{ fault, error }` with the error's message, never a
  position. On Android the task manager's error body holds a message and no code
  (`TaskService.errorBundleForError`), so the message is all the port passes on.
- The handler's serial queue (`src/recording/locationTask.ts`) holds every later delivery behind
  one that never settles. A delivery that arrives while an earlier one has been running for more
  than 10 s logs `capture` / `delivery waiting` (warn) `{ waiting, oldestS }`, at most once per
  30 s: `waiting` counts the deliveries held behind the oldest, the arriving one included, and
  `oldestS` is the oldest's age in whole seconds. The rule is a pure function over the pending
  deliveries' arrival times, tested first.

A delivery that never reaches JS (dropped natively) still leaves nothing in the debug log; T-95
records what to read in logcat for that case.

## Existing shape

The closest feature is `useSheetGeometryLog` (`src/map/useSheetGeometryLog.ts`): a hook that exists
only to write a diagnostic entry for a field bug (FIELD-2), mounted by the screen, documented in
`docs/architecture/debug-log.md`. Reused: `logEvent`, its fire-and-forget rule, the `map` and
`capture` areas (no new area), the convention that every entry is listed in `debug-log.md`, and
`fixBatchSummary`'s pattern of a pure summariser tested apart from the caller that logs it.

Extracted to be shared: nothing. The four parts log from four different places and share no
shape beyond `logEvent` itself. A generic "timed" or "diagnostic hook" helper would have one user
per variant; if a fifth timing entry appears, that is the moment to extract.

## Failure modes

- **A log write fails:** swallowed by `logEvent`, as today; no caller awaits it.
- **The heading watch cannot start** (the watch rejects): `heading watch` `{ on: false, error }`
  once, no retry until the next recording phase or return to the app; recording and the puck are
  untouched.
- **No magnetometer, or no location grant:** on Android the watch does not reject, it starts and
  sends nothing. The log shows `heading watch { on: true }`, samples of `updates: 0`, and a
  `heading stalled` once the recording has moved 50 m.
- **The app goes to the background or the recording pauses mid-window:** the watch stops, the
  partial window is dropped without a sample, and a `heading watch { on: false }` is written. No
  stall is reported across a stop.
- **Standing still:** under 50 m moved since the last update, no stall is reported, however long
  the compass is silent.
- **A timing entry on an empty geometry:** `points: 0`, the measured `ms`. A load that finds
  nothing or throws writes no `route loaded` and fails as it does today.
- **`onDeliveryFault` itself throws:** it is called inside the task executor's own promise, whose
  rejection the task manager already catches and prints; the next delivery is unaffected.
- **Log volume:** the periodic entry is one per five minutes while recording; `delivery waiting`
  is throttled; the fit entries, `route loaded` and `route derived` are one per user action. The 5,000-entry
  cap is untouched.

## Out of scope

- Any fix for T-84, T-89 or T-95, and any deferral or threshold for T-4.
- A watchdog that tells the user a recording is taking no fixes: `streamHealth.ts` deliberately
  reports facts the app observed, not GPS silence, and changing that is its own design.
- Reading the drawn puck bearing natively (a patch to rnmapbox).
- T-87 (North and 3D turn follow off).

## Decisions taken without the owner

1. **T-4 logs two entries, not the one its brief asks for, and the first is the whole load.**
   `route loaded` times the SQLite read and the parse together, on the map side, and `route
   derived` the derivation in its hook. The parse alone could only be timed inside the database
   seam, which would make the data layer write to the log on every read of a trail or an
   activity; the read and the parse both block JS and neither is what a deferral would move, so
   one figure answers the ticket's question.
2. **The heading signal is `expo-location`'s compass watch through the location port**, a second
   reader of the sensor, not the puck's own bearing. It cannot see the arrow; it splits the
   causes in two (above).
3. **The watch runs only while recording and active**, to keep the compass off otherwise. A freeze
   outside a recording is not caught.
4. **Thresholds:** five-minute samples; a stall is at least 60 s of silence since the last
   heading update over which the recording moved at least 50 m; a delivery waits after 10 s,
   logged at most every 30 s.
5. **T-84, T-89 and T-95 stay open**; T-4 goes to `ready-for-human` once its entries exist.
6. **A stall is silence only.** The under-1°-of-spread branch is dropped: on Android, the only
   platform the app is built and checked on, a reading is sent only on a turn of about 2°, so
   the branch could never fire and one reading in a window was wrongly read as a constant
   compass.
7. **`delivery fault` and `heading watch` log the native error's message**, where the map
   store's hydration failure logs the class only: these messages come from the task manager and
   the heading module, carry no payload, and the class alone would say nothing.
8. **`fit fired` is written only when the fit reached the camera controller**, so the entry
   never claims a fit the map did not get.
