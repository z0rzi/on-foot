---
severity: minor
category: bug
size:
triage:
origin: agent
filed: 2026-11-09
from: "[[2026-11-06-hiking-ux-design]]"
blocked_by: []
---
# T-78: a route source that remounts later is drawn above its own overlay's arrows and endpoints

Found in the review of T-74 (D83). The tiers fix orders the overlays against each other, not the
layers of one overlay. Every layer of a route overlay is inserted just below its tier's anchor
(`belowLayerID`, `src/map/providers/mapbox/adapter.tsx:176-290`), and rnmapbox adds a layer as it
mounts, so within a tier the stack is mount order. On the first mount that is the JSX order: the
slope or plain line source (casing, line, arrows, `adapter.tsx:211` / `:232`), then the connectors
(`:254`), then the endpoints (`:264`), endpoints on top.

A source that mounts later lands at the top of its tier instead: switching between the slope and
the plain line (`useColoured`, `adapter.tsx:198`) remounts the line source, whose casing, line and
arrows then cover the endpoint dots; connectors appearing after the first render are drawn over the
arrows and the endpoints. Pre-existing: before T-74 the same layers were added on top of the whole
stack the same way (T-74's own ticket named "a trail source that remounts later (slope / plain
switch, connectors appearing)"); T-74 confined it to the tier. Not seen on the device yet.
