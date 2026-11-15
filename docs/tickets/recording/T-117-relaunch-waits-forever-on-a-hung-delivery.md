---
severity: should-fix
category: bug
size: S
triage: ready-for-agent
origin: agent
filed: 2026-11-15
from: "[[2026-11-14-recording-survives-process-death-design]]"
blocked_by: []
---
# T-117: a relaunch waits without end behind a delivery that never settles

`resumeAfterProcessDeath` (`src/recording/recordingController.ts:240`) reads the track and hydrates
the store as one turn of `deliveryQueue` (`src/recording/deliveryQueue.ts`), so that no delivery is
stored unseen in between. It runs inside the controller's `exclusive` queue, from `resumeIfActive`,
whose `finally` calls `markResumeSettled`. If a delivery turn never settles, the relaunch never gets
its turn: `resumeSettled` stays false, `RecordButton` renders nothing (`src/map/RecordButton.tsx:113`),
and every later controller operation waits behind it. The only way out is killing the app.

The spec's failure mode "A delivery that hangs" covers the delivery (`delivery waiting` in the log),
not this consequence on the screen. No hung delivery was seen in the 2026-11-15 device checks. A hung
delivery stalls every later one too, so the recording is lost either way; bounding the wait gives the
owner back a screen from which to stop and save it.

## Agent Brief

> *Comment written by an AI agent.*

Arbitrage utilisateur 15/11 → `ready-for-agent`. Borner l'attente : passé le délai, le relancement lit
le tracé hors file, affiche l'enregistrement et logge une erreur ; l'owner peut l'arrêter et le
sauver. Pas de toast.

**Category:** bug
**Summary:** The relaunch's wait on the delivery queue is bounded; past it, the recording is shown
anyway and the wait is logged.

**Desired behavior:**
- The relaunch waits for its turn of the delivery queue for at most one named constant (about 5 s;
  the relaunch runs in a foreground runtime, where timers run).
- Past it, it reads the track and hydrates the store outside the queue, logs an `error` entry in area
  `launch` naming the timeout (no coordinates), and the launch settles: the record button is back and
  Stop and save work.
- The normal path is unchanged: within the bound, read and hydrate stay one turn of the queue
  (`src/recording/__tests__/relaunchDuringDelivery.test.ts` keeps passing).

**Acceptance criteria:**
- [ ] Test-first: a delivery turn that never settles, then `resumeIfActive`; with fake timers past the
      bound, `resumeSettled` is true, the store holds the session and its stored points, and the log
      entry is written. Fails today.
- [ ] `docs/architecture/debug-log.md` lists the new entry; the spec's "A delivery that hangs" failure
      mode names the visible outcome.
- [ ] `npm run verify` green.
