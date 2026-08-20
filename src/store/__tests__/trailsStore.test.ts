jest.mock('../../data/trails', () => ({
  trailsRepository: {
    listSummaries: jest.fn(),
    getTrail: jest.fn(),
    createTrail: jest.fn(),
    deleteTrail: jest.fn(),
  },
}))

import { useTrailsStore } from '../trailsStore'
import { NewTrailInput, TrailSummary } from '../../data/trails/types'
import { trailsRepository } from '../../data/trails'

const fakeRepo = trailsRepository as jest.Mocked<typeof trailsRepository>

const summary = (id: number): TrailSummary => ({
  id, name: `T${id}`, difficulty: 'easy',
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  createdAt: id,
})
const input: NewTrailInput = {
  name: 'New', difficulty: 'medium', description: null,
  metrics: { distanceMeters: 1, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { points: [], waypoints: [] },
}

beforeEach(() => {
  jest.clearAllMocks()
  useTrailsStore.setState({ trails: [], loading: false })
})

test('loadTrails caches summaries from the repository', async () => {
  fakeRepo.listSummaries.mockResolvedValue([summary(2), summary(1)])
  await useTrailsStore.getState().loadTrails()
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2, 1])
  expect(useTrailsStore.getState().loading).toBe(false)
})

test('addTrail creates via the repository, reloads, and returns the new id', async () => {
  fakeRepo.createTrail.mockResolvedValue(42)
  fakeRepo.listSummaries.mockResolvedValue([summary(42)])
  const id = await useTrailsStore.getState().addTrail(input)
  expect(id).toBe(42)
  expect(fakeRepo.createTrail).toHaveBeenCalledWith(input)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([42])
})

test('removeTrail deletes via the repository and drops it from the cache', async () => {
  useTrailsStore.setState({ trails: [summary(1), summary(2)] })
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  await useTrailsStore.getState().removeTrail(1)
  expect(fakeRepo.deleteTrail).toHaveBeenCalledWith(1)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2])
})
