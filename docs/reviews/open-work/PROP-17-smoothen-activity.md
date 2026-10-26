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

## Comments

> *Comment written by an AI agent.*

Reproduced 26/10, phone lying still on a desk. Nothing filters fixes at capture:
`src/recording/locationTask.ts:20-28` keeps every fix in the segment, whatever its accuracy. Fixes
with 383 m and 390 m accuracy were kept, alternating between two points ~675 m apart:
`"kept":1,"bestAccuracy":383.1,"metresFromPrevious":675`. Result: 1.3 km in one minute without
moving, and a straight red line on the map. It is also the cause of `PROP-38`'s absurd pace. An
accuracy threshold at capture would be a simpler first step than smoothing after the fact.
Evidence: `.scratch/device-checks/2026-10-26/C/25-*`, `26-*`.
