# A recording survives the death of its process

Spec: [[2026-11-14-recording-survives-process-death-design]]. A recording goes on while its process
is dead and after it is reopened: `expo-task-manager` keeps one warm host while a task is
registered, the task is defined first in every runtime, and a relaunch continues the track when
nothing is missing. Four items: the patch and the entry can be built side by side, the relaunch
rule needs the entry to be checked on the device, and the full device check closes the effort.

| # | Item | Delivers |
| --- | --- | --- |
| 01 | `expo-task-manager` keeps one host while a task is registered | The three `TaskService` hunks with their markers; reopening after a headless start no longer stalls, and a later recording in the same process records |
| 02 | The task is defined first in every runtime | The root entry and bootstrap, the error handler and `runtime started` in every runtime, the age on `cold start`, the structural test; fixes are stored while the app is dead |
| 03 | A relaunch continues the track when nothing is missing | `continue` and the cut after the last point in `resumeActionFor`, the relaunch and the deliveries on one queue |
| 04 | The full device check, and the owner's hike | The spec's eight device-check steps on the integrated build, the remaining docs, the hike handed to the owner |

01 and 02 have no blocker and can be built at the same time.

## What the build needs beyond the spec

- **The integration branch is `recording-survives-process-death`.** Items join it on worker
  branches `recording-survives-process-death-NN`; it lands on `master` squashed, once 04 is done.
  Its intermediate states are not shippable: 02 without 01 starts a host per delivery while the
  app is dead, which leaks a thread and about 3.3 MB each time.
- **The spike is a reference, not a base.** Branch `spike/t95-runtime` (local, never merged) holds
  the 2026-11-15 builds: `3d0c1a6` carries hunks 1 and 3 as they ran on the phone, and `21c04db` an
  instrumentation script for `TaskService` and the headless loader. Write the code from the spec;
  hunk 2 is new. The evidence is in `.scratch/device-checks/2026-11-15-t95-runtime/`.
- **Native work never edits the shared `node_modules`.** In a worktree, `node_modules` is a
  symlink to the main checkout's, which other workers build from. A worker on 01 replaces the
  symlink with its own install (`npm ci`), changes the patch file, and lets `patch-package` apply
  it.
- **Every device step goes through the `device-check` skill,** briefed with a check plan
  (`.claude/skills/device-check/BRIEF.md`). A change to native code needs a release build, which
  the agent makes itself. The thread name shows truncated in `ps -T`: count `ncFunctionQueue`, not
  `expo.modules.AsyncFunctionQueue`.
- **Claims a device could not confirm** go to `docs/tickets/device-checks.md`, the owner's field
  hike among them.
