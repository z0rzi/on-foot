---
severity:
category: idea
size:
triage:
origin: owner
filed: 2026-11-11
from: "[[2026-11-11-overview-on-map-design]]"
blocked_by: []
---
# T-99: look at another trail while recording, without changing the trail followed

Owner idea, from the grilling of the overview spec. Mid-hike, a known trail crosses the one
followed; the owner taps it and wants its card, then goes back to the recording card with the
followed trail unchanged.

The overview spec stops at a toast naming the tapped trail (D114), because while recording the
trail shown **is** the trail followed: it is what gets linked to the activity at save
(`alongTrailId`). A peek means splitting the two, which touches the selection model, the pill and
the card.

If built, it lifts three rules: the toast of D114, the question asked before switching trail from
the list (hiking-ux §4.7), and the refusal to open an activity while recording.
