---
severity:
category: idea
size:
triage:
origin: agent
filed: 2026-11-10
from: "[[T-97-graph-puck-wrong-leg-on-ground-covered-twice]]"
blocked_by: []
---
# T-98: on a loop started away from its drawn start, the distance left is not the distance back

A walker who parks somewhere along a loop and walks all of it is placed correctly: on
`[0,0],[400,0],[400,400],[0,400],[0,0]`, a lap begun at 600 runs the puck to 1600, wraps to 50 and
ends at 600 (measured on `stepAlongTrail`, 2026-11-10). The ahead lines are the part that is off:
`trailAhead` counts toward the trail's own end (`leftMeters: profile.totalDistance - at`,
`src/elevation/trailAhead.ts:54`), so back at the car the card reads 1000 m left, and past the
drawn start it counts down a lap the walker has already done the rest of.

The idea: on a trail whose start and end are the same place, count what is left to where the
recording joined the trail, wrapping through the drawn start. To explore: what "a loop" is
(the trail's two ends within the match radius of each other), what the graph shows (the profile
as drawn with the puck wrapping, or rotated to start where the walker did), and how it reads
with a reversed trail ([[T-96-detect-reversed-hike]]).
