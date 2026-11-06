# Pending device checks

A finding can be closed on the code while still carrying a visual or runtime claim no device has
confirmed; that caveat then lives inside the closed finding's own note, where no ticket surfaces
it. This file is the one place that lists such a claim — both the ones still waiting and the
residue a completed check could not reach. Ticket names below predate 2026-11-06 and keep their
prefix; see `README.md`.

- **ERR-1 and ERR-2** were checked on a device on 2026-10-10, and ERR-2's distinct "no route"
  message on 2026-10-26; the evidence sits in their own notes in the authoritative document. One
  fragment stays unobserved: whether `stopLocationUpdatesAsync` ever fails in practice (it has not
  been seen to).
- **ARCH-3** (row 10, ticket 2, `d08668c`) was checked on the device on 2026-10-12. `normal` is
  north-up and flat with the puck centred; `compass` tilts and rotates heading-up while holding the
  puck at the same screen point, and Mapbox's `LocationCompassEngine` registers the rotation-vector
  sensor on entry and unregisters it on exit — `FollowWithHeading` reaching the native layer. A
  manual pan clears follow. No `UserTrackingMode` error in logcat. The port has since stopped
  speaking Mapbox's words (`PROP-2`): it carries `position` / `positionAndBearing`, the Mapbox
  adapter maps them to `normal` / `compass`, and `course` is gone. **Unobservable**: the 2D/3D
  `content-desc` cannot be read while compass-follow animates — `uiautomator dump` returns `could
  not get idle state` and can serve a stale file, so that label is evidence only in a screenshot.
- **Not enough disk space for an offline download** is implemented but never checked on a device:
  it would mean filling the phone's storage. The refusal writes a debug-log entry with the needed
  and free bytes, so a field occurrence leaves evidence.
- **ERR-4, ERR-5, ERR-8** were checked on 2026-10-26 on every path a device reaches: the
  recording-tap toast, a cancelled pick doing nothing, and the Trails and Activities tabs and the
  offline maps list refreshing on focus. What needs a forced failure stays unobserved: ERR-4's pack
  registered after a failed launch-time load, ERR-5's alert for a rejecting picker, ERR-8's failure
  toast on a read error.
- **Map twist** (the north button after a two-finger rotation): `adb` cannot inject multi-touch on
  this phone (`sendevent` is refused by SELinux), so any rotation check is the owner's.
- **IDEA-17, the fix gate** (`feat/fix-gate`, [[2026-10-27-fix-gate-design]]) is built and
  unit-tested, never run on a device. Two checks are owed, both in the spec's "Device check": a
  2-minute indoor standstill (no segment longer than ~50 m, `droppedAccuracy > 0` in at least one
  `fix batch`), and a walk of known length under open sky (distance within ~5 %, `droppedJump` 0 or
  near it). The four constants are reasoned, not calibrated; the new `fix batch` fields are what
  calibrates them.
- **The 2026-11-01 batch** (PROP-41, PROP-40, PROP-6, FIELD-35, PROP-42, PROP-39, PROP-2, PROP-3)
  was checked on the device on 2026-11-02, release build. Confirmed: a re-imported GPX lists `d'`
  and `&`; deleting a linked trail with its activity selected logs no `linked trail not found`
  and a rename updates the "View linked trail" label; the five area chips filter, all off shows
  "No entry in the selected areas."; every pushed screen has a dark header in dark scheme; the
  free-mode `app active` entry reads `sheetTop: 0`; the follow cycle and pan-cancel behave as
  ARCH-3 saw them; logcat holds no `No image holder data` across cold starts. Found and filed:
  `T-43` (status bar stale after a live scheme switch) and `T-44` (activity sheet left
  off-screen once after a trail rename). Residue, unobserved: the Share export's content under a
  filter (the code exports the unfiltered list); a single-frame flash of the controls at the old
  sheet edge, finer than the ~0.3 s screenshot interval; a late gorhom `animatedPosition` write
  after the unmount reset; the three stored `d&#039;` names, which the owner renames. The map tab's
  status bar over light Mapbox styles in dark scheme stays the owner's call, not built.
- **IDEA-18, the last camera** (PROP-46, PROP-47, PROP-48, [[2026-11-02-last-camera-design]]) is
  built and unit-tested, never run on a device. Owed, the owner's: pan, tilt and rotate, kill,
  relaunch → same framing, pitch and heading, with no globe frame at any point (the splash holds
  until the map mounts on it); following at kill → relaunch opens on the last camera with no globe frame, then moves to the user; kill with the
  save-activity screen open while free → the map comes back on the last camera; the North button
  still appears after a rotation and resets. Unobserved by construction: the bounded wait's `warn`
  line (`map store hydration timed out` / `failed`), which needs a broken AsyncStorage.
