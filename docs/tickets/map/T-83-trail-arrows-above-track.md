---
severity: should-fix
category: bug
size:
triage:
origin: agent
filed: 2026-11-09
from: "device check of T-74, 2026-11-09"
blocked_by: []
---
# T-83: the trail's direction arrows are drawn above the recorded track

Seen in the device check of T-74 (2026-11-09, release build of `hiking-ux-field` at e6b06c4, mocked
GPS along a synthetic test trail): wherever the recorded track lies over the trail, the trail's
white direction arrows show on top of the orange track. Seen before the kill, after a cold-start
relaunch mid-recording, on both the Outdoors and Default layers, and on the plain (no-elevation)
line as well as the slope-coloured one. The track's colour is opaque (`#FF5722`), so the arrows are
not showing through it. The device-check screenshots were scratch files (gitignored, session
scratchpad) and are not kept.

This contradicts D83 ("the recorded track is always drawn above the shown route"). The arrows'
`SymbolLayer` is inserted with `belowLayerID` set to the route tier's anchor
(`src/map/providers/mapbox/adapter.tsx`, `RouteOverlay`, the `arrowsLayer`), like the trail's line
and casing, which the track does cover. So either the symbol layer is not placed where the anchor
says, or Mapbox draws symbol layers after line layers regardless of their order in the style. Not
investigated: read the rnmapbox and Mapbox behaviour for symbol layers before choosing a fix.

Related: [[T-78-route-tier-remount-above-endpoints]] (ordering inside one tier).
