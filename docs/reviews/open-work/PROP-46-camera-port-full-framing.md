---
severity: should-fix
category: enhancement
size: S
triage: ready-for-agent
source: "agent, 2026-11-02 (split from IDEA-18)"
blocked_by: ["[[PROP-45-last-camera-spec]]"]
---
# PROP-46: the map port reports the full framing and accepts an initial camera

Prefactor for `IDEA-18`, no visible change. The port's camera-changed event carries the heading only
(all the North button needed), and its camera component has no way to start anywhere but the
provider's default — the whole-earth view.

## Agent Brief

**Category:** enhancement
**Summary:** Extend the map port so shared code can read the camera's framing and set where it starts.

**Current behavior:**
`MapViewProps.onCameraChanged` delivers `{ heading }`. `CameraProps` describes follow and pitch only;
the first frame is always the provider's default camera.

**Desired behavior:**
- The camera-changed event delivers centre, zoom, pitch and heading, SDK-neutral.
- `CameraProps` accepts an optional initial camera (the same four values) that the provider applies
  as the camera's starting framing, before the first rendered frame, without animation.
- Both translated in the provider directory only; shared code never sees SDK types.
- No caller passes an initial camera yet; the North button and every current camera behaviour are
  unchanged.

**Key interfaces:**
- A shared framing type on the port (centre, zoom, pitch, heading), reused by `PROP-47` for the last
  camera.

**Acceptance criteria:**
- [ ] The port's camera-changed payload and `CameraProps` carry the framing type.
- [ ] `npm run verify` green, seam test included.
- [ ] North button still appears and resets as before (device check, the owner's).

**Out of scope:**
- Capturing, persisting or restoring anything (`PROP-47`).
