---
severity: investigate
category: bug
size:
triage:
origin: agent
filed: 2026-11-09
from: "device check of T-74, 2026-11-09"
blocked_by: []
---
# T-84: a relaunch mid-recording does not bring back the last camera

Observed, not investigated, in the device check of T-74 (2026-11-09, release build of
`hiking-ux-field` at e6b06c4): the app was killed from Recents mid-recording, the camera free after
"Frame the whole route" over the test trail. On relaunch (`launch cold start`, then `launch action
resume`) the map opened on the mountain view the check session had started on, not on the framing on
screen at the kill. The last camera (IDEA-18, [[2026-11-02-last-camera-design]]) should have brought
back the framing at the kill.

The same check saw the phone's USB drop every few minutes, and the camera may not have been
persisted before the kill. The debug log of the session is the first place to look. This is also
one of the claims owed in `device-checks.md` for the last camera; confirming or ruling it out
settles both.

Seen again by the owner on the hike of 2026-11-08, with a different symptom: recording along a
trail, app swiped from Recents and reopened, the camera reframed to the trail instead of keeping
the last camera. Whether the camera was following or free is not known. A relaunch should never
fit: `pendingFit` is not persisted (`PersistedMapState`, `src/store/mapStore.ts`) and a restored
selection leaves it null (`MapCanvas`), so a fit at relaunch means something called `select` or
`recenter` on the way back. The debug log of that hike is the first place to look for both cases.

The hike's debug log (exported 2026-11-09, not kept in the repo) has four cold starts with
`launch action resume` for session 120 between 17:24:08 and 17:24:33, the only relaunches of the
recording. None logged `persisted launch camera ignored` or a map store hydration failure, so
`launchCamera` (`src/map/launchCamera.ts`) had a usable follow state and last camera. The log
cannot say more: neither the launch camera's choice (follow or restore) nor a fit and what asked
for it is logged. Logging both is the first step.

Seen again in the device check of 2026-11-09 evening (release build of `hiking-ux-field` at
1b6fdcf, mocked GPS): after a relaunch from Recents mid-recording, the map opened on the camera from
before the check session, not on the view shown at the kill. Observation only; the screenshot was
deleted because it showed a real location.
