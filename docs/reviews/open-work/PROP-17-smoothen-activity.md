---
severity:
category: enhancement
size:
triage: needs-triage
source: "owner, tasks.md (moved 2026-10-26)"
blocked_by: []
---
# PROP-17: smoothen an activity's GPS jumps

Owner idea. The GPS sometimes jumps ~500 m away; detect rapid shifts and correct them. The debug
log records each fix batch's best accuracy and whole-metre distance from the previous point, so a
jump leaves evidence to design against.
