# App-log capture

Spec: [[2026-11-15-app-log-capture-design]]. The debug log's mirror in logcat is recorded on the
host for the whole of a check, so `devcheck log` and the agent read every entry from a file. One
item: the mirror and the logcat-reading `log` are already on the branch (`6c9b5d0`); this item
moves `log` onto the recorder's capture.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | The recorder keeps the capture | Start on demand, resume after a drop, stop and copy in `cleanup`, `log` from the capture, the skill and the debug-log doc |

## What the build needs beyond the spec

- **The phone is taken by another agent's check.** The build touches no phone: no `devcheck`
  command, no `adb`. The spec's device checks go to `docs/tickets/device-checks.md`, to run once
  the phone is free.
- **The worktree is outside `.claude/worktrees/`**, so `npm run verify` runs from its root as on
  the main checkout. `node_modules` is a symlink to the main checkout's: confirm the new test files
  appear in the run.
- **Each change updates the skill lines it makes wrong**, in the same change; follow
  `writing-for-agents` for the skill.
