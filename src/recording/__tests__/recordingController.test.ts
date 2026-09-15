jest.mock('../../location', () => ({
  isLocationAvailable: jest.fn(),
  requestForegroundAccess: jest.fn(),
  requestBackgroundAccess: jest.fn(),
  startBackgroundTracking: jest.fn(),
  stopBackgroundTracking: jest.fn(),
}))
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

import * as locationPort from '../../location'
import { activitiesRepository } from '../../data/activities'
import { RecordingSession } from '../../data/activities/types'
import { RECORDING_OPTIONS } from '../options'
import { pauseRecording, resumeIfActive, resumeRecording, startRecording } from '../recordingController'
import { useRecordingStore } from '../recordingStore'

const repo = jest.mocked(activitiesRepository)
const port = jest.mocked(locationPort)

const recording: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 500, currentSegment: 1,
}
const paused: RecordingSession = { ...recording, pausedAt: 4000 }

beforeEach(() => {
  jest.clearAllMocks()
  useRecordingStore.setState({ session: null, livePoints: [] })
  port.requestForegroundAccess.mockResolvedValue(true)
  port.requestBackgroundAccess.mockResolvedValue(true)
  repo.getSessionPoints.mockResolvedValue([])
})

// The invariant under test: a durable session must never claim to be recording while nothing is
// streaming. Each transition is driven through its native failure, since that path cannot be
// reached on a device.
describe('startRecording', () => {
  it('undoes the session when the location stream fails to start', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    repo.startSession.mockResolvedValue(42)
    repo.discardSession.mockResolvedValue(undefined)
    port.startBackgroundTracking.mockRejectedValue(new Error('no location service'))

    await expect(startRecording()).rejects.toThrow('no location service')
    expect(repo.discardSession).toHaveBeenCalledWith(42)
    expect(useRecordingStore.getState().session).toBeNull()
  })

  it('still clears the store when the compensating delete also fails, so a retry is reachable', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    repo.startSession.mockResolvedValue(42)
    repo.discardSession.mockRejectedValue(new Error('db gone'))
    port.startBackgroundTracking.mockRejectedValue(new Error('no location service'))

    await expect(startRecording()).rejects.toThrow('no location service')
    expect(useRecordingStore.getState().session).toBeNull()
  })

  it('keeps the session once the stream is running', async () => {
    repo.getActiveSession.mockResolvedValue(null)
    repo.startSession.mockResolvedValue(42)
    port.startBackgroundTracking.mockResolvedValue(undefined)

    await expect(startRecording()).resolves.toBe('started')
    expect(port.startBackgroundTracking).toHaveBeenCalledWith(RECORDING_OPTIONS)
    expect(repo.discardSession).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session?.id).toBe(42)
  })
})

describe('resumeRecording', () => {
  it('leaves the session paused when the stream fails to start', async () => {
    repo.getActiveSession.mockResolvedValue(paused)
    useRecordingStore.setState({ session: paused, livePoints: [] })
    port.startBackgroundTracking.mockRejectedValue(new Error('no location service'))

    await expect(resumeRecording()).rejects.toThrow('no location service')
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().session?.pausedAt).toBe(4000)
  })

  it('starts the stream without asking whether one is registered, then commits the resume', async () => {
    repo.getActiveSession.mockResolvedValue(paused)
    useRecordingStore.setState({ session: paused, livePoints: [] })
    port.startBackgroundTracking.mockResolvedValue(undefined)
    repo.markResumed.mockResolvedValue(undefined)

    await resumeRecording()
    expect(port.startBackgroundTracking).toHaveBeenCalledWith(RECORDING_OPTIONS)
    expect(repo.markResumed).toHaveBeenCalledWith(7, expect.any(Number), 2)
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
  })
})

describe('pauseRecording', () => {
  it('commits the pause even when the stream cannot be stopped', async () => {
    repo.getActiveSession.mockResolvedValue(recording)
    useRecordingStore.setState({ session: recording, livePoints: [] })
    repo.markPaused.mockResolvedValue(undefined)
    port.stopBackgroundTracking.mockRejectedValue(new Error('service already gone'))

    await expect(pauseRecording()).resolves.toBeUndefined()
    expect(repo.markPaused).toHaveBeenCalledWith(7, expect.any(Number))
    expect(useRecordingStore.getState().session?.pausedAt).toEqual(expect.any(Number))
  })
})

describe('resumeIfActive', () => {
  it('restarts capture for a recording session when a provider is available', async () => {
    repo.getActiveSession.mockResolvedValue(recording)
    port.isLocationAvailable.mockResolvedValue(true)
    port.startBackgroundTracking.mockResolvedValue(undefined)

    await resumeIfActive()
    expect(useRecordingStore.getState().session).toEqual(recording)
    expect(port.startBackgroundTracking).toHaveBeenCalledTimes(1)
  })

  it('issues no start while no provider is available', async () => {
    repo.getActiveSession.mockResolvedValue(recording)
    port.isLocationAvailable.mockResolvedValue(false)

    await resumeIfActive()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('appends no immediate position on launch', async () => {
    repo.getActiveSession.mockResolvedValue(recording)
    port.isLocationAvailable.mockResolvedValue(true)
    port.startBackgroundTracking.mockResolvedValue(undefined)

    await resumeIfActive()
    expect(repo.appendPoints).not.toHaveBeenCalled()
  })
})
