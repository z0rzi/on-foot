# Check hooks: one check run again — 2026-11-16

**What.** [[2026-11-15-check-hooks]], the gain owed by its final check
(`docs/tickets/device-checks.md`, Check hooks entry). The field-diagnostics device check of
2026-11-11 (the field-diagnostics owed checks, the T-95 repro and T-49) was run once more by a
fresh agent on 2026-11-16, with the skill and toolkit of the `check-hooks` branch at `f864514`.
It is set beside the three runs of [[2026-11-15-device-check-speed-rerun]], counted by that
report's method.

**Sources.**
- Original, re-run and trial: as named in [[2026-11-15-device-check-speed-rerun]]. Original
  17:01:14Z to 17:44:23Z on 2026-11-11; re-run 22:02:52Z to 23:01:20Z on 2026-11-14; trial
  23:15:29Z to 23:32:18Z the same night.
- Check hooks re-run: subagent
  `~/.claude/projects/-home-zorzi-nix-envs-android-studio-on-foot-rn/33f0235d-86bd-4952-86ee-1742a97d9c61/subagents/agent-a3406ea57c6c8a454.jsonl`,
  10:07:47Z to 10:22:18Z on 2026-11-16, Opus, cold. Its brief was the 2026-11-14 re-run's
  (`.scratch/check-hooks-rerun/brief-2026-11-14.md`) word for word, with the paths changed: this
  worktree's skill and launcher, the two ticket files at `.scratch/check-hooks-rerun/`, the
  session's lock. Evidence: `.scratch/device-checks/2026-11-16/`, numbers 40 to 50; capture
  `50-app-log.txt`.

## Figures

| | Original (2026-11-11) | Re-run (2026-11-14) | Trial (2026-11-15) | Check hooks (2026-11-16) |
|---|---|---|---|---|
| Model | Opus, in session | Opus, cold | Sonnet, cold | Opus, cold |
| Wall, whole window | 43.2 min | 58.5 min | 16.8 min | 14.5 min |
| Wall, minus the release build | 23.6 min | 38.4 min | 16.8 min (no build) | 14.5 min (no build) |
| Wall, minus the build and the walk waits | 18.3 min | 26.6 min | 11.2 min | 9.8 min |
| Builds | 1, 19.6 min | 1, 20.1 min | 0 | 0 |
| Model turns | 48 | 112 | 40 | 59 |
| Tool calls | 47 | 110 | 41 | 59 |
| … on the phone (toolkit or adb) | 34 | 67 | 26 | 34 |
| … code, docs and logs | 9 | 30 | 9 | 15 |
| Image reads | 4 | 7 | 3 | 7 |
| Screen reads | 108 | 184 | 130 | 78 |
| `shot` | 36 | 12, 1 of them a `do` step | 4, 2 of them `do` steps | 6, 4 of them `do` steps |
| Hook commands | none in the toolkit | none in the toolkit | none in the toolkit | 18: `state` 6, `snapshot` 3, `build-has` 3, `import-gpx`, `record start`, `record pause`, `list`, `cleanup` 1 each |
| Written sleeps | 74, in 25 calls, 125 s | 17, in 13 calls, 490 s | 15, in 8 calls, 68 s | 14, in 11 calls, 144 s |
| Raw `input` | 26 | 5 | 7 | 4 (the app switcher twice, a card swipe, the Home key) |
| `tap --until` / `do` | 0 / 0 | 54 / 21 | 25 / 14 | 20 / 6 |
| Time per toolkit call | 27.2 s (31 calls, 14.0 min) | 16.4 s (64 calls, 17.5 min) | 21.2 s (26 calls, 9.2 min) | 10.1 s (33 calls, 5.6 min) |
| Model time between calls | 3.4 min | 8.7 min | 2.0 min | 4.1 min |
| Importing the trail | the picker flow failed twice, then by hand in a 29 s call | the picker flow, about 10.7 s | the picker flow, in an 11.6 s call | the hook, in a 1.3 s call with the route's writing |
| Tearing down | by hand through the lists, 6 calls, 1.7 min | the UI flow, in a 160 s call | the UI flow, 126 s and failed, a hand tap, then 34 s | the hook, about 1 s |

**How they were counted.** A script read each JSONL over the window named above: the 2026-11-15
report's `count.py` and `cats.py`, extended for the rows the owed item added. It gives the earlier
runs' published figures again, to within 0.1 min on the re-run's wall and model time.
- **Turns, tool calls, image reads, written sleeps, raw `input`, `tap --until`, `do`**: as in
  the 2026-11-15 report, sleeps and raw input counted as written.
- **The new run's code, docs and logs calls** are 7 reads of the skill, the tickets and the
  source, 4 waits on a background task (below), 3 on the evidence (two puck crops, the stored
  preferences) and the lock's release.
- **Screen reads**: each toolkit command that reads the screen (`labels`, `shot`, `frames`, `tap`,
  `wait-for`, `scroll`, `back`), a `do` step counting as one, plus raw `uiautomator dump` and
  `screencap` (none in any run). Here a command inside a shell loop counts once per pass, so the
  trial's 130 holds 62 `scroll down` from two loops, the original's 108 holds 23 more `shot` from
  six loops, and the new run's 78 holds 5 `scroll up` from one. The UI flows read the screen many
  times and are not counted in it: `import-gpx` by the picker (2 in the original, 1 in the re-run
  and the trial), `save-activity` (2, 3, 1) and `cleanup` (1 in the re-run, 2 in the trial).
- **Hook commands**: `build-has` answers from `state` on this toolkit; on the earlier ones it was a
  string search in the installed bundle, used 2, 9 and 4 times.
- **Wall time**: the window minus the idle stretches:
  - the earlier runs' builds and walks, as the 2026-11-15 report names them;
  - in the new run, 10:10:55–10:15:05, two foreground polls of a background `until grep` for the
    `heading sample` (the first moved to the background by the harness after 180 s), and
    10:16:11–10:16:44, a foreground wait for the first walk to end. Its 45 s and 50 s sleeps after
    the two restarts, while fixes came in under the second walk, are left in, as the re-run's
    were.
- **Time per toolkit call**: from each tool call that runs the toolkit to its result, sleeps
  included.
- **Model time between calls**: the wall time minus the time inside every tool call, both
  without the idle stretches.
- **Import and tear-down durations**: the call that held the command, less what else it held
  where that can be told. The new run's hook lines in the capture date them: `hook import-gpx ok`
  at 11:09:31.360 for a call sent at 11:09:30.055, and `hook cleanup ok` at 11:21:55.686, its reply
  back on the map with the reader and recorder stopped by the call's end at 11:21:56.496.

## Verdicts

The new run reached every verdict of the three earlier runs.

| Claim | Original | Re-run | Trial | Check hooks |
|---|---|---|---|---|
| T-4: selecting a trail, then an activity, writes `route loaded` and `route derived` with `kind`, `points`, `ms` | verified | verified | verified | verified, both selected from their lists |
| T-84: a cold start writes one `launch camera`; a selection writes `fit requested` (`by: select`) then `fit fired` | verified | verified | verified | verified, the trail's and the activity's |
| T-89: `heading watch` on, off at pause and on leaving; a `heading sample` after five minutes; one `puck mounted`; the puck drawn with its arrow | verified (arrow turning: owner) | verified (arrow turning: owner) | verified | verified (arrow turning: owner) |
| T-49: a preference changed survives a kill and relaunch | verified (200 m) | verified (100 m and speed mode) | verified (100 m), on a build it did not prove | verified (100 m), on a build `build-has --commit` proved, in Settings and in the stored preferences |
| T-95: pause, stop, discard, then start in one process | not reproduced | not reproduced, two variants | not reproduced, one sequence | not reproduced, two sequences |
| `delivery fault`, `delivery waiting` | not seen | not seen | not seen | not seen |

- **T-49.** `snapshot` read `{"paceSpeedMode":"pace","elevationSmoothingMeters":100}` from the
  phone after the kill (a new pid, 10144 then 12263), and Settings showed 100 m selected
  (`43-t49-after-relaunch`). As the agent said, that shows a write after hydration surviving; the
  race T-49 fixed, a change before the hydration lands or after it fails, stays unexercised on a
  device, and no ticket or `device-checks.md` entry holds it.
- **T-95.** Its ticket has been closed since the brief's copy of it (the recording survives the
  death of its process, 2026-11-15); the brief still asked for the repro. The first sequence paused
  with the hook and stopped, discarded and started through the screens; the second ran all of it
  through the screens. Both new recordings took a `fix batch` with `kept` 1 at once, about every
  8 s, with Expo's `TaskService` finishing each delivery in logcat.
- **T-89.** `heading sample {"updates":4910,"spreadDeg":51.4,"accuracy":3,"movedM":403}` five
  minutes after the start; `on: false` when the app switcher came in front and at the pause, `on:
  true` back in front; one `puck mounted` and no unmount in the process.

## What the figures say

The new run is the fastest of the four on every wall figure, and against the re-run, the same
model cold on the same brief, it takes about a third of the time without waits (9.8 min against
26.6), half the turns and under half the screen reads. Most of that is not the hooks:

- **No build.** The preflight proved the installed build: `build-has --commit` answered `holds`
  for `1b34a63`, `69fa8a8` and HEAD, from the commit the build names in `state`. The re-run built
  for 20 minutes because T-49's change holds no string `build-has` could find; the trial skipped
  the build on a reasoning that did not hold. That is the build-identity half of
  [[T-109-device-check-trust-and-build]], which this plan built: the gain is the one build a
  change with no new string no longer needs.
- **No toolkit defect.** The re-run spent about fifteen calls on two toolkit defects, fixed before
  the trial.
- **The claims are read from the log.** T-4, T-84 and T-89 are debug-log entries: the agent read
  them with `devcheck log` (8 calls) and in Settings → Debug log (40 of its 78 screen reads:
  opening it, filtering and scrolling it, then setting its filters back). It made both selections from the lists and ran both T-95 sequences
  through the screens, as the claims are about those screens. The hooks set the stage around them:
  the trail's import, the first agent session's start and pause, the `state` reads, the stored
  preferences, the closing `cleanup`.

What the hooks did, measured: the import took 1.3 s against about 11 s for the picker, and the
tear-down about 1 s against 126 to 160 s for the UI flow (which failed in the trial) or 1.7 min by
hand. That is close to three minutes of each earlier run, and the two flows that went wrong in
them, the original's failed picker and the trial's dialog left open, did not occur. The time per
toolkit call fell to 10.1 s, from 16.4 and 21.2, with no UI flow left among the calls.

The model time between calls, 4.1 min, sits between the trial's 2.0 and the re-run's 8.7. The
agent read the source 7 times against 30, as the skill now tells it which entries to read and how.

## The skill's rules against the run's conduct

- **Preflight: kept.** `build-has --commit` on the two commits and HEAD, `native-errors` before and
  after.
- **The lock: kept.** Taken first, released after `cleanup` and `walk stop` had left the phone on
  the map and on real GPS.
- **Raw input: one departure.** The Home key once, to close the app switcher after the kill; the
  agent named it in its report. The rest was the app switcher and the card swipe the skill allows.
- **Waiting.** It waited for the `heading sample` by polling a background task in the foreground,
  as the trial waited for its walk, where the harness asks to end the turn and be told. Its
  sleeps were the claims' own: 20 s, 45 s and 50 s for fixes to come in after a start, 8 s with
  the app switcher in front.

## App observations

| Observation | Ruling |
|---|---|
| `route derived` twice for one selection: an activity saved, shown, cleared, selected again from the list | Evidence for an existing ticket: [[T-107-reselection-derives-route-twice]], the same sequence |
| `map app active` at each tap on Start recording, without leaving the app | Not traced; not filed |
| One fix per delivery, about 8 s apart, under a walk sending one a second | None: the request's interval, as every earlier mock walk showed |

# The check's owed claims — 2026-11-16

**What.** The claims the check-hooks final check left owed, run the same morning before the
re-run, on a clean release build of `f864514` and a scratch build for the held reply. All six
were verified: an agent session read back from storage after an `am crash` (pid 8013, then 10144
headless, `launch action continue`), the two delete toasts' text in frame strips (`Trail deleted`,
`Activity deleted`), the card's downloading state in a frame strip (`⬇ 79%` to `86%`), both
endpoint dots over the arrows along a back-and-forth line, Verification 21's description divider,
and the held reply (5 s printed in 5.11 s; 9 s gives `result=2` at the receiver's 8 s deadline, no
ANR, the pid unchanged). The `device-checks.md` entry for the plan is gone with them; the
fragments that belong to other entries (T-94, T-104, draped-route-overlay/01) moved there.
Evidence: `.scratch/device-checks/2026-11-16/`, numbers 24 to 39.

| Observation | Ruling |
|---|---|
| The reader fails every read while a toast is up (`mSealed`), confirm taps settling in 4.1 to 4.6 s | Toolkit, folded into [[T-112-reader-stale-after-install-or-replug]]: the same read path |
| The offline map chooser leaves an open trail card collapsed with its pip reading `Show less`; the first tap does nothing visible | Filed: [[T-121-card-pip-says-open-on-a-collapsed-card]] |
| Outdoors estimated `~13 MB` for a 6 km line, 49 MB downloaded | Evidence for [[T-120-download-estimate-ten-times-short]] |
| A short trail's selection fit leaves it low on the map, the 120 m trail's start beside the record button | Not filed: one observation, not traced to the fit's padding; a look, the owner's call |
| The flat profile's line crossing its y-axis label | None: the owner ruled the labels may be hidden |
| `native-errors` dating a process 2.5 to 4 min before its `runtime started` | None: `ps` gives the fork time, as the 2026-11-15 trial found |
