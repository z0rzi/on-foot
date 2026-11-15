# Device-check speed: a reader that does not wait for idle, and fewer round trips — Design

**Status:** Built, [[2026-11-14-device-check-speed]]. The model trial of its item 07 ran and the model was not adopted: the trial broke rules of the skill ([[2026-11-15-device-check-speed-rerun]]).
**From:** the owner's question of 2026-11-14 ("the AI operated device checks are painfully slow"),
timings taken on the phone that day, and the device-check transcripts of 2026-11-11 to 2026-11-13.
Follows [[2026-11-10-device-check-toolkit-design]].
**Date:** 2026-11-14

Terms are those of the toolkit spec: a **device check** is a run of the `device-check` skill, the
**caller** is the agent that dispatches it, the **walker** feeds mock fixes, a **mark** is a
distance along its route. New here: a **read** is one capture of the screen's accessibility tree;
the **reader** is what takes it; a screen is **settled** when two reads in a row agree.

## Problem Statement

The toolkit removed the hand-built walkers and scripts, and a device check still takes 25 to 80
minutes. The owner waits on it at the end of every change. Where the time goes now:

- **Every look at the screen waits for the screen to idle.** `uiautomator dump` waits for a second
  without accessibility events, up to 10 s. Measured on 2026-11-14: about 2.4 s on an idle screen,
  and 12 s followed by `could not get idle state` on the map in front (twice in a row), as on the
  recording screen. `tap`, `shot` and every poll of `wait-for` take one read each: the transcripts
  hold 450 taps, 348 shots and 62 wait-fors. The other adb calls are noise beside it (a shell call
  0.03 s, a screenshot 1.2 s, starting the toolkit 0.16 s).
- **The recording screen cannot be read at all**, so the skill carries a remembered record button,
  a pause confirmation, a refusal of every other tap, and "read the screenshot, or pause first".
  The same holds during a walk.
- **A tap says nothing about what it caused.** The pattern in the transcripts is
  `tap; sleep 2; shot`: 27 minutes of fixed sleeps over 147 minutes of toolkit time, and a
  screenshot taken only to learn which screen came up.
- **The only way to read the screen is a screenshot.** `shot` always captures, scales and names a
  PNG, and the agent then reads it: 606 image reads, although the labels line answers most checks.
- **One step per model turn.** The longest run (82 minutes) spent 26 of them between calls: 200
  turns at about 8 s. Agents already chain steps with `;` and `&&`, each a new process that
  re-reads the serial, the foreground and the recording state.
- **Raw `input keyevent 4` and `input text`** fill the gaps of the toolkit, outside its foreground
  guard.

Walk time at `walk` pace is real time by design and is not part of this problem.

## Solution

- **A reader that does not wait for idle**: the Appium UiAutomator2 server, two apps installed on
  the phone beside the Appium Settings app the walker already uses (the owner's choice, 2026-11-14).
  A read takes well under a second on any screen, recording and mid-walk included.
- **`tap` reports what it caused**: it waits for the screen to settle and prints the labels now on
  screen; `--until <label>` waits for a named outcome instead.
- **`labels`**, a read with no screenshot, is the default way to look. `shot` stays for when pixels
  are the evidence.
- **`back` and `type`** join the toolkit, behind the same foreground guard as `tap`.
- **`do`** runs several steps in one command and one model turn, stopping at the first failure.
- With the recording screen readable, the remembered record button, the pause confirmation and the
  "cannot be dumped" rules are deleted, from the toolkit and from the skill.
- **A faster model for the check**, adopted only if a trial shows the same verdicts.

## User Stories

1. As the owner, I want a device check of a small change to end in minutes, so that I stop deferring checks into `docs/tickets/device-checks.md`.
2. As a device-check agent, I want a read to take under a second on an idle screen, so that a tap costs a second instead of three.
3. As a device-check agent, I want a read to succeed while the map animates or the camera follows the puck, so that I do not lose 12 s to a failed dump.
4. As a device-check agent, I want a read to succeed while On Foot records, so that I can read the recording screen's labels instead of a screenshot.
5. As a device-check agent, I want to tap any control of the recording screen by its label, so that the map card, the layers and the sheet can be checked during a recording.
6. As a device-check agent, I want to read and tap while a walk moves, so that I can check the screen at a mark without waiting for the move to end.
7. As a device-check agent, I want `wait-for` to work while recording and during a walk, so that I wait on the event I mean there too.
8. As a device-check agent, I want a tap to act only once its target has stopped moving, so that a tap during a sheet animation does not land beside the control.
9. As a device-check agent, I want `tap` to print the labels on screen once the screen has settled, so that I learn what the tap caused without a second command.
10. As a device-check agent, I want `tap --until <label>` to return when that label appears, so that a slow screen is waited for by name and not by a sleep.
11. As a device-check agent, I want `tap --until-gone <label>`, so that closing a dialog or a sheet is confirmed in the same command.
12. As a device-check agent, I want a tap whose expected outcome never comes to fail with the labels it last saw, so that a missed tap is never reported as done.
13. As a device-check agent, I want a tap that changed nothing to say so, so that I notice a dead control or a missed hold.
14. As a device-check agent, I want `tap --hold` on the pause button to be confirmed by the screen itself, so that the toolkit no longer needs a remembered button.
15. As a device-check agent, I want a `labels` command that prints the labels line and nothing else, so that reading the screen costs no screenshot and no image tokens.
16. As a device-check agent, I want `labels` to print the time the read took, so that a slow reader shows in the transcript.
17. As a device-check agent, I want `shot` to keep its screenshot, half copy, dump and labels, so that pixel evidence works as before.
18. As a device-check agent, I want `shot` to include the dump while recording and during a walk, so that `crop` works on those shots.
19. As a device-check agent, I want a `back` command, so that I stop sending raw key events.
20. As a device-check agent, I want a `type` command that takes plain text with spaces, so that I stop escaping `%s` by hand.
21. As the owner, I want `back` and `type` refused when another app is in front, so that no key press of a check reaches my other apps.
22. As a device-check agent, I want `do` to run a list of steps in one command, so that a five-step flow costs one turn.
23. As a device-check agent, I want `do` to stop at the first failing step and name it, so that later steps never act on a screen I did not expect.
24. As a device-check agent, I want `do` to print each step's own output under the step, so that the evidence reads as if I had run them one by one.
25. As a device-check agent, I want `do` to exit with the failing step's code, so that `phone gone` stays distinguishable.
26. As a device-check agent, I want a faulty step refused before any step runs, so that a typo in step four does not leave the app half-driven.
27. As a device-check agent, I want `do` to refuse walks and builds as steps, so that a long wait stays a background command the harness reports.
28. As a device-check agent, I want the foreground guard applied before every step of `do`, so that a step that opened another app stops the list.
29. As the owner, I want the two server apps installed once, by the agent over adb, at a version written in the skill, so that I know what is on my phone and nothing updates behind my back.
30. As the owner, I want the server stopped by the check's clean-up, so that nothing of a check keeps running on my phone after it.
31. As the owner, I want my accessibility services left as they were while the server runs, so that a check does not switch off something I use.
32. As a device-check agent, I want the toolkit to start the server by itself when it is not answering, so that a reboot or a killed server costs one slower call, not a setup step.
33. As a device-check agent, I want a missing server app to fail pointing at Phone setup, so that I report `blocked` with the fix instead of guessing.
34. As the owner, I want one server per phone across every worktree, so that two agents share it and neither stops the other's.
35. As a device-check agent, I want a reader that fails to say why, so that I report `blocked` with the cause.
36. As a future agent, I want one reader in the toolkit, so that there is no second code path for "the screen that cannot be dumped".
37. As a future agent, I want the settled rule to be a pure function, so that its edge cases (a ticking clock, a moving sheet) are tested without a phone.
38. As a device-check agent, I want the skill to tell me to read with `labels`, act with `tap --until` and batch with `do`, so that I do not fall back to `tap; sleep; shot`.
39. As a device-check agent, I want the skill's recording and walk exceptions gone, so that there is one way to look and drive.
40. As the owner, I want the faster model adopted only if it reaches the same verdicts on the same checks, so that speed does not cost me a wrong `verified`.
41. As the owner, I want feel to stay my step, so that a faster check claims no more than before.
42. As the owner, I want the speed-up measured on a real check before and after, so that the claim rests on the phone and not on this spec.

## Implementation Decisions

### The reader

- **The Appium UiAutomator2 server is the reader** (the owner's choice, 2026-11-14, over a
  self-built program run through `app_process`: a known, maintained tool against an unproven one).
  It is two APKs from the releases of `appium/appium-uiautomator2-server`, the server and its test
  runner, started as an instrumentation and answering HTTP on a port of the phone that the toolkit
  reaches through an adb forward. The toolkit speaks to it directly; the Appium client and its
  Node server are not used and not added as dependencies.
- **Its idle wait is set to zero**, through the server's own setting, so a page source is returned
  at once on any screen.
- **The server's XML is read by the existing dump parser.** Its page source has the attributes the
  parser reads (`text`, `content-desc`, `class`, `bounds`) under other element names; the parser is
  widened to that form, and fixtures captured from the server hold it there. `crop` stays as it
  is. The summary line folds a text only into a node that contains it or is contained by it, so a
  text carried by separate nodes is said for each: a detail repeated on another row, a debug-log
  entry's among them, was dropped from the line before (found on the device in the re-run).
- **Started on demand, stopped in clean-up.** Each read first asks the server for its status; no
  answer starts the instrumentation and waits for it, under a start lock kept with the walker's
  per-phone state, so two agents never start it twice. `devcheck cleanup` stops it once no walk
  moves, after pressing back down to the map through the lists it opened, the last read it needs.
  A server left running by a dead session is found and reused by the next check.
- **One server per phone, one fixed port**, shared across worktrees like the walker.
- **Accessibility services are not suppressed**: the server is started with its argument that
  leaves running services running. Without it the owner's own accessibility service is unbound for
  as long as the server runs (seen on the device, Further Notes); the server's state check treats
  a server started without it as not running and restarts it.
- **The version is pinned.** The skill's Phone setup names the release installed and its date, as it
  does for Appium Settings; the toolkit reads the installed version and refuses another one with a
  pointer to Phone setup. An update is a deliberate change of that line.
- **Only the read goes through the server.** Taps, keys, text, the pinch and screenshots stay on
  `adb shell input`, `sendevent` and `screencap`, with the toolkit's foreground guard.
- **What the hand run of 2026-11-14 used, at v10.6.6**, enough for the read: the instrumentation
  `io.appium.uiautomator2.server.test/androidx.test.runner.AndroidJUnitRunner` started with
  `am instrument -w` and the arguments `disableAnalytics true` and
  `DISABLE_SUPPRESS_ACCESSIBILITY_SERVICES true`; the phone's port 6790; `GET /status`;
  `POST /session` with empty W3C capabilities; `POST /session/<id>/appium/settings` with
  `waitForIdleTimeout: 0`; `GET /session/<id>/source`. The source's elements are named by widget
  class, not `node`. Anything beyond these is read from the server's source at the pinned version.
- **Target**: a read under 1 s on the idle map, on the recording screen and during a `fast` walk,
  and a cold start of the server under 10 s. Met by hand on 2026-11-14 (Further Notes): reads of
  0.1 to 0.4 s, a start of 2 s. The first work item repeats it through the toolkit's own reader
  and adds what the hand run did not cover: a check of half an hour without the server dying, and
  a read after a reboot.
- **`uiautomator dump` goes** once the reader has passed its device verification: while the server
  holds the UiAutomation connection the platform's dump cannot run anyway. No fallback path is
  kept; a reader that fails is a failed command with its reason.

### Settled

- The platform's idle is replaced by the toolkit's own rule: **a screen is settled when two reads
  in a row, a short interval apart, agree**, within a cap. Agreement is on what matters to the
  caller: for a tap's target, its bounds; for a tap's outcome, the set of labels and their bounds.
- A recording clock changes a text every second. Two reads a fraction of a second apart mostly
  agree, and a third read settles the rest; the rule takes the first agreeing pair inside the cap,
  and at the cap reports the last read as "not settled" without failing. The intervals and the cap
  are constants of the toolkit, set on the device.
- The rule is a pure function of two reads; the loop around it is shell.

### Commands

- **`tap <label> [--hold MS] [--until <label> | --until-gone <label>] [--timeout S]`**: read until
  the target's bounds agree, tap, then either wait for the named outcome or for the screen to
  settle, and print `labels:` for the screen it ended on. A screen identical before and after
  prints "nothing changed". A named outcome that does not come fails with the labels last seen.
- **`labels`**: foreground guard, one read, the labels line, the time taken. No file is written.
- **`shot`** is unchanged from the caller's side, and now writes its dump on every screen.
- **`back`** sends the back key, then waits for the screen to settle as a tap with no outcome
  named does and prints the same outcome; **`type <text>`** types plain text, escaping what the
  phone's `input text` needs. Both take the foreground guard.
- **`scroll up|down`** drags the largest scrollable element on screen by a third of its height,
  inside its bounds, the delete flow's own drag, behind the foreground guard, then waits for the
  screen to settle as a tap does and prints the same outcome. A screen where nothing scrolls fails
  the command and ends the delete flow's scan. The owner's decision of
  2026-11-14, once the check chosen for the re-run was found scrolling the debug log by raw swipes.
- **`wait-for`** keeps its interface and polls the new reader; its refusals while recording and
  during a walk go.
- **`do <step>...`**: each argument is one step, written as the same command line the toolkit
  takes, split by one pure parser. Allowed steps: `tap`, `wait-for`, `labels`, `shot`, `frames`,
  `crop`, `zoom`, `scroll`, `back`, `type`. `walk`, `import-gpx`, `save-activity`, `delete`,
  `cleanup`, `build-has` and `do` itself are refused as steps, with the reason. Every step is
  parsed before the first runs. Steps run in order in one process; each prints a header naming it,
  then its own output; the first failure ends the list with that step's exit code and the count of
  steps not run.
- **The command functions return their result and the CLI prints it**, where today they print as
  they go, so that `do` composes them and `import-gpx`, `save-activity` and the delete flow keep
  calling the same functions.

### What is deleted

- The screen read's `recording` outcome, the remembered record button and its store field, the
  pause confirmation by recording state, the "only the record button" refusal, and the refusals of
  `tap` and `wait-for` during a move.
- The fixed settle sleep of the delete flow, replaced by the settled rule.
- From the skill: "The recording screen cannot be dumped", "During a walk `shot` skips the dump",
  the raw `input text` and `input keyevent 4` lines, and the step that collapses the map card
  before pausing if the device verification shows the pause button is found by label with the card
  open.

### Skill changes in the same work

- **Looking and driving** is rewritten around `labels` → `tap --until` → `do`; "read the labels
  line first" becomes "read with `labels`; take a `shot` when the claim is about pixels".
- The command table gains `labels`, `back`, `type`, `scroll`, `do` and the new `tap` options.
- The rules keep their meaning: raw `input` stays allowed only for what the toolkit still lacks
  (the app switcher, waking the screen).
- **Phone setup** gains the two server APKs, their release and install date, and the install
  command. "Leave the package and the phone intact" names the three Appium packages as the
  toolkit's own: they may be started and stopped, never the owner's apps.
- **Clean up** says the server is stopped by `cleanup`, and the report's phone state says whether
  it still runs.

### The model of the check

- A trial, not a switch: one finished device check is dispatched again with the same brief on
  Sonnet. Adopted if every verdict matches and no rule of the skill is broken; the measured wall
  time goes in the report either way. How the model is named (the skill's frontmatter if the
  harness honours it for a skill, else the caller's dispatch) is settled by reading the Claude Code
  documentation in that item, and written in one place.
- It is the last item and depends on nothing but the others being in, so its trial runs on the
  fast toolkit.

## Testing Decisions

- **The seam stays the pure core, called as functions**, as the owner chose for the toolkit: no
  test spawns the toolkit, a fake adb or the reader. A good test gives one function a realistic
  input and checks what the caller sees.
- **New pure units and their cases**:
  - the settled rule: equal reads agree; a moved target does not; a changed clock text with equal
    bounds agrees for a target and not for the full label set; the cap reports "not settled";
  - the tap outcome: appeared, gone, nothing changed, timed out with the labels seen;
  - the step parser: quoting, options, an unknown or refused step named with its position, an empty
    list refused;
  - the step runner's plan: order kept, stop at the first failure, the failing step's exit code,
    the count not run;
  - text escaping for `type`: spaces, quotes, the characters `input text` mangles;
  - the server's state from what it answers: running, not answering, app missing, another version;
  - the server's page source through the dump parser: the same nodes, labels and bounds as a
    platform dump of the same screen.
- **The reader's output is held to the parser by fixtures captured from the phone with the new
  reader**: the idle map, the recording screen with the map card open and closed, a sheet
  mid-animation, the picker. The existing dump fixtures stay, proving one parser reads both.
- **Tests that go with the code they cover**: the remembered-button and "recording cannot be
  dumped" cases of the tap-target tests.
- **Prior art**: the dump-parsing and list-scan tests (fixture text into findings), the pinch-plan
  and frames-plan tests (a plan as data, the shell around it untested), the phone-state tests.
- **Device-verified by the agent that builds each item**, each check able to fail:
  - the reader's target above, timed, on the three screens, and the cold start;
  - a read with an accessibility service running, the service still running after;
  - the server killed between two commands: the next read starts it and succeeds;
  - `cleanup` leaves no server process; a read after a phone reboot works with no manual step;
  - a tap on a control of a sheet while it opens: the tap lands;
  - the pause held by label while recording, with the map card open and closed;
  - `tap --until` on a screen that takes over a second to come, and on one that never comes;
  - `back` and `type` refused with another app in front;
  - a `do` list whose third step fails: steps four on not run;
  - one earlier device check re-run end to end, its wall time, turn count and image reads set
    against the original's in the report.

## Existing shape

- **The screen read** is the first and only instance of the reader: one function returning a dump,
  a recording refusal or a failure. It is replaced in place, not forked; its `recording` branch and
  everything built on it are removed.
- **`wait-for`'s polling loop** is the first instance of "read until a judge is satisfied". The
  settle wait and the tap outcome are the second and third: they go through that one loop, with the
  judge as the only difference.
- **`import-gpx`, `save-activity` and the delete flow** are the first instances of a step list, as
  code. `do` is the same shape as data; all four call the same command functions. The flows are not
  rewritten as `do` lists: they hold guards a step list does not (the `DEVCHECK` prefix, the dialog
  that must name the item).
- **The half-width copy and `crop`** stay the only image paths. `labels` shares the summary line
  with `shot`.
- **Appium Settings** is the first Appium app the toolkit drives (the walker's mock location):
  the server follows its shape for the preflight that checks the app is installed and points at
  Phone setup, and for the per-phone state shared across worktrees. What differs is that the
  server is a process the toolkit starts and stops.
- **The adb module** is the only way the toolkit reaches the phone today. The server adds a second
  channel, HTTP over an adb forward; it lives in one module beside adb, and a lost phone seen there
  is turned into the same `phone gone` path.

## Failure modes

| Mode | Visible outcome | Recovery |
|---|---|---|
| Server not running (reboot, killed, first read of a check) | Started before the read; the call is slower once | None needed |
| Server app missing, or another version than the pinned one | The command fails pointing at Phone setup | Install the pinned release; until then `blocked` |
| Server does not come up within its start timeout | The command fails with the instrumentation's output | Run again; if it persists, `blocked` |
| Server dies mid-check (the system kills it, OxygenOS battery rules) | The next read restarts it; the restart is printed | None needed; a check that sees it repeatedly reports it |
| OxygenOS's battery manager freezes the server (its background activity not allowed) | A read stalls past the status timeout; the toolkit finds the freeze in logcat, stops the server and fails pointing at Phone setup | Allow the server's background activity (Phone setup); until then `blocked` |
| The port forward is gone (adb reconnect, replug) | Set again before the read | None needed |
| The port is taken on the host | The command fails naming the port and its holder | Free the port |
| Two agents start the server at once | The second waits on the start lock, then reuses it | None needed |
| A session dies with the server running | It stays up, holding the UiAutomation connection | The next check reuses it and its `cleanup` stops it |
| Server answers with an error or no tree | The command fails with its message; nothing is cached | Run again |
| No active window (screen off, keyguard) | Fails saying the screen cannot be read | Wake the phone as the skill says; a PIN stops the check |
| Phone gone during a read | The adb rules as today: one reconnect, `phone gone`, exit 3 | `blocked` |
| Screen never settles inside the cap (a spinner, the recording clock on a full-screen compare) | The last read is printed as "not settled"; the command does not fail | Name the outcome with `--until` |
| Target still moving at the cap | The tap is refused, saying so | Tap again, or wait for a label first |
| `--until` label never appears | Fails with the time waited and the labels last seen | Correct the label or report the finding |
| Tap changes nothing | "nothing changed" printed, exit 0 | The agent decides: dead control or a real finding |
| Another app in front before a step | The step refuses; in `do`, the list stops there | Bring On Foot back |
| A step of `do` is malformed or not allowed | Refused before any step runs, naming the step | Fix the list |
| A step of `do` fails | Its output and exit code; the count of steps not run | Continue from that step |
| `type` given a character the phone's input cannot send | Refused naming the character | Use another test string |
| The faster model breaks a rule or differs on a verdict | The trial report says which | The model is not adopted |

## Out of Scope

- **Walk time.** `walk` pace is real time and `fast` is bounded by the trail match; unchanged.
- **Release build time** (8 to 13 minutes cold): still the separate decision the toolkit spec left.
- **A self-built reader run through `app_process`** (nothing installed, no server): considered and
  set aside by the owner for the Appium server.
- **Driving through the server** (its taps, gestures, screenshots, element finding): only the read
  is taken. Whether its screenshot beats `screencap` is worth a look later.
- **The Appium client, Appium's Node server, Maestro** or any test framework on top.
- Rewriting `import-gpx`, `save-activity` or the delete flow as `do` lists.
- A screenshot that is cheaper than `screencap` (1.2 s); a faster `frames`.
- Running two steps at once, or two agents on one phone.
- Any change to the app to make it easier to read (test IDs, a quieter clock).
- Judging feel; `owner to verify` stays.

## Further Notes

- Timings of 2026-11-14 are from the phone with On Foot's map in front: `uiautomator dump` 11.8 s
  and 12.1 s, both `ERROR: could not get idle state`; `screencap` 1.2 s; `dumpsys` calls 0.05 s;
  toolkit start 0.2 s. The 2.4 s idle figure is the toolkit spec's.
- Transcript figures cover every session of 2026-11-11 to 2026-11-13 that called the toolkit: 398
  shell calls holding a toolkit command, 147 minutes inside them, 27 minutes of written sleeps, 606
  PNG reads. Counts of `tap`, `shot` and `wait-for` are of invocations inside those calls. They
  were counted once by the agent that wrote this spec and not fact-checked independently.
- **Measured on the phone on 2026-11-14 with server v10.6.6** (installed that day over adb, no
  prompt on the phone; SHA-256 of the server APK `8ff760a2…c80d`, of the test APK `e6f72928…1e1c`),
  driven by hand with `curl`, idle wait set to zero:
  - cold start, from `am instrument` to a ready status: 2.0 s;
  - idle map, where `uiautomator dump` had just failed twice after 12 s: ten reads of 0.09 to 0.17 s;
  - recording, standing: ten reads of 0.17 to 0.30 s;
  - recording during a `fast` walk, the camera following: ten reads of 0.22 to 0.39 s;
  - the recording screen's labels read in full, **Pause recording (press and hold)** found by its
    label and held at its bounds, the next read showing **Resume recording**;
  - started plain, the server unbound the owner's accessibility service (Wispr Flow); started with
    the instrumentation argument `DISABLE_SUPPRESS_ACCESSIBILITY_SERVICES true` the service stayed
    bound. That argument is required, not optional;
  - with the server running, `uiautomator dump` fails at once with no output, so today's toolkit
    `tap` does not work beside it: the switch is all at once;
  - `am force-stop` of the two packages stops it, and the accessibility service is bound after.
  So the read target is met on the three screens. Not yet seen: the server living through a long
  check under OxygenOS's battery rules, and a read after a reboot.
- The two apps are on the phone since that measurement, stopped.
- Tooling has no ticket area, so this spec has no worklist ticket and carries no triage field; the
  work goes to a plan folder through `/to-tickets`.
