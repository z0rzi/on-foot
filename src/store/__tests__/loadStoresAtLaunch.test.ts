jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))
jest.mock('../../data/trails', () => ({ trailsRepository: { listOverviewRows: jest.fn() } }))
jest.mock('../../data/activities', () => ({ activitiesRepository: { listOverviewRows: jest.fn() } }))

import { loadStoresAtLaunch } from '../loadStoresAtLaunch'
import { useTrailsStore } from '../trailsStore'
import { useActivitiesStore } from '../activitiesStore'
import { TrailOverviewRow, trailsRepository } from '../../data/trails'
import { ActivityOverviewRow, activitiesRepository } from '../../data/activities'
import { logEvent } from '../../log'

const trailsRepo = trailsRepository as jest.Mocked<typeof trailsRepository>
const activitiesRepo = activitiesRepository as jest.Mocked<typeof activitiesRepository>

const trail: TrailOverviewRow = {
  id: 1, name: 'T1', difficulty: 'easy',
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 }, createdAt: 1,
  overviewGeometry: null, start: null,
}
const activity: ActivityOverviewRow = {
  id: 2, name: 'A2', effort: 'easy',
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  linkedTrailId: null, startedAt: 2, createdAt: 2, overviewGeometry: null, start: null,
}

beforeEach(() => {
  jest.clearAllMocks()
  useTrailsStore.setState({ trails: [], version: 0 })
  useActivitiesStore.setState({ activities: [], version: 0 })
})

test('the launch load fills both stores', async () => {
  trailsRepo.listOverviewRows.mockResolvedValue([trail])
  activitiesRepo.listOverviewRows.mockResolvedValue([activity])
  await loadStoresAtLaunch()
  expect(useTrailsStore.getState().trails).toEqual([trail])
  expect(useActivitiesStore.getState().activities).toEqual([activity])
})

test('a store failing to load is logged and the other still loads', async () => {
  trailsRepo.listOverviewRows.mockRejectedValue(new Error('db'))
  activitiesRepo.listOverviewRows.mockResolvedValue([activity])
  await expect(loadStoresAtLaunch()).resolves.toBeUndefined()
  expect(useActivitiesStore.getState().activities).toEqual([activity])
  expect(logEvent).toHaveBeenCalledWith('warn', 'map', 'loading the trails at launch failed', { errorClass: 'Error' })
})
