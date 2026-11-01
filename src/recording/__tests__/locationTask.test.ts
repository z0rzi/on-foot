jest.mock('../../location', () => ({ defineBackgroundFixHandler: jest.fn() }))
jest.mock('../../log', () => ({ logEvent: jest.fn() }))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { getActiveSession: jest.fn(), getLastSegmentPoint: jest.fn(), appendPoints: jest.fn() },
}))

import type { LocationFix } from '../../location'
import type { RecordingSession, TrackPoint } from '../../data/activities'

const session: RecordingSession = {
  id: 7, startedAt: 1000, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 2, segmentStartedAt: 5000,
}
const fix = (t: number, accuracy: number | null = null, lat = 45, lng = 6): LocationFix => ({
  lat, lng, ele: 1200, t, accuracy,
})
const anchor: TrackPoint = { lat: 45, lng: 6, ele: 1200, t: 5500 }
// ~600 m north of the anchor.
const farLat = 45.0054

type Handler = (fixes: LocationFix[]) => Promise<void>
let handleFixes: Handler
let repo: jest.Mocked<typeof import('../../data/activities').activitiesRepository>
let logged: jest.MockedFunction<typeof import('../../log').logEvent>
let store: typeof import('../recordingStore').useRecordingStore

// The task module holds the recovery candidate between deliveries, so each test loads it afresh.
beforeEach(() => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs a synchronous load, and this jest setup rejects dynamic import() */
  jest.isolateModules(() => {
    const location: typeof import('../../location') = require('../../location')
    require('../locationTask')
    handleFixes = jest.mocked(location.defineBackgroundFixHandler).mock.calls[0][0]
    repo = jest.mocked((require('../../data/activities') as typeof import('../../data/activities')).activitiesRepository)
    logged = jest.mocked((require('../../log') as typeof import('../../log')).logEvent)
    store = (require('../recordingStore') as typeof import('../recordingStore')).useRecordingStore
  })
  /* eslint-enable @typescript-eslint/no-require-imports */
  repo.getActiveSession.mockResolvedValue(session)
  repo.getLastSegmentPoint.mockResolvedValue(null)
  store.setState({ session, livePoints: [] })
})

const batchSummaries = () => logged.mock.calls.filter((call) => call[2] === 'fix batch').map((call) => call[3])

it('stores and shows only the fixes taken after the segment began', async () => {
  await handleFixes([fix(4000), fix(6000)])
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(6000)])
  expect(store.getState().livePoints).toEqual([{ ...fix(6000), segment: 2 }])
})

it('appends nothing when every fix was taken before the segment began', async () => {
  await handleFixes([fix(4000)])
  expect(repo.appendPoints).not.toHaveBeenCalled()
  expect(store.getState().livePoints).toEqual([])
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

it('summarises the batch as arrived, kept and dropped before the segment', async () => {
  await handleFixes([fix(4000), fix(6000), fix(7000)])
  expect(batchSummaries()).toEqual([expect.objectContaining({ arrived: 3, kept: 2, droppedBeforeSegment: 1 })])
})

it('stores and shows only the fixes the gate kept', async () => {
  await handleFixes([fix(6000, 5), fix(7000, 383), fix(8000, 5)])
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(6000, 5), fix(8000, 5)])
  expect(store.getState().livePoints).toEqual([
    { ...fix(6000, 5), segment: 2 },
    { ...fix(8000, 5), segment: 2 },
  ])
})

it('appends nothing when the gate rejects every fix, and still logs why', async () => {
  await handleFixes([fix(6000, 383), fix(7000, 390)])
  expect(repo.appendPoints).not.toHaveBeenCalled()
  expect(store.getState().livePoints).toEqual([])
  expect(batchSummaries()).toEqual([
    expect.objectContaining({ arrived: 2, kept: 0, droppedAccuracy: 2, worstRejectedAccuracy: 390 }),
  ])
})

it('judges jumps from the last stored point of the current segment', async () => {
  repo.getLastSegmentPoint.mockResolvedValue(anchor)
  await handleFixes([fix(6000, 5, farLat), fix(7000, 5, 45.0001)])
  expect(repo.getLastSegmentPoint).toHaveBeenCalledWith(7, 2)
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(7000, 5, 45.0001)])
  expect(batchSummaries()).toEqual([
    expect.objectContaining({ droppedJump: 1, metresFromAnchor: 600 }),
  ])
})

it('re-anchors when a fix of the next delivery agrees with the candidate the previous one left', async () => {
  repo.getLastSegmentPoint.mockResolvedValue(anchor)
  await handleFixes([fix(6000, 8, farLat)])
  await handleFixes([fix(11_000, 8, farLat + 0.00009)])
  expect(repo.appendPoints).toHaveBeenCalledTimes(1)
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(11_000, 8, farLat + 0.00009)])
  expect(batchSummaries()[1]).toEqual(expect.objectContaining({ kept: 1, recovered: 1 }))
})

it('ignores a candidate left by another segment', async () => {
  repo.getLastSegmentPoint.mockResolvedValue(anchor)
  await handleFixes([fix(6000, 8, farLat)])
  repo.getActiveSession.mockResolvedValue({ ...session, currentSegment: 3 })
  await handleFixes([fix(11_000, 8, farLat + 0.00009)])
  expect(repo.appendPoints).not.toHaveBeenCalled()
  expect(batchSummaries()[1]).toEqual(expect.objectContaining({ kept: 0, droppedJump: 1, recovered: 0 }))
})

it('handles an overlapping delivery only once the previous one has finished', async () => {
  let releaseFirst: (value: RecordingSession) => void = () => {}
  repo.getActiveSession.mockReturnValueOnce(new Promise((resolve) => (releaseFirst = resolve)))
  const first = handleFixes([fix(6000)])
  const second = handleFixes([fix(7000)])
  await new Promise(setImmediate)
  expect(repo.getActiveSession).toHaveBeenCalledTimes(1)

  releaseFirst(session)
  await Promise.all([first, second])
  expect(repo.getActiveSession).toHaveBeenCalledTimes(2)
  expect(repo.appendPoints.mock.calls).toEqual([
    [7, 2, [fix(6000)]],
    [7, 2, [fix(7000)]],
  ])
})
