import { recordingPhase } from '../recordingPhase'
import type { RecordingSession } from '../../data/activities/types'

const recordingSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}
const pausedSession: RecordingSession = { ...recordingSession, linkedTrailId: 3, pausedAt: 4000, currentSegment: 1 }

describe('recordingPhase', () => {
  it('no session → idle', () => {
    expect(recordingPhase(null)).toBe('idle')
  })
  it('open session (no pausedAt) → recording', () => {
    expect(recordingPhase(recordingSession)).toBe('recording')
  })
  it('session with pausedAt → paused', () => {
    expect(recordingPhase(pausedSession)).toBe('paused')
  })
})
