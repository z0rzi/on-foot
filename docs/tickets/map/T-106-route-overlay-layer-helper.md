---
severity: minor
category: refactor
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-14
from: "DUP-5 in [[2026-11-14-full-review]]"
blocked_by: []
---
# T-106: `RouteOverlay` repeats its casing, line and arrows block for each source

`src/map/providers/mapbox/adapter.tsx:238-276`: the slope source and the plain source each declare
a casing `LineLayer`, a line `LineLayer` and the arrows layer. The blocks differ only in their ids
(`${tier}-slope-casing` / `${tier}-line-casing`, …) and `lineColor`, and each is under the
duplication gate's 8-line window.

## Agent Brief

**Category:** refactor
**Summary:** One `routeLineLayers(idPrefix, lineColor)` helper inside the adapter, used by both
sources. Same layers, same ids, same stacking.

**Desired behavior:**
- The helper stays inside `src/map/providers/mapbox/`, since it is provider-specific.
- Layer ids, `belowLayerID` stacking and paint are unchanged. Read `docs/architecture/mapbox-gotchas.md`
  before touching a layer.

**Acceptance criteria:**
- [ ] One declaration of the casing, line and arrows triple.
- [ ] Device check through the `device-check` skill: a trail with slope colouring and one without,
      both tiers, with arrows and casing drawn and stacked as before. Needs the phone, which was
      busy on 2026-11-14.
- [ ] `npm run verify` green.

**Out of scope:**
- Any change to how the route looks.
