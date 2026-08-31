import { recordingPhase, useRecordingStore } from '../recordingStore'
import { RecordingSession, TrackPoint } from '../../data/activities/types'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })
const recordingSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0,
}
const pausedSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: 3, pausedAt: 4000, pausedMs: 0, currentSegment: 1,
}

beforeEach(() => {
  useRecordingStore.setState({ session: null, liveGeometry: { segments: [] } })
})

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

describe('recordingStore', () => {
  it('beginSession sets the session (recording) + one open empty segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[]])
  })
  it('hydrate loads a session + its segments', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1), p(2)]])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1), p(2)]])
  })
  it('setSession replaces the session without touching geometry', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1)]])
    useRecordingStore.getState().setSession(pausedSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('paused')
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1)]])
  })
  it('appendLivePoints appends into the last segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints([p(1), p(2)])
    useRecordingStore.getState().appendLivePoints([p(3)])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1), p(2), p(3)]])
  })
  it('startSegment then appendLivePoints writes into the new segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints([p(1)])
    useRecordingStore.getState().startSegment()
    useRecordingStore.getState().appendLivePoints([p(2)])
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([[p(1)], [p(2)]])
  })
  it('appendLivePoints with [] is a no-op (same reference)', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    const before = useRecordingStore.getState().liveGeometry
    useRecordingStore.getState().appendLivePoints([])
    expect(useRecordingStore.getState().liveGeometry).toBe(before)
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().hydrate(recordingSession, [[p(1)]])
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().session).toBeNull()
    expect(useRecordingStore.getState().liveGeometry.segments).toEqual([])
  })
})
