import { recordingPhase, useRecordingStore } from '../recordingStore'
import { LiveTrackPoint, RecordingSession, TrackPoint } from '../../data/activities/types'
import { groupPointsBySegment } from '../../data/activities/mapping'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })
const lp = (t: number, segment: number): LiveTrackPoint => ({ ...p(t), segment })
const recordingSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0,
}
const pausedSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: 3, pausedAt: 4000, pausedMs: 0, currentSegment: 1,
}

beforeEach(() => {
  useRecordingStore.setState({
    session: null,
    livePoints: [],
    locationAvailable: null,
    stream: { kind: 'stopped' },
    resumeSettled: false,
  })
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
  it('beginSession sets the session (recording) + empty live points', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    expect(useRecordingStore.getState().session).toEqual(recordingSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('recording')
    expect(useRecordingStore.getState().livePoints).toEqual([])
  })
  it('hydrate loads a session + its tagged points', () => {
    useRecordingStore.getState().hydrate(recordingSession, [lp(1, 0), lp(2, 0)])
    expect(useRecordingStore.getState().livePoints).toEqual([lp(1, 0), lp(2, 0)])
  })
  it('setSession replaces the session without touching live points', () => {
    useRecordingStore.getState().hydrate(recordingSession, [lp(1, 0)])
    useRecordingStore.getState().setSession(pausedSession)
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('paused')
    expect(useRecordingStore.getState().livePoints).toEqual([lp(1, 0)])
  })
  it('appendLivePoints tags points with their segment, in order', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints(0, [p(1), p(2)])
    useRecordingStore.getState().appendLivePoints(1, [p(3)])
    expect(useRecordingStore.getState().livePoints).toEqual([lp(1, 0), lp(2, 0), lp(3, 1)])
  })
  it('grouping the live points yields one array per segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints(0, [p(1), p(2)])
    useRecordingStore.getState().appendLivePoints(1, [p(3)])
    expect(groupPointsBySegment(useRecordingStore.getState().livePoints)).toEqual([[p(1), p(2)], [p(3)]])
  })
  it('appending into the same segment across calls extends that segment', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().appendLivePoints(0, [p(1)])
    useRecordingStore.getState().appendLivePoints(0, [p(2)])
    expect(groupPointsBySegment(useRecordingStore.getState().livePoints)).toEqual([[p(1), p(2)]])
  })
  it('appendLivePoints with [] is a no-op (same reference)', () => {
    useRecordingStore.getState().beginSession(recordingSession)
    const before = useRecordingStore.getState().livePoints
    useRecordingStore.getState().appendLivePoints(0, [])
    expect(useRecordingStore.getState().livePoints).toBe(before)
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().hydrate(recordingSession, [lp(1, 0)])
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().session).toBeNull()
    expect(recordingPhase(useRecordingStore.getState().session)).toBe('idle')
    expect(useRecordingStore.getState().livePoints).toEqual([])
  })
})

describe('stream state', () => {
  const observed = { locationAvailable: true, stream: { kind: 'faulted', fault: 'start-failed' } as const }
  const streamState = () => {
    const s = useRecordingStore.getState()
    return { locationAvailable: s.locationAvailable, stream: s.stream }
  }

  it('setStreamState merges only the given fields', () => {
    useRecordingStore.getState().setStreamState({ locationAvailable: true })
    useRecordingStore.getState().setStreamState({ stream: { kind: 'faulted', fault: 'permission-missing' } })
    expect(streamState()).toEqual({ locationAvailable: true, stream: { kind: 'faulted', fault: 'permission-missing' } })
  })
  it('beginSession clears the stream state', () => {
    useRecordingStore.getState().setStreamState(observed)
    useRecordingStore.getState().beginSession(recordingSession)
    expect(streamState()).toEqual({ locationAvailable: null, stream: { kind: 'stopped' } })
  })
  it('hydrate clears the stream state', () => {
    useRecordingStore.getState().setStreamState(observed)
    useRecordingStore.getState().hydrate(recordingSession, [])
    expect(streamState()).toEqual({ locationAvailable: null, stream: { kind: 'stopped' } })
  })
  it('reset clears the stream state', () => {
    useRecordingStore.getState().setStreamState(observed)
    useRecordingStore.getState().reset()
    expect(streamState()).toEqual({ locationAvailable: null, stream: { kind: 'stopped' } })
  })
  it('stays settled across a reset once launch handling has settled', () => {
    useRecordingStore.getState().markResumeSettled()
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().resumeSettled).toBe(true)
  })
})
