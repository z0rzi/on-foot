import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { activitiesRepository } from '../data/activities'
import { useRecordingStore } from './recordingStore'
import { toTrackPoint } from './track'

export const RECORDING_TASK = 'onfoot-location-recording'

TaskManager.defineTask(RECORDING_TASK, async ({ data, error }) => {
  if (error || !data) return
  const { locations } = data as { locations: Location.LocationObject[] }
  if (!locations?.length) return
  const session = await activitiesRepository.getActiveSession()
  if (!session || session.endedAt != null) return
  const points = locations.map(toTrackPoint)
  await activitiesRepository.appendPoints(session.id, points)
  useRecordingStore.getState().appendLivePoints(points)
})
