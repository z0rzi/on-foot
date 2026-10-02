import { defineBackgroundFixHandler } from '../location'
import { activitiesRepository } from '../data/activities'
import { useRecordingStore } from './recordingStore'
import { fixesInSegment } from './session'

defineBackgroundFixHandler(async (fixes) => {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) return
  const segmentFixes = fixesInSegment(fixes, session.segmentStartedAt)
  if (segmentFixes.length === 0) return
  await activitiesRepository.appendPoints(session.id, session.currentSegment, segmentFixes)
  useRecordingStore.getState().appendLivePoints(session.currentSegment, segmentFixes)
})
