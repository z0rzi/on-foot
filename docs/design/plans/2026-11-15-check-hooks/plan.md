# Check hooks

Spec: [[2026-11-15-check-hooks-design]]; decision [[0004-check-hooks]]. A device check sets up,
tears down and reads the app through check hooks sent with `am broadcast`, answered in the
broadcast's result, instead of driving its screens. Eleven items: two prefactors of the toolkit
and the build, the first hook end to end, two prefactors of the app's rules into cores, the hooks
in three groups, the snapshot, the skill, then the one device check, with the measurement owed.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | Toolkit commands come from one registry | Each command declared once; no change of behaviour |
| 02 | The build names itself | Commit, change hash and native fingerprint in the app and its launch line; the toolkit's verdict |
| 03 | The first hook, `state`, end to end | The receiver, the dispatcher with readiness and guards, the `hooks` area, the toolkit's broadcast |
| 04 | Selection and recording rules move into cores | Show activity, show trail, start from the map, stop for save, save; screens unchanged |
| 05 | Import and delete move into cores | Import and the trail and activity deletes out of their screens; screens unchanged |
| 06 | Read and select hooks | `list`, `select`, `clear-selection` |
| 07 | Import, delete and cleanup on hooks | The write hooks, the UI flows deleted, `tap`'s delete-dialog guard |
| 08 | Recording hooks on agent sessions | `record …`, agent sessions, `save-activity` deleted |
| 09 | Snapshot | The database and preferences on the computer |
| 10 | The skill drives with hooks | The skill and its brief rewritten around hooks |
| 11 | The final device check, and the gain measured | The device criteria only the phone answers, on one build; the held-reply build and the gain owed |

01, 02, 04 and 05 can start at once.

## What the build needs beyond the spec

- **The phone is touched once, by 11.** No other item builds for the phone, installs or checks:
  each puts its device criteria in 11, which runs them on one build of the integration branch.
  The phone may be shared with another agent's check: 11 waits for it, runs the integration
  worktree's own launcher, and leaves the phone as the skill's clean-up says. Claims it could not
  confirm go to `docs/tickets/device-checks.md`.
- **A build with the flag replaces the owner's daily app**, as every agent build does; no item
  installs a build without the flag. The unflagged case is checked on the bundle and with
  `dumpsys`, as the spec says.
- **Each item updates the skill lines it makes wrong**, in the same change; 10 rewrites the
  driving guidance as a whole. The skill is written for an agent: follow `writing-for-agents`.
- **The challenge's findings are the spec's decisions**, not suggestions: a top-level import of
  hook code, a manifest receiver, identity computed inside the app's config, or a hook that
  prompts would each undo one.
- **No test spawns adb, the app or a fake phone.** New decisions are pure functions; the
  dispatcher is the one new seam.
