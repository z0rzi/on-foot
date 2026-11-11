import { defineBackgroundFixHandler, LocationFix } from '../location'
import { activitiesRepository } from '../data/activities'
import { createSerialQueue } from '../async/serialQueue'
import { logEvent } from '../log'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'
import { gateFixes } from './fixGate'
import { fixBatchSummary } from './fixBatchSummary'
import { deliveryWaiting } from './deliveryWaiting'

// The task manager awaits each delivery but does not queue them; the gate reads the segment's last
// point and appends after it, so two deliveries must never interleave.
const serial = createSerialQueue()

// Lives only in memory: after a process death the relaunch opens a new segment, which no candidate
// may vote on.
let heldCandidate: { sessionId: number; segment: number; fix: LocationFix } | null = null

// Arrival times of the deliveries that have not settled, oldest first: the queue settles them in
// the order they arrived.
const pendingSince: number[] = []
let waitingLoggedAt: number | null = null

async function recordDelivery(fixes: LocationFix[]): Promise<void> {
  const session = await activitiesRepository.getActiveSession()
  // A paused session still being delivered to is the interesting case: the stop that pause asked for
  // did not take. No session at all means the stream outlived every recording.
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
  heldCandidate = gate.candidate && { sessionId: session.id, segment, fix: gate.candidate }
  logEvent('info', 'capture', 'fix batch', fixBatchSummary(fixes, segmentFixes, gate, anchor))
  if (gate.kept.length === 0) return
  await activitiesRepository.appendPoints(session.id, segment, gate.kept)
  useRecordingStore.getState().appendLivePoints(segment, gate.kept)
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
    return serial(() => recordDelivery(fixes)).finally(() => pendingSince.shift())
  },
  (fault, error) => logEvent('warn', 'capture', 'delivery fault', { fault, error }),
)
