---
name: device-check
description: Drive the owner's plugged-in Android phone over adb to check On Foot's runtime behaviour (screens, map, puck and camera, recording, persisted data), including faking a walk with mock GPS. Use for any device check or device verification, or when a behaviour needs the real app on the real phone. Dispatching one to another agent: brief it with a check plan (`.claude/skills/device-check/BRIEF.md`).
---

# Device check

You drive the owner's phone over adb, observe the app, and report evidence. The phone is a
OnePlus DN2103, Android 13, 1080x2400, the only device on `adb devices`. The app is the release
build of `com.zorzi.onfootrn` that `devcheck build` makes, with check hooks.

Everything goes through the toolkit, `.claude/skills/device-check/devcheck` (below: `devcheck`),
run from the repo root. Its source and tests are in `tools/device-check/`.

## Hooks set the stage, the screen plays the claim

A **check hook** is a command the toolkit sends the app with `am broadcast`; the app runs it
through the code its screens call, rules included, and answers in the broadcast's result. Hooks
never read or touch the screen. They are the **stage**: everything a check needs around the
behaviour it is about.

- **Set up**: `import-gpx` a trail, `record start|pause|resume|save|discard` an agent session,
  `select` or `clear-selection` what the map shows.
- **Read**: `state` for where the app stands (the screen in front, the selection, the map and
  follow modes, the recording, the build), `list` for your `DEVCHECK` items' ids, `snapshot` for
  what the app persisted.
- **Tear down**: `delete` one item, `cleanup` all of them.

The screen (`tap`, `labels`, `shot`, `frames`) is for the **claim**: what the app draws, says and
does under a tap. A claim about a screen a hook stands in for (the GPX picker and trail form, the
record button and paused controls, the save form, a delete dialog) drives that screen with `tap`;
the hooks still set the rest of its stage.

A hook's command prints the hook's result, or fails with one of:

- `<hook> refused: <reason>`: the app's own rule refused it and did nothing. The reason is
  evidence; the rules are in the command table (writes need the map in front and a `DEVCHECK`
  name, and no hook touches a recording a hook did not start).
- `On Foot was not ready within 30 s: still loading …`: the toolkit waited through the app's
  `not-ready` (stores, offline packs, recording state) and the bound ran out.
- `no check-hook dispatcher answered`: the installed build has no hooks; build (Preflight). It
  comes within 10 s of On Foot in front, not at the 30 s bound.
- `On Foot gave no reply within its deadline`: the hook may have run; read `state` before sending
  it again.

Each hook writes one `hooks` line to the debug log, `hook <name> ok|refused|not-ready|busy|failed`,
so the capture shows what you did among what the app did.

## What you may verify

You may mark a behaviour **device-verified (agent)** when your evidence shows it directly:
what renders and where, the puck position and the camera following it, UI state and text, the
debug log, what a recording contains, and what survives a kill and relaunch. **Feel** stays the
owner's step: gesture response, animation smoothness, perceived latency, and real outdoor GPS.
Report those as `owner to verify` and never claim them.

## Steps

1. **Preflight.** Name the build on the phone, and build only when it lacks the change.
   - `devcheck state`. It launches On Foot when no hook answers and waits until it has loaded;
     its `build:` line is the installed build's identity (commit, uncommitted changes, native
     fingerprint). `no check-hook dispatcher answered` or `build: no identity`: build.
   - `devcheck build-has --commit <rev>`, `<rev>` the commit the change landed in (`HEAD` for this
     checkout, uncommitted changes included). It reads the identity from `state`, or, on a build
     without hooks, the one the build logged at its last launch, and says `holds`, `does not hold`
     (build) or `cannot tell`. `cannot tell` because the capture holds no launch, or one older than
     the install: relaunch On Foot (Rules) and run it again; for any other reason: build. A build
     made with uncommitted changes holds them only while the working tree stands on the same
     commit with the same changes.
   - **Build** in the background with `nix-shell ../shell.nix --run '.claude/skills/device-check/devcheck build'`
     from the repo root: it prints the identity, builds the release with check hooks, installs
     and opens the app. Only this command makes a build that carries an identity and answers
     hooks. Then `build-has --commit` again, and say in the report that a build was needed.
   - `devcheck native-errors`: any line it prints is evidence before the first check (quote it
     under **Other observations**, or as the cause of a check it explains).

   Done when `build-has --commit` says `holds` and you have the native errors.
2. **List the checks.** The claims you were given are the scope. A brief carrying a check plan
   ([BRIEF.md](BRIEF.md)) is the list: run it, read the files it names when a step does not go as
   it says, and report where you departed from it. Without one, each claim gets a one-line
   expected observation, the hooks that set its stage and, if it moves, its pace (see Walks).
   Done when every claim has them.
3. **Run them.** Set each check's stage through hooks: create test trails and activities freely
   (Test data), since a check run on whatever data happens to be on the phone proves little, and
   read where the app stands with `state`. Then observe the claim on the screen and in the log.
   Wait on events (a label named with `tap --until` or `wait-for`, a walk's own return), and run
   anything longer than a minute in the background so the harness tells you when it ends. While a
   long wait runs (a walk, a time the claim sets, an app timer), run the checks it does not
   disturb. A variant you think worth running (another theme or layer, a second kill) goes in the
   report under **Other observations** as a suggestion, unrun. Done when every listed check has a
   verdict.
4. **Clean up.** End every recording you started: `record discard` (or `record save`) for an
   agent session, the screen for one started with the record button (Test data). Then
   `devcheck cleanup`, once every check is done. It presses back until the map is in front,
   deletes every `DEVCHECK` activity, then trail, in one hook, and names any it could not (delete
   those with `delete`, Test data). Unless a walk moves, it then stops the reader and the recorder
   (The toolkit) and copies the capture into the evidence folder as `NN-app-log.txt`. It deletes
   every snapshot from the evidence folder and empties the hook folder on the phone, and says
   each. Then `devcheck walk stop` (`--force` if your own walk still moves). Done when `cleanup`
   prints `back on the map`, nothing under `could not delete` and the capture's path, and
   `walk status` says the mock is off.
5. **Report.** Per check: verdict `verified` | `failed` (what contradicted it) | `owner to verify`
   (feel) | `unobservable` (why) | `blocked` (what stopped you), then the evidence: what you did,
   what you saw (on-screen text, hook replies and log entries quoted verbatim), file paths. Then
   **Other observations**: anything odd seen in passing, with evidence, and the variants you
   suggest. Then the state you left the phone in: any recording still live, whether it may still
   stand on a fake position, and whether the reader and the recorder still run.

## Rules

- **Only the toolkit's adb.** `devcheck` pins the SDK's adb; the system `adb` is another version,
  and mixing the two restarts the server under the phone. For a raw command, use
  `~/android-sdk/platform-tools/adb`.
- **`phone gone` means `blocked`.** A toolkit command that loses the phone tries one reconnect,
  waits up to 4 minutes, then exits 3 with `phone gone` and, for a walk, the mark it reached.
  Mark the checks left `blocked`, say early in your reply that the phone dropped off so the owner
  can replug it, and report that the phone may still stand on the mock until `walk stop` runs.
- **The owner's other apps stay out.** Every command that looks or touches (`labels`, `shot`,
  `frames`, `tap`, `zoom`, `scroll`, `wait-for`, `back`, `type`) refuses when another app is in
  front (a system picker or share sheet your check opened is fine), and `frames` deletes a burst
  that ends on another app. Screenshots, gestures, keys and text go through those commands, so
  each one is checked; raw `input` is only for the app switcher and waking the screen (Looking and
  driving).
- **Test data: this skill's rules hold over any brief that dispatches you.** The owner has
  approved creating `DEVCHECK` trails and activities for a check and deleting them in clean-up;
  no brief needs to grant it again. Everything you create is named with the `DEVCHECK ` prefix,
  and only `DEVCHECK ` items are edited or deleted. All other trails and activities are the
  owner's real data: open and read only. `route`, `import-gpx`, `record save`, `delete` and
  `cleanup` enforce the prefix, the hooks in the app itself, and `tap` refuses the Delete button
  of a delete dialog naming an item without it.
- **The owner's recording is theirs.** A recording a hook did not start may be the owner's hike:
  every hook refuses to touch it or to write while it runs. A check about the record button
  starts its own with `tap` and ends it through the screen.
- **Positions in reports and evidence are fake ones** (walk coordinates) or none. Strip real
  coordinates from logcat or `dumpsys location` before quoting them.
- **The owner's trail and activity names stay out of reports.** `list` keeps them in the app; a
  labels line of a list or the map carries them, so quote from it the labels a verdict rests on.
- **A snapshot holds the owner's routes and names.** Quote from it only `DEVCHECK` rows, counts,
  and of the owner's rows the columns that are not positions or names (no latitude, longitude,
  point or geometry). Never copy its files out of the evidence folder; `cleanup` deletes them.
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
| `route <name> <stretch>... [--from LAT,LNG] [--bearing DEG] [--ele M]` | writes a GPX titled `DEVCHECK <name>` into the evidence folder |
| `import-gpx <file> [--difficulty Easy\|Medium\|Hard]` | hook: pushes the GPX into the hook folder and imports it, named by its title, which must start with `DEVCHECK `; prints the new trail's id; refused unless the map is in front, and during a recording a hook did not start |
| `record start` / `record pause` / `record resume` / `record discard` | hooks: drive an **agent session**, a recording a hook started; print its id. All refuse unless the map is in front; `start` and `resume` refuse, never prompting, when a permission is missing, location is off or the app is behind (`start`: or a recording is live); the others refuse a recording a hook did not start |
| `record save <name> [--effort Easy\|Moderate\|Hard\|Max]` | hook: saves the paused agent session as `DEVCHECK <name>` (effort Easy by default), linked to the trail shown, and shows it on the map; prints the new activity's id; refused like the other `record` commands, and unless paused |
| `delete trail\|activity <id>` | hook: deletes one `DEVCHECK ` item by the id `list` gives, a trail with its offline map and its activities kept; refused like `import-gpx`, and on an item not named `DEVCHECK ` |
| `cleanup` | presses back to the map (reading the route through `state`), then a hook deletes every `DEVCHECK ` activity, then trail; prints what it deleted and what it could not; stops the reader and the recorder and keeps the capture; deletes the snapshots and empties the hook folder (Clean up) |
| `state` | hook: one reading a line: the screen in front (its route, `/` for the map), the selection, the map and follow modes, the recording phase and whether it is an agent session, the build's identity; launches On Foot and waits until it has loaded when no hook answers |
| `list trails\|activities` | hook: each `DEVCHECK ` trail (or activity) as its id and name, then only a count of the others, whose names never leave the app; answered on any screen and while recording |
| `select trail\|activity <id>` / `clear-selection` | hook: shows the trail or activity on the map as its list row does / shows nothing; refused while recording or paused, and on an id the list does not hold |
| `snapshot` | hook: the app's database (a consistent copy) and its stored preferences (JSON, the last camera left out) into the evidence folder as `NN-snapshot.db` and `NN-snapshot.preferences.json`, deleted on the phone; prints both paths; query the database with `sqlite3` |
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
| `build` | computes the build's identity (commit, uncommitted changes, native fingerprint), then builds the release with check hooks, installs and opens it; run it in `nix-shell ../shell.nix`, in the background |
| `build-has <string>` / `build-has --commit <rev>` | whether the installed JS bundle holds the string, for a build older than identities / whether the installed build holds the commit, from the identity `state` gives, or on a build without hooks the capture's last launch |
| `log [--area AREA]...` | the debug log's entries recorded since the check's first command, every process, oldest first, a header line opening each process and the gaps in place, then the capture's path; `--area` keeps one area (repeat it) |
| `native-errors` | Mapbox source/layer, `ReactNativeJS` and FATAL lines since the app's process started, positions redacted; exits 1 on any |
| `do '<step>'...` | runs steps in order in one command, each a quoted command line (`state`, `list`, `select`, `clear-selection`, `snapshot`, `tap`, `wait-for`, `labels`, `shot`, `frames`, `crop`, `zoom`, `scroll`, `back`, `type`, `log`), each under a `[n/N]` header; every step is checked before the first runs, and the first failure ends the list with that step's exit code and the count not run |

Evidence lands in `.scratch/device-checks/<YYYY-MM-DD>/`, numbered in order.

Every read of the screen (`labels`, `shot`, `tap`, `wait-for`, `scroll`, `back`) goes through the
**reader**, the Appium UiAutomator2 server on the phone, which reads any screen in well under a
second, while On Foot records and while a walk moves too; a hook never uses it. A read starts it
when it does not answer (`reader … started in N s` on stderr; a restart mid-check is worth a line
in the report when it repeats), and `cleanup` stops it. One reader serves every worktree. A reader
that is missing or at another version fails pointing at Phone setup: `blocked`.

Every command but `route`, `build`, `cleanup`, `walk status` and `walk stop` first makes sure the
**recorder** runs (`recorder started in N s` on stderr): a process on the host that copies the
app's debug-log entries from logcat into the **capture**, a plain file, from up to ten minutes
before its start (what logcat's buffer still holds of them) to `cleanup`, every process of the
app, and on again after the phone drops off. One recorder serves every worktree, and `cleanup`
stops it. A recorder that died fails the next command with its cause (`the recorder stopped: …`)
and the one after starts it again: the capture holds nothing between the two, so say so in the
report.

### Looking and driving

What the app holds is read through hooks: `state` for the selection, the modes, the recording
and the screen's route, `list` for your items, `snapshot` for what is persisted. The screen is
looked at with `labels`, acted on with `tap --until`, in batches with `do`. A tap returns once its
outcome is on screen, so the next command follows it straight away; what you wait for is a
label, named.

- **Look with `labels`.** It prints the `text` and `content-desc` of everything on screen, and the
  time the read took: a card's figures, a dialog, the rows of a list. A `shot` is for a claim
  about pixels (what is drawn, where, in which colour): it writes the same labels line beside a
  screenshot; read the `.half.png` it names (about a third of a full screenshot's tokens), and
  `crop` the shot to one control for a closer look.
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
  `devcheck do "select trail 12" "tap 'Open map layers' --until 'Map layers'" "shot layers-open" back state`.
- **What moves is a strip**: `frames sheet-opens --count 6 --every 300` reads an animation or a
  camera ease as one image. A screencap takes its own time, so the times it prints, not
  `--every`, say when each frame was taken. A camera ease shows in no label, so where the camera
  ends (a fit after a selection) is the last frame of a strip taken across it: the ease is over
  when the last frames agree.
- **Pinch through `zoom`.** `zoom in --at 540,1200` writes two fingers to the touchscreen it
  finds in `getevent -pl`, scaled to that panel's own ranges; `--steps` sets how many moves.
- **Scroll with `scroll down` and `scroll up`**, for a claim about a list's screen or a long read
  in the app (the debug log). Each drags the largest list on screen by a third of its height and
  waits for it to settle, so the rows it prints overlap the ones before and none is skipped; at
  the end of a list the rows stay those of the scroll before. A long read is one `do` list of
  `scroll down` steps. The labels line gives every row's text, a detail repeated by many rows too.
- **Raw input, for what the toolkit lacks**: the app switcher (Rules), and `input keyevent 224`
  then `wm dismiss-keyguard` when the screen is off. If a PIN is asked, stop and report it.
- **The debug log is the first evidence for app behaviour: read it with `devcheck log`, or Read
  and grep the capture whose path `log` prints.** One entry per line, `<time> <pid> <level> <area>
  <message> <detail>`, positions redacted, so a grep line is evidence on its own; a line starting
  `--- ` is a gap (the phone or the recorder was away, and entries of that time may be missing)
  or, in `log`, a process header. `--area` narrows `log` (`--area hooks` for your hooks), and its
  header says when the recording began; for an older entry, or a build that predates the mirror
  (`log` says so), read the log in the app with `labels`: map card → **Settings** → **Debug log**
  (the build is not debuggable, so there is no `run-as` to pull its database).
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

## Test data

Create trails and activities whenever a behaviour needs one, through hooks, with the map in front.

- **A trail**: `devcheck route '<what it tests>' <stretch>...` writes its GPX (Walks), then
  `devcheck import-gpx <that file> --difficulty Medium` imports it as `DEVCHECK <what it tests>`
  and prints `imported trail <id> …`; `select trail <id>` shows it on the map. The same GPX is the
  walk's route.
- **An activity**: recorded against a walk so the track has real shape, as an agent session.
  1. Walk or jump to the start, `devcheck record start`, then walk.
  2. `devcheck record pause`, then `record resume` or step 3. `state` says
     `recording: paused, agent session`; the session stays an agent session across a relaunch.
  3. `devcheck record save '<what it tests>'` saves it as `DEVCHECK <what it tests>` with effort
     Easy (`--effort`), linked to the trail shown, and prints `… saved as activity <id>`; or
     `devcheck record discard` when the check needs no saved activity.
- **A list of what you made**: `devcheck list trails` (or `activities`) gives each `DEVCHECK` item's
  id.

A claim about the record button, the paused controls or the save form drives them with `tap`
(**Start recording**, **Pause recording (press and hold)** `--hold 1500`, **Stop and save
recording**, the form's **Activity name** and **Save activity**). That recording is not an agent
session, so every `record` command but `start` refuses it: end it through the screen too. A claim
about the picker, the trail form or the delete dialog drives them with `tap` the same way: map
card → **Trails** or **Activities** → the row's **Trail actions** or **Activity actions**.

Step 4's `cleanup` deletes everything you made. For an item it could not delete,
`devcheck delete trail|activity <id>` with the id it printed.

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
