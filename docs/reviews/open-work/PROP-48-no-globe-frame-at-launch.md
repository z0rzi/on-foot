---
severity: should-fix
category: enhancement
size: S
triage: ready-for-agent
source: "agent, 2026-11-02 (split from IDEA-18)"
blocked_by: ["[[PROP-47-restore-free-camera-at-launch]]"]
---
# PROP-48: no globe frame at launch when the camera was free

Last slice of `IDEA-18`. Spec: `docs/design/specs/2026-11-02-last-camera-design.md`. The map store persists to AsyncStorage, which hydrates asynchronously, and
nothing in the app waits for it: the map can mount on the defaults (whole-earth view) before the
restored state arrives, so a restored free camera flashes the globe first.

## Agent Brief

**Category:** enhancement
**Summary:** The map's first rendered frame uses the hydrated store, so a restored free camera shows no globe.

**Current behavior:**
The map mounts without waiting for the map store's hydration.

**Desired behavior:**
- The map mounts only once the map store has hydrated; the native splash (`expo-splash-screen`,
  which auto-hides today) is held over the wait.
- A hydration that fails or never completes does not hold the app: past a bounded wait, the map
  mounts on the defaults (follow) and the debug log records one `warn` line.
- Launches that follow behave exactly as today.

**Acceptance criteria:**
- [ ] The hydration gate's decision (hydrated / timed out) is a pure, tested function or relies on
      the store library's own hydration signal, not a timing guess in a component.
- [ ] Free camera at kill time, relaunch: no globe frame is ever visible (device check, the owner's).
- [ ] `npm run verify` green.

**Out of scope:**
- Hydration of stores other than the map store, unless the same gate covers them for free.
