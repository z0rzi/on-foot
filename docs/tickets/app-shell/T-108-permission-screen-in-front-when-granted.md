---
severity: investigate
category: bug
size:
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-device-check-speed-rerun]]"
blocked_by: []
---
# T-108: the system's permission screen comes in front for a moment, every permission already granted

Seen twice on the device on 2026-11-14, with location and notifications already granted and no
dialog shown. `com.google.android.permissioncontroller/…GrantPermissionsActivity` was the resumed
activity for about 2 s after a relaunch that followed an `adb install -r` mid-recording, and for
up to 5 s right after **Start recording**, then left on its own. A later check did not see it after
**Start recording**, so it does not happen every time.

The app asks again whatever it already holds. `useLocationPermission`
(`src/map/useLocationPermission.ts`) calls `requestForegroundAccess` on every map mount, which
calls `Location.requestForegroundPermissionsAsync`. Starting a recording calls
`ensureTrackingNotificationAccess` (`src/recording/notificationAccess.ts`, from
`recordingController.ts:116`), which calls `PermissionsAndroid.request(POST_NOTIFICATIONS)`.
Android can start its permission activity even for a request it grants at once, so On Foot's
activity is paused for that moment. `hasForegroundAccess` already reads the grant without asking.

What is not known: whether the owner ever sees it (the screen is transparent when nothing is
asked), and whether the pause has effects of its own. The debug log's `map app active` and the
`heading watch` off and on that follow app-state changes are where to look. The system's
`lost permission to set exact alarms!` line at the same install is unrelated: the app declares no
exact-alarm permission, and the system writes that line on a package replace.

## Comments

> *Comment written by an AI agent.*

Seen again on 2026-11-15 in the T-95 runtime spike (`.scratch/device-checks/2026-11-15-t95-runtime/`,
release builds of master and of `spike/t95-runtime`): the permission screen flashed briefly on
**every** resume of the app, not now and then. That is consistent with `useLocationPermission`
asking again on each map mount. The owner asked for it to be tracked (2026-11-15).
