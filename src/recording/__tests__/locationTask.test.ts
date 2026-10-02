jest.mock('../../location', () => ({ defineBackgroundFixHandler: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { getActiveSession: jest.fn(), appendPoints: jest.fn() },
}))

import { defineBackgroundFixHandler } from '../../location'
import type { LocationFix } from '../../location'
import { activitiesRepository } from '../../data/activities'
import type { RecordingSession } from '../../data/activities'
import { useRecordingStore } from '../recordingStore'
import '../locationTask'

const handleFixes = jest.mocked(defineBackgroundFixHandler).mock.calls[0][0]
const repo = jest.mocked(activitiesRepository)

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 2, segmentStartedAt: 5000,
}
const fix = (t: number): LocationFix => ({ lat: 45, lng: 6, ele: 1200, t, accuracy: null })

beforeEach(() => {
  repo.getActiveSession.mockResolvedValue(session)
  repo.appendPoints.mockReset()
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
