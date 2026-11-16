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

## A toast fails every read (agent, 2026-11-16)

Folded in from the check-hooks owed checks of 2026-11-16 (release build of `f864514`): the fix
lands in the same read path, `readTree` (`tools/device-check/reader.ts:166-180`). While an
Android toast is on screen, every `/session/<id>/source` fails on the phone with `Cannot set
AccessibilityNodeInfo's field 'mSealed' to 'true'` (a `NoSuchFieldException: No field mSealed` in
the server's `UiElementSnapshot.addToastMsg`), so the server's toast capture never works on this
Android 13 phone. `readTree` throws the answer as a `ReaderAnsweredError`, which `pollScreen`
(`look.ts`) waits through as a hand-over between screens. So every confirm tap whose screen shows
a toast (`Trail deleted`, `Activity deleted`, `Offline map ready`) took 4.1 to 4.6 s to settle,
and a lone `labels` right after a download failed with `the reader failed: unknown error: Cannot
set AccessibilityNodeInfo's field 'mSealed'…`. A toast's text is read from a `frames` strip
started with the tap; with the capture broken, turning it off in the session's settings
(`openSession`, `reader.ts:158`) or treating this answer apart loses nothing the reader gives
today.
