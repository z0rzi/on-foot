import { useMapStore } from '../store/mapStore'
import { useTrailsStore } from '../store/trailsStore'
import { currentRecordingPhase } from '../recording/recordingStore'
import { selectTrailWhileRecording } from '../recording/alongTrail'
import { currentAlongTrailId } from '../recording/currentAlongTrail'

export type ShowTrailOutcome =
  // Shown, and the recording, if one runs, was already along it.
  | { kind: 'shown' }
  // Shown, and now the recording's trail.
  | { kind: 'along' }
  // Not shown: the recording is along another trail, which only the caller's choice replaces.
  | { kind: 'differs'; recordedAlong: { name: string } }

// While recording the trail shown is the recording's trail. A selection whose trail is no longer in
// the list is a trail gone from under the map, which is cleared on its own: the recording is along
// no trail.
export function showTrail(id: number, options?: { replaceAlong?: boolean }): ShowTrailOutcome {
  const select = () => useMapStore.getState().select('trail', id)
  if (currentRecordingPhase() === 'idle') {
    select()
    return { kind: 'shown' }
  }
  const currentId = currentAlongTrailId()
  const current = useTrailsStore.getState().trails.find((t) => t.id === currentId) ?? null
  const outcome = selectTrailWhileRecording(current?.id ?? null, id)
  if (outcome === 'ask' && current != null && options?.replaceAlong !== true) {
    return { kind: 'differs', recordedAlong: { name: current.name } }
  }
  select()
  return outcome === 'same' ? { kind: 'shown' } : { kind: 'along' }
}
