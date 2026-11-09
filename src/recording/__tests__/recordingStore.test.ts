jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { listSummaries: jest.fn(), getActivity: jest.fn() },
}))

import { recordingPhase } from '../recordingPhase'
import { useRecordingStore } from '../recordingStore'
import { LiveTrackPoint, RecordingSession, TrackPoint } from '../../data/activities/types'
import { groupPointsBySegment } from '../../data/activities/mapping'
import { activitiesRepository, type Activity } from '../../data/activities'
import { logEvent } from '../../log'

const p = (t: number): TrackPoint => ({ lat: 0, lng: t, ele: null, t })
const lp = (t: number, segment: number): LiveTrackPoint => ({ ...p(t), segment })
const recordingSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}
const pausedSession: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: 3, pausedAt: 4000, pausedMs: 0, currentSegment: 1, segmentStartedAt: 1000,
}

beforeEach(() => {
  jest.mocked(activitiesRepository).listSummaries.mockResolvedValue([])
  useRecordingStore.setState({
    session: null,
    livePoints: [],
    locationAvailable: null,
    stream: { kind: 'stopped' },
    resumeSettled: false,
    interruption: null,
    historyFactor: 1,
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
  it('reset drops an interruption not yet announced, since its recording is gone', () => {
    useRecordingStore.getState().announceInterruption({ since: 1000, until: 2000 })
    useRecordingStore.getState().reset()
    expect(useRecordingStore.getState().interruption).toBeNull()
  })
})

describe('history factor', () => {
  const repo = jest.mocked(activitiesRepository)
  const METERS_PER_DEGREE_AT_EQUATOR = (6371000 * Math.PI) / 180
  // Tobler's flat speed (Tobler, 1993): 6 · e^(−0.175) km/h.
  const toblerFlatSecondsPer50m = (0.05 / (6 * Math.exp(-0.175))) * 3600

  // A saved 3 km flat hike walked at `factor` times Tobler's time, a point every 50 m.
  const hike = (id: number, factor: number): Activity => ({
    id,
    name: `Hike ${id}`,
    effort: 'moderate',
    comments: null,
    linkedTrailId: null,
    metrics: { distanceMeters: 3000, durationSeconds: 3600, elevationGainMeters: 0, elevationLossMeters: 0 },
    geometry: {
      segments: [Array.from({ length: 61 }, (_, i) => ({
        lat: 0,
        lng: (i * 50) / METERS_PER_DEGREE_AT_EQUATOR,
        ele: 500,
        t: i * toblerFlatSecondsPer50m * factor * 1000,
      }))],
    },
    startedAt: id,
    createdAt: id,
    endedAt: id + 1,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    repo.listSummaries.mockResolvedValue([hike(1, 1.5)])
    repo.getActivity.mockImplementation(async (id) => hike(id, 1.5))
  })

  const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
  const factor = () => useRecordingStore.getState().historyFactor

  it('is 1 before anything is read', () => {
    expect(factor()).toBe(1)
  })
  it('is read from the saved activities when a session begins', async () => {
    useRecordingStore.getState().beginSession(recordingSession)
    await settle()
    expect(factor()).toBeCloseTo(1.5, 3)
  })
  it('is read when a relaunch hydrates a session', async () => {
    useRecordingStore.getState().hydrate(pausedSession, [])
    await settle()
    expect(factor()).toBeCloseTo(1.5, 3)
  })
  it('is read again when the session\'s next segment begins', async () => {
    useRecordingStore.getState().hydrate(pausedSession, [])
    await settle()
    useRecordingStore.getState().setSession({ ...pausedSession, pausedAt: null, currentSegment: 2 })
    await settle()
    expect(repo.listSummaries).toHaveBeenCalledTimes(2)
  })
  it('is not read again when the session changes within its segment', async () => {
    useRecordingStore.getState().beginSession(recordingSession)
    await settle()
    useRecordingStore.getState().setSession({ ...recordingSession, linkedTrailId: 3 })
    useRecordingStore.getState().setSession({ ...recordingSession, linkedTrailId: 3, pausedAt: 4000 })
    await settle()
    expect(repo.listSummaries).toHaveBeenCalledTimes(1)
  })
  it('falls back to 1 and logs a warning when the read fails', async () => {
    repo.listSummaries.mockRejectedValue(new Error('database is locked'))
    useRecordingStore.getState().beginSession(recordingSession)
    await settle()
    expect(factor()).toBe(1)
    expect(logEvent).toHaveBeenCalledWith('warn', 'recording', 'personal factor history read failed', { error: 'Error: database is locked' })
  })
  it('is dropped with the recording', async () => {
    useRecordingStore.getState().beginSession(recordingSession)
    await settle()
    useRecordingStore.getState().reset()
    expect(factor()).toBe(1)
  })
  it('ignores a read that resolves after its recording ended', async () => {
    useRecordingStore.getState().beginSession(recordingSession)
    useRecordingStore.getState().reset()
    await settle()
    expect(factor()).toBe(1)
  })
})
