import { useMapStore } from '../store/mapStore'
import { currentRecordingPhase } from '../recording/recordingStore'
import { logEvent } from '../log'

export type ShowActivityOutcome = { kind: 'shown' } | { kind: 'refused-recording' }

// A recording's map shows the recording and its trail, so an activity is shown only while nothing
// records, paused included.
export function showActivity(id: number): ShowActivityOutcome {
  if (currentRecordingPhase() !== 'idle') {
    logEvent('warn', 'error', 'refused opening an activity while recording')
    return { kind: 'refused-recording' }
  }
  useMapStore.getState().select('activity', id)
  return { kind: 'shown' }
}
