jest.mock('../../location', () => ({
  defineBackgroundFixHandler: jest.fn(),
  isLocationAvailable: jest.fn(async () => true),
  startBackgroundTracking: jest.fn(async () => {}),
  stopBackgroundTracking: jest.fn(async () => false),
}))
jest.mock('../appActivity', () => ({ isAppActive: () => true, whenAppActive: async () => {} }))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../personalFactor', () => ({ historyActivityIds: () => [], historyFactor: () => 1 }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    getActiveSession: jest.fn(),
    getSessionPoints: jest.fn(),
    getLastSegmentPoint: jest.fn(),
    appendPoints: jest.fn(),
    markResumed: jest.fn(),
    listOverviewRows: jest.fn(async () => []),
  },
}))

import * as locationPort from '../../location'
import { activitiesRepository, LiveTrackPoint, RecordingSession } from '../../data/activities'
import type { LocationFix } from '../../location'
import '../locationTask'
import { resumeIfActive } from '../recordingController'
import { useRecordingStore } from '../recordingStore'

const repo = jest.mocked(activitiesRepository)
const handleFixes = jest.mocked(locationPort.defineBackgroundFixHandler).mock.calls[0][0]

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

it('keeps a delivery stored between the relaunch reading the track and showing it', async () => {
  const now = Date.now()
  const session: RecordingSession = {
    id: 7, startedAt: now - 60_000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: now - 60_000,
  }
  const stored: LiveTrackPoint[] = [{ lat: 45, lng: 6, ele: null, t: now - 5_000, segment: 0 }]
  let releaseRead!: () => void
  const read = new Promise<void>((resolve) => {
    releaseRead = resolve
  })
  repo.getActiveSession.mockResolvedValue(session)
  repo.getLastSegmentPoint.mockImplementation(async () => stored[stored.length - 1])
  repo.appendPoints.mockImplementation(async (_id, segment, points) => {
    stored.push(...points.map((p) => ({ lat: p.lat, lng: p.lng, ele: p.ele, t: p.t, segment })))
  })
  repo.getSessionPoints.mockImplementation(async () => {
    const snapshot = [...stored]
    await read
    return snapshot
  })

  const relaunch = resumeIfActive()
  await settle()
  expect(repo.getSessionPoints).toHaveBeenCalled()
  const fix: LocationFix = { lat: 45, lng: 6, ele: null, t: now, accuracy: 5 }
  const delivery = handleFixes([fix])
  await settle()
  releaseRead()
  await relaunch
  await delivery

  expect(useRecordingStore.getState().livePoints.map((p) => p.t)).toEqual([now - 5_000, now])
})
