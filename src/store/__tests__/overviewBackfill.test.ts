jest.mock('../../log', () => ({
  ...jest.requireActual('../../log/errorClass'),
  ...jest.requireActual('../../log/oneDecimal'),
  logEvent: jest.fn(),
}))
jest.mock('../../async/nextFrame', () => ({ nextFrame: () => Promise.resolve() }))
jest.mock('../../data/trails', () => ({
  trailsRepository: { listOverviewRows: jest.fn(), listIdsWithoutOverview: jest.fn(), fillOverview: jest.fn() },
}))
jest.mock('../../data/activities', () => ({
  activitiesRepository: { listOverviewRows: jest.fn(), listIdsWithoutOverview: jest.fn(), fillOverview: jest.fn() },
}))

import { backfillOverviews } from '../overviewBackfill'
import { trailsRepository } from '../../data/trails'
import { activitiesRepository } from '../../data/activities'
import { logEvent } from '../../log'

const trails = jest.mocked(trailsRepository)
const activities = jest.mocked(activitiesRepository)
const log = jest.mocked(logEvent)

// Each row's fill is timed by two reads of the clock.
const clock = (...readings: number[]) => {
  const now = jest.spyOn(performance, 'now')
  for (const reading of readings) now.mockReturnValueOnce(reading)
}

beforeEach(() => {
  jest.restoreAllMocks()
  jest.clearAllMocks()
  trails.listOverviewRows.mockResolvedValue([])
  activities.listOverviewRows.mockResolvedValue([])
  trails.listIdsWithoutOverview.mockResolvedValue([])
  activities.listIdsWithoutOverview.mockResolvedValue([])
  trails.fillOverview.mockResolvedValue({ kind: 'filled' })
  activities.fillOverview.mockResolvedValue({ kind: 'filled' })
})

test('fills every row without an overview, and logs the pass once', async () => {
  trails.listIdsWithoutOverview.mockResolvedValue([1, 2])
  activities.listIdsWithoutOverview.mockResolvedValue([5])
  clock(0, 2, 10, 15.04, 20, 21)
  await backfillOverviews()
  expect(trails.fillOverview.mock.calls).toEqual([[1], [2]])
  expect(activities.fillOverview.mock.calls).toEqual([[5]])
  expect(log.mock.calls).toEqual([['info', 'map', 'overview backfill', { rows: 3, failed: 0, slowestMs: 5, ms: 8 }]])
})

test('with every row already filled, nothing is filled and nothing logged', async () => {
  await backfillOverviews()
  expect(trails.fillOverview).not.toHaveBeenCalled()
  expect(activities.fillOverview).not.toHaveBeenCalled()
  expect(log).not.toHaveBeenCalled()
})

test('an unreadable row is counted and logged once, with its error class and never its message', async () => {
  trails.listIdsWithoutOverview.mockResolvedValue([1, 2])
  trails.fillOverview.mockResolvedValueOnce({ kind: 'unreadable', error: new SyntaxError('45.123,6.456') })
  await backfillOverviews()
  expect(log.mock.calls[0]).toEqual(['warn', 'map', 'overview geometry unreadable', { kind: 'trail', errorClass: 'SyntaxError' }])
  expect(log.mock.calls[1][3]).toMatchObject({ rows: 2, failed: 1 })
})

test('a row deleted since it was listed is not counted', async () => {
  activities.listIdsWithoutOverview.mockResolvedValue([5, 6])
  activities.fillOverview.mockResolvedValueOnce({ kind: 'missing' })
  await backfillOverviews()
  expect(log.mock.calls[0][3]).toMatchObject({ rows: 1, failed: 0 })
})

test('the store reloads after each few rows and at the end, so the overview fills as it goes', async () => {
  trails.listIdsWithoutOverview.mockResolvedValue([1, 2, 3, 4, 5, 6])
  await backfillOverviews()
  expect(trails.listOverviewRows).toHaveBeenCalledTimes(2)
  expect(activities.listOverviewRows).not.toHaveBeenCalled()
})

test('a failing write stops the pass; the rows left are filled at the next start', async () => {
  trails.listIdsWithoutOverview.mockResolvedValue([1, 2, 3])
  trails.fillOverview.mockResolvedValueOnce({ kind: 'filled' }).mockRejectedValueOnce(new Error('disk I/O error'))
  await expect(backfillOverviews()).resolves.toBeUndefined()
  expect(trails.fillOverview).toHaveBeenCalledTimes(2)
  expect(log.mock.calls).toEqual([
    ['warn', 'map', 'overview backfill stopped', { rows: 1, failed: 0, errorClass: 'Error' }],
  ])
  expect(trails.listOverviewRows).toHaveBeenCalledTimes(1)
})

test('a failing listing stops the pass before any row', async () => {
  activities.listIdsWithoutOverview.mockRejectedValue(new Error('database is locked'))
  await expect(backfillOverviews()).resolves.toBeUndefined()
  expect(trails.fillOverview).not.toHaveBeenCalled()
  expect(log.mock.calls).toEqual([
    ['warn', 'map', 'overview backfill stopped', { rows: 0, failed: 0, errorClass: 'Error' }],
  ])
})
