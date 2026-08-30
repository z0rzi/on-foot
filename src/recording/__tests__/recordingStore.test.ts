import { recordingPhase, useRecordingStore } from '../recordingStore'
import { RecordingSession, TrackPoint } from '../../data/activities/types'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })
const recordingSession: RecordingSession = {
  id: 7, startedAt: 1000, endedAt: null, linkedTrailId: null, pausedAt: null, pausedMs: 0,
}
const pausedSession: RecordingSession = {
  id: 7, startedAt: 1000, endedAt: null, linkedTrailId: 3, pausedAt: 4000, pausedMs: 0,
}

beforeEach(() => {
  useRecordingStore.setState({ session: null, liveGeometry: { points: [] } })
})

describe('recordingPhase', () => {
  it('no session → idle', () => {
    expect(recordingPhase(null)).toBe('idle')
  })
  it('open session (endedAt null) → recording', () => {
    expect(recordingPhase(recordingSession)).toBe('recording')
  })
  it('session with pausedAt → paused', () => {
    expect(recordingPhase(pausedSession)).toBe('paused')
  })
})

describe('recordingStore', () => {
  it('beginSession sets the session (recording) + empty geometry', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    expect(useRecordingStore.getState().session).toEqual(recordingSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('recording')
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
  it('hydrate loads a session + its points', () => {
    useRecordingStore.getState().hydrate(recordingSession, [p(1), p(2)])
    expect(useRecordingStore.getState().session).toEqual(recordingSession)
    expect(useRecordingStore.getState().liveGeometry.points).toHaveLength(2)
  })
  it('setSession replaces the session without touching geometry (phase derives to paused)', () => {
    useRecordingStore.getState().hydrate(recordingSession, [p(1)])
    useRecordingStore.getState().setSession(pausedSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('paused')
    expect(useRecordingStore.getState().liveGeometry.points).toHaveLength(1)
  })
  it('appendLivePoints appends in order', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints([p(1), p(2)])
    useRecordingStore.getState().appendLivePoints([p(3)])
    expect(useRecordingStore.getState().liveGeometry.points.map((x) => x.t)).toEqual([1, 2, 3])
  })
  it('appendLivePoints with [] is a no-op (same reference)', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    const before = useRecordingStore.getState().liveGeometry
    useRecordingStore.getState().appendLivePoints([])
    expect(useRecordingStore.getState().liveGeometry).toBe(before)
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().hydrate(recordingSession, [p(1)])
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().session).toBeNull()
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('idle')
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
})
