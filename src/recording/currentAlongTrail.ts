import { useMapStore } from '../store/mapStore'
import { alongTrailId } from './alongTrail'
import { currentRecordingPhase } from './recordingStore'

export function currentAlongTrailId(): number | null {
  return alongTrailId(currentRecordingPhase(), useMapStore.getState().selection)
}
