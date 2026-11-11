---
severity: should-fix
category: bug
size:
triage: needs-info
origin: agent
filed: 2026-11-09
from: "device check, 2026-11-09"
blocked_by: []
---
# T-95: a recording started after a discard in the same process took no fixes for four minutes

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

## Triage Notes

**What we've established so far:**

- Fixes delivered by Android every 4 s, none logged as `fix batch`, none recorded.
- A new process recorded at once.

**What we still need:**

- A reproduction: pause, stop, discard, start again in one process, under a `devcheck walk`, then the
  debug log's `capture` entries and logcat.

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
