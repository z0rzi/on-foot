---
name: device-check
description: Drive the owner's plugged-in Android phone over adb to check On Foot's runtime behaviour (screens, map, puck and camera, recording, persisted data), including faking a walk with mock GPS. Use for any device check or device verification, or when a behaviour needs the real app on the real phone.
---

# Device check

You drive the owner's phone over adb, observe the app, and report evidence. The phone is a
OnePlus DN2103, Android 13, 1080x2400, the only device on `adb devices`. The app is the release
build of `com.zorzi.onfootrn`.

## What you may verify

You may mark a behaviour **device-verified (agent)** when your evidence shows it directly:
what renders and where, the puck position and the camera following it, UI state and text, the
debug log, what a recording contains, and what survives a kill and relaunch. **Feel** stays the
owner's step: gesture response, animation smoothness, perceived latency, and real outdoor GPS.
Report those as `owner to verify` and never claim them.

## Steps

1. **Preflight.** `adb devices` shows the phone. The installed build contains the change under
   check: build it with `nix-shell ../shell.nix --run 'npx expo run:android --variant release --no-bundler'`
   from the repo root (it installs and opens the app), or prove an installed APK current by
   pulling it (`pm path`), unzipping `assets/index.android.bundle` and grepping for an identifier
   the change introduced. Done when you can name the build you are checking.
2. **List the checks.** Each claim to check gets a one-line expected observation. Done when every
   claim has one.
3. **Run them.** Make the data and movement each check needs: create test activities and fake
   walks freely (see below), since a check run on whatever data happens to be on the phone proves
   little. Save evidence to `.scratch/device-checks/<YYYY-MM-DD>/`, files numbered in order
   (`01-map-start.png`, `02-map-start.xml`). Done when every check has a verdict.
4. **Clean up.** Delete every `DEVCHECK` activity and trail you created, stop any walk
   (`walk.sh stop`), and leave On Foot in the foreground on the Map tab with no recording running.
   Done when the Activities and Trails lists show no `DEVCHECK` entry.
5. **Report.** Per check: verdict `verified` | `failed` (what contradicted it) | `owner to verify`
   (feel) | `unobservable` (why) | `blocked` (what stopped you), then the evidence: what you did,
   what you saw (on-screen text and log entries quoted verbatim), file paths. Then **Other
   observations**: anything odd seen in passing, with evidence. Then the state you left the phone in.

## Rules

- **Before every `screencap` or `uiautomator dump`**, confirm On Foot is in front:
  `adb shell dumpsys activity activities | grep topResumedActivity` shows `com.zorzi.onfootrn`
  (a system picker or share sheet your check opened is fine too). This keeps the owner's other
  apps out of the evidence.
- **Everything you create is named with the `DEVCHECK` prefix**, and only `DEVCHECK` items are
  edited or deleted. All other trails and activities are the owner's real data: open and read only.
- **Positions in reports and evidence are fake ones** (walk coordinates) or none. Strip real
  coordinates from logcat or `dumpsys location` before quoting them.
- Leave the package and the phone intact: no `pm clear`, uninstall, permission changes, or other
  apps' data. Relaunch with `adb shell monkey -p com.zorzi.onfootrn -c android.intent.category.LAUNCHER 1`
  rather than `am force-stop`, which leaves the package `stopped=true` and blocks background
  wake-ups. To kill as the owner does: `input keyevent KEYCODE_APP_SWITCH`, then swipe the card
  up (`input swipe 540 1200 540 200`).

## Driving and looking

- **Find controls by label.** Icon controls carry an `accessibilityLabel`, which shows up as
  `content-desc` in the UI tree: `adb shell rm -f /sdcard/ui.xml; adb shell uiautomator dump /sdcard/ui.xml; adb exec-out cat /sdcard/ui.xml`,
  then tap the centre of the node's `bounds`. Remove the old file before each dump: while the map
  animates the dump fails with `could not get idle state` and would leave a stale file behind.
  Labels come from the source (`grep -rn accessibilityLabel src`), so read them there to plan.
- **Input.** `input tap X Y`; a long press is `input swipe X Y X Y 1500`; `input text`;
  `input keyevent 4` is back. If the screen is off: `input keyevent 224`, then `wm dismiss-keyguard`.
  If a PIN is asked, stop and report it.
- **Screens.** `adb exec-out screencap -p > <evidence>/NN-name.png`, viewed with Read. A loop of
  screencaps gives 3–4 frames/s (the phone has no `screenrecord`).
- **The debug log is the first evidence for app behaviour.** The build is not debuggable (no
  `run-as`), so read it in the app: Settings tab → Debug log, through dumps and screenshots.
- **Native side.** `adb logcat -d -v time` (`ReactNativeJS` carries `console.log` from the release
  build, plus `Mapbox` and `AndroidRuntime`). Process deaths and their reasons:
  `adb shell dumpsys activity exit-info com.zorzi.onfootrn | head -40`. Crash stacks:
  `adb shell dumpsys dropbox --print data_app_crash`.

## Test activities

Create activities whenever a behaviour needs one: recording, the activity list, the sheet,
export, elevation, pause and resume, a relaunch mid-recording. Record against a walk so the track
has real shape:

1. Start a walk (below), then on the Map tab tap **Start recording**.
2. Pause with a long press on **Pause recording (press and hold)** (it needs over 1 s, `MapTokens.holdToStopMs`); **Resume recording** or
   **Stop and save recording** from there.
3. In the form, name it `DEVCHECK <what it tests>`, then **Save activity** (or **Discard activity**).

Delete in step 4: Activities tab → the row's **Delete activity** button → confirm the alert.

## Walks

`.claude/skills/device-check/walk.sh` fakes the phone's position with one fix per second, through
the Appium Settings app. The mock replaces Google's fused location, the source both the puck and
recording read, so the app sees only the walk.

```
walk.sh line [--from LAT,LNG] [--bearing DEG] [--speed M/S] [--seconds N] [--accuracy M] [--ele M]
walk.sh gpx FILE [--speed M/S] [--accuracy M]
walk.sh stop
```

- `line` walks straight from Place du Capitole, Toulouse (default) at 1.4 m/s, bearing 45°,
  altitude 146 m, accuracy 4 m. `--speed 0` stands still, for checks on a fixed position.
- `gpx` follows a track's points at `--speed`, altitude from `<ele>`. Write the GPX you need
  (a loop, a climb, a hairpin, a bad-accuracy stretch via `--accuracy`) into the evidence folder.
- Start positions are public places, never the owner's real location.
- Run it in the background while you drive the app; it stops the mock when it ends or is killed.
  A leftover walk or a crashed script leaves the **whole phone** on the fake position, so run
  `walk.sh stop` in clean-up regardless.
- A position jump to the owner's real location during a walk means the mock is not in effect:
  check the phone setup below.

### Phone setup

Done once, already in place on 2026-11-06. `walk.sh` checks it and points here when it is missing:

- Developer options → **Disable permission monitoring** on (OnePlus; without it adb cannot grant
  mock location).
- Appium Settings installed: the `settings_apk-debug.apk` asset of the latest release of
  `appium/io.appium.settings` on GitHub, then `adb install -r` it.
- `adb shell pm grant io.appium.settings android.permission.ACCESS_FINE_LOCATION` (and
  `ACCESS_COARSE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`), then
  `adb shell appops set io.appium.settings android:mock_location allow`.
