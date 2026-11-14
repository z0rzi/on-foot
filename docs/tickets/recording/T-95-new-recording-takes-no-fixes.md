---
severity: should-fix
category: bug
size: M
triage:
origin: agent
filed: 2026-11-09
from: "device check, 2026-11-09"
blocked_by: []
---
# T-95: a recording whose process dies loses its track, while the app is dead and after it is opened

Reproduced and traced on 2026-11-14 (last two sections). A process restarted in the background
records nothing until the app is opened, and in most cases nothing after it either. Feature-sized:
the fix is designed in [[2026-11-14-recording-survives-process-death-design]], which waits on the
owner's calls.

## First sighting, 2026-11-09

Seen on the device on 2026-11-09, release build of `3c51462`, with `walk.sh gpx` replaying
`climb.gpx`. In one app process: a recording along `DEVCHECK climb` (after a relaunch from an APK
install, `launch action resume` at 22:05:45), paused with a long press (`capture stream stopped`
22:09:37), stopped and discarded (`recording discarded {"sessionId":130}`, `capture stream stopped`
22:10:06), then a new recording started at 22:10:49 (`capture ready`, `stream live`, `recording start
started`, `capture recovery left the live request alone`). For four minutes the pill read "0 m" while
the map's puck followed the walk, and the debug log holds no `fix batch` entry after 22:10:49, while
logcat shows Expo's `TaskService` handling an `onfoot-location-recording` intent every 4 s. After the
APK was reinstalled (new process, 22:14) the app showed the toast "No position between 22:10 and
22:14" and the distance moved again.

So the fixes reached the process but the handler in `src/recording/locationTask.ts` logged nothing:
either the handler was never invoked, or its `createSerialQueue` chain was held by an earlier batch
that never settled, which would stall every later batch silently. Not reproduced yet.

## Read from the source, 2026-11-11

No reproduction was attempted: the phone was locked. From the code, a delivery can vanish without
a debug-log entry in four places, two in JS and two native:

- **JS, the port's handler** (`defineBackgroundFixHandler`, `src/location/expoLocation.ts`) returns
  silently on a task `error` and on a body with no location.
- **JS, the serial queue** (`src/recording/locationTask.ts`): a turn that never settles holds every
  later delivery. The turn awaits only repository reads and one insert, on a synchronous SQLite
  driver, so nothing in it is known to hang.
- **Native, the timestamp filter**: `LocationTaskConsumer` (`expo-location` 57.0.11,
  `reportLocationsImmediately`) keeps a fix only if its time is later than `sLastTimestamp`, a
  static that lives as long as the process and is not reset when the task is unregistered and
  registered again. One fix with a time ahead of the clock would drop every later fix until the
  process dies, with the broadcast still logged every few seconds, and a new process would record
  at once. That matches every observation above; what would have produced such a fix is not known.
- **Native, the job**: a kept fix is handed to JS through a scheduled job, not from the broadcast.

So the logcat of the next occurrence settles it. `Handling intent with task name` alone means the
fixes were dropped by the timestamp filter or the job never ran; followed by `Handling job with
task name` and `Finished task`, they reached JS, and the debug log's `delivery fault` or
`delivery waiting` ([[2026-11-11-field-diagnostics-design]], §4) names the path.

## Reproduction attempt, 2026-11-11

On the device, release build of `field-diagnostics`, one process, under a mock walk at 1.4 m/s:
a recording of 134 m, paused with a long press, stopped and discarded (`recording discarded
{"sessionId":140}`), then a new recording 10 s later. The new recording took fixes at once: 134 m
after 107 s, 581 m at its stop, a `fix batch` every 8 s, and no `delivery fault` or
`delivery waiting`. Not reproduced. What this attempt left out of the first sighting: the first
recording there had been resumed by a relaunch after an APK install (`launch action resume`).

## Reproduced, 2026-11-14

On the device, the release build installed 2026-11-13 11:16, under a `devcheck walk` at 1.4 m/s
(a fix a second, a delivery every 8 s). The installed APK was pulled from the phone and put back
with `adb install -r` to stand for the APK install of the first sighting; no other build was used.

**What was run:**

- **Plain sequence, one process, once.** A recording of 134 m, paused, stopped, discarded, a new
  recording 8 s later: 146 m after 107 s of walking. Not reproduced, as on 2026-11-11.
- **Task swiped from recents mid-recording, once.** The process survived (same pid), the app ran
  `main` again in it, and the recording kept taking fixes.
- **APK reinstalled mid-recording, then relaunched, twice.** Reproduced both times.
- **APK reinstalled with no recording, then relaunched, once.** A recording started in that process
  took a fix every 8 s (78 m after 73 s). Not reproduced.

**What the two reproductions show:**

- The stall begins in the resumed recording itself, not at the discard. Run 1: `launch action
  resume {"sessionId":151}` at 17:19:01, two `fix batch` entries at 17:19:02, then none while the
  walk covered 150 m; the pill stayed at 212 m. Run 2: the pill went from 78 m to 89 m over 100 m
  walked, the last `fix batch` at 17:30:51.
- The recording started after pause, stop and discard in that process then read "0 m" for the
  whole walk (280 m in run 1, 100 m in run 2), with the first sighting's log exactly: `capture
  ready`, `stream live`, `recording start started`, `capture recovery left the live request alone`,
  and no `fix batch` after it.
- The debug log holds no `delivery waiting` and no `delivery fault` in either run.
- Logcat, every 8 s for the whole stall: `Handling intent with task name` followed by `Handling job
  with task name`, and never `Finished task` (run 1: 14 jobs then 26 jobs, 0 finished; run 2: 9
  then 10, 0 finished). `Started headless task 2 to keep JS timers alive` is logged once at the
  first stalled delivery and never finishes.
- In both runs the new process was started by the package replacement and a fix delivery, before
  the app was opened: `Registered task`, `Handling intent with action MY_PACKAGE_REPLACED`,
  `Handling intent` and `Handling job` for the task, `Started headless task 1`, the warning `No task
  registered for key expo-task-manager`, and only then `Running "main"`. The deliveries queued
  during that start finish together (two `Finished task` within 100 ms), `Finished headless task 1`
  follows, and no later delivery finishes. In the run with no recording the process was also
  started by `MY_PACKAGE_REPLACED`, but with no task registered nothing was delivered before the
  app was opened, and every delivery finished.

**What this rules out, of the four places above:**

- The timestamp filter and the job: a fix is kept and its job runs, every 8 s.
- The serial queue: a delivery held behind another would log `delivery waiting`; none is logged.
- The port's handler: a task error or an empty body would log `delivery fault`; none is logged.

So the deliveries are lost between `TaskService.executeTask` and the JS task, a fifth place, and
only in a process that a delivery started before the app was opened.

**Read from the source, not observed** (`expo-task-manager` 57.0.12, `expo-modules-core`): in such
a process the task manager is registered while the headless loader holds the app's record, so
`setTaskManager` stores it in `sHeadlessTaskManagers`. Two seconds after the last pending event
finishes, `notifyTaskFinished` calls `invalidateAppRecord`, which removes that entry even though
`RNHeadlessAppLoader.invalidateApp` leaves the React host alive for the activity. From then on
`getTaskManager` returns null, `executeTask` queues each event and asks the loader to load an app
that is already loaded, and its `onReactContextInitialized` never fires again, so the queue is
never drained. That matches the two-second gap (the first unfinished delivery came 23 s and 13 s
after the last finished one) and the stall lasting until the process dies. No log line confirms
which table held the task manager.

**Without an app update, same day.** Four more runs, each from a process the launcher had opened,
a recording live under the walk, the app sent to the home screen, then the process killed:

- **`adb shell am stop-app com.zorzi.onfootrn`, twice** (logcat: `Killing … fully stop … by user
  request`; the package stays `stopped=false` and the location requests survive, unlike a
  force-stop). Stalled both times after the app was reopened: the pill read 56 m after 240 m
  walked, then 67 m after 220 m.
- **`adb shell am crash com.zorzi.onfootrn`, twice** (logcat: `FATAL EXCEPTION … shell-induced
  crash`, `has died: fg +50 FGS`). Stalled once (the pill stayed at 123 m over 130 m walked); the
  other run kept recording, a `Finished task` after every job.

In all four the system restarted the process within two seconds, `Start proc … for broadcast
{…/com.mapbox.common.location.LocationUpdatesReceiver}`, and the task's deliveries then started
the app headlessly, with the same lines as after the reinstall and no `Running "main"`. Until the
app was reopened no delivery finished: `Handling job` every 8 s and nothing else, for 35 to 60 s.
At the reopen (`Running "main"`, `launch action resume`) the queued deliveries finished together
within 100 ms, each logged as a `fix batch` with `droppedBeforeSegment: 1`, because the relaunch
had just opened a new segment; `Finished headless task 1` followed. In the three stalled runs no
later delivery finished, the first lost one 12 to 14 s after `Finished headless task 1`. So:

- A process killed mid-recording stalls the same way with no update involved: across the day, 5
  of the 6 headless starts stalled.
- The headless start is needed but not enough. The run that kept recording has the same lines in
  the same order up to `Finished headless task 1`, so what decides the outcome is not logged. The
  reading from the source above predicts a stall every time and is therefore incomplete: it would
  need the table the task manager lands in to depend on a race at start-up, which nothing observed
  shows.
- Separately from the stall, the fixes delivered while the app is dead in the background are never
  recorded: they wait in memory for the app to be opened and are then dropped as taken before the
  new segment.

**Who can hit it:** a recording that is live when the app is updated, crashes, or has its process
killed, and every recording started afterwards in that process. A kill by the low-memory killer
itself was not produced; `am stop-app` stands for it.

## Cause, 2026-11-14

Read from the source after the reproductions; the detail is in the spec.

- **Nothing recorded while the app is dead:** the task is defined by `app/_layout.tsx`, a route
  module, and a headless start renders no route, so neither the task nor the task manager's JS
  listener exists until the app is opened.
- **Nothing recorded after it is opened:** `expo-task-manager` drops a task manager created on a
  headless-started host two seconds after its deliveries finish, although the host lives on under
  the activity. That replaces the reading under "Read from the source, not observed" above, and
  explains the run that did not stall: which table the task manager lands in is a race between
  the main thread and the JS thread at start-up.
