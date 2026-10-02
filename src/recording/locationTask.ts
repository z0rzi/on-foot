import { defineBackgroundFixHandler } from '../location'
import { activitiesRepository } from '../data/activities'
import { logEvent } from '../log'
import { fixBatchSummary } from '../log/fixBatchSummary'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'

defineBackgroundFixHandler(async (fixes) => {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) {
    logEvent('info', 'capture', 'fixes ignored, no running session', { arrived: fixes.length })
    return
  }
  const segmentFixes = fixesInSegment(fixes, session.segmentStartedAt)
  // The previous stored point is what makes an implausible jump visible, and it is the only thing
  // read from it: a distance, never a position.
  const livePoints = useRecordingStore.getState().livePoints
  const previous = livePoints.length ? livePoints[livePoints.length - 1] : null
  logEvent('info', 'capture', 'fix batch', fixBatchSummary(fixes, segmentFixes, previous))
  if (segmentFixes.length === 0) return
  await activitiesRepository.appendPoints(session.id, session.currentSegment, segmentFixes)
  useRecordingStore.getState().appendLivePoints(session.currentSegment, segmentFixes)
})
