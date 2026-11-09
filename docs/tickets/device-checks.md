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
  `PROP-43` (status bar stale after a live scheme switch) and `PROP-44` (activity sheet left
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
- **T-76, the trail's specs on the recording card** ([[2026-11-06-hiking-ux-design]], D81) was
  checked on the device on 2026-11-09, both schemes, with the recording card and the trail card. One
  fragment stays unobserved: the trail card swapping its badge for the download progress, since no
  download ran.
- **T-74, the route tiers** (D83, [[2026-11-06-hiking-ux-design]]) was checked on the device on
  2026-11-09, release build. Confirmed: after a cold-start relaunch mid-recording (`launch action
  resume`), and after switching Outdoors → Default → Outdoors, the recorded track's line covers the
  trail's line and casing (slope-coloured; the plain line too, seen without a relaunch); a trail
  shown alone draws its casing, arrows and both endpoints. Contradicted: the trail's direction
  arrows draw above the recorded track wherever they overlap, before and after the relaunch and on
  both layers.
- **T-77, T-80, T-81 and T-82, the ahead lines on the recording card** ([[2026-11-06-hiking-ux-design]],
  D81; [[2026-11-09-walking-time-ahead-design]], D84, D85, D86, D87; review rulings D89, D91, D92)
  were checked on the device on 2026-11-09, release build of `1b6fdcf`, with mocked GPS replays
  along synthetic test trails, both schemes. Confirmed: under the Along row, two lines behind the
  flag and mountain icons, "2.0 km · 27 min left" over "Next climb in 400 m · 5 min · 40 m up",
  then "Climbing · 38 m up · 6 min to the top" on the climb and "No climb left" past it, following
  the graph's puck with every time shrinking; at the trail's end "0 m left" with no time; off the
  trail the one line "Not on the trail" behind its marker, back on → the two lines; a trail with no
  elevation profile shows no ahead lines. The personal factor: three saved 2.4 km activities walked
  at 2.5 m/s (factor 0.56) made a 1.7 km trail's start read "13 min left" and "7 min" to the next
  climb where Tobler alone gives 23 and 12, unchanged after a pause and resume, after a relaunch
  from recents and after a cold relaunch mid-recording (both logged `launch action resume`), with
  no `personal factor history read failed` line in the debug log; the owner's own history had read
  "27 min" where Tobler alone gives 26. The lines sit up to 10 m behind a walker who stops (the
  recording's 10 m minimum distance), so a stop 5 m short of the end reads "5 m · 1 min left".
  Unobserved: a fresh install reading Tobler's times (it needs an empty activity list).
- **T-79, durations in "min" and "h"** (D88, [[2026-11-09-walking-time-ahead-design]]) was checked
  on the device on 2026-11-09. Confirmed: the save-activity screen's Duration reads "3 min 02 s" and
  "20 min 46 s", the activity card's "3 min 02 s" and "4 h 14", the Activities list's lines
  "134 m · 3 min 02 s" and "16.2 km · 4 h 14", while the pill's stopwatch reads "3:01" and "16:16"
  and the banner's "Recording · 27:17". Unobserved: a stopwatch past an hour ("1:02:00"), as no
  recording ran an hour.
- **T-90, climbs from steep stretches** (D93, [[2026-11-09-walking-time-ahead-design]]) was checked
  on the device on 2026-11-09, with the T-77 replays. Confirmed: on a trail climbing 40 m at 10 %
  from 400 m then rising 16 m at 2 % over 800 m, "Next climb in 400 m · … · 40 m up", "Climbing ·
  21 m up" at 600 m and "No climb left" at 860 m, on the gentle rise; on a trail with a lone 10 m
  step at 300 m and a 40 m climb at 1000 m, "Next climb in 988 m · … · 39 m up" from the start and
  "Next climb in 649 m" on the step itself, "Climbing · 30 m up" at 1100 m, "No climb left" past
  1400 m.
- **T-91, T-92, T-93 and T-94** ([[2026-11-06-hiking-ux-design]], D94–D101, §4.4): T-91 to T-93 were
  seen by the owner on 2026-11-09 along `DEVCHECK climb` (T-94 came of it); T-94's summary row,
  divider and tighter title were seen on the device the same day; the D99 climbing line and the D100
  end line are unit-tested, never seen on a device. Owed, both schemes: recording along a trail with
  the card open, the Along row with the summary row tight under it on one line ("Easy · 2.0 km · 56
  m gain"), the ahead lines in the primary text with "Trail end in 16 min (1.3 km)", "Next climb in
  12 min (1.2 km) · 340 m to climb" and "Climbing · 10 min to the top (43 m up)", then the
  description behind a divider in the secondary text, and no metrics grid, while the trail card
  keeps its grid and the Trails and Activities rows lead their summary with the badge on one line
  (Verification 21); the graph puck's centre on the line at the profile's lowest and highest points
  and its first and last metre, whole, reaching into the card's margin, the scrub cursor passing
  under it (Verification 24); along `.scratch/device-checks/2026-11-07-hiking-ux-feedback/climb.gpx`
  (146–202 m, the profile the overlap was seen on, not the 155–211 m first reported) the y-axis
  reads "180 m" and "160 m", apart, with no label over the top 20 m.
