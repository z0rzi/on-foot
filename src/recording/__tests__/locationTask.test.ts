jest.mock('../../location', () => ({ defineBackgroundFixHandler: jest.fn() }))
jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { getActiveSession: jest.fn(), appendPoints: jest.fn() },
}))

import { defineBackgroundFixHandler } from '../../location'
import { logEvent } from '../../log'
import type { LocationFix } from '../../location'
import { activitiesRepository } from '../../data/activities'
import type { RecordingSession } from '../../data/activities'
import { useRecordingStore } from '../recordingStore'
import '../locationTask'

const handleFixes = jest.mocked(defineBackgroundFixHandler).mock.calls[0][0]
const repo = jest.mocked(activitiesRepository)
const logged = jest.mocked(logEvent)

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 2, segmentStartedAt: 5000,
}
const fix = (t: number): LocationFix => ({ lat: 45, lng: 6, ele: 1200, t, accuracy: null })

beforeEach(() => {
  repo.getActiveSession.mockResolvedValue(session)
  repo.appendPoints.mockReset()
  logged.mockClear()
  useRecordingStore.setState({ session, livePoints: [] })
})

it('stores and shows only the fixes taken after the segment began', async () => {
  await handleFixes([fix(4000), fix(6000)])
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(6000)])
  expect(useRecordingStore.getState().livePoints).toEqual([{ ...fix(6000), segment: 2 }])
})

it('appends nothing when every fix was taken before the segment began', async () => {
  await handleFixes([fix(4000)])
  expect(repo.appendPoints).not.toHaveBeenCalled()
  expect(useRecordingStore.getState().livePoints).toEqual([])
})

it('says the session is paused, rather than missing, when fixes arrive for a paused one', async () => {
  repo.getActiveSession.mockResolvedValue({ ...session, pausedAt: 6000 })
  await handleFixes([fix(6000)])
  expect(logged).toHaveBeenCalledWith('info', 'capture', 'fixes ignored, session paused', { arrived: 1 })
})

it('warns when a batch arrives with no session at all', async () => {
  repo.getActiveSession.mockResolvedValue(null)
  await handleFixes([fix(6000)])
  expect(logged).toHaveBeenCalledWith('warn', 'capture', 'fixes ignored, no session', { arrived: 1 })
})

it('summarises the batch as arrived, kept and dropped', async () => {
  await handleFixes([fix(4000), fix(6000), fix(7000)])
  expect(logged).toHaveBeenCalledWith(
    'info',
    'capture',
    'fix batch',
    expect.objectContaining({ arrived: 3, kept: 2, dropped: 1 }),
  )
})
