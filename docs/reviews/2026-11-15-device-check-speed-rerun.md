# Device-check speed: one check run again — 2026-11-15

**What.** [[2026-11-14-device-check-speed]], item 06. The field-diagnostics device check of
2026-11-11 (the field-diagnostics owed checks, the T-95 repro and T-49) was run again by a fresh
agent on 2026-11-14, with the rewritten `device-check` skill and the toolkit of the
`device-check-speed` branch. The two runs are set side by side below, with how each figure was
counted.

**Sources.**
- Original: inline in the main session
  `~/.claude/projects/-home-zorzi-nix-envs-android-studio-on-foot-rn/d91681da-3de8-4bdf-ab7d-0d727ab6acca.jsonl`.
  The skill was invoked at 17:00:38Z, the phone was plugged in at 17:01:14Z, and the report came at
  17:44:23Z. Toolkit of 2026-11-10 (`uiautomator dump`, no `labels`, `--until` or `do`).
- Re-run: subagent `…/05a2575a-e2ee-4305-8a67-92a51fd3906f/subagents/agent-af9ce25a3a89b6e37.jsonl`,
  22:02:52Z to 23:01:20Z. Its brief, near verbatim the original's, gave the tickets as they stood
  before the original check, so the run was blind to its results.

## Figures

| | Original (2026-11-11) | Re-run (2026-11-14) |
|---|---|---|
| Wall, whole window | 43.2 min | 58.5 min |
| Wall, minus the release build | 23.6 min | 38.4 min |
| Wall, minus the build and the background walks | 18.3 min | 26.6 min |
| Model turns | 48 | 112 |
| Tool calls | 47 | 110 |
| … on the phone (toolkit or adb) | 34 | 67 |
| … reading code, docs and logs | 9 | 30 |
| Image reads | 4 | 7 |
| `shot` | 36 | 11 |
| Written sleeps | 74, in 25 calls, 125 s as written | 17, in 13 calls, 490 s as written |
| Raw `input` | 26 (12 scroll swipes, 11 back keys) | 5 (the app switcher, a kill) |
| `tap --until` / `do` | 0 / 0 | 54 / 21 |
| Time per toolkit call | 27.2 s (31 calls, 14.0 min) | 16.4 s (64 calls, 17.5 min) |
| Model time between calls | 3.4 min | 8.7 min |

**How they were counted.** A script read each JSONL over the window named above.
- **Turns**: distinct assistant `message.id`.
- **Image reads**: `Read` calls on a `.png` or `.jpg`.
- **Written sleeps**: every `sleep N` in a Bash command, counted as written, so a `sleep` inside a
  loop counts once. The seconds are the sum of the N's.
- **Wall time**: the window minus the idle stretches where the agent had ended its turn and
  waited for a background task to report:
  - the build, 17:02:14–17:21:47 in the original and 22:06:02–22:26:06 in the re-run;
  - the walks, 17:29:03–17:34:23 in the original, and 22:29:27–22:36:35, 22:44:02–22:47:35 and
    22:56:29–22:57:42 in the re-run.
- **Time per toolkit call**: from each tool call to its result, over the calls that run the
  toolkit. It includes the sleeps and the foreground walks inside them.

**Builds.** Both runs built a release in the background, for about 20 minutes. The original built
an unmerged branch. The re-run built master `c7f942b`: T-49's change has no string `build-has` can
find, and the skill's preflight builds when it cannot prove the installed bundle holds the change.

## Verdicts

The re-run reached every verdict of the original.

| Claim | Original | Re-run |
|---|---|---|
| T-4: selecting a trail, then an activity, writes `route loaded` and `route derived` with `kind`, `points`, `ms` | verified | verified |
| T-84: a cold start writes one `launch camera`; a selection writes `fit requested` (`by: select`) then `fit fired` | verified | verified |
| T-89: `heading watch` on at start, off at pause and on leaving the app; a `heading sample` after five minutes; one `puck mounted`; the puck drawn with its arrow | verified (arrow turning: owner) | verified (arrow turning: owner) |
| T-49: a preference changed survives a kill and relaunch | verified (smoothing 200 m) | verified (smoothing 100 m and speed mode) |
| T-95: pause, stop, discard, then start in one process | not reproduced | not reproduced, also after an `adb install -r` mid-recording |
| `delivery fault`, `delivery waiting` | not seen, not provoked | not seen, not provoked |

## What the figures say

The re-run spent more turns and more wall time than the original, so this check gives no speed-up
of the whole run. What the re-run did differently, in order of weight:

- **It did more.** It ran a second T-95 variant (a reinstall mid-recording, then the same
  sequence) and two kills and relaunches. It also spent about fifteen calls on two toolkit defects
  (below), which it found and worked around.
- **It started cold.** The original ran inside the session that had built field diagnostics, with
  the code in its context, so it read code 9 times. The re-run read the spec, the debug-log doc and
  the source 30 times, and its model time between calls is 8.7 min against 3.4.
- **It waited on the clock.** Its 17 written sleeps are waits the claims themselves set: the five
  minutes before a `heading sample`, the gap of the T-95 sequence, the app kept in the background,
  distance growing on the pill. They come to 490 s as written, against 125 s of sleeps the
  original spent mostly after taps.

The mechanics the plan changed did show up. A toolkit call cost 16 s against 27 s. The run took 11
screenshots against 36 and used raw input 5 times against 26. It named an outcome 54 times and
batched steps 21 times, where the original slept after each tap. There was one fall-back to
`tap; sleep; shot` (below). Image reads went from 4 to 7: the re-run read the puck and the trail
fit as pixels, and the original read its labels from `shot` too.

## The skill's wording

- **The one fall-back.** A selection made with `--until`, then `sleep 3; shot`, to let the
  camera's fit end before the screenshot. The skill said nothing about an ease no label shows. It
  now says to take a `frames` strip across the ease and read its last frame, the ease being over
  when the last frames agree.
- **Clean up** said `devcheck back` from the list. `cleanup` opens the activity list, then the
  trail list, by deep link. The lists stack, so one back lands on the other list, and the
  phone had been left on the owner's Activities list by an earlier check. `cleanup` now presses
  back down to the map itself before it stops the reader, and the step says so.
- **Scrolling** was raw input before the re-run. On the owner's decision it became
  `scroll up|down`, a command and a `do` step.

## Toolkit defects the re-run found

- **`scroll up` did not move the debug log while recording.** `scroll` dragged a fixed band of the
  screen, from 35 % to 70 % of its height. While recording, the debug log carries a banner, and
  its list (`ScrollView`, `scrollable="true"`) starts at y 876. The upward drag started at y 840,
  above the list, so nothing scrolled. The downward drag started inside it. With no banner the
  list starts higher, which is why `scroll up` had passed its first device check.
  Fix: the drag is taken inside the largest scrollable element of the read, at 70 % and 35 % of
  its own height (`scrollPlan.ts`, from a fixture of the debug log while recording). A screen
  where nothing scrolls fails the command and ends the delete flow's scan.
  Device: while recording, three `scroll down` then four `scroll up` in one `do`; up brought the
  rows back to the top.
- **A log row's detail went missing from the labels line.** It was the toolkit's: the server had
  read the row (`text='{"on":false}'` in `128-log-bg.xml`). The labels line kept each text once
  across the whole screen, so a detail repeated by a later row (`{"on":false}` under two
  `heading watch` rows) was dropped. The agent's own `grep` for `text="…"` missed the single-quoted
  value and read it as empty.
  Fix: a text is folded only into a node that contains it or that it contains (a control and its
  own text), and listed again for a node elsewhere (`uiDump.ts`).
  Device: the debug log's repeated details now appear on every row.

## App observations

| Observation | Ruling |
|---|---|
| `route derived` twice for one selection | Real: selecting a trail or activity again derives its route twice. [[T-107-reselection-derives-route-twice]] |
| The system permission screen in front for about 2 s after the relaunch | Real, effect unknown: the app asks again for grants it holds. [[T-108-permission-screen-in-front-when-granted]] |
| `heading sample` of 627 updates and 11.3° over five minutes, the phone still | Evidence for an existing ticket, not a new one: a dated comment on [[T-89-puck-heading-freezes]] |
| `uid … lost permission to set exact alarms!` at the install | None: the app declares no exact-alarm permission, the system writes it on a package replace |
| The trail's fit leaves the route about half the screen wide | Not judged: a look, the owner's call |
| Pace shows `—` under 200 m | None: by design (`currentPace`) |

## Decisions taken with the owner asleep

- The check chosen for the re-run, and its brief: the original task verbatim, and the
  tickets as they stood before the original check, so the re-run could not read its answers.
- The two toolkit defects were fixed in the toolkit; neither is the server's or the app's.
- `cleanup` returning to the map was fixed in the toolkit rather than in the skill's wording.
- T-107 and T-108 were filed, T-89 got a comment, and no ticket was filed for the alarm line, the
  fit or the pace.
- A tooling question left open: the permission screen T-108 describes puts another app in front,
  so a `wait-for` or a `tap --until` fails on it, where a picker the check opened passes. Whether
  the toolkit should wait through it, without ever tapping it, is the owner's call.

# The model of the check on trial — 2026-11-15

**What.** [[2026-11-14-device-check-speed]], item 07. The same check, dispatched once more with the
re-run's brief, word for word, to a fresh agent on Sonnet (the Agent tool's `model` override). It
ran the skill and toolkit of the 06 worktree at `b40cca4`.

**Source.** Subagent `…/05a2575a-e2ee-4305-8a67-92a51fd3906f/subagents/agent-af342e25c7d99ad5e.jsonl`,
2026-11-14 23:15:29Z to 23:32:18Z. Evidence: the 06 worktree's `.scratch/device-checks/2026-11-15/`,
shots 01–04.

**The confound.** The trial ran on the skill and toolkit after 06's fixes, the re-run before them:
`scroll` dragging inside the list, the labels line keeping a repeated detail, `cleanup` pressing
back to the map, and the skill's line on a camera ease. Those two defects had cost the re-run about
fifteen calls. The trial also needed no build: the installed APK was the re-run's own build of
`c7f942b`, reinstalled at 23:50 local by the re-run's T-95 variant.

## Figures

Counted as above, with the same script, over the window named.

| | Original | Re-run | Trial |
|---|---|---|---|
| Wall, whole window | 43.2 min | 58.5 min | 16.8 min |
| Wall, minus the release build | 23.6 min | 38.4 min | 16.8 min (no build) |
| Wall, minus the build and the background walks | 18.3 min | 26.6 min | 11.2 min |
| Model turns | 48 | 112 | 40 |
| Tool calls | 47 | 110 | 41 |
| … on the phone (toolkit or adb) | 34 | 67 | 26 |
| … reading code, docs and logs | 9 | 30 | 9 |
| Image reads | 4 | 7 | 3 |
| `shot` | 36 | 11 | 2, and 2 more as `do` steps |
| Written sleeps | 74, in 25 calls, 125 s | 17, in 13 calls, 490 s | 15, in 8 calls, 68 s |
| Raw `input` | 26 | 5 | 7 (the app switcher twice, two card swipes, the Home key three times) |
| `tap --until` / `do` | 0 / 0 | 54 / 21 | 25 / 14 |
| Time per toolkit call | 27.2 s | 16.4 s | 21.2 s (26 calls, 9.2 min) |
| Model time between calls | 3.4 min | 8.7 min | 2.0 min |

- **The walk excluded** is 23:17:47–23:23:25: the agent backgrounded a 342 s walk, then waited
  for it by polling the task's output file in two foreground calls (5.6 min) instead of ending its
  turn. The model time is the wall time minus the time inside tool calls, both without that wait.
- **The sleeps**: two lock waits (25 s), two output polls (10 s), ten around the app switcher, the
  Home key and a relaunch (30 s), one after a selection (3 s).
- **The toolkit calls** hold two shell loops of `scroll down`, 40 and 22 commands (112 s and 60 s),
  and a 126 s `cleanup` that failed (below).

The trial took less than half the re-run's wall time and a third of its turns. Most of that does
not come from the model: no build, no toolkit defect to work around, one T-95 sequence where the
re-run ran two, and less checked (below). Its model time between calls, 2.0 min against 8.7, is the
figure the model moves: it read the code 9 times against 30.

## Verdicts

| Claim | Original | Re-run | Trial |
|---|---|---|---|
| T-4: selecting a trail, then an activity, writes `route loaded` and `route derived` with `kind`, `points`, `ms` | verified | verified | verified |
| T-84: a cold start writes one `launch camera`; a selection writes `fit requested` (`by: select`) then `fit fired` | verified | verified | verified |
| T-89: `heading watch` on, off at pause and on leaving; a `heading sample` after five minutes; one `puck mounted`; the puck drawn with its arrow | verified (arrow turning: owner) | verified (arrow turning: owner) | verified |
| T-49: a preference changed survives a kill and relaunch | verified (200 m) | verified (100 m and speed mode) | verified (100 m), on a build it did not prove |
| T-95: pause, stop, discard, then start in one process | not reproduced | not reproduced, two variants | not reproduced, one sequence |
| `delivery fault`, `delivery waiting` | not seen | not seen | not seen |

Every verdict matches. What lies under three of them is thinner:

- **T-4, the activity.** The trial read the activity's entries from the selection the app makes
  on saving (`fit requested {"by":"select","kind":"activity"}`, then `route loaded
  {"kind":"activity","points":42,"ms":28.8}`), not from a tap on the Activities list. It is the same
  `select` action of `mapStore`, and the original read it the same way; the re-run selected from
  the list. The agent said so in its report.
- **T-84, the activity's fit.** The claim names a trail, and the trail's `fit requested` then
  `fit fired` are quoted. The activity's `fit fired`, which the re-run quoted, the trial never read:
  its first read of the log after the save was scrolled one page down, past where that entry
  would stand.
- **T-49.** The 100 m chip shows selected after the kill (`04-prefs-after.half.png`), and the pid
  changed (27774, then 30948), so the process did die. The build is the gap, under the rules below.

## The skill's rules against the trial's conduct

Read from the transcript, against the 06 worktree's `SKILL.md`.

- **Preflight: broken.** T-49's change holds no string the agent tried with `build-has`. Step 1
  says to build when the change is missing from what `build-has` can see; the re-run built. The
  trial reasoned instead that the install (23:50:08) came after master's head commit (23:26), and
  that the kill and relaunch "confirms it". Neither follows: an install time does not name the
  commit built, and a build without the fix also keeps a preference over a plain kill and relaunch
  unless the write races the hydration. The verdict stands only because the installed APK was, by
  the re-run's record, its build of `c7f942b`, which holds `69fa8a8`.
- **Raw input: broken.** The rule allows raw `input` only for the app switcher and waking the
  screen. The trial pressed the Home key three times: after killing a card, and to leave the app
  for T-89's `heading watch {"on":false}`. The re-run left the app through the app switcher.
- **The lock: broken (the brief's rule).** The brief said to hold the lock for the whole check and
  release it once the phone is left as Clean up says. The trial chained `cleanup …; rmdir` and so
  released it at 23:31:16 with `cleanup` failed and a delete dialog open, then took it again at
  23:31:19.
- **The hand tap on DELETE: within the rules.** Step 4 says to delete by hand what `cleanup` could
  not. The dialog named `DEVCHECK diag`, and the agent read it with `labels` right before the tap,
  after re-taking the lock. The tap named no outcome and spent the 4 s cap (`not settled`); the
  trail list then had no `DEVCHECK` item, and a second `cleanup` ended `back on the map`.
- **Waiting on events: departed from.** Step 3 says to wait on a named label or a walk's return.
  The trial slept 6 and 7 s after a relaunch where `wait-for` names the screen, slept 3 s after
  the trail selection for the fit to fire, and polled the background walk's output file.
- **Reading the log: departed from.** The skill reads a long log as one `do` list of
  `scroll down`. The trial ran 40 and 22 separate `devcheck scroll down` commands in shell loops,
  about 2.8 s each, and grepped their labels lines.
- **The report.** Per-check verdicts with quotes, other observations and the phone's state are
  there, with no position and no owner trail name. Three explanations in it do not hold: the build
  "after master HEAD"; a process start from `native-errors` (00:16:19, for the process launched
  after the T-49 kill twelve minutes later) called a clock offset, where `ps` gives the fork time
  and Android may fork app processes ahead of a launch; and the failed delete put down to "the list slow to refresh" while its own labels line shows the
  dialog still in front.

### What the trial met in the toolkit

`cleanup` left the trail's delete dialog open: `could not delete: trail "DEVCHECK diag": the list
did not come back after the delete; labels seen: Delete trail | Delete "DEVCHECK diag" and its
offline map? … | CANCEL | DELETE`, then `not back on the map: back changed nothing` with the same
dialog. `confirmDelete` (`deleteFlow.ts`) taps the confirm button on the first read where the
dialog appears, without the two agreeing reads `tap` and the flow's own menu tap wait for, so a
tap during the dialog's entrance can miss the button. A `devcheck tap DELETE`, which waits for the
target to stand still, then closed it at once. Read from the code and the transcript, not
reproduced on the device.

## Can a skill name its model

Yes. The skills documentation, frontmatter reference
(<https://code.claude.com/docs/en/skills>, the `model` row): "Model to use when this skill is
active. The override applies for the rest of the current turn and isn't saved to settings. The
session model resumes when you send your next prompt. Accepts the same values as `/model`, or
`inherit` to keep the active model. A value excluded by your organization's `availableModels`
allowlist isn't used, and the session keeps its current model. In auto mode, … a model that auto
mode doesn't support also isn't used … With `context: fork`, the value sets the forked subagent's
model instead." So the frontmatter would be the one place: invoked inline, it holds for the
turn the skill is invoked in; with `context: fork`, it sets the forked subagent's model. The page
does not say how it acts when the skill is invoked inside a subagent the Agent tool dispatched.
The trial itself was dispatched with the Agent tool's `model`
override, which names a model per dispatch rather than in the skill.

## The owner's decision

Not adopted. The item's rule adopts the model only if every verdict matches, no rule is broken
and the owner agrees. Every verdict matched, but the trial broke the preflight rule (T-49 checked
on a build it never proved), the raw-input rule (the Home key) and the brief's lock rule (released
with the phone mid-cleanup). So nothing changes and no model is named in the skill. The owner was
asleep and was not asked: the rule decides this outcome without them.
