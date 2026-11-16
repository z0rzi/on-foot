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

## The start time `native-errors` prints (check-hooks final check, 2026-11-16)

Folded in at filing, as its fix is a line of the same function. `reportNativeErrors` prints the
pid's start from `ps -o STIME=` (`tools/device-check/nativeErrors.ts:17-19`), which on Android is
when the zygote pre-forked the process (the USAP pool), not when On Foot launched in it. The
check-hooks final check's report (part 1, "Other observations"; part 2, "Other observations")
saw `On Foot pid 31672, started 09:30:28` for a process whose first log line is 10:02:26 (`ps`
ELAPSED 32:10), and `pid 5505, started 10:01:12` for one that launched at 10:05:40. Only the
printed time is wrong: the logcat read is filtered by pid. The launch time is the pid's first
logcat line, or the app's own `launch cold start` entry.
