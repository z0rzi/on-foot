---
severity:
category: bug
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# FIELD-37: saving or discarding an activity resets the camera

Owner observation. After saving (or discarding) an activity, the camera goes back to the
whole-world view and re-zooms to the user instead of keeping the bounds it had. Same root as
`IDEA-18` (start from the last camera position).

## Comments

> *Comment written by an AI agent.*

Not reproduced 26/10. Camera set at street level then panned before stopping; after "save" as after
"discard", every frame (one every ~0.45 s for 6 s) keeps exactly the same framing. The only "globe
then zoom to the user" sweep seen in the session is a cold start's. Hypothesis: the save observed
followed a process relaunch. Evidence: `.scratch/device-checks/2026-10-26/C/23-after-save-*`,
`30-after-discard-*`.
