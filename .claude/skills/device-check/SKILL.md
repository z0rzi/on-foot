---
name: device-check
description: Drive the owner's plugged-in Android phone over adb to check On Foot's runtime behaviour (screens, map, puck and camera, recording, persisted data), including faking a walk with mock GPS. Use for any device check or device verification, or when a behaviour needs the real app on the real phone. Dispatching one to another agent: brief it with a check plan (`.claude/skills/device-check/BRIEF.md`).
---

# Device check

You drive the owner's phone over adb, observe the app, and report evidence. The phone is a
OnePlus DN2103, Android 13, 1080x2400, the only device on `adb devices`. The app is the release
build of `com.zorzi.onfootrn`.

Everything goes through the toolkit, `.claude/skills/device-check/devcheck` (below: `devcheck`),
run from the repo root. Its source and tests are in `tools/device-check/`.

## What you may verify

You may mark a behaviour **device-verified (agent)** when your evidence shows it directly:
what renders and where, the puck position and the camera following it, UI state and text, the
debug log, what a recording contains, and what survives a kill and relaunch. **Feel** stays the
owner's step: gesture response, animation smoothness, perceived latency, and real outdoor GPS.
Report those as `owner to verify` and never claim them.

## Steps

1. **Preflight.** `devcheck build-has '<string>'` with a string the change introduced (a log
   message, a label, a function name; Hermes drops constant names), the check plan's when the
   brief carries one (step 2). Found: name the build by the
   install time it prints. Missing, or the change touches native code (which `build-has` cannot
   see): build in the background with `nix-shell ../shell.nix --run 'npx expo run:android --variant release --no-bundler'`
   from the repo root (it installs and opens the app), and say in the report that a build was
   needed. Then `devcheck native-errors`: any line it prints is evidence before the first check
   (quote it under **Other observations**, or as the cause of a check it explains). Done when you
   can name the build you are checking and have its native errors.
2. **List the checks.** A brief carrying a check plan ([BRIEF.md](BRIEF.md)) is the list: run it, read the files it names when a step does not go as it
   says, and report where you departed from it. Without one, each claim to check gets a one-line
   expected observation and, if it moves, its pace (see Walks). Done when every claim has one.
3. **Run them.** Make the data and movement each check needs: create test activities and fake
   walks freely, since a check run on whatever data happens to be on the phone proves little.
   Wait on events (a label named with `tap --until` or `wait-for`, a walk's own return), and run
   anything longer than a minute in the background so the harness tells you when it ends. Done
   when every check has a verdict.
4. **Clean up.** With no recording running, `devcheck cleanup` deletes every `DEVCHECK` activity
   and trail on the phone, so run it once every check is done, and names any it could not (delete
   those by hand, see Test activities). It then goes back to the map and stops the reader (The
   toolkit) unless a walk moves, and says both. Then `devcheck walk stop` (`--force` if your own
   walk still moves). Done when `cleanup` reports nothing left and `back on the map`, and
   `walk status` says the mock is off.
5. **Report.** Per check: verdict `verified` | `failed` (what contradicted it) | `owner to verify`
   (feel) | `unobservable` (why) | `blocked` (what stopped you), then the evidence: what you did,
   what you saw (on-screen text and log entries quoted verbatim), file paths. Then **Other
   observations**: anything odd seen in passing, with evidence. Then the state you left the phone
   in, including whether it may still stand on a fake position and whether the reader still runs.

## Rules

- **Only the toolkit's adb.** `devcheck` pins the SDK's adb; the system `adb` is another version,
  and mixing the two restarts the server under the phone. For a raw command, use
  `~/android-sdk/platform-tools/adb`.
- **`phone gone` means `blocked`.** A toolkit command that loses the phone tries one reconnect,
  waits up to 4 minutes, then exits 3 with `phone gone` and, for a walk, the mark it reached.
  Mark the checks left `blocked`, say early in your reply that the phone dropped off so the owner
  can replug it, and report that the phone may still stand on the mock until `walk stop` runs.
- **The owner's other apps stay out.** Every command that looks or touches (`labels`, `shot`,
  `frames`, `tap`, `zoom`, `scroll`, `wait-for`, `back`, `type`, `delete`) refuses when another app is in
  front (a system picker or share sheet your check opened is fine), and `frames` deletes a burst
  that ends on another app. Screenshots, gestures, keys and text go through those commands, so
  each one is checked; raw `input` is only for the app switcher and waking the screen (Looking and
  driving).
- **Test data: this skill's rules hold over any brief that dispatches you.** The owner has
  approved creating `DEVCHECK` trails and activities for a check and deleting them in clean-up;
  no brief needs to grant it again. Everything you create is named with the `DEVCHECK ` prefix,
  and only `DEVCHECK ` items are edited or deleted. All other trails and activities are the
  owner's real data: open and read only. `route`, `import-gpx`, `save-activity` and `delete`
  enforce the prefix.
- **Positions in reports and evidence are fake ones** (walk coordinates) or none. Strip real
  coordinates from logcat or `dumpsys location` before quoting them.
- **The owner's trail and activity names stay out of reports.** A labels line of a list or the
  map carries them, so quote from it the labels a verdict rests on.
- Leave the package and the phone intact: no `pm clear`, uninstall, permission changes, or other
  apps' data. The three Appium packages (`io.appium.settings`, `io.appium.uiautomator2.server`,
  `io.appium.uiautomator2.server.test`) are the toolkit's own: they may be started and
  force-stopped, never the owner's apps. Relaunch with `adb shell monkey -p com.zorzi.onfootrn -c android.intent.category.LAUNCHER 1`
  rather than `am force-stop`, which leaves the package `stopped=true` and blocks background
  wake-ups. To kill as the owner does: `input keyevent KEYCODE_APP_SWITCH`, then swipe the card
  up (`input swipe 540 1200 540 200`).

## The toolkit

`devcheck` with no arguments prints this list with each command's options.

| Command | Does |
|---|---|
| `walk to <mark\|end> --pace walk\|fast\|<m/s> [--route FILE] [--offset M] [--accuracy M]` | moves along the route a fix a second, returns at the mark, standing |
| `walk jump <mark\|end> [--route FILE] [--offset M] [--accuracy M]` | puts the position at a mark; refused while recording |
| `walk status` / `walk stop [--force]` | where the fake position is / stop the mock (`--force`: and a moving walk) |
| `route <name> <stretch>... [--from LAT,LNG] [--bearing DEG] [--ele M]` | writes a `DEVCHECK` GPX into the evidence folder |
| `import-gpx <file> [--difficulty Easy\|Medium\|Hard]` | pushes a `DEVCHECK` GPX and imports it through the app's picker |
| `save-activity <name> [--effort Easy\|Moderate\|Hard\|Max]` | pauses, stops, names and saves the recording |
| `delete trail\|activity '<name>'` | deletes one `DEVCHECK ` item through its list, confirming only a dialog that names it |
| `cleanup` | deletes every `DEVCHECK ` activity, then trail; prints what it deleted and what it could not; goes back to the map and stops the reader |
| `labels` | the labels on screen in one line and the time the read took; no file, no screenshot |
| `shot <name>` | screenshot, half-width copy, dump and the same labels line |
| `frames <name> --count N --every MS` | N screenshots (2 to 10) MS apart, as one half-width strip, with each frame's time |
| `crop <shot> <label>` | cuts a shot to one control |
| `tap <label> [--hold MS] [--until <label> \| --until-gone <label>] [--timeout S]` | taps (or long-presses) by accessibility label or text once it stands still, then waits for the label to appear or go (default 10 s) or, with none named, for the screen to settle; prints what it caused and the labels on screen |
| `scroll up\|down` | drags the largest list on screen by a third of its height, inside it (`down` brings the rows below), then waits for it to settle; prints what it caused and the labels on screen |
| `back` | presses the back key, then waits for the screen to settle as a tap does; prints what it caused and the labels on screen |
| `type '<text>'` | types into the focused field (tap it first), spaces as they are; printable ASCII only, another character is refused by name |
| `zoom in\|out [--at X,Y] [--steps N]` | two-finger pinch about a point (default the screen centre) |
| `wait-for <label> [--gone] [--timeout S]` | waits for a label to appear or go, prints the time waited |
| `build-has <string>` | whether the installed JS bundle holds the string |
| `native-errors` | Mapbox source/layer, `ReactNativeJS` and FATAL lines since the app's process started, positions redacted; exits 1 on any |
| `do '<step>'...` | runs steps in order in one command, each a quoted command line (`tap`, `wait-for`, `labels`, `shot`, `frames`, `crop`, `zoom`, `scroll`, `back`, `type`), each under a `[n/N]` header; every step is checked before the first runs, and the first failure ends the list with that step's exit code and the count not run |

Evidence lands in `.scratch/device-checks/<YYYY-MM-DD>/`, numbered in order.

Every read of the screen (`labels`, `shot`, `tap`, `wait-for`, the flows) goes through the
**reader**, the Appium UiAutomator2 server on the phone, which reads any screen in well under a
second, while On Foot records and while a walk moves too. A read starts it when it does not
answer (`reader … started in N s` on stderr; a restart mid-check is worth a line in the report
when it repeats), and `cleanup` stops it. One reader serves every worktree. A reader that is
missing or at another version fails pointing at Phone setup: `blocked`.

### Looking and driving

Look with `labels`, act with `tap --until`, batch with `do`. A tap returns once its outcome is on
screen, so the next command follows it straight away; what you wait for is a label, named.

- **Look with `labels`.** It prints the `text` and `content-desc` of everything on screen, and the
  time the read took. Text is read there: a card's figures, a dialog, a list, the debug log. A
  `shot` is for a claim about pixels (what is drawn, where, in which colour): it writes the same
  labels line beside a screenshot; read the `.half.png` it names (about a third of a full
  screenshot's tokens), and `crop` the shot to one control for a closer look.
- **Act with `tap --until`.** Labels come from the source (`grep -rn accessibilityLabel src`); a
  button made of an icon and a text answers to the text. A tap waits for its target to stand
  still, taps, then waits for the label named by `--until` to appear, or by `--until-gone` to go
  (a dialog or a sheet closing), and returns the moment it does; when it does not come, the tap
  fails with the time waited and the labels last seen. A tap that misses lists the labels it saw.
- **A tap with no label named waits for the screen to settle**, two reads in a row agreeing, and
  prints `settled`, `nothing changed` (the screen is as before the tap) or `not settled` at its
  4 s cap, then the labels line. Agreement is on labels and their bounds, so a change only pixels
  show (a map layer, a selected chip) reads as `nothing changed`: take a `shot` for it. Name the
  outcome with `--until` on a screen with a ticking text, the recording clock among them: it never
  settles and spends the whole cap.
- **Name the screen a step needs before the step.** A tap reads the screen in front: a target on
  a screen that has not started to appear fails at once with the labels seen. `back` waits for
  the screen to settle as a tap with no label named does. `type` returns once the text is sent,
  without a read, so tap a field before you `type` into it. `back` on the map leaves On Foot and
  fails with another app in front: relaunch it (Rules).
- **Batch with `do`** once you know the next steps: one call for the list, every step checked
  before the first runs, and the first failure ends it with that step's output, so no step acts
  on a screen you did not expect:
  `devcheck do "tap 'Open map layers' --until 'Map layers'" "shot layers-open" back "tap Settings --until 'Debug log'" labels`.
- **What moves is a strip**: `frames sheet-opens --count 6 --every 300` reads an animation or a
  camera ease as one image. A screencap takes its own time, so the times it prints, not
  `--every`, say when each frame was taken. A camera ease shows in no label, so where the camera
  ends (a fit after a selection) is the last frame of a strip taken across it: the ease is over
  when the last frames agree.
- **Pinch through `zoom`.** `zoom in --at 540,1200` writes two fingers to the touchscreen it
  finds in `getevent -pl`, scaled to that panel's own ranges; `--steps` sets how many moves.
- **Scroll with `scroll down` and `scroll up`.** Each drags the largest list on screen by a third
  of its height and waits for it to settle, so the rows it prints overlap the ones before and none
  is skipped; at the end of a list the rows stay those of the scroll before. A long read, such as
  the debug log, is one `do` list of `scroll down` steps. The labels line gives every row's text,
  a detail repeated by many rows too.
- **Raw input, for what the toolkit lacks**: the app switcher (Rules), and `input keyevent 224`
  then `wm dismiss-keyguard` when the screen is off. If a PIN is asked, stop and report it.
- **The debug log is the first evidence for app behaviour.** The build is not debuggable (no
  `run-as`), so read it in the app with `labels`: map card → **Settings** → **Debug log**.
- **Native side.** `devcheck native-errors` first. For more, `adb logcat -d -v time`
  (`ReactNativeJS` carries `console.log` from the release build, plus `Mapbox` and
  `AndroidRuntime`). Process deaths and their reasons:
  `adb shell dumpsys activity exit-info com.zorzi.onfootrn | head -40`. Crash stacks:
  `adb shell dumpsys dropbox --print data_app_crash`.

## Walks

The walker fakes the phone's position through the Appium Settings app. The mock replaces Google's
fused location, the source both the puck and recording read, so the app sees only the walk.

- **A route first.** `devcheck route 'climb then flat' 600 400:8% 200:noele 700` writes a straight
  route from Place du Capitole, Toulouse (a public place; `--from`, `--bearing`, `--ele` move it):
  stretches of `LENGTH`, `LENGTH:GRADE%` or `LENGTH:noele` (no elevation). Any GPX works as a
  route; pass it once with `--route FILE`, later moves reuse it.
- **A mark is a distance along the route** in metres; `--offset M` ends the move M metres to the
  right of the route (negative: left), for "Not on the trail" checks. `--accuracy M` sets the fixes'
  accuracy (default 4 m), for the accuracy gate and bad-GPS checks.
- **Between moves the phone stands still on its own**: Appium repeats the last fix every 2 s, and
  the last fix of a move carries no speed. Nothing of yours keeps running.
- **A jump** (`walk jump`, or the first move on a new route, which starts with a jump to its start)
  is refused while On Foot records: the fix gate recovers to a seek after two good fixes, so it
  would draw a straight line into the track under check. Pause, jump, then resume (a resume opens
  a new segment), or walk there at `fast`.
- One walker per phone, across every worktree: a second move is refused while one runs, and
  `walk stop` refuses to end a moving walk, maybe another agent's, without `--force`.

### Pace

Every move names its pace; there is no default.

- `walk` (1.4 m/s) for anything that reads pace: current pace, moving time, the personal factor,
  and so every walking time and the history they come from. A chosen speed (`--pace 2.5`) builds
  personal-factor history at a known pace.
- `fast` (8 m/s, recorded points about 16 m apart) for checks where only the place matters: the
  puck, the camera, distance and climbs left, off-trail. It distorts everything in the line above,
  and an activity of 2 km or more enters the saved history, so keep fast `DEVCHECK` recordings
  under 2 km unless history is what you check.

## Test activities

Create activities whenever a behaviour needs one: recording, the activity list, the sheet,
export, elevation, pause and resume, a relaunch mid-recording. Record against a walk so the track
has real shape:

1. Walk or jump to the start,
   `devcheck tap 'Start recording' --until 'Pause recording (press and hold)'`, then walk.
2. Pause with `devcheck tap 'Pause recording (press and hold)' --hold 1500 --until 'Stop and save recording'`
   (it needs over 1 s, `MapTokens.holdToStopMs`); **Resume recording** or **Stop and save recording** from there.
3. `devcheck save-activity '<what it tests>'` pauses if needed, stops, names it
   `DEVCHECK <what it tests>` with effort Easy (`--effort`), and saves.

Step 4's `cleanup` deletes them. By hand, for what it could not: map card → **Activities** → the
row's **Activity actions** → **Delete activity** → confirm. Trails likewise from **Trails**
(**Trail actions** → **Delete trail**).

## Phone setup

Done once, already in place on 2026-11-06 (Appium Settings 8.2.1) and 2026-11-14 (the reader,
UiAutomator2 server 10.6.6). The walker and the reader check it and point here when it is missing:

- Developer options → **Disable permission monitoring** on (OnePlus; without it adb cannot grant
  mock location).
- Appium Settings installed: the `settings_apk-debug.apk` asset of the latest release of
  `appium/io.appium.settings` on GitHub, then `adb install -r` it.
- `adb shell pm grant io.appium.settings android.permission.ACCESS_FINE_LOCATION` (and
  `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`), then
  `adb shell appops set io.appium.settings android:mock_location allow`.
- The reader, pinned at release `v10.6.6` of `appium/appium-uiautomator2-server` (installed
  2026-11-14): its two assets `appium-uiautomator2-server-v10.6.6.apk` (SHA-256 `8ff760a2…c80d`) and
  `appium-uiautomator2-server-debug-androidTest.apk` (`e6f72928…1e1c`), each through
  `~/android-sdk/platform-tools/adb install -r <apk>`. The toolkit refuses another version: an
  update is a deliberate change of this line and of `PINNED_READER_VERSION` in
  `tools/device-check/readerState.ts`.
- The reader allowed background activity (set 2026-11-14): App info of
  `io.appium.uiautomator2.server` (`adb shell am start -a android.settings.APPLICATION_DETAILS_SETTINGS -d package:io.appium.uiautomator2.server`)
  → **Battery usage** → **Allow background activity** on → **Allow**. Without it OxygenOS's
  battery manager freezes the server 10 s after each read and the next read stalls for seconds; the
  toolkit then fails pointing here. The deviceidle whitelist and the background appops do not stop
  the freeze.
- `ffmpeg` on the host, for `shot`'s half-width copy and `crop` (the system ImageMagick has no PNG
  support).
