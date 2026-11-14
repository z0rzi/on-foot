# A recording survives the death of its process — Design

**Status:** Draft. Written without a brainstorm with the owner; the rulings that are theirs are
listed under **Owner's calls** and nothing is planned until they are taken.
**From:** [[T-95-new-recording-takes-no-fixes]].
**Date:** 2026-11-14

Terms are the glossary's: **Fix**, **Segment**. A **delivery** is one batch of fixes Android hands
to the recording task. A **headless start** is a process Android starts for a delivery, with no
activity: the app is not on screen.

## Problem Statement

A recording whose process dies (a crash, a kill by the system, an app update) loses its track
twice, both times in silence. Reproduced on the device on 2026-11-14, 5 headless starts out of 6;
the evidence is in the ticket.

1. **While the app is dead, nothing is recorded.** Android restarts the process within two
   seconds and keeps delivering every 8 s, but no delivery reaches the handler until the owner
   opens the app. Those fixes are then dropped as older than the segment the relaunch has just
   opened.
2. **After the app is opened, nothing is recorded either.** The deliveries that were waiting
   finish together, and from two seconds later no delivery finishes again, for that recording and
   for every later one, until the process dies. The pill freezes; the map's puck still moves.

## Causes

Read from the source (`expo-task-manager` 57.0.12, `expo-modules-core` 57.0.11, `expo-router`
57.0.14) and consistent with every log line of the reproductions. Neither has been confirmed by a
change that makes the symptom go away; the plan's first items do that.

### 1. The task is defined by a route, and a headless start renders no route

`src/recording/locationTask.ts` is imported by `app/_layout.tsx`. Expo Router loads route modules
through `require.context`, whose entries are evaluated when the route tree is built, inside the
root component's render (`useStore` → `getRoutes`). A headless start evaluates the bundle's entry
and renders nothing, so `_layout.tsx` is never evaluated: the task is not defined and the
`expo-task-manager` JS module, which holds the listener for deliveries, is not even loaded. The
native module keeps each delivery in memory (`TaskManagerInternalModule.mEventsQueue`) until that
listener appears, which is when the owner opens the app.

Expo's task-manager page recommends importing the task file at the top of the root layout. On
this stack that is not early enough for a headless start, which is what the logcat shows: `Handling
job` every 8 s and not one `Finished task` before `Running "main"`.

### 2. `expo-task-manager` drops its task manager when the app opens on a headless host

`TaskService` keeps the JS-facing task manager in one of two tables, chosen once, when the module
is created: `sHeadlessTaskManagers` if the headless loader holds a record for the app at that
moment, `sTaskManagers` otherwise. Two seconds after the last pending delivery finishes,
`notifyTaskFinished` calls `invalidateAppRecord`: the loader drops its record and destroys the
React host **unless an activity is bound to it**, and `TaskService` removes the entry from
`sHeadlessTaskManagers` in both cases.

When the owner has opened the app on a host a delivery started, the host survives and the task
manager does not. From then on `getTaskManager` returns null; each delivery is queued and the
loader is asked to load an app whose host is already running, so the `onReactContextInitialized`
it waits for never fires and the queue is never drained. `Started headless task 2` is logged and
never finishes. This is the stall.

The one headless start in six that did not stall is the table being chosen the other way: the
loader's record is written by a listener on the main thread, the module is created from the JS
thread while the bundle loads, and when the module wins that race the task manager lands in
`sTaskManagers`, which `invalidateAppRecord` never touches.

Cause 1 feeds cause 2: because no delivery can finish before the app is opened, the host is
always still alive, and always headless-born, when the activity arrives.

## Solution

### 1. The task is defined at the bundle's entry

A root `index.ts` becomes the package's `main`. It imports `src/recording/locationTask` and then
`expo-router/entry`, and does nothing else. The import leaves `app/_layout.tsx`.

A headless start then defines the task and runs the handler as written: it reads the active
session from SQLite, gates the fixes and appends them to the session's current segment. The
database client opens at module scope and needs no component. The recording store is module
state; `appendLivePoints` on a store with no session only fills `livePoints`, which the relaunch
replaces when it hydrates from the database.

### 2. `expo-task-manager` keeps its task manager when the host survives

The existing `patches/expo-task-manager+57.0.12.patch` gains a second hunk, in
`TaskService.invalidateAppRecord`: when the host is bound to an activity, the entry moves from
`sHeadlessTaskManagers` to `sTaskManagers` instead of being dropped. The host's lifecycle state is
the same test the loader uses to decide whether to destroy it. The hunk logs once with the
`[onfoot-patch]` marker, so its presence in an APK is one grep, as for the `expo-location` patch.

Both are needed. With only §1, the app opened during the few seconds a headless host is alive
(the bundle's load plus two seconds, out of every 8) still stalls. With only §2, the fixes taken
while the app is dead are still lost.

### 3. A relaunch no longer cuts a track that has no gap

Today a relaunch after a process death always opens a new segment and announces "No position
between … and …", because until now the dead time was always a gap. With §1 the track usually
runs on through the death. The relaunch opens a new segment and announces the interruption only
when the last stored point is older than a threshold; otherwise it hydrates the store and goes on
in the current segment, with no toast.

The rule is a pure function beside `applyRelaunch` in `src/recording/session.ts`, tested first.
The threshold is one named constant; its value is an owner's call.

### 4. The debug log names a runtime that started without the app

`launch` / `runtime started`, written once per JS runtime from the entry. A `runtime started` with
no `cold start` after it is a headless start, which the log cannot show today. No coordinates.

## Existing shape

- **Native patches** (`docs/architecture/native-patches.md`): `expo-task-manager` and
  `expo-location` are already built from source and patched with `patch-package`. §2 extends the
  existing patch file and reuses the marker convention of the `expo-location` patch; its entry in
  `native-patches.md` gets the usual "if dropped" paragraph.
- **Relaunch after a process death** (`resumeAfterProcessDeath`, `applyRelaunch`,
  `InterruptionGap`, [[2026-09-17-onfoot-rn-resume-location-gate-design]]): §3 changes when this
  path opens a segment; the announcement, the toast and the hydration are reused unchanged.
- **Field diagnostics** ([[2026-11-11-field-diagnostics-design]]): §4 is one more entry of that
  kind. `delivery waiting` and `delivery fault` from its §4 are what ruled out the handler here.
- **Nothing to extract.** The app has one background task and one bundle entry; there is no
  second instance of either shape.

## Failure modes

- **The app is updated mid-recording and the update carries a migration.** A headless start runs
  the handler before any screen has run the migrations. A query against the old schema throws;
  the task manager catches it and finishes the delivery, so nothing hangs, and those fixes are
  lost until the app is opened. Visible afterwards as an interruption toast (§3). See Owner's
  calls.
- **Android thins out the deliveries of a process with no foreground service.** A restored task
  gets no foreground service until the app is opened. Over the 35 to 60 s observed the cadence
  held at 8 s; over a longer dead time it may not. The outcome is a real gap, and §3 then cuts the
  segment and says so.
- **The fix gate's held candidate does not survive a headless host.** Each headless host lives
  two seconds past its deliveries, so a candidate held for the next delivery is lost and a jump
  is never confirmed while the app is dead. The gate then keeps dropping the jump, which is its
  safe side.
- **The patch does not reach the APK.** The marker is absent; `native-patches.md` already
  describes the check. The stall is then back as before, and the log shows it as `fix batch`
  entries stopping while the recording is live.
- **The handler runs in a runtime with no recording** (a delivery after a stop). Unchanged: `fixes
  ignored, no session`.
- **Render-time throw:** none, nothing here renders.

## Consequences accepted

- While the app is dead, each delivery loads the bundle again, since the host is destroyed two
  seconds after the previous one. That costs battery every 8 s until the app is opened or the
  recording stopped. To be measured on the device before it is believed to matter.
- A recording that outlives its process is still not shown in the notification: restoring the
  foreground service needs the app in front.

## Out of scope

- **Making capture recovery re-issue the stream on silence.** The location request is not what
  breaks; a re-issued request delivers to the same missing task manager.
- **Surviving a reboot.** Not promised (`native-patches.md`).
- **[[T-5-relaunched-crash-hang]]** and **[[T-84-relaunch-old-camera]]**: same neighbourhood,
  different defects.

## Device check

Under a `devcheck walk`, the sequences of 2026-11-14, each twice: `am stop-app` mid-recording,
`am crash` mid-recording, the same APK reinstalled mid-recording. For each:

- While the app is dead: `fix batch` entries with `kept` above zero, a `Finished task` after
  every job, and `runtime started` with no `cold start`.
- After the app is opened: no interruption toast, the pill's distance covering the dead time, and
  a `Finished task` after every job for at least two minutes.
- Once, the app opened within two seconds of a delivery, the case §2 alone covers.
- The patch's marker in the APK.

Ten minutes dead, once, for the cadence without a foreground service and the battery cost.

## Owner's calls

1. **The relaunch threshold (§3).** Recommended: a relaunch cuts the segment and shows the toast
   only when the last stored point is more than 30 s old. The alternative is to keep cutting on
   every relaunch, which leaves a break in the saved track at every process death even when no
   fix is missing.
2. **A migration under a live recording.** Recommended: accept the loss until the app is opened;
   it needs an update with a migration during a hike. The alternative is to run the migrations
   from the entry as well, which gives the database two places that migrate it.
3. **Reporting cause 2 to Expo.** It is their defect and the patch has to be carried until they
   fix it. Filing an issue on `expo/expo` is public and is the owner's to do or to ask for.

## Docs

`docs/architecture/native-patches.md` (the second hunk), `docs/architecture/debug-log.md` (the new
entry), and the comment above `resumeAfterProcessDeath`, which states the rule §3 changes.
