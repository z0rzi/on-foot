---
severity: should-fix
category: bug
size: S
triage:
origin: agent
filed: 2026-11-15
from: "[[2026-11-15-app-log-capture-design]]"
blocked_by: []
---
# T-113: the reader's freeze check reads logcat's whole buffer, past its own timeout on a large buffer

`refuseFrozen` (`tools/device-check/reader.ts:118`) runs `logcat -d -b main | grep -F
'io.appium.uiautomator2.server pids:'` (`reader.ts:121`) under `TIMEOUT.logcat`, 15 s
(`tools/device-check/adb.ts:34`). A dump of the whole main buffer scans all of it: with the buffer
at 16 MiB (85 MiB of entries) it took 28 s on the phone on 2026-11-15, so the check times out
whenever the reader is silent, the one moment it runs. The recorder met the same cost and bounds
every read with `-T` (`recorderLogcat`, `tools/device-check/capture.ts`); the freeze it looks for
is recent, so a window of a few minutes holds it.

`native-errors` reads the same buffer by `--pid` (`tools/device-check/nativeErrors.ts:18`) and
scales with it too; the phone's buffer is back at the default 256 KiB since 2026-11-15, which
hides both.
