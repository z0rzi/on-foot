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
  calibrates them. The standstill was run on 2026-11-14 (release build installed 2026-11-13, real
  GPS, phone still on its cable, 2 min 13 s) and is inconclusive: the recording read 0 m, but only
  two deliveries arrived, both at 3 m accuracy, so `droppedAccuracy` stayed 0 and rule 1 never
  fired. It is still owed, somewhere the GPS is poor. The open-sky walk is still owed.
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
  built and unit-tested. Checked on the device on 2026-11-17, release build of `9c71917`, on a
  process that died with the swipe (a paused agent session, so no foreground service): with the
  save-activity screen open, camera free on a framed route, rotated, then again pitched in 3D, each
  relaunch logged `launch camera` `restore` `from: true` and opened on the map with the same framing,
  pitch and heading, the North button shown. **Failed on a warm runtime**: when the swipe leaves the
  process alive (a running recording), the reopen logs `cold start` with a large `runtimeAgeMs` and
  no `launch camera`, and opens on the camera of the process's first launch, free or following;
  cause and evidence in [[T-84-relaunch-old-camera]]. Owed, the owner's: pan, tilt and rotate by
  hand (no gesture injection on this phone: `zoom` and `sendevent` are refused by SELinux), and no
  globe frame at any point (the launch is faster than a frame strip reaches On Foot in front).
  Unobserved by construction: the bounded wait's `warn` line (`map store hydration timed out` /
  `failed`), which needs a broken AsyncStorage.
- **T-74, the route tiers** (D83, [[2026-11-06-hiking-ux-design]]) was checked on the device on
  2026-11-09, release build. Confirmed: after a cold-start relaunch mid-recording (`launch action
  resume`), and after switching Outdoors → Default → Outdoors, the recorded track's line covers the
  trail's line and casing (slope-coloured; the plain line too, seen without a relaunch); a trail
  shown alone draws its casing, arrows and both endpoints. The trail's arrows and endpoint dots draw
  above the recorded track's line, as Mapbox draws symbol and circle layers with terrain on; D102
  keeps them there.
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
  and the banner's "Recording · 27:17". On 2026-11-17 an agent session ran past an hour: the pill
  read "1:01:25", the banner "Recording · 1:02:01" and the save screen's Duration "1 h 02".
- **T-90, climbs from steep stretches** (D93, [[2026-11-09-walking-time-ahead-design]]) was checked
  on the device on 2026-11-09, with the T-77 replays. Confirmed: on a trail climbing 40 m at 10 %
  from 400 m then rising 16 m at 2 % over 800 m, "Next climb in 400 m · … · 40 m up", "Climbing ·
  21 m up" at 600 m and "No climb left" at 860 m, on the gentle rise; on a trail with a lone 10 m
  step at 300 m and a 40 m climb at 1000 m, "Next climb in 988 m · … · 39 m up" from the start and
  "Next climb in 649 m" on the step itself, "Climbing · 30 m up" at 1100 m, "No climb left" past
  1400 m.
- **T-91, T-92, T-93 and T-94** ([[2026-11-06-hiking-ux-design]], D94–D101, §4.4): T-91 to T-93
  were seen by the owner on 2026-11-09 along `DEVCHECK climb` (T-94 came of it); T-94's summary
  row, divider and tighter title were seen on the device the same day. On 2026-11-16, in the
  phone's current scheme, in the check-hooks check ([[2026-11-15-check-hooks]]), recording along
  `DEVCHECK climb` with the card open: the Along row with "Easy · 2.0 km · 56 m gain" tight under
  it on one line, the ahead lines in the primary text with the D100 end line "Trail end in 27 min
  (2.0 km)" and the D99 climbing line "Climbing · 10 min to the top (51 m up)", and no metrics
  grid; with the trail shown alone, its graph's y-axis reads "180 m" and "160 m", apart, with no
  label over the top 20 m. Recording along `DEVCHECK owed desc` with a description set through the
  trail form, a hairline divider under the ahead lines and the description under it in the
  secondary text (Verification 21's divider). On 2026-11-17, release build of `9c71917`, along
  `DEVCHECK owed climb` (a dip, a flat, a 10 % climb, a descent): the D99 next-climb line "Next climb
  in 12 min (979 m) · 79 m to climb", "Climbing · 7 min to the top (64 m up)", "No climb left" and
  "At the trail end"; the trail card keeping its grid; the Trails and Activities rows leading their
  summary with the badge on one line; the graph puck's centre on the line near the first metre, at
  the lowest and highest points and at the last metre, whole, reaching into the card's margin; then
  in dark scheme the recording card (Along row, summary row, ahead lines, no grid) and both lists.
  Owed: the description divider and the next-climb and climbing lines in dark; the scrub cursor
  passing under the puck. Seen in passing and filed as
  [[T-122-open-card-clips-grown-ahead-lines]]: a card opened while "Not on the trail" hides the
  climb line under the nav row once the two ahead lines arrive.
- **draped-route-overlay/01, the in-tier layer order** (T-78, D83, D102)
  was checked on the device on 2026-11-10, terrain on, along a trail on two segments whose dashed
  connector crosses its own line, on builds whose arrows and dots were draped lines (items 02 and 03,
  since restored to the symbol and circle layers by D102). Confirmed for the line layers, which did
  not change: the connector's dashes draw over the line and its casing on the slope-coloured trail,
  on the same geometry imported without elevation (plain line), back on the slope-coloured one, after
  a relaunch on Default and after switching Default → Outdoors live. The slope ↔ plain switch was
  made by switching between the two trails, not within one. A connector mounting after the rest of
  its overlay (a spike handing the route its connectors 6 s late) draws over the line and casing;
  a live track resumed away from its pause point draws its late connector. The order has since
  become casing, line, connectors, arrows, endpoints (D102). **Unobservable** with terrain on: the
  markers' place among the lines, Mapbox drawing the arrows and dots above every line whatever
  their place in the style. On 2026-11-17 (`9c71917`), selecting the same two-segment trail: the
  connector's dashes over the slope-coloured line and casing once settled. **Unobservable**: the
  plain line before the slope one within that selection (the T-78 remount), as the derivation lands
  75 ms after the load and a frame strip's frames are 0.65 s apart; a smoothing change does not
  re-derive the shown route. A trail
  shown alone draws both endpoint dots over its arrows: seen on 2026-11-16 along `DEVCHECK owed
  zigzag`, a line running back and forth so its arrows cross both ends, arrow strokes passing
  under each dot and out at its rim.
- **Field diagnostics** ([[2026-11-11-field-diagnostics-design]]) was checked on the device on
  2026-11-11, on a release build of the branch, under a mock walk along a straight 1.5 km route,
  all read in Settings → Debug log. Confirmed: selecting a trail (an import) and an activity (a
  save) each writes `fit requested` (`by: select`), `route loaded`, `route derived` and `fit fired`
  with their `kind`, `points` and `ms` (T-4, T-84); three cold starts each write one `launch camera`
  (`kind: restore`) and one `puck mounted`, with no other mount in the process, and the puck is
  drawn with its heading arrow (T-84, T-89); a recording writes `heading watch` `on: true` at its
  start and `on: false` at its pause and when the app leaves the front, and a `heading sample`
  after five minutes; with the phone lying still while the mock walked, `heading stalled` was
  written once after 64 s and 78 m, and `heading resumed` when the phone was picked up (T-89).
  Not seen, none being provoked: `delivery fault`, `delivery waiting`. Owed, the owner's, in the
  field:
  - **T-4**: select a long real trail, then a long real activity, and read `route loaded` and
    `route derived`; their `ms` say whether the load or the derivation is worth deferring.
  - **T-89**: record a real walk. A healthy compass leaves a `heading sample` every five minutes
    and no `heading stalled`; when the puck's arrow freezes, the log should hold a
    `heading stalled` near that time (the compass went silent) or none (the compass still turned,
    so the fault is in the drawing), and any `puck mounted` after the cold start's.
  - **T-84**: when a launch opens on the wrong view or a route is not framed, read
    `launch camera` (which branch ran) and whether each `fit requested` has its `fit fired`.
- **The family list in the card** (overview-on-map 09, [[2026-11-11-overview-on-map-design]] D115)
  was checked on the device on 2026-11-12, release build. Two fragments stay: whether the rows read
  as rows on the white light-theme panel is the owner's look. A family of seven agent sessions
  scrolled inside the card, the nav row fixed, on 2026-11-17 in dark scheme.
- **The overview backfill** (overview-on-map 02, [[2026-11-11-overview-on-map-design]] D121) was
  checked on the device on 2026-11-12, release build. Unobserved: an `overview backfill` entry
  appearing only after a recording that was running at launch ends, since every row on the phone is
  backfilled now and a pass finds nothing to log either way.
- **The overview's lines** (overview-on-map 03, [[2026-11-11-overview-on-map-design]] D103–D107,
  D127, D138) were checked on the device on 2026-11-12, release build. The owner kept `trailLine`
  purple and set `activityLine` to one pink in both themes (2026-11-15; teal was lost among the
  map's greens and blues). Owed to the owner: pink and purple told apart side by side outdoors, on
  Satellite above all (fallback if they blur: a white casing on overview activity lines), and the
  zoom range, still to tune. Unobserved: the exact fade
  zooms (`overviewLineZoomFrom` 10 to 11; a release build shows no zoom), a saved trail showing
  within half a second (the debug log has a one-second grain, and the new trail opens selected, its
  plain line under its full dress), and at most two `overview-lines-*.json` in `files/overview/`
  (no `run-as` on a release build).
- **The overview's focus** (overview-on-map 04, [[2026-11-11-overview-on-map-design]] D108–D110,
  D114, D132) was checked on the device on 2026-11-12, release build. Owed to the owner: the dimming
  level (`overviewDimmedOpacity`, 0.55; the owner found 0.35 too dim on 2026-11-12), and that the
  selected item's plain line never blinks out before its full dress shows (D132), finer than the
  ~3 frames a second a screenshot loop reaches. A linked activity's family was checked on
  2026-11-16, in the check-hooks check: with an activity selected, its sibling activity and
  its trail drawn at full strength, the trail it no longer links dimmed, read from the pixels.
  With 317 trails seeded through `import-gpx` (about 0.6 s each) on 2026-11-17: a selection's
  `fit fired` 226 ms after its `fit requested`, its pins file (322 pins) written in 13 ms, the
  framed trail on screen by the second frame (0.8 s); the Trails toggle rewrote the pins in 8.5 and
  16.5 ms. Each import's `overview loaded` took 6 to 14 ms. Stutter is the owner's to feel.
- **The Layers menu** (overview-on-map 05, [[2026-11-11-overview-on-map-design]] D119, D124, D130,
  D135) was checked on the device on 2026-11-12, release build; the roles are right in the dump
  (radio buttons and checkboxes, each with its state). Owed to the owner: what TalkBack says.
- **The overview's pins and clusters** (overview-on-map 06, [[2026-11-11-overview-on-map-design]]
  D104, D105, D116, D117, D128, D133, D136) were checked on the device on 2026-11-12, release build,
  in both schemes. Owed to the owner: the teardrop hues and the merging distance
  (`overviewClusterCap` 17, `overviewClusterRadius` 40, both still to tune). Not checked: tags kept
  by rank (family, trails, completed, activities), as no rank conflict was staged.
- **A tap on the overview** (overview-on-map 07, [[2026-11-11-overview-on-map-design]] D112–D114,
  D126, D134) was checked on the device on 2026-11-12, release build. Unobserved: a pending fit from
  a list selection dropped by a map tap (the window is a few frames between the list tap and the
  fit), and a tap during a layer switch selecting nothing with `overview press failed` (not hit: a
  tap a tenth of a second after a switch selected normally).
- **A tap on a cluster** (overview-on-map 08, [[2026-11-11-overview-on-map-design]] D118, D126,
  D134, D135) was checked on the device on 2026-11-12, release build; the fit with follow on in 2D
  and the list sheet running under the status bar, both found then, were fixed and seen fixed the
  same day. Owed to the owner: Verification 10, tap comfort, the dimming level and cluster reach.
- **The overview after its review** (overview-on-map review, [[2026-11-11-overview-on-map-design]]
  D116, D117, D118, D138) was checked on the device on 2026-11-12, release build. Unobserved: the
  values `getClusterExpansionZoom` gives (the cap plus one for a cluster that stays merged, at most
  17 for one that splits), though both branches behave as built; the pins' labels in airplane mode on
  a phone whose map never showed them online (it would mean clearing the owner's data); at most two
  `overview-pins-*.json` in `files/overview/` (no `run-as`). Blocked: panning and pinching with
  about 300 items writing no `overview loaded` and no `overview pins written`: seeding is now cheap,
  but this phone refuses injected multi-touch (`zoom` fails on `sendevent`) and the toolkit has no
  pan; at 35 trails and 23 activities they write nothing.
- **A tap on nothing** (overview-on-map review, [[2026-11-11-overview-on-map-design]] D139) was
  checked on the device on 2026-11-12, release build, over TEST data: a tap on the bare map closes
  the card (`outcome deselect`) with the framing unchanged, a tap on the selected route and one
  about 15 dp beside it keep it (`outcome none`, no line hit), and recording or paused a tap on the
  bare map keeps the followed trail. Unobserved: a double tap zooming without deselecting, the
  camera with follow on (it shifts with the card's padding, as D113 accepts), and a press whose
  query fails doing nothing (no failure was hit). Owed to the owner: the dimming level at 0.55 and
  whether the reach around the selected route feels right.
- **ERR-2 of the 2026-11-14 review** ([[2026-11-14-full-review]], `ac2c1e3`, the tolerant stream
  stop) was checked on the device on 2026-11-16, in the check-hooks check. Confirmed: no
  On Foot notification and no foreground service after each pause, discard and save, of agent
  sessions and of a recording through the screens; one `capture stream stopped` after each
  `recording paused`, and the discard's one stop logged 8 ms before `recording discarded`; none
  after `recording finished`, as a save always follows a pause and the pause had stopped the stream
  (`stopStreamTolerant` logs only a running stream); none in the capture across two cold launches
  with no recording. Unobservable without a forced failure: `stream stop failed`, and discard
  completing with the notification left up until the next launch. ERR-1's `fix batch not stored`
  needs a failing write and stays unobserved the same way.
- **T-104, the cards' title and summary rows** (DUP-3 of [[2026-11-14-full-review]], the shared
  `CardTitleRow` and `CardSummaryRow`), with T-76's last fragment (the trail card swapping its
  badge for the download progress, [[2026-11-06-hiking-ux-design]], D81), was checked on the
  device on 2026-11-16 in the phone's current scheme, in the check-hooks check. Confirmed: the
  trail card's name with `✓ Offline` and ⋮ beside it and the `Medium` badge under it; while a
  download ran, `⬇ 0%` between the name and ⋮ and `Downloading Outdoors · 0%` in the badge's
  place, and in a frame strip `⬇ 79%` to `86%` with its progress bar and `Downloading Satellite ·
  79%` there, then `✓ Offline` and the badge back; the activity card's name and ⋮, the `Moderate`
  badge with the date beside it, and its five tiles; the save-activity form's three tiles; the
  Activities list's ⋮ menu opening and deleting. On 2026-11-17, in both schemes, a trail name over
  three lines wrapped beside its ⋮ with the `Hard` badge under it, the pill keeping it on one line.
  Owed: the download progress in dark; `⚠ Failed`, which needs a failed download.
- **The app-log capture** ([[2026-11-15-app-log-capture-design]]) was checked on the device on
  2026-11-15: a recorder started 1.5 min after a launch holds it; a kill and relaunch 2 min later
  shows both processes; an unplug and replug leaves one gap marker, no line twice, entries after
  it, and `logcat -T` takes its spaced time as one argument; a 15-minute walk with a recording,
  about 62 logcat lines a second, leaves the capture holding the launch 35 minutes back; `cleanup`
  leaves no recorder and no `adb logcat`, and keeps `NN-app-log.txt`. On 2026-11-17 a capture held
  82 minutes (15:26 to 16:48, three processes, about 2 000 lines) with no gap marker. Unobserved: a
  capture that cannot be written failing the next command with its cause.
- **A recording survives the death of its process**
  ([[2026-11-14-recording-survives-process-death-design]], T-95) was checked on the device on
  2026-11-15, release build of `ffcba43`, under a mock walk along a straight 4 km route, read in
  logcat and in Settings → Debug log. Confirmed: the three `TaskService` hunk markers in the APK's
  dex; after two `am crash`, a reinstall and an `am stop-app`, each with 60 s dead, a `runtime
  started` with no `cold start` until the reopen, a `Finished task` in logcat and a `fix batch` with
  `kept` 1 every 8 s while dead and for two minutes after, the reopen's `cold start` carrying the
  runtime's age (54 to 60 s), `launch action continue` and no toast, and after the first crash the
  pill at 295 m for 314 m walked (a plain recording falls 13 m short per segment); no notification
  while dead after the reinstall and the stop-app, back after reopening; four opens 0.3 to 0.4 s
  after the first finished delivery of a headless-born process with jobs finishing for a minute
  after, a fifth followed only 8 s before the phone dropped off adb, and three opens a minute after
  that delivery; a pause 0.7 s after a delivery (`TaskService invalidate-only` logged 2 s after that
  delivery), a resume, a save and a second recording in the same process that records; ten minutes
  dead with the screen off and dozing, one runtime and one `ncFunctionQueue` thread throughout,
  memory up 6 MB; two cuts (`launch action resume`, the toast "No position between 19:30 and 19:34",
  the new segment starting just after the last point) whose first batch held a fix taken before the
  relaunch and delivered after it, kept with `droppedBeforeSegment` 0; a plain recording with a
  pause, no toast and two segments. Seen in passing: a fix taken at the moment of a crash, delivered
  32 s late and after newer ones, is dropped by the fix gate as a jump (`seconds` -24); an open
  behind the lock screen evaluated the bundle at once but ran the relaunch (`cold start`, the cut)
  only at the unlock 11 minutes later, where it logged `stream start failed`, then `recovery
  re-issued the stream`. Not run: two quick crashes, and a migration under a live recording. Never
  logged: `TaskService clear-both`, as no host was destroyed while the app was open. Re-checked the
  same day on a release build of `28805da`: two more opens 0.31 and 0.39 s after the first finished
  delivery of a headless-born process, each with 9 jobs and 9 `Finished task` over the next minute;
  and twice, a swipe from recents and a reopen more than 30 s after the last fix, same pid, `launch
  action held` with no `detected an interruption` and no new segment. Owed, on the device:
  `TaskService clear-both` on the integrated build. It was logged only in the spike (build C). One
  attempt did not reach it, and the source suggests the UI cannot: a destroy needs no task
  registered and no activity bound within 2 s of a finished delivery, but back and home leave the
  activity bound, and a swipe after a pause kills the process.

  The T-84 re-check the spec asks for, a relaunch now able to open on a warm runtime, is in
  [[T-84-relaunch-old-camera]]. Owed, the owner's: a real hike where the app dies, with real GPS;
  the mock walk does not show the field cadence.
  After it, in Settings → Debug log (areas capture and launch):
  - **while the app was dead:** `runtime started` with no `cold start` after it, then
    `fix batch` with `kept` above zero at regular spacing;
  - **a collapse would look like** minutes between batches while walking;
  - **batching:** `arrived` above 1 in the `fix batch` entries while the app is open; under the
    mock walk every batch held one fix, so whether the fused provider defers into batches is only
    shown by real GPS;
  - **at the reopen:** `cold start` with the runtime's age (`runtimeAgeMs`), `launch action
    continue`, then a `fix batch` about every 8 s;
  - **when a recording stays at "0 m" while the puck moves:** share the log before relaunching;
    `delivery fault` or `delivery waiting` names the JS path, their absence points at the native
    side.
- **T-49, preferences written only after hydration** (`69fa8a8`) was checked on the device on
  2026-11-16 ([[2026-11-16-check-hooks-rerun]]), on a release build `build-has --commit` proved: a
  preference changed in Settings survives a kill and relaunch (smoothing 100 m and speed mode, read
  in Settings and in `snapshot`'s stored preferences). That is a write after hydration surviving.
  Unobserved: the race the fix closes, a change made before the hydration lands (the first moments
  of a launch) or in a session whose hydration failed (it needs a failing AsyncStorage), leaving
  the other preferences as storage held them; `src/settings/__tests__/preferencesStore.test.ts`
  holds it.
