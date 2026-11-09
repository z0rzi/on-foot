---
severity:
category: idea
size:
triage:
origin: owner
filed: 2026-11-09
from:
blocked_by: []
---
# T-26: show all my activities on the map

Owner idea. Every recorded activity is on the map at once: zoomed out you see roughly where your
hikes were, zoomed in you see each one. Start point only or the whole track is open; the track is
preferred.

Drawing many lines is cheap; getting them into the map is what costs. The full track is stored as
text (`activities.geometry`, `src/data/db/schema.ts`), and parsing it is part of the 657 ms one
long trail selection costs (T-4). Each change of a `ShapeSource`'s `shape` repeats the parse, the
bridge crossing and the native tiling. On the GPU, the layer count is what costs, not the
feature count. That points to:

- a simplified geometry stored at save time, so the overview never parses full tracks;
- one collection overlay on the map port (one source, one line layer, a feature per activity),
  not the route overlay mounted N times;
- clustered start points zoomed out, lines from some zoom on; a tap opens the selected-activity
  flow.

Figure out the UX first.
