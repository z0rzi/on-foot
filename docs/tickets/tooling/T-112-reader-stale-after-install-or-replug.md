---
severity: should-fix
category: bug
size: S
triage:
origin: agent
filed: 2026-11-15
from: "device check of the app-log capture, 2026-11-15"
blocked_by: []
---
# T-112: the reader goes stale after an app install or a USB replug, and the toolkit never restarts it

Seen twice in the app-log capture's device check of 2026-11-15: once right after `adb install -r`
of a new build (21:13), once right after the phone's cable was pulled and plugged back (21:31).
Each time the server answered `/status`, so `ensureRunning` (`tools/device-check/reader.ts`) took
it as running, while every `/session/<id>/source` failed on the phone with `Timed out after
10050ms waiting for the root AccessibilityNodeInfo in the active window`. The toolkit's read then
fails with `the reader gave no answer in 10 s twice in a row` (`readTree`, `reader.ts:166`) and
keeps failing on every later command: `cleanup` could not reach either list nor get back to the
map. A force-stop of the two server packages, then any read, started a fresh server that answered
in 0.9 s.

A server that answers its status and fails two source reads in a row is in a state the toolkit can
recover from by restarting it once, as it does for a server that does not answer.
