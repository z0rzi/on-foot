---
status: open
blocked_by: ["[[02-task-defined-first-in-every-runtime]]"]
closes: []
---
# 03: A relaunch continues the track when nothing is missing

**What to build:** reopening the app after a short process death goes on in the same segment with
no interruption toast; after a real gap of more than 30 s it opens a new segment that keeps the
fixes delivered late, and says so. The pill counts every stored fix. Spec §3.

- [ ] Test-first, `resumeActionFor` takes the session, its last stored point and `now`, and
      returns `continue` when the reference (the later of the last point and `segmentStartedAt`)
      is 30 s old or less; the threshold is one named constant.
- [ ] A cut opens a segment that starts just after the reference, and announces the interruption
      from the reference to now.
- [ ] Both branches restart capture.
- [ ] The delivery queue has its own module; the relaunch's read-and-hydrate runs as one turn of
      it. A Jest test interleaves a delivery between the read and the hydrate and fails without
      the shared queue.
- [ ] Docs: `debug-log.md` (the `continue` action), `GLOSSARY.md` **Segment**, and the comments
      above `resumeAfterProcessDeath`, `resumeIfActive` and `heldCandidate`.
- [ ] Device check on a release build with 02:
  - [ ] after `am crash` and 60 s dead, the reopen logs `launch action continue` and shows no
        toast;
  - [ ] after `am crash` with the walk stopped for more than 30 s, the reopen logs
        `launch action resume`, shows the toast from the last point, and the late batches log
        `droppedBeforeSegment` 0.
- [ ] `npm run verify` green.
