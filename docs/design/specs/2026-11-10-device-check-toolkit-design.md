# Device-check toolkit: a steered walker and shared drivers — Design

**Status:** Built 2026-11-10, straight from this spec, with two changes found on the device:
ffmpeg makes the half-width copy and the crop, and the recording screen is never dumped (see
Looking and driving).
**From:** the review of the device-check transcripts of 2026-11-06 to 2026-11-10; the
`device-check` skill.
**Date:** 2026-11-10

Terms are the glossary's: **Fix**, **Point**, **Segment**, **Jump**, **Walking time**, **Personal
factor**. A **device check** is a run of the `device-check` skill; the **caller** is the agent that
dispatches it; the **walker** is what feeds mock fixes to the phone; a **mark** is a distance along
the walker's route.

## Problem Statement

Device checks take close to an hour, and up to two. Eleven subagent runs between 2026-11-06 and
2026-11-10 drove the phone; the device-check ones took 13 to 124 minutes, with 4 to 19 minutes of
model time and the rest waiting on the phone. (Two other long runs, T-61 and draped-overlay 03,
were implementation runs whose totals include coding and builds.) Where the time went:

- **Walks the agent had to build and babysit.** Every run that walked wrote its own walker
  (`drive.py`, `mover.py` + `sender.sh`, `feed.sh`), and then polled a status file in loops,
  regularly past the shell's 600 s foreground limit, after which the call moved to the background
  and the agent polled again. The longest run spent about 47 minutes on three 2.4 km recordings at
  2.5 m/s to build up personal-factor history: a check that needs walking pace, so no speed-up
  could have shortened it.
- **Fixed sleeps after every action** (`tap; sleep 2; screencap`), a few minutes per run, plus
  `sleep 85–110` after each walk step.
- **The phone dropping off adb**: one run got 17 "no devices" results and several 2–5 minute
  reconnect loops; one walker failed 724 sends during a 13-minute drop; another run waited ten
  minutes and reported the phone still gone. Two adb clients live on the machine (35.0.1 on the
  system, 37.0.1 in the SDK inside `nix-shell`), and transcripts show "daemon not running;
  starting now" restarts between them.
- **`uiautomator dump` failing while the map animates** ("could not get idle state"), about 6 s a
  failure, worst while the camera follows a moving puck.
- **The same tools rewritten each run**: besides the walkers, a "screenshot only if On Foot is in
  front, then dump with retries" script (`shot.sh`, `snap.sh`), a "tap the node whose label matches"
  script (`tap.sh`), a UI-tree printer (`ui.sh`), an adb reconnect (`ensure.sh`), a GPX generator
  with an elevation profile (`gen.py`), a crop, a GPX import (`import.sh`) and a pause-stop-save
  sequence (`saveact.sh`). Each was written, debugged and thrown away.
- **Context**: 37 to 55 screenshots per run, about 2 400 tokens each as read (the Read tool already
  downscales a 1080×2400 capture to 900×2000), 90–135 k tokens of contexts that peaked at 216–273 k,
  slowing every later turn. Raw UI-dump XML printed into the transcript added more.
- **Release builds** of 8–13 minutes when a check, or its caller in a fresh worktree, had to build.

For the owner, a device check is the last gate before a change is done; when it costs an hour,
checks are deferred, batched or skipped, and `docs/tickets/device-checks.md` grows.

## Solution

The `device-check` skill ships a small, tested toolkit, so a check spends its time checking:

- A **walker** steered by marks: "walk to the 1 400 m mark at walking pace", "jump to the 600 m
  mark", "step 30 m off the trail". Each move is one command that returns when the mark is
  reached, run in the background so the harness reports its end. Between moves the phone stands
  still on its own: Appium Settings repeats the last position every 2 s.
- **Pace is always chosen**, never defaulted: `walk` for anything that measures pace, moving time,
  walking time or the personal factor; `fast` for checks where only the place matters (the puck,
  the camera, distance and climbs left, off-trail). The skill lists what `fast` distorts.
- **A jump** (putting the position straight at a mark) is allowed when the app is not taking
  fixes, idle or paused, and refused while it records.
- A **shot** command: foreground guard, screenshot, a half-width copy to read, a UI dump only when
  the walker is still, and a one-line summary of the labels and texts on screen. A **crop** to one
  control keeps a pixel check small.
- **tap** by label or text (`--hold` for a long press), and **wait-for** a label or text to appear or
  go, replacing fixed sleeps.
- **route**, which writes a `DEVCHECK` GPX from a list of lengths and grades; **import-gpx** and
  **save-activity**, the two flows every run rebuilt.
- **Bounded adb loss**: one pinned adb, a timeout on every call, one reconnect attempt, then
  `phone gone`, which the skill turns into a `blocked` verdict instead of a loop.
- The skill text changes with it: the toolkit replaces the ad-hoc scripts, long waits run in the
  background, and `build-has` proves the installed bundle current before anything is built.

## User Stories

1. As a device-check agent, I want to tell the walker "walk to the 1 400 m mark along this route", so that I do not compute coordinates myself.
2. As a device-check agent, I want a walk command that returns when the mark is reached, so that I stop polling status files in loops.
3. As a device-check agent, I want to run a long walk in the background and be notified when it ends, so that I never hit the shell's foreground timeout.
4. As a device-check agent, I want to be made to choose the pace of every walk, so that I cannot run a pace-sensitive check fast by accident.
5. As a device-check agent, I want `fast` to cover ground at the highest speed the app still records as a walk on the route I gave, so that a 2 km walk takes a few minutes when only places matter.
6. As a device-check agent, I want `walk` pace to be a walker's speed, so that pace, moving time and walking times read as they would on a hike.
7. As a device-check agent, I want an explicit speed in m/s, so that I can build personal-factor history at a chosen pace.
8. As a device-check agent, I want the skill to list what `fast` distorts, so that I pick the pace from the claim, not from impatience.
9. As the owner, I want fast DEVCHECK recordings kept under 2 km unless history is what is checked, so that a blocked clean-up cannot halve my next hike's walking times.
10. As a device-check agent, I want to jump to a mark when the app is idle or paused, so that a puck, camera or "distance left" check costs seconds.
11. As a device-check agent, I want a jump refused while the app records, so that I do not draw a straight line into the track I am checking.
12. As a device-check agent, I want starting a walk on a new route treated as a jump, so that the same guard covers it.
13. As a device-check agent, I want the phone to stay put between moves without any process of mine, so that a crash of my session leaves no half-sent walk.
14. As a device-check agent, I want the last fix of a move sent without speed, so that the repeated position reads as standing still.
15. As a device-check agent, I want to step a given distance to the side of the route, so that I can check "Not on the trail".
16. As a device-check agent, I want the walker to carry the route's elevation into each fix, and none where the route has none, so that elevation, climbs and tracks without elevation can all be checked.
17. As a device-check agent, I want to set the accuracy of the fixes of a move, so that I can check the accuracy gate and bad-GPS behaviour.
18. As a device-check agent, I want a status command that prints the route, mark, offset and whether a walk is moving, so that I know where the fake position is.
19. As a device-check agent, I want the walker to advance its mark only after a fix is sent, so that a USB drop pauses the walk instead of jumping it.
20. As a device-check agent, I want a walk interrupted by a lost phone to fail with `phone gone` and the mark it reached, so that I can report `blocked` or resume from there.
21. As the owner, I want one walker per phone, even across worktrees, so that one agent's clean-up never stops another agent's walk.
22. As the owner, I want `walk stop` to stop the mock whatever state the walker is in, so that clean-up always returns my phone to real GPS.
23. As the owner, I want a blocked report to say when the phone may still be on a fake position, so that I know to run `walk stop`.
24. As a device-check agent, I want to describe a route as a list of lengths and grades, with `noele` stretches, and get a GPX, so that I stop writing generators.
25. As a device-check agent, I want routes to start at a public place by default, so that no evidence carries the owner's position.
26. As a device-check agent, I want generated GPX names to carry the `DEVCHECK` prefix, so that clean-up finds every trail I imported.
27. As a device-check agent, I want one command that pushes a GPX and imports it through the app's picker, so that I do not rebuild that flow.
28. As a device-check agent, I want one command that pauses, stops, names and saves a recording, so that every check saves activities the same way.
29. As a device-check agent, I want shot to refuse to capture when another app is in front, so that the owner's other apps never reach the evidence.
30. As a device-check agent, I want shot to accept a system picker or share sheet my check opened, so that import and export flows can still be captured.
31. As a device-check agent, I want shot to print the labels and texts on screen in one line, so that most checks need no image at all.
32. As a device-check agent, I want a half-width copy of each screenshot to read, so that fifty screenshots do not fill my context.
33. As a device-check agent, I want the full screenshot kept beside it, so that a pixel-level check can still be made.
34. As a device-check agent, I want to crop a screenshot to one control by its label, so that a close look costs a fraction of a full image.
35. As a device-check agent, I want shot to skip the UI dump while the walker moves and say so, so that a shot mid-walk costs one screenshot, not a minute of failed dumps.
36. As a device-check agent, I want a failed dump to leave no stale file, so that I never read the previous screen's tree.
37. As a device-check agent, I want shot to number files in the evidence folder in order, so that the report's evidence reads in sequence.
38. As a device-check agent, I want to tap a control by its accessibility label or text, so that I never hard-code coordinates.
39. As a device-check agent, I want tap to fail with the labels it did see when no node matches, so that I can correct the label without another dump.
40. As a device-check agent, I want `tap --hold MS`, so that hold-to-pause works without computing bounds.
41. As a device-check agent, I want wait-for to return when a label or text appears or goes, within a timeout, so that I replace `sleep 2` with the event I mean.
42. As a device-check agent, I want wait-for to report how long it waited, so that slow screens show in the report.
43. As a device-check agent, I want every toolkit command to use the same pinned adb, so that two adb servers do not fight over the phone.
44. As a device-check agent, I want every adb call to time out instead of hanging, so that a dropped phone cannot freeze a command.
45. As a device-check agent, I want the toolkit to try one reconnect and then fail with `phone gone` after a few minutes, so that I report `blocked` instead of looping for ten.
46. As the owner, I want the toolkit never to kill the adb server, so that one agent's recovery does not cut off another.
47. As the owner, I want a check blocked by a lost phone to tell me early, so that I can replug it while the agent still has context.
48. As a device-check agent, I want `build-has` to tell me whether the installed bundle contains an identifier of the change, so that I can name the build without rebuilding.
49. As a device-check agent, I want `build-has` to say it proves the JS bundle only, so that I do not claim a native change is installed.
50. As a device-check agent, I want the toolkit's commands listed in the skill with one line each, so that I reach for them instead of writing my own.
51. As a device-check agent, I want the toolkit to write evidence only under `.scratch/device-checks/<date>/`, so that nothing lands in the repo by accident.
52. As a future agent changing the toolkit, I want its logic tested in `npm run verify` and its code type-checked and linted there, so that a broken walker is caught before a check depends on it.
53. As a future agent, I want a test that runs the walker's planned fast fixes through the app's own jump rule and trail matching, so that a change to either cannot make fast walks lie.
54. As the owner, I want feel (gestures, animation, field GPS) to stay my step, so that a faster check does not claim more than its evidence shows.
55. As a device-check agent, I want the toolkit to run in any worktree whose dependencies are installed, with no extra install, so that it is there when I need it.

## Implementation Decisions

### Shape

- **One toolkit, one entry point**, with subcommands: `walk` (`to`, `jump`, `status`, `stop`),
  `route`, `import-gpx`, `save-activity`, `shot`, `crop`, `tap`, `wait-for`, `build-has`. It
  replaces `walk.sh`; the skill folder keeps `SKILL.md` and a thin launcher that runs the toolkit
  through `tsx`.
- **TypeScript, in a top-level tooling folder outside `src/`.** The root `tsconfig.json` already
  type-checks it; `.claude/**` is excluded from type-checking, which is why the code does not sit
  in the skill folder. `expo lint` without paths lints only `src`, `app` and `components`, so the
  `lint` script names the tooling folder as well. `tsx` becomes a direct dev dependency (today it is
  only `drizzle-kit`'s). The architecture gates scan `src`, `app` and `modules` and stay so: the
  toolkit is not app code, and adb is not an app dependency, so nothing is registered in `seams.ts`.
- **No import from `src/` at runtime.** The toolkit runs in plain Node, where the app's modules
  cannot be relied on to load (`src/location` throws on `__DEV__`; `fixGate.ts` loads today only
  because its one import from there is type-only). Tests may import app modules, since Jest runs
  under `jest-expo`.
- **Pure core, thin shell.** Every decision is a pure function: the route geometry and the plan of
  fixes for a move, the route spec, parsing a UI dump, the summary line, label matching, crop
  bounds, classifying `topResumedActivity` (On Foot, picker or share sheet, other) and classifying
  `dumpsys activity services` (taking fixes or not). The shell around them runs adb, sleeps between
  fixes and writes files, and holds no logic worth a test.

### The walker

- **A move is one blocking command**: `walk to <mark> --pace walk|fast|<m/s> [--offset M]
  [--accuracy M]` sends fixes until the mark, then exits; the skill tells agents to run any move
  over a minute in the background. **There is no default pace**; a move without one is refused.
- **Nothing runs between moves.** Appium Settings' location service re-sends its last position
  every 2 s with a fresh timestamp until told otherwise, so the phone stands still on its own. The
  last fix of a move carries no speed or bearing, so the repeat reads as standing. A small state
  file holds the route, mark, offset and the PID of a running move; `walk status` reads it.
- **One fix a second.** Fix times are stamped by the phone on receipt, so a move cannot be
  compressed in time; pace is the spacing between fixes. Below the app's 10 m distance interval a
  fix is dropped by the location service anyway.
- **`walk` is 1.4 m/s. `fast` is a constant of the toolkit, 8 m/s**, chosen for the trail match,
  not the jump rule: points 16 m apart (every second fix kept at the 10 m interval) stay well inside
  the 25 m match radius on a fold. The jump rule allows 60 m per second-apart fix and is not the
  limit. The number is pinned by a test, not by an import (see Testing).
- **A jump is refused while the app takes fixes.** Taking fixes is read from `dumpsys activity
  services` for the package: the background location service in the foreground. It runs exactly
  while recording; a pause stops tracking and a resume opens a new segment, so a jump while paused
  is not a Jump. A `walk to` on a new route starts with a jump to its first mark and takes the same
  guard. When the state cannot be read, the jump is refused with the reason. Why it matters: the
  fix gate does not just drop a seek, it recovers to it after two good fixes, so a seek while
  recording draws a straight line into the track.
- **The mark advances only after a successful send.** On failure the move retries the same fix
  inside the adb rules below; on `phone gone` it exits with that reason and the mark it reached,
  and the phone, if reachable again, is still standing on the last fix sent.
- **One walker per phone**: the lock and state live under `$XDG_RUNTIME_DIR`, keyed by the device
  serial, not in the worktree. `walk stop` stops the mock service and clears the state whatever it
  finds; a move still running may be another agent's, so killing it takes `walk stop --force`.

### Looking and driving

- **Shot**: foreground guard on `topResumedActivity`; `screencap` to `NN-<name>.png` and a
  half-width copy beside it through ffmpeg (the system ImageMagick has no PNG support), the one
  the skill says to read by default (about 880 tokens against 2 400). A UI dump only when no move
  is running and On Foot is not recording: one attempt with a short timeout, after removing the
  old file; on failure no `.xml` is left and the shot says "no dump".
- **The recording screen is never dumped.** `uiautomator dump` waits for a second without
  accessibility events, within 10 s, and the recording clock ticks every second: on the device,
  every dump while recording failed after 11–12 s, with or without a walk; paused and idle screens
  dump in about 2.4 s. So while the app takes fixes, shot skips the dump and says why, wait-for
  refuses, and tap reaches only the record button: RecordButton is one control labelled **Start
  recording** idle and **Pause recording (press and hold)** recording, so its bounds from the last
  dump showing **Start recording** stand for it, with the map card collapsed (the open card lifts
  the button). The tap then reads the recording state and fails if the app still takes fixes, so a
  hold that missed is never reported as a pause. Any other label is refused there. A dumper that
  does not wait for idle (a `uiautomator runtest` jar) would lift this; not built.
  The output is the summary line of `text` and `content-desc` values; raw XML is never printed.
- **Crop** `<shot> <label>` cuts the full screenshot to a node's bounds from that shot's dump.
- **Tap** `<label> [--hold MS]` dumps fresh, taps (or swipes in place for a hold) at the bounds'
  centre, and on no match prints the labels it saw. **Wait-for** `<label> [--gone] [--timeout S]`
  polls dumps and prints the time waited. Both refuse while a move runs, for the same idle reason.
  Import-gpx reaches the Trails screen through the `onfootrn:///trails` link, from any On Foot
  screen, and is refused up front while the app records.
- **Import-gpx** and **save-activity** chain those commands; their labels come from the app
  (`grep -rn accessibilityLabel src`), and a label change surfaces as a tap listing what it saw.

### adb

- **One pinned adb**, the SDK's, resolved once and used by every call, so the toolkit never starts
  a second server. The skill tells agents not to call the system `adb` while the toolkit is in use.
  Whether mixed clients cause the drops is checked once on the device before the drop handling is
  tuned.
- **Every call has a timeout** (a few seconds for shell calls, longer for `screencap` and pulls).
  On a timeout or "no devices" the toolkit waits for the device with one `adb reconnect`, never
  `kill-server`, up to 4 minutes in all, which covers the drops seen (2–5 minutes, mostly under
  4), then fails with `phone gone`. The skill turns `phone gone` into `blocked` for the checks left
  and says in the report whether the phone may still be on the mock.

### Skill changes in the same work

- The preflight runs `build-has` first; a build happens only when it misses, runs in the
  background, and the report says a build was needed. `build-has` compares a string the change
  introduced (a log message or label; Hermes keeps strings and function names, not constant names)
  against the installed APK's bundle and says it proves JS only.
- The steps say to run any wait over a minute in the background and never chain fixed sleeps.
- A **pace rule**: `fast` distorts current pace, moving time, the personal factor and so every
  walking time, and the saved history of any activity of 2 km or more; anything that reads those
  is walked at `walk` pace or a chosen speed, and fast DEVCHECK recordings stay under 2 km unless
  history is the subject.
- The "Walks" and "Driving and looking" sections are rewritten around the toolkit; "Phone setup"
  stays, with the installed Appium Settings version recorded.

## Testing Decisions

- **The seam is the pure core, called as functions** (the owner's choice after the challenge). A
  good test calls one function with a realistic input and checks its output from the caller's side:
  "a dump where the label is absent lists the labels present", "a move of 2 km at fast pace gives
  fixes 8 m apart ending with one without speed". No test spawns the toolkit or a fake adb.
- **Fixtures are real**: UI dumps, `topResumedActivity` lines and `dumpsys activity services` output
  captured from the phone into the toolkit's test fixtures (fixture files outside `__tests__`, or
  with a non-test extension, since every `.ts` under `__tests__` is a suite). They include a dump
  taken on the picker, a recording, a paused recording and an idle app.
- **Cases**: the plan of fixes (spacing per pace, elevation interpolated and absent on `noele`,
  offset perpendicular to the route, the last fix without speed, accuracy carried); the route spec
  (lengths, grades, `noele`, faulty specs refused with the faulty part named); label matching and
  the summary line; crop bounds; foreground classification (On Foot, picker, share sheet, other);
  service classification (recording, paused, idle, unreadable).
- **The cross-check with the app**: a test plans a fast walk on a route with a fold and runs it
  through the app's own `gateFixes` (no fix dropped) and trail-progress matching (the walker's
  branch kept all along), and does the same at `walk` pace. A change to either module that would
  make fast walks lie fails here. This is why `fast` needs no import.
- **Prior art**: the trail-progress and current-pace tests build synthetic tracks with timestamps;
  the fix gate tests are the reference for a Jump; the architecture gate tests parse fixture text
  into findings, the shape of the dump-parsing tests.
- **Device-verified once by the agent that builds it**, each check able to fail: a jump refused
  while recording and allowed while paused, on the real service state; USB unplugged mid-walk,
  then `phone gone`, then after replug a walk on from the reached mark with no Jump in the debug
  log; a shot taken while the camera follows a moving walk, timed; the ahead line's walking times at
  `fast` and at `walk` pace, recorded as the evidence for the pace rule; a fast 2 km walk's `fix
  batch` lines showing points about 16 m apart and no `droppedJump`.

## Existing shape

- **`walk.sh`** is the first instance of the walker and is replaced, not forked: its fix sending
  (Appium Settings' location service with accuracy, altitude, bearing and speed), its preflight and
  its stop-on-exit move into the toolkit, and the file goes.
- **The ad-hoc scripts** of the runs are the second to fifth instances of the same shapes; the
  toolkit is their extraction: the advance-only-after-send rule from `drive.py`, the foreground
  guard and the picker exception from `shot.sh`/`snap.sh`, the label match and its miss message
  from `tap.sh`, the profile-to-GPX idea from `gen.py`, and the flows of `import.sh` and
  `saveact.sh`. Not taken: their long-running sender processes and control files, which Appium's
  own repeat makes unnecessary.
- **Geometry**: the app's geo metrics compute distances along tracks; the toolkit needs the inverse
  (a point at a distance along a polyline, an offset). App modules do not serve tooling, so the
  toolkit has its own small geometry module, and its tests check what it produces with the app's
  `haversineMeters`.
- **GPX**: the app's parser (`src/data/trails/gpx/parse.ts`) is the sibling of the toolkit's GPX
  reader. It cannot be shared under the no-runtime-import rule, so the toolkit keeps a small reader
  of its own, and a test holds its trail title rule (track name, metadata name, file name) to the
  app's, since the `DEVCHECK` guard of import-gpx depends on it.
- **Nothing exported from `src/` for the toolkit.** The fast pace is the toolkit's constant, held
  honest by the cross-check test.

## Failure modes

| Mode | Visible outcome | Recovery |
|---|---|---|
| Phone unplugged or adb offline | Calls time out; one `adb reconnect`; after 4 minutes `phone gone` with the mark reached | The skill reports `blocked`, says whether the mock may still be on; the owner replugs and re-dispatches |
| adb hangs instead of erroring | The per-call timeout fires; same path as above | Same |
| A move is killed or the session dies mid-walk | The phone keeps repeating the last fix (Appium) | `walk stop` in clean-up; a blocked report names it |
| Two agents on one phone | The second `walk to` is refused: a walk holds the phone; `walk stop` refuses a moving walk | Wait, or `walk stop --force` if the holder is gone |
| Jump asked while recording, or a new route while recording | Refused with the reason | `walk to` at `fast` along the route |
| Recording state unreadable | Jump refused, reason printed | Pause, or walk instead |
| Move without a pace | Refused, the paces listed | Choose one |
| Shot, tap or wait-for while a move runs | Shot saves the screenshot with "no dump"; tap and wait-for refuse | Wait for the move to end |
| Map animating with no move (camera easing) | The one dump fails; "no dump", no `.xml` left | Shot again, or rely on the screenshot |
| On Foot recording | Shot: screenshot only, "no dump: On Foot is recording"; wait-for refuses; tap refuses every label but the record button's | Read the screenshot, or pause first |
| Record button never seen in a dump | Tap of the pause label refused, saying so | Shot or tap "Start recording" before recording |
| Another app in front | Shot refuses, prints the front activity | Bring On Foot back |
| No node matches a tap, crop or wait-for label | Fails, listing the labels on screen | Correct the label |
| wait-for times out | Fails with the time waited | Investigate; never a silent pass |
| Malformed route spec or GPX with fewer than 2 points | Refused with the faulty part named; no file | Fix the spec |
| ffmpeg missing | Shot keeps the full screenshot and says no copy was made; crop fails | Read the full one |
| Installed bundle older than the change | `build-has` misses | Build in the background; the report says so |
| A native change under check | `build-has` cannot see it | The skill says to build when the change touches native code |
| A blocked check leaves fast DEVCHECK activities | Under 2 km, they never enter the personal-factor history | The next check's clean-up deletes them |

## Out of Scope

- **Build time.** Cold release builds in fresh worktrees (8–13 minutes, `android/` is generated per
  checkout) are a separate decision: a warm build checkout or a shared Gradle cache. Ticket later.
- **Seeding personal-factor history without walking it** (importing activities is T-24, not built);
  history checks stay real-pace walks.
- Android's own test provider (`cmd location providers add-test-provider`) as a replacement for
  Appium Settings: whether it reaches Google's fused location, the source the app reads, is
  unverified; worth a look later, not needed now.
- Running the walker loop on the phone (`adb shell nohup`): it would survive USB drops but is
  harder to steer and stop; the host loop was chosen.
- Loops, hairpins and reverse walks in the route spec, and per-stretch accuracy inside one move
  (a move takes one accuracy).
- Multi-touch (pinch, two-finger rotation; `sendevent` is refused on this phone) and screen
  recording (no `screenrecord`); both stay the owner's.
- Computing expected values with the app's own functions: the app would be its own oracle.
- Changing the app's fix gate, distance interval or recording to suit the walker.
- More than one device, or an emulator; the debug build or Metro.
- Judging feel; the `owner to verify` verdict stays.

## Further Notes

- Figures come from the subagent transcripts of 2026-11-06 to 2026-11-10, recounted by an
  independent fact-check: tool times as the union of tool intervals (summing double-counts calls
  sent together), image tokens from the transcripts' own usage figures.
- Rejected after the challenge: a walker daemon with control and status files (Appium's 2 s repeat
  makes it unnecessary, and it raced); `fast` as the default pace (it halves every walking time and
  hides personal-factor bugs at the 0.5 clamp); `fast` tied to an exported fix-gate constant (the
  rule's limit is 60 m per fix, not the speed constant, and the import loads app code in plain
  Node); recording state from the notification (paused and restored recordings look idle; the
  service state is exact); three dump retries (a followed puck never idles); black-box CLI tests
  against a fake adb (fixtures cannot reproduce idle failures or hangs, and spawning `tsx` per test
  slows the pre-push gate).
- Why the phone drops off adb is not in the transcripts; the pinned adb may be the fix, and the
  bounded wait makes the rest cheap.
- Tooling has no ticket area, so this spec has no worklist ticket; the work goes straight to a plan
  folder through `/to-tickets`.
