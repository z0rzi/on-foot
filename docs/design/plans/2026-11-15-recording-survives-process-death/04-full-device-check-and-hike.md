---
status: open
blocked_by: ["[[01-task-manager-keeps-one-host]]", "[[03-relaunch-continues-the-track]]"]
closes: ["[[T-95-new-recording-takes-no-fixes]]"]
---
# 04: The full device check, and the owner's hike

**What to build:** the integrated build shows on the device that a recording survives the death of
its process, every way it can die, with no stall, no leak and no regression of a plain recording.
Spec "Device check".

- [ ] The spec's eight device-check steps on a release build of the integration branch, each
      with the line that shows it passed and what it would have shown broken.
- [ ] The constraint on data-transforming migrations, written where the migrations are
      documented.
- [ ] The owner's hike listed in `docs/tickets/device-checks.md`, with the log lines to read
      after it.
- [ ] The spec's status reads "Built".
- [ ] `npm run verify` green.
