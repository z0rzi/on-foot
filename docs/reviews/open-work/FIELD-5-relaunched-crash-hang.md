---
severity: investigate
category: bug
size:
triage: needs-info
source: "[[2026-09-10-full-review]]"
blocked_by: []
---
# FIELD-5: a crash in a relaunched recording process can hang instead of dying

Seen once, unconfirmed. Ironically harder to reproduce now that `FIELD-4` — the crash that
produced it — is fixed.

## Triage Notes

**What we've established so far:**

- Seen once, after a relaunch following the `FIELD-4` crash, which is now fixed.
- The process hung instead of dying; no reproduction since.

**What we still need from you (@owner):**

- A second occurrence: the debug-log export and the `adb` exit-info/dropbox evidence from that run.
- Whether the hang happened on the relaunched recording process or on the UI process.
