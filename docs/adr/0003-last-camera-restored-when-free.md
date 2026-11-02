# The last camera is restored at launch when the camera was free

The restore-last-map-state spec (2026-08-21) locked "follow me, trail overlaid": every launch
re-follows the user, and follow mode, camera position, pitch and heading stay session-only. In the
field that meant a relaunch — the system kills the app in the background (`FIELD-1`), including
while the save-activity screen is open — always came back on the globe and swept to the user,
throwing away a framing the owner had set by hand. We reverse the session-only rule (2026-11-02):
the follow state is persisted exactly as it was, and when the camera was **free** at the last
leave, its **last camera** (centre, zoom, pitch, heading) is persisted too and the map opens
directly on it — no globe frame, no sweep. When it was **following**, launch re-follows as before:
the camera was the user, there is nothing else to restore. A free camera is a deliberate intention,
so the restored view stands even when the user is now far from it; the position button is one tap
away.

**Considered and rejected:** always restoring the camera and only following on tap — breaks the
reflex "open the app on the trail, see yourself", the common case. A distance threshold that
re-follows when the user is far from the last camera — a heuristic to tune and to explain, added
only if use shows the need. Restoring the camera and then re-following once a position arrives —
cosmetic, it only hides the globe. Capturing the camera only on backgrounding instead of on every
camera idle — depends on a lifecycle event and misses a foreground crash (`FIELD-5`) for no
saving worth having.
