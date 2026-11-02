---
severity: should-fix
category: enhancement
size: M
triage: ready-for-agent
source: "agent, 2026-11-02 (split from IDEA-18)"
blocked_by: ["[[PROP-46-camera-port-full-framing]]"]
---
# PROP-47: a free camera is restored at launch

The demoable slice of `IDEA-18`. Today the follow state and the camera are session-only, so a
relaunch — including a background kill while the save-activity screen is open (the merged
`FIELD-37`) — always re-follows the user from the globe.

## Agent Brief

**Category:** enhancement
**Summary:** Persist the follow state and the last camera; a launch with a free camera opens on it.

**Current behavior:**
Every launch starts in position follow; `followMode` and the camera are not persisted.

**Desired behavior:**
- The follow state is persisted exactly (position, position and heading, or free).
- The last camera is captured whenever the camera comes to rest (debounced) and persisted.
- At launch: following → follow as today; free with a valid last camera → the map starts on it via
  the port's initial camera, follow off; free with an invalid or missing last camera → follow as
  today, plus one `warn` line in the debug log (accuracy-free: no coordinates).
- The restored view stands whatever the user's current distance from it; the position button
  re-follows as today.
- A restored trail selection keeps today's rule: overlay shown, no fit.

A brief globe frame before the restored camera is tolerated here; `PROP-48` removes it.

**Key interfaces:**
- A pure launch-camera resolution helper (follow state + last camera → what the camera does at
  launch) and a pure last-camera validity predicate (finite numbers, zoom within the provider's
  range), both TDD'd.
- The map store's persisted subset gains the follow state and the last camera.

**Acceptance criteria:**
- [ ] Helpers tested first: following, free + valid, free + invalid, free + missing.
- [ ] Pan the map, kill the app, relaunch: same framing, pitch and heading (device check, the owner's).
- [ ] Following at kill time, relaunch: as today (device check, the owner's).
- [ ] `npm run verify` green.

**Out of scope:**
- Holding the first frame until hydration (`PROP-48`).
- Any distance threshold.
- Persisting a pending fit or an activity selection.
