const mockSaveActivity = jest.fn()

jest.mock('../../location', () => ({
  hasForegroundAccess: jest.fn(),
  isLocationAvailable: jest.fn(),
  promptToEnableLocation: jest.fn(),
  requestBackgroundAccess: jest.fn(),
  requestForegroundAccess: jest.fn(),
  startBackgroundTracking: jest.fn(),
  stopBackgroundTracking: jest.fn(),
}))
jest.mock('../appActivity', () => ({ isAppActive: jest.fn(), whenAppActive: jest.fn() }))
jest.mock('../notificationAccess', () => ({ ensureTrackingNotificationAccess: jest.fn() }))
jest.mock('../../components/toast', () => ({ showToast: jest.fn() }))
jest.mock('../../store/activitiesStore', () => ({
  useActivitiesStore: { getState: () => ({ saveActivity: mockSaveActivity }) },
}))
jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    getActiveSession: jest.fn(),
    startSession: jest.fn(),
    discardSession: jest.fn(),
    markPaused: jest.fn(),
    markResumed: jest.fn(),
    markLinkedTrail: jest.fn(),
    getSessionPoints: jest.fn(),
    appendPoints: jest.fn(),
  },
}))

import * as locationPort from '../../location'
import * as appActivity from '../appActivity'
import * as notificationAccess from '../notificationAccess'
import { activitiesRepository, NewActivityInput, RecordingSession } from '../../data/activities'
import { RECORDING_OPTIONS } from '../options'
import {
  discardRecording,
  ensureStreaming,
  finishRecording,
  pauseRecording,
  resumeIfActive,
  resumeRecording,
  startRecording,
} from '../recordingController'
import { useRecordingStore } from '../recordingStore'
import { showToast } from '../../components/toast'

const repo = jest.mocked(activitiesRepository)
const port = jest.mocked(locationPort)
const app = jest.mocked(appActivity)
const notifications = jest.mocked(notificationAccess)

const recording: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 500, currentSegment: 1,
}
const paused: RecordingSession = { ...recording, pausedAt: 4000 }

function deferred<T = void>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

// A fake database row and a fake location service. Registration flips when start or stop is called
// rather than when they settle, so an interleaving that issues a start after a pause is observable.
let row: RecordingSession | null
let registered: boolean
let calls: string[]

beforeEach(() => {
  jest.clearAllMocks()
  row = null
  registered = false
  calls = []
  useRecordingStore.setState({
    session: null,
    livePoints: [],
    locationAvailable: null,
    captureFault: null,
    streamLive: false,
    resumeSettled: false,
  })

  repo.getActiveSession.mockImplementation(async () => row)
  repo.startSession.mockImplementation(async (startedAt) => {
    row = { id: 42, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0 }
    calls.push('startSession')
    return 42
  })
  repo.markPaused.mockImplementation(async (_id, pausedAt) => {
    row = row && { ...row, pausedAt }
    calls.push('markPaused')
  })
  repo.markResumed.mockImplementation(async (_id, pausedMs, currentSegment) => {
    row = row && { ...row, pausedAt: null, pausedMs, currentSegment }
    calls.push('markResumed')
  })
  repo.discardSession.mockImplementation(async () => {
    row = null
  })
  repo.getSessionPoints.mockResolvedValue([])

  port.requestForegroundAccess.mockResolvedValue(true)
  port.requestBackgroundAccess.mockResolvedValue(true)
  port.hasForegroundAccess.mockResolvedValue(true)
  port.isLocationAvailable.mockResolvedValue(true)
  port.promptToEnableLocation.mockResolvedValue(true)
  port.startBackgroundTracking.mockImplementation(async () => {
    registered = true
    calls.push('start')
  })
  port.stopBackgroundTracking.mockImplementation(async () => {
    registered = false
    calls.push('stop')
  })

  app.isAppActive.mockReturnValue(true)
  app.whenAppActive.mockResolvedValue(undefined)
  notifications.ensureTrackingNotificationAccess.mockImplementation(async () => {
    calls.push('notification')
  })
})

describe('startRecording', () => {
  it('only reports an existing session', async () => {
    row = recording
    await expect(startRecording()).resolves.toBe('already-active')
    expect(port.requestForegroundAccess).not.toHaveBeenCalled()
  })

  it('refuses to start while location is off and the prompt is declined', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    port.promptToEnableLocation.mockResolvedValue(false)
    await expect(startRecording()).resolves.toBe('location-off')
    expect(repo.startSession).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('starts once the user accepts the location prompt, even before a provider reports available', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    await expect(startRecording()).resolves.toBe('started')
    expect(port.startBackgroundTracking).toHaveBeenCalledWith(RECORDING_OPTIONS)
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })

  it('asks for notification access after the location gate and before writing the session', async () => {
    await startRecording()
    expect(calls).toEqual(['notification', 'startSession', 'start'])
  })

  it('writes the session only once the app is active again', async () => {
    const active = deferred()
    app.whenAppActive.mockReturnValue(active.promise)
    const started = startRecording()
    await settle()
    expect(repo.startSession).not.toHaveBeenCalled()
    active.resolve()
    await expect(started).resolves.toBe('started')
  })

  it('keeps the session and records the fault when the start is rejected while the app is active', async () => {
    port.startBackgroundTracking.mockRejectedValue(new Error('refused'))
    await expect(startRecording()).resolves.toBe('started')
    expect(useRecordingStore.getState().session?.id).toBe(42)
    expect(useRecordingStore.getState().captureFault).toBe('start-failed')
    expect(repo.discardSession).not.toHaveBeenCalled()
  })

  it('records no fault for a start rejected while the app is not active', async () => {
    port.startBackgroundTracking.mockRejectedValue(new Error('backgrounded'))
    app.isAppActive.mockReturnValue(false)
    await startRecording()
    expect(useRecordingStore.getState().captureFault).toBeNull()
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })

  it('does not hold other operations behind the location prompt', async () => {
    const prompt = deferred<boolean>()
    port.isLocationAvailable.mockResolvedValue(false)
    port.promptToEnableLocation.mockReturnValue(prompt.promise)
    const started = startRecording()
    await expect(ensureStreaming()).resolves.toBeUndefined()
    prompt.resolve(false)
    await expect(started).resolves.toBe('location-off')
  })

  it('does not hold other operations behind the notification request', async () => {
    const asking = deferred()
    notifications.ensureTrackingNotificationAccess.mockReturnValue(asking.promise)
    const started = startRecording()
    await settle()
    await expect(ensureStreaming()).resolves.toBeUndefined()
    asking.resolve()
    await expect(started).resolves.toBe('started')
  })

  it('does not hold other operations while waiting for the app to become active', async () => {
    const active = deferred()
    app.whenAppActive.mockReturnValue(active.promise)
    const started = startRecording()
    await settle()
    await expect(ensureStreaming()).resolves.toBeUndefined()
    active.resolve()
    await expect(started).resolves.toBe('started')
  })

  it('starts one session when Record is pressed twice before either start queues', async () => {
    const results = await Promise.all([startRecording(), startRecording()])
    expect(results).toEqual(['started', 'started'])
    expect(repo.startSession).toHaveBeenCalledTimes(1)
  })
})

describe('ensureStreaming', () => {
  beforeEach(() => {
    row = recording
    useRecordingStore.setState({ session: recording })
  })

  it('does not restart a live stream', async () => {
    useRecordingStore.setState({ streamLive: true })
    await ensureStreaming()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('starts a stream that is not live and marks it live', async () => {
    await ensureStreaming()
    expect(port.startBackgroundTracking).toHaveBeenCalledTimes(1)
    expect(useRecordingStore.getState().streamLive).toBe(true)
  })

  it('does not mark a start live when location went away during it', async () => {
    port.isLocationAvailable.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    await ensureStreaming()
    expect(port.startBackgroundTracking).toHaveBeenCalledTimes(1)
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })

  it('never starts while no location provider is available', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    await ensureStreaming()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().locationAvailable).toBe(false)
  })

  it('reports a missing foreground permission without starting', async () => {
    port.hasForegroundAccess.mockResolvedValue(false)
    await ensureStreaming()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().captureFault).toBe('permission-missing')
  })

  it('clears the permission fault once access returns, even with a live stream', async () => {
    useRecordingStore.setState({ streamLive: true, captureFault: 'permission-missing' })
    await ensureStreaming()
    expect(useRecordingStore.getState().captureFault).toBeNull()
  })

  it('retries a failed start and clears the fault when it succeeds', async () => {
    port.startBackgroundTracking.mockRejectedValueOnce(new Error('refused'))
    await ensureStreaming()
    expect(useRecordingStore.getState().captureFault).toBe('start-failed')
    await ensureStreaming()
    expect(useRecordingStore.getState().captureFault).toBeNull()
    expect(useRecordingStore.getState().streamLive).toBe(true)
  })

  it('does nothing while paused', async () => {
    row = paused
    await ensureStreaming()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('collapses triggers that arrive while one recovery is already queued', async () => {
    port.startBackgroundTracking.mockRejectedValue(new Error('refused'))
    await Promise.all([ensureStreaming(), ensureStreaming(), ensureStreaming()])
    expect(port.startBackgroundTracking).toHaveBeenCalledTimes(1)
  })

  it('leaves no running stream when a pause lands while a recovery is checking location', async () => {
    const check = deferred<boolean>()
    port.isLocationAvailable.mockReturnValueOnce(check.promise)
    const recovery = ensureStreaming()
    const pause = pauseRecording()
    await settle()
    check.resolve(true)
    await Promise.all([recovery, pause])
    expect(registered).toBe(false)
    expect(calls).toEqual(['start', 'markPaused', 'stop'])
  })

  it('starts nothing when it is queued behind a pause', async () => {
    const committing = deferred()
    repo.markPaused.mockImplementationOnce(async (_id, pausedAt) => {
      await committing.promise
      row = row && { ...row, pausedAt }
    })
    const pause = pauseRecording()
    const recovery = ensureStreaming()
    await settle()
    committing.resolve()
    await Promise.all([pause, recovery])
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })
})

describe('resumeRecording', () => {
  beforeEach(() => {
    row = paused
    useRecordingStore.setState({ session: paused })
  })

  it('commits the resume, then starts the stream', async () => {
    await resumeRecording()
    expect(calls).toEqual(['markResumed', 'start'])
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
    expect(useRecordingStore.getState().streamLive).toBe(true)
  })

  it('commits the resume and starts nothing while location is off', async () => {
    port.isLocationAvailable.mockResolvedValue(false)
    await resumeRecording()
    expect(repo.markResumed).toHaveBeenCalledWith(7, expect.any(Number), 2)
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().locationAvailable).toBe(false)
  })

  it('keeps the resume when the start is rejected, recording the fault', async () => {
    port.startBackgroundTracking.mockRejectedValue(new Error('refused'))
    await expect(resumeRecording()).resolves.toBeUndefined()
    expect(useRecordingStore.getState().session?.pausedAt).toBeNull()
    expect(useRecordingStore.getState().captureFault).toBe('start-failed')
  })
})

describe('pauseRecording', () => {
  it('commits the pause even when the stream cannot be stopped', async () => {
    row = recording
    useRecordingStore.setState({ session: recording, streamLive: true })
    port.stopBackgroundTracking.mockRejectedValue(new Error('service already gone'))
    await expect(pauseRecording()).resolves.toBeUndefined()
    expect(useRecordingStore.getState().session?.pausedAt).toEqual(expect.any(Number))
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })
})

describe('discardRecording', () => {
  it('propagates a failure to stop the stream', async () => {
    row = paused
    port.stopBackgroundTracking.mockRejectedValue(new Error('service already gone'))
    await expect(discardRecording(7)).rejects.toThrow('service already gone')
  })

  it('marks the stream dead before the database write, even when the write rejects', async () => {
    row = paused
    useRecordingStore.setState({ streamLive: true })
    repo.discardSession.mockRejectedValue(new Error('db gone'))
    await expect(discardRecording(7)).rejects.toThrow('db gone')
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })
})

describe('resumeIfActive', () => {
  it('stops an orphaned stream when there is no session', async () => {
    registered = true
    await resumeIfActive()
    expect(registered).toBe(false)
    expect(useRecordingStore.getState().resumeSettled).toBe(true)
  })

  it('leaves a session the running process already holds untouched', async () => {
    row = recording
    useRecordingStore.setState({ session: recording, streamLive: true })
    await resumeIfActive()
    expect(repo.getSessionPoints).not.toHaveBeenCalled()
    expect(repo.markResumed).not.toHaveBeenCalled()
    expect(jest.mocked(showToast)).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
    expect(useRecordingStore.getState().resumeSettled).toBe(true)
  })

  it('opens a new segment, announces the gap and restarts capture after the process died', async () => {
    row = recording
    const lastPointAt = new Date(2026, 8, 14, 13, 56).getTime()
    const reopenedAt = new Date(2026, 8, 14, 14, 40).getTime()
    repo.getSessionPoints.mockResolvedValue([{ lat: 0, lng: 0, ele: null, t: lastPointAt, segment: 1 }])
    const clock = jest.spyOn(Date, 'now').mockReturnValue(reopenedAt)
    try {
      await resumeIfActive()
    } finally {
      clock.mockRestore()
    }
    expect(repo.markResumed).toHaveBeenCalledWith(7, 500, 2)
    expect(useRecordingStore.getState().session?.currentSegment).toBe(2)
    expect(jest.mocked(showToast)).toHaveBeenCalledWith('Recording interrupted 13:56–14:40')
    expect(port.startBackgroundTracking).toHaveBeenCalledTimes(1)
    expect(repo.appendPoints).not.toHaveBeenCalled()
  })

  it('announces the gap from the session start when nothing was captured', async () => {
    row = { ...recording, startedAt: new Date(2026, 8, 14, 10, 0).getTime() }
    const clock = jest.spyOn(Date, 'now').mockReturnValue(new Date(2026, 8, 14, 10, 30).getTime())
    try {
      await resumeIfActive()
    } finally {
      clock.mockRestore()
    }
    expect(jest.mocked(showToast)).toHaveBeenCalledWith('Recording interrupted 10:00–10:30')
  })

  it('hydrates a paused session without announcing or starting anything', async () => {
    row = paused
    await resumeIfActive()
    expect(useRecordingStore.getState().session).toEqual(paused)
    expect(jest.mocked(showToast)).not.toHaveBeenCalled()
    expect(port.startBackgroundTracking).not.toHaveBeenCalled()
  })

  it('settles launch handling even when it fails', async () => {
    repo.getActiveSession.mockRejectedValueOnce(new Error('db gone'))
    await expect(resumeIfActive()).rejects.toThrow('db gone')
    expect(useRecordingStore.getState().resumeSettled).toBe(true)
  })
})

describe('finishRecording', () => {
  const input: NewActivityInput = {
    name: 'Walk',
    effort: 'moderate',
    comments: null,
    linkedTrailId: null,
    geometry: { segments: [] },
    metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
    startedAt: 1000,
    endedAt: 2000,
  }

  beforeEach(() => {
    row = paused
    useRecordingStore.setState({ session: paused })
    mockSaveActivity.mockImplementation(async () => {
      calls.push('save')
      return 99
    })
  })

  it('stops the stream before saving, then clears the recording', async () => {
    registered = true
    await expect(finishRecording(7, input)).resolves.toBe(99)
    expect(calls).toEqual(['stop', 'save'])
    expect(registered).toBe(false)
    expect(useRecordingStore.getState().session).toBeNull()
  })

  it('still saves when the stream cannot be stopped', async () => {
    port.stopBackgroundTracking.mockRejectedValue(new Error('service already gone'))
    await expect(finishRecording(7, input)).resolves.toBe(99)
    expect(mockSaveActivity).toHaveBeenCalledWith(7, input)
  })

  it('marks the stream dead before the database write, even when the write rejects', async () => {
    registered = true
    useRecordingStore.setState({ streamLive: true })
    mockSaveActivity.mockRejectedValue(new Error('db gone'))
    await expect(finishRecording(7, input)).rejects.toThrow('db gone')
    expect(useRecordingStore.getState().streamLive).toBe(false)
  })
})
