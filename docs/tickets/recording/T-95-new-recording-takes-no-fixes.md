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

- A reproduction: pause, stop, discard, start again in one process, under a `walk.sh` walk, then the
  debug log's `capture` entries and logcat.
