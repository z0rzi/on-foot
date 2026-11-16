const mockSaveActivity = jest.fn()

jest.mock('../../location', () => ({
  hasBackgroundAccess: jest.fn(),
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
jest.mock('../../store/activitiesStore', () => ({
  useActivitiesStore: { getState: () => ({ saveActivity: mockSaveActivity }) },
}))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    getActiveSession: jest.fn(),
    startSession: jest.fn(),
    markLinkedTrail: jest.fn(),
    listOverviewRows: jest.fn(),
    getSessionPoints: jest.fn(),
  },
}))
jest.mock('../personalFactor', () => ({ historyActivityIds: () => [], historyFactor: () => 1 }))

import * as locationPort from '../../location'
import * as appActivity from '../appActivity'
import * as notificationAccess from '../notificationAccess'
import { activitiesRepository, RecordingSession, TrackPoint } from '../../data/activities'
import { useMapStore } from '../../store/mapStore'
import { useRecordingStore } from '../recordingStore'
import { checkForCapture, promptForStart } from '../recordingController'
import { loadRecording, saveRecording, startFromMap, stopForSave } from '../mapRecording'

const repo = jest.mocked(activitiesRepository)
const port = jest.mocked(locationPort)
const app = jest.mocked(appActivity)
const notifications = jest.mocked(notificationAccess)

const paused: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: 3, pausedAt: 61000, pausedMs: 0, currentSegment: 0, segmentStartedAt: 1000,
}

let row: RecordingSession | null

beforeEach(() => {
  jest.clearAllMocks()
  row = null
  useRecordingStore.setState({ session: null, livePoints: [], stream: { kind: 'stopped' }, locationAvailable: null })
  useMapStore.setState({ selection: { kind: 'activity', id: 12 }, pendingFit: null })

  repo.getActiveSession.mockImplementation(async () => row)
  repo.startSession.mockImplementation(async (startedAt) => {
    row = { id: 42, startedAt, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: startedAt }
    return 42
  })
  repo.markLinkedTrail.mockResolvedValue(undefined)
  repo.listOverviewRows.mockResolvedValue([])
  mockSaveActivity.mockResolvedValue(99)

  port.hasForegroundAccess.mockResolvedValue(true)
  port.hasBackgroundAccess.mockResolvedValue(true)
  port.requestForegroundAccess.mockResolvedValue(true)
  port.requestBackgroundAccess.mockResolvedValue(true)
  port.isLocationAvailable.mockResolvedValue(true)
  port.promptToEnableLocation.mockResolvedValue(true)
  port.startBackgroundTracking.mockResolvedValue(undefined)
  port.stopBackgroundTracking.mockResolvedValue(false)
  app.isAppActive.mockReturnValue(true)
  app.whenAppActive.mockResolvedValue(undefined)
  notifications.ensureTrackingNotificationAccess.mockResolvedValue(undefined)
})

const selection = () => useMapStore.getState().selection

describe('startFromMap', () => {
  it('starts the recording and ends the activity view', async () => {
    await expect(startFromMap(checkForCapture)).resolves.toBe('started')
    expect(useRecordingStore.getState().session?.id).toBe(42)
    expect(selection()).toBeNull()
  })

  it('keeps a shown trail, as the trail the recording follows', async () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 3 } })
    await startFromMap(checkForCapture)
    expect(selection()).toEqual({ kind: 'trail', id: 3 })
  })

  it('leaves the activity view when a recording is already active', async () => {
    row = paused
    await expect(startFromMap(checkForCapture)).resolves.toBe('already-active')
    expect(selection()).toEqual({ kind: 'activity', id: 12 })
  })

  describe('checking without prompting', () => {
    const noPrompt = () => {
      expect(port.requestForegroundAccess).not.toHaveBeenCalled()
      expect(port.requestBackgroundAccess).not.toHaveBeenCalled()
      expect(port.promptToEnableLocation).not.toHaveBeenCalled()
      expect(notifications.ensureTrackingNotificationAccess).not.toHaveBeenCalled()
    }
    const nothingStarted = () => {
      expect(repo.startSession).not.toHaveBeenCalled()
      expect(selection()).toEqual({ kind: 'activity', id: 12 })
    }

    it('refuses a start while location access is missing', async () => {
      port.hasForegroundAccess.mockResolvedValue(false)
      await expect(startFromMap(checkForCapture)).resolves.toBe('permission-missing')
      noPrompt()
      nothingStarted()
    })

    it('refuses a start while "All the time" access is missing', async () => {
      port.hasBackgroundAccess.mockResolvedValue(false)
      await expect(startFromMap(checkForCapture)).resolves.toBe('permission-missing')
      noPrompt()
      nothingStarted()
    })

    it('refuses a start while location is off', async () => {
      port.isLocationAvailable.mockResolvedValue(false)
      await expect(startFromMap(checkForCapture)).resolves.toBe('location-off')
      noPrompt()
      nothingStarted()
    })

    it('refuses a start while the app is not in front', async () => {
      app.isAppActive.mockReturnValue(false)
      await expect(startFromMap(checkForCapture)).resolves.toBe('app-behind')
      expect(app.whenAppActive).not.toHaveBeenCalled()
      nothingStarted()
    })
  })

  describe('prompting, as the record button does', () => {
    it('asks for a missing permission and starts once it is granted', async () => {
      port.hasForegroundAccess.mockResolvedValue(false)
      await expect(startFromMap(promptForStart)).resolves.toBe('started')
      expect(port.requestForegroundAccess).toHaveBeenCalled()
      expect(selection()).toBeNull()
    })

    it('reports a refused permission and starts nothing', async () => {
      port.requestBackgroundAccess.mockResolvedValue(false)
      await expect(startFromMap(promptForStart)).resolves.toBe('permission-denied')
      expect(repo.startSession).not.toHaveBeenCalled()
      expect(selection()).toEqual({ kind: 'activity', id: 12 })
    })
  })
})

describe('stopForSave', () => {
  beforeEach(() => {
    row = { ...paused, linkedTrailId: null }
    useRecordingStore.setState({ session: row })
  })

  it('links the trail the recording followed', async () => {
    useMapStore.setState({ selection: { kind: 'trail', id: 3 } })
    await stopForSave()
    expect(repo.markLinkedTrail).toHaveBeenCalledWith(7, 3)
    expect(useRecordingStore.getState().session?.linkedTrailId).toBe(3)
  })

  it('links no trail when the recording followed none', async () => {
    useMapStore.setState({ selection: null })
    await stopForSave()
    expect(repo.markLinkedTrail).toHaveBeenCalledWith(7, null)
  })
})

describe('saveRecording', () => {
  const segments: TrackPoint[][] = [[
    { lat: 45, lng: 6, ele: 1000, t: 1000 },
    { lat: 45.01, lng: 6, ele: 1100, t: 31000 },
  ]]

  beforeEach(() => {
    row = paused
    useRecordingStore.setState({ session: paused })
    useMapStore.setState({ selection: { kind: 'trail', id: 3 } })
  })

  it('saves the activity built from the session, ending when it paused', async () => {
    await saveRecording({ session: paused, segments }, { name: 'Morning', effort: 'hard', comments: 'windy' })
    expect(mockSaveActivity).toHaveBeenCalledWith(7, expect.objectContaining({
      name: 'Morning',
      effort: 'hard',
      comments: 'windy',
      linkedTrailId: 3,
      geometry: { segments },
      startedAt: 1000,
      endedAt: 61000,
    }))
  })

  it('finishes the recording and shows the new activity, answering its id', async () => {
    await expect(saveRecording({ session: paused, segments }, { name: 'Morning', effort: 'easy', comments: null })).resolves.toBe(99)
    expect(useRecordingStore.getState().session).toBeNull()
    expect(selection()).toEqual({ kind: 'activity', id: 99 })
  })
})

describe('loadRecording', () => {
  it('loads the session with its points, one list a segment', async () => {
    row = paused
    repo.getSessionPoints.mockResolvedValue([
      { lat: 45, lng: 6, ele: 1000, t: 1000, segment: 0 },
      { lat: 45.01, lng: 6, ele: 1100, t: 31000, segment: 1 },
    ])
    await expect(loadRecording()).resolves.toEqual({
      session: paused,
      segments: [[{ lat: 45, lng: 6, ele: 1000, t: 1000 }], [{ lat: 45.01, lng: 6, ele: 1100, t: 31000 }]],
    })
    expect(repo.getSessionPoints).toHaveBeenCalledWith(7)
  })

  it('finds none once the recording has ended', async () => {
    await expect(loadRecording()).resolves.toBeNull()
    expect(repo.getSessionPoints).not.toHaveBeenCalled()
  })
})
