---
severity: investigate
category: bug
size:
triage: needs-info
origin: agent
filed: 2026-09-10
from: "[[2026-09-10-full-review]]"
blocked_by: []
---
# T-5: a crash in a relaunched recording process can hang instead of dying

Seen once, unconfirmed. Ironically harder to reproduce now that `FIELD-4` — the crash that
produced it — is fixed.

## Triage Notes

**What we've established so far:**

- Seen once, after a relaunch following the `FIELD-4` crash, which is now fixed.
- The process hung instead of dying; no reproduction since.

**What we still need from you (@owner):**

- A second occurrence: the debug-log export and the `adb` exit-info/dropbox evidence from that run.
- Whether the hang happened on the relaunched recording process or on the UI process.

## The crash runs of 2026-11-15

The device check of [[2026-11-14-recording-survives-process-death-design]] (release builds of the
feature, mock walk) sent six `am crash` mid-recording, and none hung. Four hit a relaunched
process, one that had started headless while the app was dead and was then opened: pid 4592 at
19:08:43 (born after an `am stop-app`), 12442 at 18:41:26 and 5231 at 19:33:36 (each born after an
earlier crash), and 23901 at 16:16:07 (born headless; its log holds no earlier crash). Each logged
`FATAL EXCEPTION: main` (`CrashedByAdbException: shell-induced crash`); where the system's own lines
were captured (`item04`), `has died` followed within 0.2 s. While the walk moved, the next delivery
ran in a new process 1 to 8 s after the crash; after 5231, with the walk standing still, the new
process started within 2 s and handled its first job at the reopen. The other two (pids 32326 and
714) died the same way. Evidence:
`.scratch/device-checks/2026-11-15/rsp-01/crash-round2.txt`, `item02-dead-logcat.txt` and
`item04/logcat-full.txt`, not kept in the repo.

`am crash` throws on the main thread from outside, not from inside the app the way `FIELD-4` did,
so this rules out a relaunched process that cannot die, not a crash of the app's own that hangs.
The error handler set in bootstrap would give such a crash a trace, in a headless runtime too.
