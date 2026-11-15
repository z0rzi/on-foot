import { defineBackgroundFixHandler, LocationFix } from '../location'
import { activitiesRepository } from '../data/activities'
import { errorClass, logEvent } from '../log'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'
import { gateFixes } from './fixGate'
import { fixBatchSummary } from './fixBatchSummary'
import { deliveryWaiting } from './deliveryWaiting'
import { deliveryQueue } from './deliveryQueue'

// Lives only in memory and belongs to one segment: a runtime born after a process death starts with
// none, and a relaunch that cuts opens a segment no earlier candidate may vote on. A relaunch that
// continues onto a warm runtime keeps it.
let heldCandidate: { sessionId: number; segment: number; fix: LocationFix } | null = null

// Arrival times of the deliveries that have not settled, oldest first: the queue settles them in
// the order they arrived.
const pendingSince: number[] = []
let waitingLoggedAt: number | null = null

async function recordDelivery(fixes: LocationFix[]): Promise<void> {
  // Once the gate has run, a batch that could not be stored is logged with its counts: `kept` is the
  // size of the hole in the track.
  let summary: Record<string, unknown> = { arrived: fixes.length }
  try {
    const session = await activitiesRepository.getActiveSession()
    // A paused session still being delivered to is the interesting case: the stop that pause asked
    // for did not take. No session at all means the stream outlived every recording.
    if (!session || session.pausedAt != null) {
      logEvent(
        session ? 'info' : 'warn',
        'capture',
        session ? 'fixes ignored, session paused' : 'fixes ignored, no session',
        { arrived: fixes.length },
      )
      return
    }
    const segment = session.currentSegment
    const segmentFixes = fixesInSegment(fixes, session.segmentStartedAt)
    const anchor = await activitiesRepository.getLastSegmentPoint(session.id, segment)
    const candidate =
      heldCandidate && heldCandidate.sessionId === session.id && heldCandidate.segment === segment
        ? heldCandidate.fix
        : null
    const gate = gateFixes(segmentFixes, anchor, candidate)
    summary = fixBatchSummary(fixes, segmentFixes, gate, anchor)
    if (gate.kept.length > 0) {
      await activitiesRepository.appendPoints(session.id, segment, gate.kept)
      // Invariant: the handler never sets the store's `session`. An empty one is how
      // `resumeIfActive` knows this runtime has not shown the recording yet, even a warm headless one.
      useRecordingStore.getState().appendLivePoints(segment, gate.kept)
    }
    heldCandidate = gate.candidate && { sessionId: session.id, segment, fix: gate.candidate }
    logEvent('info', 'capture', 'fix batch', summary)
  } catch (error) {
    logEvent('warn', 'capture', 'fix batch not stored', { ...summary, errorClass: errorClass(error) })
  }
}

defineBackgroundFixHandler(
  (fixes) => {
    const arrivedAt = Date.now()
    const waiting = deliveryWaiting(pendingSince, arrivedAt, waitingLoggedAt)
    if (waiting) {
      waitingLoggedAt = arrivedAt
      logEvent('warn', 'capture', 'delivery waiting', waiting)
    }
    pendingSince.push(arrivedAt)
    return deliveryQueue(() => recordDelivery(fixes)).finally(() => pendingSince.shift())
  },
  (fault, error) => logEvent('warn', 'capture', 'delivery fault', { fault, error }),
)
