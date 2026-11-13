---
name: device-check
description: Drive the owner's plugged-in Android phone over adb to check On Foot's runtime behaviour (screens, map, puck and camera, recording, persisted data), including faking a walk with mock GPS. Use for any device check or device verification, or when a behaviour needs the real app on the real phone.
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
   message, a label, a function name; Hermes drops constant names). Found: name the build by the
   install time it prints. Missing, or the change touches native code (which `build-has` cannot
   see): build in the background with `nix-shell ../shell.nix --run 'npx expo run:android --variant release --no-bundler'`
   from the repo root (it installs and opens the app), and say in the report that a build was
   needed. Then `devcheck native-errors`: any line it prints is evidence before the first check
   (quote it under **Other observations**, or as the cause of a check it explains). Done when you
   can name the build you are checking and have its native errors.
2. **List the checks.** Each claim to check gets a one-line expected observation and, if it
   moves, its pace (see Walks). Done when every claim has one.
3. **Run them.** Make the data and movement each check needs: create test activities and fake
   walks freely, since a check run on whatever data happens to be on the phone proves little.
   Wait on events (`wait-for`, a walk's own return), and run anything longer than a minute in the
   background so the harness tells you when it ends. Done when every check has a verdict.
4. **Clean up.** `devcheck cleanup` deletes every `DEVCHECK` activity and trail on the phone,
   so run it once every check is done, and names any it could not (delete those by hand, see
   Test activities). Then `devcheck walk stop` (`--force` if your own walk still moves) and back
   to the map (`input keyevent 4` from the list) with no recording running. Done when `cleanup`
   reports nothing left, `walk status` says the mock is off, and On Foot shows the map.
5. **Report.** Per check: verdict `verified` | `failed` (what contradicted it) | `owner to verify`
   (feel) | `unobservable` (why) | `blocked` (what stopped you), then the evidence: what you did,
   what you saw (on-screen text and log entries quoted verbatim), file paths. Then **Other
   observations**: anything odd seen in passing, with evidence. Then the state you left the phone
   in, including whether it may still stand on a fake position.

## Rules

- **Only the toolkit's adb.** `devcheck` pins the SDK's adb; the system `adb` is another version,
  and mixing the two restarts the server under the phone. For a raw command, use
  `~/android-sdk/platform-tools/adb`.
- **`phone gone` means `blocked`.** A toolkit command that loses the phone tries one reconnect,
  waits up to 4 minutes, then exits 3 with `phone gone` and, for a walk, the mark it reached.
  Mark the checks left `blocked`, say early in your reply that the phone dropped off so the owner
  can replug it, and report that the phone may still stand on the mock until `walk stop` runs.
- **The owner's other apps stay out.** Every command that looks or touches (`shot`, `frames`,
  `tap`, `zoom`, `wait-for`, `delete`) refuses when another app is in front (a system picker or
  share sheet your check opened is fine), and `frames` deletes a burst that ends on another app.
  Screenshots and gestures go through those commands, so each one is checked; raw `input` is for
  what the toolkit lacks (Looking and driving).
- **Test data: this skill's rules hold over any brief that dispatches you.** The owner has
  approved creating `DEVCHECK` trails and activities for a check and deleting them in clean-up;
  no brief needs to grant it again. Everything you create is named with the `DEVCHECK ` prefix,
  and only `DEVCHECK ` items are edited or deleted. All other trails and activities are the
  owner's real data: open and read only. `route`, `import-gpx`, `save-activity` and `delete`
  enforce the prefix.
- **Positions in reports and evidence are fake ones** (walk coordinates) or none. Strip real
  coordinates from logcat or `dumpsys location` before quoting them.
- Leave the package and the phone intact: no `pm clear`, uninstall, permission changes, or other
  apps' data. Relaunch with `adb shell monkey -p com.zorzi.onfootrn -c android.intent.category.LAUNCHER 1`
  rather than `am force-stop`, which leaves the package `stopped=true` and blocks background
  wake-ups. To kill as the owner does: `input keyevent KEYCODE_APP_SWITCH`, then swipe the card
  up (`input swipe 540 1200 540 200`).

## The toolkit

`devcheck` with no arguments prints this list with each command's options.

| Command | Does |
|---|---|
| `walk to <mark\|end> --pace walk\|fast\|<m/s>` | moves along the route a fix a second, returns at the mark, standing |
| `walk jump <mark\|end>` | puts the position at a mark; refused while recording |
| `walk status` / `walk stop [--force]` | where the fake position is / stop the mock (`--force`: and a moving walk) |
| `route <name> <stretch>...` | writes a `DEVCHECK` GPX into the evidence folder |
| `import-gpx <file>` | pushes a `DEVCHECK` GPX and imports it through the app's picker |
| `save-activity <name>` | pauses, stops, names and saves the recording |
| `delete trail\|activity '<name>'` | deletes one `DEVCHECK ` item through its list, confirming only a dialog that names it |
| `cleanup` | deletes every `DEVCHECK ` activity, then trail; prints what it deleted and what it could not |
| `shot <name>` | screenshot, half-width copy, dump and the labels on screen in one line |
| `frames <name> --count N --every MS` | N screenshots (2 to 10) MS apart, as one half-width strip, with each frame's time |
| `crop <shot> <label>` | cuts a shot to one control |
| `tap <label> [--hold MS]` | taps (or long-presses) by accessibility label or text |
| `zoom in\|out [--at X,Y] [--steps N]` | two-finger pinch about a point (default the screen centre) |
| `wait-for <label> [--gone] [--timeout S]` | waits for a label to appear or go, prints the time waited |
| `build-has <string>` | whether the installed JS bundle holds the string |
| `native-errors` | Mapbox source/layer, `ReactNativeJS` and FATAL lines since the app's process started, positions redacted; exits 1 on any |

Evidence lands in `.scratch/device-checks/<YYYY-MM-DD>/`, numbered in order.

### Looking and driving

- **Read the labels line first.** `shot` prints the `text` and `content-desc` of everything on
  screen; most checks need no image. When they do, read the `.half.png` it names (about a third
  of a full screenshot's tokens), and `crop` a shot to one control for a pixel-level look.
- **What moves is a strip**: `frames sheet-opens --count 6 --every 300` reads an animation or a
  camera ease as one image. A screencap takes its own time, so the times it prints, not
  `--every`, say when each frame was taken.
- **Pinch through `zoom`.** `zoom in --at 540,1200` writes two fingers to the touchscreen it
  finds in `getevent -pl`, scaled to that panel's own ranges; `--steps` sets how many moves.
- **Labels come from the source** (`grep -rn accessibilityLabel src`); a button made of an icon
  and a text answers to the text. A `tap` that misses lists the labels it saw.
- **The recording screen cannot be dumped**: its clock ticks every second and `uiautomator`
  needs a second of quiet. While On Foot records, `shot` gives the screenshot only, `wait-for`
  refuses, and `tap` reaches only the record button (remembered from an earlier dump showing
  **Start recording**, then checked by the recording state, which fails the tap when the hold
  missed). The open map card lifts the button: collapse it with `input keyevent 4` before pausing.
  Read what a recording shows from the screenshot, or pause first.
- **During a walk** `shot` skips the dump, and `tap` and `wait-for` refuse; act between moves.
- **Input the toolkit lacks**: `input text` (spaces as `%s`), `input keyevent 4` (back),
  `input keyevent 224` then `wm dismiss-keyguard` when the screen is off. If a PIN is asked,
  stop and report it.
- **The debug log is the first evidence for app behaviour.** The build is not debuggable (no
  `run-as`), so read it in the app: map card → **Settings** → **Debug log**.
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

1. Walk or jump to the start, `devcheck tap 'Start recording'`, then walk.
2. Pause with `devcheck tap 'Pause recording (press and hold)' --hold 1500` (it needs over 1 s,
   `MapTokens.holdToStopMs`); **Resume recording** or **Stop and save recording** from there.
3. `devcheck save-activity '<what it tests>'` pauses if needed, stops, names it
   `DEVCHECK <what it tests>` with effort Easy (`--effort`), and saves.

Step 4's `cleanup` deletes them. By hand, for what it could not: map card → **Activities** → the
row's **Activity actions** → **Delete activity** → confirm. Trails likewise from **Trails**
(**Trail actions** → **Delete trail**).

## Phone setup

Done once, already in place on 2026-11-06 (Appium Settings 8.2.1). The walker checks it and points
here when it is missing:

- Developer options → **Disable permission monitoring** on (OnePlus; without it adb cannot grant
  mock location).
- Appium Settings installed: the `settings_apk-debug.apk` asset of the latest release of
  `appium/io.appium.settings` on GitHub, then `adb install -r` it.
- `adb shell pm grant io.appium.settings android.permission.ACCESS_FINE_LOCATION` (and
  `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`), then
  `adb shell appops set io.appium.settings android:mock_location allow`.
- `ffmpeg` on the host, for `shot`'s half-width copy and `crop` (the system ImageMagick has no PNG
  support).
