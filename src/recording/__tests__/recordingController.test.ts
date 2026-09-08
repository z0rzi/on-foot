jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  ActivityType: { Fitness: 3 },
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  startLocationUpdatesAsync: jest.fn(),
  stopLocationUpdatesAsync: jest.fn(),
  hasStartedLocationUpdatesAsync: jest.fn(),
}))
jest.mock('expo-task-manager', () => ({ defineTask: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    getActiveSession: jest.fn(),
    startSession: jest.fn(),
    discardSession: jest.fn(),
    markPaused: jest.fn(),
    markResumed: jest.fn(),
    getSessionPoints: jest.fn(),
    appendPoints: jest.fn(),
  },
}))

import * as Location from 'expo-location'
import { activitiesRepository } from '../../data/activities'
import { RecordingSession } from '../../data/activities/types'
import { pauseRecording, resumeRecording, startRecording } from '../recordingController'
import { useRecordingStore } from '../recordingStore'

const repo = activitiesRepository as jest.Mocked<typeof activitiesRepository>
const location = Location as jest.Mocked<typeof Location>

const recording: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 500, currentSegment: 1,
}
const paused: RecordingSession = { ...recording, pausedAt: 4000 }

const grantAllPermissions = () => {
  location.requestForegroundPermissionsAsync.mockResolvedValue({ granted: true } as any)
  location.requestBackgroundPermissionsAsync.mockResolvedValue({ granted: true } as any)
}

beforeEach(() => {
  jest.clearAllMocks()
  useRecordingStore.setState({ session: null, livePoints: [] })
})

// The invariant under test: a durable session must never claim to be recording while nothing is
// streaming. Each transition is driven through its native failure, since that path cannot be
// reached on a device.
describe('startRecording', () => {
  it('undoes the session when the location stream fails to start', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    grantAllPermissions()
    repo.startSession.mockResolvedValue(42)
    repo.discardSession.mockResolvedValue(undefined)
    location.startLocationUpdatesAsync.mockRejectedValue(new Error('no location service'))

    await expect(startRecording()).rejects.toThrow('no location service')
    expect(repo.discardSession).toHaveBeenCalledWith(42)
    expect(useRecordingStore.getState().session).toBeNull()
  })

  it('still clears the store when the compensating delete also fails, so a retry is reachable', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    grantAllPermissions()
    repo.startSession.mockResolvedValue(42)
    repo.discardSession.mockRejectedValue(new Error('db gone'))
    location.startLocationUpdatesAsync.mockRejectedValue(new Error('no location service'))

    await expect(startRecording()).rejects.toThrow('no location service')
    expect(useRecordingStore.getState().session).toBeNull()
  })

  it('keeps the session once the stream is running', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    grantAllPermissions()
    repo.startSession.mockResolvedValue(42)
    location.startLocationUpdatesAsync.mockResolvedValue(undefined)

    await expect(startRecording()).resolves.toBe('started')
    expect(repo.discardSession).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session?.id).toBe(42)
  })
})

describe('resumeRecording', () => {
  it('leaves the session paused when the stream fails to start', async () => {
    repo.getActiveSession.mockResolvedValue(paused)
    useRecordingStore.setState({ session: paused, livePoints: [] })
    location.hasStartedLocationUpdatesAsync.mockResolvedValue(false)
    location.startLocationUpdatesAsync.mockRejectedValue(new Error('no location service'))

    await expect(resumeRecording()).rejects.toThrow('no location service')
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session?.pausedAt).toBe(4000)
  })

  it('commits the resume once the stream is running', async () => {
    repo.getActiveSession.mockResolvedValue(paused)
    useRecordingStore.setState({ session: paused, livePoints: [] })
    location.hasStartedLocationUpdatesAsync.mockResolvedValue(false)
    location.startLocationUpdatesAsync.mockResolvedValue(undefined)
    repo.markResumed.mockResolvedValue(undefined)

    await resumeRecording()
    expect(repo.markResumed).toHaveBeenCalledWith(7, expect.any(Number), 2)
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
  })
})

describe('pauseRecording', () => {
  it('commits the pause even when the stream cannot be stopped', async () => {
    repo.getActiveSession.mockResolvedValue(recording)
    useRecordingStore.setState({ session: recording, livePoints: [] })
    repo.markPaused.mockResolvedValue(undefined)
    location.hasStartedLocationUpdatesAsync.mockResolvedValue(true)
    location.stopLocationUpdatesAsync.mockRejectedValue(new Error('service already gone'))

    await expect(pauseRecording()).resolves.toBeUndefined()
    expect(repo.markPaused).toHaveBeenCalledWith(7, expect.any(Number))
    expect(useRecordingStore.getState().session?.pausedAt).toEqual(expect.any(Number))
  })
})
