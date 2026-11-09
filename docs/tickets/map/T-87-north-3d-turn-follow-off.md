---
severity: 
category: bug
size:
triage:
origin: owner
filed: 2026-11-09
from: "field notes, hike of 2026-11-08"
blocked_by: []
---
# T-87: the North and 3D buttons turn follow off

Seen by the owner on a hike: pressing North or 3D stops the camera following them; it should keep
following. Not a regression, it has been so since the controls were written (2026-08-19/20):

- 3D: `handleToggle` (`src/map/MapControls.tsx`) calls `disableFollow()` before animating the
  pitch, and so does the vertical tilt drag (`pan`'s `onBegin`).
- North: `northPressed` (`src/store/mapStore.ts`) demotes compass follow to position follow, which
  keeps following; from position follow it sets `followMode: 'off'` and fires the one-shot north
  reset.

Both leave follow because rnmapbox ignores an imperative camera move while following
(`CameraController`, `src/map/provider/types.ts`). rnmapbox's `Camera` also takes `followPitch` and
`followHeading` (`node_modules/@rnmapbox/maps/src/components/Camera.tsx`), a declarative pitch and
heading while following; whether they do this on Android is unchecked. A fix goes through the
map port, not the Mapbox props directly.
