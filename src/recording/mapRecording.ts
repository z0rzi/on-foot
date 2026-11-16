import { activitiesRepository } from '../data/activities'
import type { RecordingSession, TrackPoint } from '../data/activities/types'
import { buildNewActivityInput, groupPointsBySegment, type ActivityFormFields } from '../data/activities/mapping'
import { useMapStore } from '../store/mapStore'
import { currentAlongTrailId } from './currentAlongTrail'
import { finishRecording, linkTrailForSave, startRecording, type CaptureGate } from './recordingController'

// The recording's steps as they meet the map: what a start does to the map's view, which trail a
// stop links, and what a save shows.

// A recording started over an activity view replaces it; a shown trail stays, as the followed trail.
export async function startFromMap<Refusal extends string>(
  gate: CaptureGate<Refusal>,
): Promise<'started' | 'already-active' | Refusal> {
  const result = await startRecording(gate)
  if (result === 'started') useMapStore.getState().endActivityView()
  return result
}

// The activity is linked to the trail the recording followed, the one shown when it stops.
export function stopForSave(): Promise<void> {
  return linkTrailForSave(currentAlongTrailId())
}

export interface LoadedRecording {
  session: RecordingSession
  segments: TrackPoint[][]
}

// The recording as a save builds it: the session and its points, one list a segment. None once the
// recording has ended.
export async function loadRecording(): Promise<LoadedRecording | null> {
  const session = await activitiesRepository.getActiveSession()
  if (!session) return null
  return { session, segments: groupPointsBySegment(await activitiesRepository.getSessionPoints(session.id)) }
}

// Saves the recording as an activity, ends it, and shows the new activity on the map; answers its id.
export async function saveRecording({ session, segments }: LoadedRecording, fields: ActivityFormFields): Promise<number> {
  const activityId = await finishRecording(session.id, buildNewActivityInput(session, segments, fields))
  useMapStore.getState().select('activity', activityId)
  return activityId
}
