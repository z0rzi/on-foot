# A recording survives the death of its process — Design

**Status:** Spec, not built. Owner's calls taken 2026-11-15. Challenged on 2026-11-15 by a fact
check and a design critique, and its runtime unknowns settled on the device the same day
(`.scratch/device-checks/2026-11-15-t95-runtime/`, spike branch `spike/t95-runtime`).
**From:** [[T-95-new-recording-takes-no-fixes]].
**Date:** 2026-11-14, rewritten 2026-11-15.

Terms are the glossary's: **Fix**, **Segment**. A **delivery** is one batch of fixes Android hands
to the recording task. A **headless start** is a process Android starts for a delivery, with no
activity: the app is not on screen. A **host** is the process's React host, which holds the JS
runtime.

## Problem Statement

A recording whose process dies (a crash, a kill by the system, an app update) loses its track
twice, both times in silence. Reproduced on the device on 2026-11-14 (5 headless starts out of 6)
and again on 2026-11-15; the evidence is in the ticket and the device-check folder.

1. **While the app is dead, nothing is recorded.** Android restarts the process and keeps
   delivering, but no delivery reaches the handler until the owner opens the app. Those fixes are
   then dropped as older than the segment the relaunch has just opened.
2. **After the app is opened, nothing is recorded either.** The deliveries that were waiting
   finish together, and from two seconds later no delivery finishes again, for that recording and
   for every later one, until the process dies. The pill freezes; the map's puck still moves.

## Causes

Read from the source (`expo-task-manager` 57.0.12, `expo-modules-core` 57.0.11, `expo-router`
57.0.14), checked line by line by an independent fact check, and observed on the device with
instrumented builds (2026-11-15).

### 1. The task is defined by a route, and a headless start renders no route

`src/recording/locationTask.ts` is imported by `app/_layout.tsx`. Expo Router loads route modules
through `require.context`, whose entries are lazy getters read when the route tree is built, inside
the root component's render (`useStore` → `getRoutes`). A headless start evaluates the bundle's
entry and starts no surface, so `_layout.tsx` is never evaluated: the task is not defined, and the
`expo-task-manager` JS module, which holds the listener for deliveries, is not loaded. The proof in
the logcat is `No task registered for key expo-task-manager`, a key that module registers at its
top level. The native side keeps each delivery in memory until that listener appears, which is when
the owner opens the app. If the process is killed again first, those deliveries are gone.

### 2. `expo-task-manager` drops its task manager while a host it no longer owns survives

`TaskService` keeps the JS-facing task manager in one of two tables, `sHeadlessTaskManagers` or
`sTaskManagers`. The table is chosen once, when the native module is created on the JS thread,
by whether the headless loader holds a record for the app at that moment. The loader writes that
record from a main-thread listener, so it is a race. On the device: when the loader's record lands
first, the manager goes to `sHeadlessTaskManagers`; when the module lands first, to
`sTaskManagers`.

About two seconds after the last pending delivery finishes, `TaskService.invalidateAppRecord` asks
the loader to invalidate the app and, whenever the loader held a record, removes the entry from
`sHeadlessTaskManagers` at once. The loader's own decision, destroy the host unless an activity is
bound to it, is posted to the main thread and runs later. When an activity is bound, the host
survives and its task manager is gone: `getTaskManager` returns null, each delivery is queued, and
the loader is asked to start a host that is already running, so the `onReactContextInitialized` it
waits for never fires. That is the stall (logged as `executeTask taskManager=null` on every
delivery, none finished).

This is not limited to an app opened within seconds of a headless start. A process the launcher
started while deliveries were pending also landed in `sHeadlessTaskManagers` and stalled.

### What the device showed besides

- **A host per delivery leaks.** With cause 1 fixed alone, each delivery while the app is dead
  starts a host and the next invalidate destroys it. `AppContext` starts an
  `expo.modules.AsyncFunctionQueue` thread per host and never quits it: 2 → 38 threads over 37
  hosts, about 3.3 MB of memory per host, about 2.4 s of bundle load per delivery. Those long jobs
  also exhaust the expedited-job quota: under forced Doze with no foreground service, jobs ran every
  40 s carrying 5 fixes each instead of every 8 s.
- **A crash keeps the foreground service.** After `am crash` the location service is restarted in
  the new process with its foreground state and notification. After `am stop-app` it is gone, and
  the process sits at broadcast-receiver priority.
- **Expo documents no restart.** The v57 location page says a terminated app does not restart on a
  location event on Android. The restart the device shows is the fused provider's pending intent
  outliving the process, which a force stop cancels.

## Solution

### 1. The task is defined first in every runtime

The package's `main` becomes a root `index.ts` that imports `src/bootstrap` and then
`expo-router/entry`, and nothing else. This is Expo Router's documented custom-entry pattern.

`src/bootstrap.ts` runs, in this order, in every JS runtime, headless or not:
- installs the global error handler (it moves from `app/_layout.tsx`, so a throw in a headless
  runtime reaches the log too);
- writes `launch` / `runtime started` (§4);
- imports `src/recording/locationTask`, which defines the task.

The import of `locationTask` leaves `app/_layout.tsx`.

**Invariant:** no module loads `expo-task-manager` before the task is defined. If a delivery
reaches a runtime where the SDK is loaded and the task is not, `expo-task-manager` unregisters the
task (`TaskManager.ts:264-272`), which ends the recording. Bootstrap running first in every runtime
is what upholds it.

**Invariant:** the background handler never sets the recording store's `session`. That is how the
relaunch path (`resumeIfActive`) knows that this runtime has not yet shown the recording, even when
the runtime is a warm headless one.

The task's import graph runs in a runtime with no view mounted, so it may contain no map, no UI
and no timers: a headless host's JS timers stay paused, and a `setTimeout` on that path would hang
the delivery. It is light today (log, data, zustand, the location port).

### 2. `expo-task-manager` keeps one host while a task is registered

The existing `patches/expo-task-manager+57.0.12.patch` gains three hunks in `TaskService`:

1. **No invalidate while a task is registered.** The delayed invalidate after a finished delivery
   is skipped while the app has a registered task. The headless host stays warm for the whole
   recording: one runtime per process, not one per delivery.
2. **`invalidateAppRecord` no longer touches the tables.** It asks the loader to invalidate and
   nothing else.
3. **`setTaskManager(null)` clears both tables.** It runs from `TaskManagerInternalModule.onDestroy`,
   that is, when the host really is destroyed. It becomes the only place an entry is removed, so
   an entry lives exactly as long as its module.

Each hunk logs with its own `[onfoot-patch]` marker text every time it acts. The text names the
hunk, so `native-patches.md`'s dex grep can tell it from the `expo-location` patch's marker.

Hunks 2 and 3 matter when no task is registered (after Pause or Stop, which unregister it). Without
them, a delivery finishing just after Pause or Stop would reach today's `invalidateAppRecord`, drop
the entry while the activity keeps the host alive, and stall the next recording in that process.

On the device, a build with hunk 1 and hunk 3 (build C) gave:
- no stall in 9 reopens of a headless-born process, in both table orders;
- no stall in 8 opens at 0.5 to 3.6 s after a finished delivery;
- one thread and one runtime over 11 minutes dead, with memory up about 1 MB a minute;
- jobs every 8 s under forced Doze with no foreground service, each taking 20 to 50 ms;
- a second recording in the same process that records.

The path hunk 2 closes was never triggered there; it is read from the source.

### 3. A relaunch continues the track when nothing is missing

Today a relaunch after a process death always opens a new segment at `now` and announces "No
position between … and …". With §1 the track usually runs on through the death, and a segment
started at `now` would drop the fixes the dead time delivers late.

The relaunch's **reference** is the later of the session's last stored point and its
`segmentStartedAt`. Then:
- **Continue:** if the reference is 30 s old or less, the relaunch hydrates the store, keeps the
  current segment and shows no toast.
- **Cut:** if it is older, the relaunch opens a new segment that starts just after the reference,
  not at `now`. It announces the interruption from the reference to now. Fixes the dead time
  delivers late are kept: the saved track can hold points inside the announced gap (owner,
  2026-11-15). A cached position taken before the last stored point is still dropped.

The decision lives in `resumeActionFor` (`src/recording/resume.ts`), which gains the last point
and `now` and a `continue` action beside `resume`, `paused` and `none`. The existing
`launch action <action>` entry then logs it. Test-first. The 30 s threshold is one named
constant. Both branches go on to restart capture (`issueStreamIfAvailable`), which restores the
foreground service when it was lost.

**One queue for the relaunch and the deliveries.** Today the relaunch reads the session's points
and hydrates the store on the controller's queue, while deliveries append on the task's own queue.
A delivery stored between the read and the hydrate is in the database but missing from the pill
and the live track. The delivery queue moves to its own module, and the relaunch's read-and-hydrate
runs as one turn of it. A Jest test interleaves a delivery between the two and fails without this.

### 4. The debug log names a runtime that started without the app

- `launch` / `runtime started`, written once per JS runtime from bootstrap.
- `cold start` carries the runtime's age, in ms.

A `runtime started` with no `cold start` after it is a headless start; a `cold start` on an old
runtime is an app opened onto a warm host. No coordinates.

## Rejected alternatives

- **A host per delivery (§1 alone, plus a lifecycle check in `invalidateAppRecord`).** It leaks a
  thread and about 3.3 MB per delivery and exhausts the expedited-job quota. The lifecycle check is
  racy: on the device, `TaskService` read `BEFORE_CREATE` 40 to 70 ms before the loader read
  `RESUMED` and kept the host. Quitting the leaked thread would also need a patch on a second
  package.
- **Re-issuing the location request on silence.** The request is not what breaks: a re-issued
  request delivers to the same missing task manager.
- **Running the migrations from the entry too.** Two places would migrate the database (owner,
  2026-11-15).

## Existing shape

- **Native patches** (`docs/architecture/native-patches.md`): `expo-task-manager` and
  `expo-location` are built from source and patched with `patch-package`. §2 extends the existing
  patch file and its `native-patches.md` entry gets the usual "if dropped" paragraph. The marker
  convention is the `expo-location` patch's.
- **Relaunch after a process death** (`resumeIfActive`, `resumeAfterProcessDeath`, `applyRelaunch`,
  `resumeActionFor`, [[2026-09-17-onfoot-rn-resume-location-gate-design]]): §3 adds an action to
  the existing decision and reuses the announcement, the toast and the hydration. Continuing a
  segment across a short gap matches that spec's location-off precedent.
- **Field diagnostics** ([[2026-11-11-field-diagnostics-design]]): §4 is one more entry of that
  kind. `delivery waiting` and `delivery fault` are what show a hung delivery.
- **The architecture gates** (`src/architecture/`): a root `index.ts` is outside their scan roots,
  so a structural test holds §1 (see Testing).
- **Nothing to extract.** The app has one background task and one bundle entry.

## Failure modes

- **The patch does not reach the APK.** The hunk markers are absent from the dex, and the stall is
  back: `fix batch` entries stop while the recording is live.
- **A migration under a live recording.** A headless runtime runs the handler before any screen
  has run the migrations. A query against the old schema throws; the task manager finishes the
  delivery, so nothing hangs, and those fixes are lost until the app is opened (accepted by the
  owner, 2026-11-15, who never updates during a hike). A data-transforming migration could pick up
  rows written in the old shape, which is corruption rather than loss: this constraint goes into
  the migrations' documentation.
- **Android kills the warm process.** With no foreground service (after a stop-app) it sits at
  broadcast-receiver or cached priority. A kill means a new headless start on the next delivery,
  and the track goes on.
- **A delivery that hangs.** Anything on the handler path that waits on a JS timer never resolves
  in a headless runtime. Visible as `delivery waiting`; prevented by keeping the handler's graph
  timer-free (§1).
- **A real gap.** With no fix for more than 30 s (a standstill, the fused provider deferring, a
  long tunnel), the relaunch cuts and shows the toast. That is not unsafe; it is the relaunch
  telling the truth about a gap in the stored track.
- **Two quick crashes.** Android stops restarting a process that crashed twice within about two
  minutes ("crashed quickly"). Nothing is recorded until the app is opened; the relaunch then cuts.
- **The handler runs with no recording** (a delivery after a stop): unchanged, `fixes ignored, no
  session`.
- **Render-time throw:** none, nothing here renders.

## Consequences accepted

- While a task is registered, the process keeps a warm React host in the background (about 165 to
  175 MB in the spike). It is released when the recording stops and the process dies, which
  Android decides.
- A recording that outlives a stop-app gets no foreground service and no notification until the
  app is opened.
- At a relaunch, restarting capture can drop the provider's pending batch: a bridged line of at most
  one batch window.

## Out of scope

- **Surviving a reboot or a force stop.** Not promised (`native-patches.md`); a force stop cancels
  the pending intent.
- **[[T-5-relaunched-crash-hang]]**: a hang in a relaunched process, separate from this. The error
  handler moving into bootstrap gives it a trace in headless runtimes, and the crash runs below
  will show whether it recurs.
- **[[T-84-relaunch-old-camera]]**: separate. Re-check it after this lands, since a relaunch can now
  open on a warm runtime.

## Testing

- `resumeActionFor`: continue at 30 s and below, cut above, the reference taken from the later of
  the last point and `segmentStartedAt`, the cut segment starting just after the reference.
- The relaunch and a delivery interleaved: the delivery's points end in the store.
- A structural test, in `src/architecture/__tests__/`:
  - `index.ts` imports `src/bootstrap` first, then `expo-router/entry`;
  - bootstrap imports `locationTask`;
  - nothing under `app/` imports `locationTask`;
  - the task's import graph reaches no map provider or UI module.

## Device check

Through the `device-check` skill, under a mock walk. Each step names what it would show if the bug
were still there.

1. **The patch is in the APK.** The three hunk markers are in the dex. Broken: absent.
2. **`am crash` mid-recording, dead 60 s, reopen.** Twice.
   - While dead: `runtime started` with no `cold start`, then a `fix batch` with `kept` above zero
     about every 8 s.
   - After reopening: `launch action continue`, no toast, the pill's distance within one batch of
     the walk's distance, and a `Finished task` after every job for at least two minutes.
   - Broken: no `fix batch` while dead, `launch action resume` and a toast, or jobs that stop
     finishing.
3. **The same with a reinstall mid-recording, and with `am stop-app`.** After the stop-app there is
   no notification while dead, and it is back after reopening.
4. **Open within 2 s of a finished delivery,** five times. Broken: a stall.
5. **Pause just after a delivery, resume; then stop, save and start a second recording in the same
   process.** The second one records. Broken: it stalls (the path hunks 2 and 3 close).
6. **The cut branch.** After `am crash`, stop the walk for more than 30 s, then reopen.
   - Expect `launch action resume`, the toast from the last point to now, a new segment starting
     just after the last point, and `droppedBeforeSegment` 0 for the late batches.
   - Broken: the late batches dropped.
7. **Ten minutes dead, the screen off.** The `ncFunctionQueue` thread count stays flat and there is
   one `runtime started`. Broken: one thread and one runtime per delivery.
8. **A plain recording, no process death:** start, pause, resume, stop, save. No toast, and the
   segments are as today.

**The owner's step:** a real hike where the app dies, with real GPS. The device check runs on a
plugged-in phone with a mock walk, which does not show the field cadence. After the hike, in
Settings → Debug log (capture and launch areas):
- **While the app was dead:** `runtime started` with no `cold start` after it, then
  `capture fix batch` with `kept` above zero at regular spacing.
- **A collapse would look like** minutes between batches while walking.
- **At the reopen:** `cold start` with the runtime's age, `launch action continue`, then a
  `fix batch` about every 8 s.

## Owner's calls

Taken 2026-11-15.

1. **The relaunch threshold (§3): 30 s.**
2. **A migration under a live recording: accepted.** The fixes are lost until the app is opened.
   The owner never updates the app during a hike. The migrations run from one place only.
3. **Reporting cause 2 to Expo: the owner files it,** once the patch is confirmed on the device.
   The thread leak of a destroyed host is worth naming in the same report.
4. **A cut segment keeps the late fixes,** even when they fall inside the announced gap.

## Docs

- `docs/architecture/native-patches.md`: the three hunks, their markers, and the "if dropped"
  paragraph.
- `docs/architecture/debug-log.md`: `runtime started`, the age on `cold start`, and the `continue`
  action.
- `GLOSSARY.md`, **Segment**: a relaunch opens one only after a gap.
- The comments above `resumeAfterProcessDeath`, `resumeIfActive` (an empty store now means "this
  runtime has not shown the recording"), and `heldCandidate` in `locationTask.ts`.
- The migrations' documentation: the constraint on data-transforming migrations.
