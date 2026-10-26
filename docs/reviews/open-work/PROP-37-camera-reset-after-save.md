---
severity:
category: bug
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# PROP-37: saving or discarding an activity resets the camera

Owner observation. After saving (or discarding) an activity, the camera goes back to the
whole-world view and re-zooms to the user instead of keeping the bounds it had. Same root as
`PROP-18` (start from the last camera position).
