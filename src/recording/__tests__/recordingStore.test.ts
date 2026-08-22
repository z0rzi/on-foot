import { useRecordingStore } from '../recordingStore'
import { TrackPoint } from '../../data/activities'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })

beforeEach(() => {
  useRecordingStore.setState({ phase: 'idle', sessionId: null, startedAt: null, liveGeometry: { points: [] } })
})

describe('recordingStore', () => {
  it('startRecording sets recording phase + session + empty geometry', () => {
    useRecordingStore.getState().startRecording(7, 1000)
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'recording', sessionId: 7, startedAt: 1000 })
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
  it('hydrateFrom loads a session + its points into recording phase', () => {
    useRecordingStore.getState().hydrateFrom({ id: 3, startedAt: 500, endedAt: null, linkedTrailId: null }, [p(1), p(2)])
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'recording', sessionId: 3, startedAt: 500 })
    expect(useRecordingStore.getState().liveGeometry.points).toHaveLength(2)
  })
  it('appendLivePoints appends in order', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().appendLivePoints([p(1), p(2)])
    useRecordingStore.getState().appendLivePoints([p(3)])
    expect(useRecordingStore.getState().liveGeometry.points.map((x) => x.t)).toEqual([1, 2, 3])
  })
  it('appendLivePoints with [] is a no-op', () => {
    useRecordingStore.getState().startRecording(1, 0)
    const before = useRecordingStore.getState().liveGeometry
    useRecordingStore.getState().appendLivePoints([])
    expect(useRecordingStore.getState().liveGeometry).toBe(before)
  })
  it('beginSaving moves to saving phase', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().beginSaving()
    expect(useRecordingStore.getState().phase).toBe('saving')
  })
  it('reset returns to idle + clears everything', () => {
    useRecordingStore.getState().startRecording(1, 0)
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState()).toMatchObject({ phase: 'idle', sessionId: null, startedAt: null })
    expect(useRecordingStore.getState().liveGeometry.points).toEqual([])
  })
})
