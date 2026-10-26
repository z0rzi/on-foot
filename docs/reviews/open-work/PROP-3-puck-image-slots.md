---
severity: minor
category: bug
size: S
triage: ready-for-agent
source: device check, 2026-10-12
blocked_by: []
---
# PROP-3: the custom puck leaves Mapbox's top and shadow image slots unset

Observed on the device during the ARCH-3 check. logcat repeats
`E Mapbox: [maps-android\LocationPuck2D]: No image holder data for mapbox-location-top-icon!` and
the same for `-shadow-icon`, once per puck re-render. `UserPuck` in the mapbox adapter supplies
only `bearingImage`, so the default top and shadow images are never registered. The puck renders
correctly, so this is log noise rather than a visual defect — but it is per-frame noise in the
platform log, the same class of repeating-benign-entry problem ERR-7 describes for the debug log.
Cause is inferred from the adapter, not confirmed; worth one look at whether `LocationPuck` wants
`topImage`/`shadowImage` alongside a custom `bearingImage`.

## Agent Brief

**Category:** bug
**Summary:** The Mapbox puck registers its top and shadow images so the per-render logcat error stops.

**Current behavior:**
The Mapbox provider's user puck passes only `bearingImage` to `LocationPuck`. logcat repeats
`No image holder data for mapbox-location-top-icon!` and the same for `-shadow-icon` on every puck
re-render. The puck renders correctly. The cause is inferred, not confirmed.

**Desired behavior:**
First confirm from `@rnmapbox/maps`' sources or types that a custom `bearingImage` leaves the
default top and shadow slots unregistered. If so, supply `topImage` and `shadowImage` (transparent
or matching images) so nothing is missing. If the sources say otherwise, record what was found in
this ticket and stop.

**Key interfaces:**
- `LocationPuck` props: `bearingImage`, `topImage`, `shadowImage`.
- The provider's puck component, inside the map provider seam only.

**Acceptance criteria:**
- [ ] The cause is confirmed or refuted from the library's sources, written in the commit or ticket.
- [ ] If confirmed, the puck sets all three image slots and looks the same as today.
- [ ] No map SDK import leaves `src/map/providers/`.
- [ ] The owner checks on the device that logcat no longer shows the error (owner's step).

**Out of scope:**
- Redesigning the puck.
