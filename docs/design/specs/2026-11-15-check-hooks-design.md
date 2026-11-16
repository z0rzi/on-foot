# Check hooks: a device check sets up, tears down and reads the app without the screen — Design

**Status:** Built, [[2026-11-15-check-hooks]]. Challenged 2026-11-15 (a fact-check and a design critique) and rewritten on
their findings.
**From:** the owner's question of 2026-11-15 ("the agents keep on scrolling through interfaces …
is there really not a way for agents to send intents"), and the grilling that followed the same
day. Follows [[2026-11-15-app-log-capture-design]]; folds in the build-identity half of
[[T-109-device-check-trust-and-build]]. The choice of a hook inside the owner's own app is
[[0004-check-hooks]].
**Date:** 2026-11-15

Terms are the glossary's (**device check**, **check hook**) and the toolkit specs' (the
**toolkit**, the **reader**, the **recorder**, the **capture**, a **flow**). New here: a **core**
is the function a screen and a hook both call to do one thing in the app, with the rules that
decide whether it may; the **dispatcher** is the part of the app that receives a hook and answers
it; the **hook folder** is the app's own folder on the phone's shared storage, which adb can read
and write; an **agent session** is a recording a hook started.

## Problem Statement

A device check reaches every state it needs through the screen. To set up a trail it opens the
trail list, the system file picker and the trail form; to clean up it pages through both lists,
opens each `DEVCHECK` row's menu and confirms a dialog; to save a recording it fills a form; to
learn what is selected or whether the app records, it reads labels or a screenshot. On
2026-11-15 these flows took 12 to 126 s each, and the screen reader they depend on went stale
twice (after an install, after a replug), so `cleanup` failed to reach either list
([[T-112-reader-stale-after-install-or-replug]]). The toolkit carries the code that drives them
(list scanning, the delete dialog, the picker, the save form) and its tests.

None of this is what a check is about. The behaviour under check is one screen or one interaction;
the rest is setup, teardown and reading state. The release build cannot be reached any other way:
it is not debuggable, and a deep link can be sent by any app.

The toolkit also cannot tell which build is on the phone: `build-has` finds a string in the
bundle, so a change with no new string forces a 20-minute build (T-109).

## Solution

- **Check hooks**: commands a device check sends the app with `am broadcast`, each answered in
  the broadcast's own result, which `am broadcast` prints: import a GPX, delete `DEVCHECK` items,
  list them, select and clear, read the app's state, drive an agent session, and take a snapshot
  of the app's data. Each hook calls the same core as the screen, rules included, so the app's
  logic is the real one; only the taps are gone.
- **Only adb can call them**, and **only a build made with `EXPO_PUBLIC_DEBUG_CHECK_HOOKS` answers
  them**. Every build an agent makes sets the flag. Without it the dispatcher's code is not in the
  bundle and the receiver is never registered.
- **Hooks never touch what the owner does**: they refuse while a recording other than an agent
  session is live, recording hooks act only on agent sessions, writes are limited to `DEVCHECK`
  items, and writes refuse unless the map is the screen in front.
- **The app says when it is ready**: until its stores, offline packs and recording state have
  loaded, every hook answers `not-ready` and the toolkit waits on `state`, never on the reader.
- **The build names itself**: its commit and native fingerprint, in `state` and in the debug
  log's launch line; the toolkit says whether the installed build holds a commit.
- **The toolkit's commands keep their names** and change their path: `cleanup`, `delete` and
  `import-gpx` call hooks; `save-activity` becomes `record save`; `list`, `select`,
  `clear-selection`, `state`, `record` and `snapshot` are new. The UI-driving flows are deleted.
- **The toolkit's commands come from one registry**, built first, so the new commands are one
  entry each.

## User Stories

1. As a device-check agent, I want to import a `DEVCHECK` trail in one command that does not touch the screen, so that setup costs a second, not a picker and a form.
2. As a device-check agent, I want the import to return the new trail's id, so that I select it or delete it without looking it up.
3. As a device-check agent, I want an import whose trail would not be named `DEVCHECK …` refused before anything is written, so that I cannot create a trail that looks like the owner's.
4. As a device-check agent, I want `cleanup` to delete every `DEVCHECK` trail and activity in one hook, so that clean-up takes seconds and does not depend on the reader.
5. As a device-check agent, I want `delete trail|activity <id>` to refuse an item not named `DEVCHECK …`, in the app itself, so that a wrong id never deletes the owner's data.
6. As a device-check agent, I want deleting a trail to remove its offline map and keep its linked activities, as the screen's delete does, so that the hook leaves the data as the UI would.
7. As a device-check agent, I want `list trails|activities` to give each `DEVCHECK` item's id and name and a count of the others, so that I find my items without the owner's names entering my evidence.
8. As a device-check agent, I want `select trail|activity <id>` and `clear-selection`, so that I put the map in the state a check needs without tapping a list row.
9. As a device-check agent, I want a selection refused while recording, so that a hook never changes the trail a recording follows.
10. As a device-check agent, I want `state` to give the selection, the map mode, the follow mode, the screen in front, the recording phase and whether the session is an agent session, so that I read the app's state without a screenshot.
11. As a device-check agent, I want `state` to give the installed build's commit and native fingerprint, and the toolkit to say whether that commit holds the change I check, so that I build only when the change is missing.
12. As a device-check agent, I want the build's identity in the debug log's launch line too, so that I can read it from a build or a moment that has no hooks.
13. As a device-check agent, I want `record start` to start an agent session, or to refuse with the reason when a permission is missing, location is off or the app is not in front, so that a hook never hangs on a system dialog.
14. As a device-check agent, I want `record pause` and `record resume` on my agent session, so that a check of the card or the map during a recording reaches its state in a command.
15. As a device-check agent, I want `record save <name> [--effort …]` to save my paused agent session as `DEVCHECK <name>`, so that `save-activity`'s form is gone.
16. As a device-check agent, I want `record discard` on my agent session, so that a check that needs no saved activity ends cleanly.
17. As the owner, I want every recording hook to refuse a recording it did not start, so that a hike I paused and plugged in is never discarded or saved under a `DEVCHECK` name.
18. As the owner, I want imports, deletes and `cleanup` refused while a recording other than an agent session is live, so that a check never edits my data in the middle of my hike.
19. As a device-check agent, I want write hooks refused unless the map is in front, so that a hook never pulls a session or a trail from under an open form.
20. As a device-check agent, I want every hook to answer `not-ready` until the app has loaded its stores, its offline packs and its recording state, so that a hook never acts on a half-launched app.
21. As a device-check agent, I want the toolkit to launch On Foot when no dispatcher answers and wait until `state` says ready, without reading the screen, so that a hook never fails because the app was killed or just installed.
22. As a device-check agent, I want a build without hooks known at once, so that I build with the flag instead of waiting out a timeout.
23. As a device-check agent, I want every hook to answer with one reply, `ok` with its data, `refused` with the reason or `not-ready` with what is loading, so that I never guess what a command did.
24. As a device-check agent, I want each hook to write one line to the debug log under its own area, so that the capture shows what I did in order beside what the app logged, and I can tell an entry a hook caused.
25. As a device-check agent, I want `snapshot` to bring the app's database and its stored preferences to the computer, so that I query what the app persisted with `sqlite3`.
26. As a device-check agent, I want a snapshot to be consistent, so that I never read a file caught mid-write.
27. As the owner, I want my last camera position left out of a snapshot's preferences, so that the one live position the preferences hold never leaves the phone.
28. As the owner, I want a snapshot deleted from the phone once pulled and deleted from the computer by `cleanup`, so that my real trails and tracks do not linger in a check's files.
29. As the owner, I want reports to quote from a snapshot only `DEVCHECK` rows, counts and columns that are not positions, so that my routes and names stay out of every report.
30. As the owner, I want no other app on my phone able to send a hook, so that a hook in my daily app is no way in for anything else.
31. As the owner, I want a build without the flag to carry no dispatcher code and register no receiver, so that a build made for anyone else answers no hook.
32. As the owner, I want every build the agents make to have hooks, so that the app I use every day keeps working with the checks.
33. As a device-check agent, I want a `tap` on a delete confirmation refused when its dialog names an item not named `DEVCHECK …`, so that checking the delete dialog by hand can never delete the owner's item.
34. As a device-check agent, I want a check about a screen the hooks replace (the picker, the delete dialog, the save form) to drive that screen with `tap`, so that those screens are still checked.
35. As a device-check agent, I want the toolkit's commands to keep their names, so that the skill and my habits carry over.
36. As a future agent, I want each rule a screen applies (a selection refused while recording, the activity view ended on a start, the trail linked before a save) to live in a core both the screen and the hook call, so that a hook cannot skip one.
37. As a future agent, I want the dispatcher to be a pure function of a request and the cores, so that every hook and every refusal is tested without a phone.
38. As a future agent, I want the reply's format held between the app and the toolkit by a test, so that the two never drift.
39. As a future agent, I want each toolkit command declared once (its usage, parsing, running, `do` rule and recorder rule), so that adding a command is one entry.
40. As a future agent, I want the UI-driving flows deleted, not kept as a fallback, so that there is one way to set up and tear down.

## Implementation Decisions

### The command registry (first)

- Every toolkit command is one entry: its usage line, its parser, the function it runs, whether
  `do` takes it (or why not), and whether it starts the recorder. The usage text, the step list,
  the refusal map, the recorder rule, the command type and the command switch all come from the
  entries; the parallel lists go. The skill's command table is still checked against the usage
  text.
- Built before any hook, with no change of behaviour: the existing tests of the parser, the steps,
  the usage text and the recorder rule hold it.

### The flag and the build

- `EXPO_PUBLIC_DEBUG_CHECK_HOOKS=1` at build time, set by the skill's build command. The bundler
  inlines it; the dispatcher is reached only through a `require` inside a branch guarded by that
  literal variable, so with it unset the dispatcher's code is not collected into the bundle. A
  top-level import of hook code anywhere would defeat this, and the dispatcher's own test checks
  the guard's shape.
- Gradle's bundle task does not take environment variables as inputs, so a build whose only change
  is the flag would reuse the previous bundle. Agent builds always set the flag, so they never flip
  it; a build without it, made only when the owner asks, is made from a clean `android/` and a
  fresh bundle.
- **Build identity** is computed by the build command, outside the app's config (the native
  fingerprint hashes the config, so the config cannot compute it): the commit, whether the tree
  had uncommitted changes and a hash of those changes, and the native fingerprint. They reach the
  config by environment variables and the app through the config's `extra`, read with
  `expo-constants`, which is regenerated on every build. The fingerprint is configured to leave
  `extra` out of its hash, so identity does not change it. `state` returns the identity and the
  debug log's `launch cold start` line carries it.
- **The verdict** is the toolkit's: given a commit the change landed in, it says whether the
  installed commit holds it, and a build with uncommitted changes counts only if its hash matches
  the working tree's. The fingerprint is the one T-110 compares to choose a JS-only build.

### The receiver

- A local native module beside `share-intent`, declared in the native-modules seam.
- **Registered at runtime, not in the manifest**: the module registers its receiver when the
  dispatcher starts listening, exported and requiring `android.permission.DUMP`, and unregisters it
  when the dispatcher stops. A build without the flag has no dispatcher, so it never registers one;
  a process started without its UI (a headless start) has none either, so a broadcast there finds
  no receiver.
- **Only adb can send it**: `DUMP` is held by adb's shell and by no installed app.
- **The reply is the broadcast's result.** `am broadcast` sends an ordered broadcast and waits for
  it, printing the result code and data. The receiver holds the broadcast open, hands the request
  to JS as an event, and sets the result to the dispatcher's reply. A broadcast with no receiver
  comes back at once with no data, which the toolkit reads as "no dispatcher". A reply must come
  within the broadcast's time limit (about 10 s, sent as a foreground broadcast); no hook waits on
  anything slower, and a reply that would be large (a snapshot) is a file in the hook folder with
  its path in the reply.
- It also gives JS the path of the hook folder, which `expo-file-system` does not expose.

### The dispatcher

- A component mounted inside the map provider but outside the launch gate, so it listens from the
  app's first render and gets what the screens get (the offline controller from the provider's
  context); no shared code names a provider.
- **Readiness**: it answers `not-ready` with what is still loading until the launch has resolved,
  the trail and activity stores have loaded, the offline packs have loaded and the recording's
  resume has settled.
- **The dispatcher function** is pure: a request in, a reply out, the cores and the app's state as
  its dependencies. Unknown hooks, malformed arguments, the guards below and the cores' refusals
  are replies, never throws.
- **The guards**, applied before a core runs:
  - a write (import, delete, cleanup, a recording hook) refuses unless the map is the screen in
    front;
  - an import, a delete and `cleanup` refuse while a recording other than an agent session is
    live;
  - every recording hook but `start` refuses a session that is not an agent session;
  - writes refuse a name not starting with `DEVCHECK `.
- **Agent sessions**: the session ids `record start` created are kept persisted, so a relaunch
  mid-recording still knows them; an id leaves the set when its session is saved or discarded.
- **One debug-log line per hook**, under a new `hooks` area: the hook's name and its outcome, no
  data. The area is a chip of the Debug log screen's filter like the others.
- Hooks run one at a time: a hook that arrives while one runs is refused as busy.

### The cores

Each core holds the rules its screen applies today, and the screen calls it:

- **Import**: read the file, parse the GPX, compute its metrics and add the trail, with the name
  the request gives and a difficulty; returns the trail's id. Today inside the new-trail screen.
- **Delete a trail**: its offline packs, then the trail (which unlinks its activities), then forget
  it in the map's selection memory. Today inside the trail-delete hook with its confirm.
- **Delete an activity**: the activity, then forget it. Today inside the activity-delete hook.
- **Show an activity**: refused while recording, else selected. Today in the activities screen.
- **Show a trail**: refused while recording for a hook (no hook changes the trail a recording
  follows); the screen keeps its question ("Record along X instead of Y?") on the same core's
  answer that the trail differs from the one recorded along. Today in the show-trail hook.
- **Start from the map**: check permissions, location and the app being in front without
  prompting, start the recording and end the activity view. The record button prompts on the
  core's "missing permission" answer as it does now; the hook refuses with it. Today split between
  the record button and the recording controller.
- **Stop for save**: link the trail the recording followed, as the paused controls do before
  opening the save form.
- **Save**: build the activity from the session and its points, finish the recording and select
  the new activity, as the save screen does. A hook saves only a paused session, a rule of the
  hook, new, since no screen saves an unpaused one.
- Already callable as they are: listing (the stores), clearing the selection (the map store),
  pause, resume and discard (the recording controller), and the state readers.

### The hook folder, the GPX and the snapshot

- The toolkit pushes a GPX into the hook folder and names it in `import-gpx`'s request; the app
  reads it there. Files the app writes there are created through the folder, as a file that does
  not exist yet fails `expo-file-system`'s write check. That adb can write the folder is
  confirmed on the device in the receiver's item.
- **The snapshot**: the database copied with SQLite's `VACUUM INTO`, run synchronously through the
  database engine's seam so it never lands inside another write's transaction, and the stored
  preferences written as JSON with `lastCamera` removed, both into the hook folder. The toolkit
  pulls both into the check's evidence folder and deletes them on the phone; `cleanup` deletes
  them from the evidence folder and empties the hook folder, pushed GPX files included.

### The toolkit

- A hook is `am broadcast` with an explicit package through the toolkit's adb, as a foreground
  broadcast; its reply is parsed from what `am broadcast` prints. No reply data means no
  dispatcher: the toolkit launches On Foot and polls `state` until ready (bounded), then sends the
  hook again; a second miss fails pointing at a build with the flag.
- Commands on hooks: `import-gpx <file> [--difficulty]`, `delete trail|activity <id>`, `cleanup`
  (every `DEVCHECK` item in one hook, then back to the map and the reader and recorder stopped as
  today), `list trails|activities`, `select trail|activity <id>`, `clear-selection`, `state`,
  `record start|pause|resume|discard`, `record save <name> [--effort]`, `snapshot`, and
  `build-has` answering from the identity when the build has it.
- `state`, `list`, `select`, `clear-selection` and `snapshot` are `do` steps; the other writes are
  not, as the flows were not.
- **`tap` refuses a delete confirmation** whose dialog names an item not named `DEVCHECK …`, the
  guard the delete flow carried.
- **Deleted**: the list scan, the delete dialog flow, the picker import, `save-activity` and their
  tests. `build-has`'s bundle search stays for a build older than hooks.

### The skill

- Setup, teardown and state go through hooks; the screen is for the behaviour under check. The
  command table, the test-activities section, Preflight (identity from `state`) and Clean up are
  rewritten; the snapshot's quoting rule joins the rules on positions and the owner's names.

## Testing Decisions

- **A good test gives one unit a realistic input and checks what its caller sees**, as the
  toolkit's and the app's tests do; no test spawns adb, the app or a fake phone.
- **The dispatcher** (the one new seam): requests with fake cores and a given app state, for every
  hook: the `ok` reply and its data; `not-ready` for each thing still loading; each guard (a write
  off the map, a write during a recording that is not an agent session, a recording hook on a
  session that is not one, a non-`DEVCHECK` name, busy); a core's own refusal passed through; the
  agent-session set kept across a reload.
- **The cores**, where they hold the rules: show an activity or a trail while recording; start
  from the map with a permission missing, location off, the app behind, and the activity view
  ended after a start; stop for save linking the trail; the save's input from a session; the
  import's name and its refusal of an unreadable file; the trail delete's order (packs, trail,
  selection memory) with the offline controller faked. The screens' tests show the screens follow
  the cores' answers. Prior art: the store and recording-controller tests.
- **The toolkit's pure core**, the existing seam: the registry (the usage text, the step rules,
  the recorder rule, read from it), each hook's broadcast arguments, the parse of `am broadcast`'s
  output (a reply, no receiver, a refused or not-ready reply), the identity verdict, and `tap`'s
  delete-dialog refusal from a dump fixture. Prior art: the command-line, steps and tap-target
  tests.
- **The reply format**: the app's reply writer read by the toolkit's parser, in the cross-check
  test that already holds the debug-log mirror.
- **Device-verified, each able to fail**:
  - `state` on a build with the flag answers with its commit and fingerprint, and the launch line
    carries them;
  - the receiver registered with the `DUMP` permission (`dumpsys activity broadcasts`), so an app
    cannot send one; and a build without the flag registers none, read from that build's bundle
    and from `dumpsys` (no unflagged build replaces the owner's app for it);
  - each hook end to end: an import then its trail on the map; a delete of a `DEVCHECK` trail and
    its offline map gone; a delete of a non-`DEVCHECK` id refused; `list`, `select` and
    `clear-selection` seen on the screen; an agent session started, paused, resumed, saved and
    discarded; a recording started by the record button refused by `record discard`; `snapshot`
    opened in `sqlite3` with no `lastCamera`;
  - a hook right after an install and after a kill: `not-ready`, then answered, without the
    reader;
  - a reply held by the dispatcher for 5 s still printed by `am broadcast`;
  - a write hook with the save form open refused;
  - `cleanup` on the hooks, timed against today's flow.

## Existing shape

- **The share-intent module and its handler** are the first instance of "an Android intent
  received natively and handed to a component near the app's root". The receiver and the
  dispatcher's component are the second: a second local module in the same seam, a second handler.
  What differs is deliberate: the receiver is registered at runtime and replies through the
  broadcast's result, and the component sits outside the launch gate so it can say `not-ready`.
- **The screens' rules** (a selection refused while recording, the trail question, the activity
  view ended on a start, the trail linked before a save) are moved into cores the screens call, so
  the screen and the hook apply one rule; nothing is copied into the dispatcher.
- **The debug log** gets one area more; its lines reach the capture like every entry.
- **The toolkit's per-command facts** live in six places today (the usage text, the command type,
  the parser's switch, the execute switch, the step and refusal lists, the recorder rule); the
  registry replaces them before the hook commands add to them.
- **The delete flow's dialog guard** moves to `tap` when the flow goes.

## Failure modes

| Mode | Visible outcome | Recovery |
|---|---|---|
| The installed build has no hooks (no flag, or older) | `am broadcast` returns no data; after a launch and a second miss the command says the build has no hooks | Build with the flag |
| On Foot not running, or running headless | No dispatcher answers; the toolkit launches On Foot and polls `state` | None needed |
| The app still loading | `not-ready: <what>`; the toolkit polls until ready, bounded | None needed; a bound reached is reported with what was loading |
| A recording other than an agent session is live | Imports, deletes, `cleanup` and recording hooks refuse, saying so | The owner's: wait for it to end, a check never touches it. One a check started with the record button: end it through the screen |
| A write hook with another screen in front | `refused`, naming the screen | Go back to the map |
| A write names a non-`DEVCHECK` item | `refused`, naming the rule; nothing written | Use a `DEVCHECK` item |
| A core refuses (a selection while recording, a start with a permission missing or location off) | `refused` with the core's reason | Bring the app to a state that allows it |
| A hook while another runs | `refused: busy` | Send it again |
| Unknown hook or malformed arguments | `refused` naming the argument | Fix the command (the toolkit's parser catches most first) |
| A core throws (disk full, a corrupt GPX) | `refused` with the error's message; the app keeps running | Report it; a corrupt GPX is a finding |
| The reply misses the broadcast's time limit | `am broadcast` returns without data; the hook may have run | Read `state`; a hook that cannot answer in time is a defect of that hook |
| The hook folder cannot be written | `refused` with the cause | Report it |
| The phone drops off during a hook | `phone gone` as every command; the hook may have run | Read `state` once the phone is back |
| A broadcast from another app | Refused by the system before the app sees it | None needed |
| A snapshot while an agent session records | The engine's consistent copy, the session as of that moment | None needed |
| A delete confirmation tapped by hand on an owner's item | `tap` refuses, naming the item | Use a `DEVCHECK` item |

## Out of Scope

- A separate development app beside the owner's, a debuggable build with `run-as`, and deep links
  as the channel ([[0004-check-hooks]]).
- Replies through logcat lines and the recorder, the first draft's channel: the broadcast's result
  replaced them, with no time-out guessing and no file for long replies.
- A receiver declared in the manifest: it would start the app headless with nothing to answer.
- Preference hooks (a speed-mode setter does not exist yet); preferences are read through
  `snapshot` and set through the screen.
- `show` for a `DEVCHECK` item's figures, offered by the critique in place of the snapshot; the
  snapshot was kept, with its handling rules.
- The other half of T-109: a guarded way to leave the app (the Home key).
- T-110's JS-only build path, which will read the fingerprint `state` returns.
- Two agents on one phone.

## Further Notes

- The grilling of 2026-11-15 settled: setup, teardown and reads only; the name; the owner's own
  app; adb-only; `EXPO_PUBLIC_DEBUG_CHECK_HOOKS` on every agent build; the hook set with the
  recording hooks; extracted cores; the `DEVCHECK` rule in the app; the UI flows and
  `save-activity` deleted; a second local module; the hook folder; the toolkit's names; the
  snapshot; build identity folded in; the registry first.
- The challenge of the same day found the first draft wrong on: code left out of the bundle by an
  inlined flag alone (Metro collects every top-level import), the identity computed inside the
  config (the fingerprint hashes the config), the screens' rules said to be in callable functions
  (they were in the screens), the dispatcher beside the share-intent handler (inside the launch
  gate, so absent before launch resolves), and a recording hook able to touch the owner's own
  recording. It found the broadcast's result as a reply channel, which the first draft missed. The
  owner then chose: replies by the broadcast's result, the module present but unregistered without
  the flag, a selection refused while recording, a start that refuses instead of prompting, `list`
  with counts for the owner's items, the snapshot kept without `lastCamera`, and a `hooks` area in
  the debug log.
- Timings that motivate it, 2026-11-15: `import-gpx` 11.7 s, `save-activity` 16 to 22 s,
  `cleanup` up to 126 s and failed once on the reader.
