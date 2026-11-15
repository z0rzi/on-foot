jest.mock('../../location', () => ({ defineBackgroundFixHandler: jest.fn() }))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
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
let reportFault: (fault: 'error' | 'empty', error?: string) => void
let repo: jest.Mocked<typeof import('../../data/activities').activitiesRepository>
let logged: jest.MockedFunction<typeof import('../../log').logEvent>
let store: typeof import('../recordingStore').useRecordingStore

// The task module holds the recovery candidate between deliveries, so each test loads it afresh.
beforeEach(() => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.isolateModules needs a synchronous load, and this jest setup rejects dynamic import() */
  jest.isolateModules(() => {
    const location: typeof import('../../location') = require('../../location')
    require('../locationTask')
    const defined = jest.mocked(location.defineBackgroundFixHandler).mock.calls[0]
    handleFixes = defined[0]
    reportFault = defined[1]
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

it('stores a delivery in a runtime that has not shown the recording, and leaves it unshown', async () => {
  store.setState({ session: null, livePoints: [] })
  await handleFixes([fix(6000)])
  expect(repo.appendPoints).toHaveBeenCalledWith(7, 2, [fix(6000)])
  expect(store.getState().session).toBeNull()
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

it('logs a batch it could not store, and keeps neither its points nor its candidate', async () => {
  repo.getLastSegmentPoint.mockResolvedValue(anchor)
  repo.appendPoints.mockRejectedValueOnce(new TypeError('disk full'))
  await handleFixes([fix(6000, 5, 45.0001), fix(7000, 8, farLat)])
  expect(logged).toHaveBeenCalledWith(
    'warn',
    'capture',
    'fix batch not stored',
    expect.objectContaining({ arrived: 2, kept: 1, droppedJump: 1, errorClass: 'TypeError' }),
  )
  expect(batchSummaries()).toEqual([])
  expect(store.getState().livePoints).toEqual([])

  await handleFixes([fix(11_000, 8, farLat + 0.00009)])
  expect(batchSummaries()).toEqual([expect.objectContaining({ kept: 0, droppedJump: 1, recovered: 0 })])
})

it('logs only the arrived count of a batch whose session could not be read', async () => {
  repo.getActiveSession.mockRejectedValueOnce(new TypeError('db gone'))
  await handleFixes([fix(6000)])
  expect(logged).toHaveBeenCalledWith('warn', 'capture', 'fix batch not stored', { arrived: 1, errorClass: 'TypeError' })
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

it('logs a delivery the port could not read, with the fault and the error', () => {
  reportFault('error', 'task failed')
  reportFault('empty')
  expect(logged).toHaveBeenCalledWith('warn', 'capture', 'delivery fault', { fault: 'error', error: 'task failed' })
  expect(logged).toHaveBeenCalledWith('warn', 'capture', 'delivery fault', { fault: 'empty', error: undefined })
})

describe('a delivery whose turn never settles', () => {
  const waitingEntries = () => logged.mock.calls.filter((call) => call[2] === 'delivery waiting').map((call) => call[3])
  let now: jest.SpyInstance<number, []>

  beforeEach(() => {
    now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
    repo.getActiveSession.mockReturnValueOnce(new Promise(() => {}))
    void handleFixes([fix(6000)])
  })
  afterEach(() => now.mockRestore())

  it('says nothing of a delivery arriving within 10 s of it', () => {
    now.mockReturnValue(1_009_000)
    void handleFixes([fix(7000)])
    expect(waitingEntries()).toEqual([])
  })

  it('logs each later delivery as waiting, at most once per 30 s, with no position', () => {
    now.mockReturnValue(1_011_000)
    void handleFixes([fix(7000)])
    now.mockReturnValue(1_020_000)
    void handleFixes([fix(8000)])
    now.mockReturnValue(1_045_000)
    void handleFixes([fix(9000)])
    expect(waitingEntries()).toEqual([
      { waiting: 1, oldestS: 11 },
      { waiting: 3, oldestS: 45 },
    ])
  })
})

it('counts a settled delivery as waiting no longer', async () => {
  const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000)
  await handleFixes([fix(6000)])
  now.mockReturnValue(1_060_000)
  await handleFixes([fix(7000)])
  now.mockRestore()
  expect(logged.mock.calls.filter((call) => call[2] === 'delivery waiting')).toEqual([])
})
