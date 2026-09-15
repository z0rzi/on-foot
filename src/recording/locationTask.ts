import { defineBackgroundFixHandler } from '../location'
import { activitiesRepository } from '../data/activities'
import { useRecordingStore } from './recordingStore'

defineBackgroundFixHandler(async (fixes) => {
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.pausedAt != null) return
  await activitiesRepository.appendPoints(session.id, session.currentSegment, fixes)
  useRecordingStore.getState().appendLivePoints(session.currentSegment, fixes)
})
