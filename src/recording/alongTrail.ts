import type { Selection } from '../store/mapStore'
import type { RecordingPhase } from './recordingPhase'

export type TrailWhileRecording = 'along' | 'ask' | 'same'

// What showing a trail does to a running recording: along no trail it becomes along this one, along
// another it asks before switching, along this one it is only shown.
export function selectTrailWhileRecording(currentTrailId: number | null, nextTrailId: number): TrailWhileRecording {
  if (currentTrailId == null) return 'along'
  return currentTrailId === nextTrailId ? 'same' : 'ask'
}

// The recording is along the trail shown on the map; the shown trail is linked to the activity at
// Stop (PausedControls).
export function alongTrailId(phase: RecordingPhase, selection: Selection | null): number | null {
  if (phase === 'idle') return null
  return selection?.kind === 'trail' ? selection.id : null
}

export interface AlongTrailState {
  phase: RecordingPhase
  trailId: number | null
}

// A change of the recording's trail happens within one recording; a recording starting along a
// trail or ending is not one.
export function alongTrailChanged(prev: AlongTrailState, next: AlongTrailState): boolean {
  return prev.phase !== 'idle' && next.phase !== 'idle' && prev.trailId !== next.trailId
}
