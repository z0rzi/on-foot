---
status: open
blocked_by: []
closes: []
---
# 01: `expo-task-manager` keeps one host while a task is registered

**What to build:** a recording that was running when its process died goes on recording after the
app is reopened, and so does every later recording in that process. The JS-facing task manager is
never dropped while the host that holds it is alive. Spec §2 and "Causes" 2.

- [ ] The three hunks of §2 in `patches/expo-task-manager+57.0.12.patch`: no invalidate while a
      task is registered; `invalidateAppRecord` leaves the tables alone; `setTaskManager(null)`
      clears both.
- [ ] Each hunk logs its own `[onfoot-patch]` marker text every time it acts. The dex grep in
      `native-patches.md` tells each one from the `expo-location` patch's marker.
- [ ] `native-patches.md`: the hunks, their markers, and what breaks if they are dropped.
- [ ] Device check on a release build of this item (the master entry, no bootstrap):
  - [ ] the three markers are in the dex;
  - [ ] `am crash` mid-recording, reopen: a `Finished task` after every job for at least two
        minutes, twice (broken: `taskManager=null` and jobs that never finish);
  - [ ] pause just after a delivery and resume, then stop, save and start a second recording in
        the same process: it records (broken: it stalls).
- [ ] `npm run verify` green.
