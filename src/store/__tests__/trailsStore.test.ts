jest.mock('../../data/trails', () => ({
  trailsRepository: {
    listOverviewRows: jest.fn(),
    getTrail: jest.fn(),
    createTrail: jest.fn(),
    updateTrail: jest.fn(),
    deleteTrail: jest.fn(),
  },
}))

jest.mock('../../data/activities', () => ({
  activitiesRepository: { listOverviewRows: jest.fn() },
}))

import { useTrailsStore } from '../trailsStore'
import { useActivitiesStore } from '../activitiesStore'
import { NewTrailInput, TrailOverviewRow } from '../../data/trails/types'
import { trailsRepository } from '../../data/trails'
import { ActivityOverviewRow, activitiesRepository } from '../../data/activities'

const fakeRepo = trailsRepository as jest.Mocked<typeof trailsRepository>
const fakeActivitiesRepo = activitiesRepository as jest.Mocked<typeof activitiesRepository>

const summary = (id: number): TrailOverviewRow => ({
  id, name: `T${id}`, difficulty: 'easy',
  metrics: { distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  createdAt: id, overviewGeometry: null, start: null,
})
const activitySummary = (id: number, linkedTrailId: number | null): ActivityOverviewRow => ({
  id, name: `A${id}`, effort: 'easy',
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  linkedTrailId, startedAt: id, createdAt: id, overviewGeometry: null, start: null,
})
const input: NewTrailInput = {
  name: 'New', difficulty: 'medium', description: null,
  metrics: { distanceMeters: 1, elevationGainMeters: 0, elevationLossMeters: 0 },
  geometry: { segments: [], waypoints: [] },
}

beforeEach(() => {
  jest.clearAllMocks()
  useTrailsStore.setState({ trails: [], version: 0, loaded: false })
  useActivitiesStore.setState({ activities: [], version: 0 })
  fakeActivitiesRepo.listOverviewRows.mockResolvedValue([])
})

test('loadTrails caches summaries from the repository', async () => {
  fakeRepo.listOverviewRows.mockResolvedValue([summary(2), summary(1)])
  await useTrailsStore.getState().loadTrails()
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2, 1])
})

test('is loaded once a load has read the list, and not after a failed one', async () => {
  fakeRepo.listOverviewRows.mockRejectedValueOnce(new Error('disk'))
  await expect(useTrailsStore.getState().loadTrails()).rejects.toThrow('disk')
  expect(useTrailsStore.getState().loaded).toBe(false)
  fakeRepo.listOverviewRows.mockResolvedValue([])
  await useTrailsStore.getState().loadTrails()
  expect(useTrailsStore.getState().loaded).toBe(true)
})

test('addTrail creates via the repository, reloads, and returns the new id', async () => {
  fakeRepo.createTrail.mockResolvedValue(42)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(42)])
  const id = await useTrailsStore.getState().addTrail(input)
  expect(id).toBe(42)
  expect(fakeRepo.createTrail).toHaveBeenCalledWith(input)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([42])
})

test('removeTrail deletes via the repository and reloads the cache', async () => {
  useTrailsStore.setState({ trails: [summary(1), summary(2)] })
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(2)])
  await useTrailsStore.getState().removeTrail(1)
  expect(fakeRepo.deleteTrail).toHaveBeenCalledWith(1)
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2])
})

test('loadTrails leaves the mutation version unchanged', async () => {
  fakeRepo.listOverviewRows.mockResolvedValue([summary(1)])
  await useTrailsStore.getState().loadTrails()
  await useTrailsStore.getState().loadTrails()
  expect(useTrailsStore.getState().version).toBe(0)
})

test('addTrail bumps the mutation version', async () => {
  fakeRepo.createTrail.mockResolvedValue(42)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(42)])
  await useTrailsStore.getState().addTrail(input)
  expect(useTrailsStore.getState().version).toBe(1)
})

test('updateTrail bumps the mutation version', async () => {
  fakeRepo.updateTrail.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(1)])
  await useTrailsStore.getState().updateTrail(1, { name: 'Renamed', difficulty: 'hard', description: 'note' })
  expect(useTrailsStore.getState().version).toBe(1)
})

test('removeTrail bumps the mutation version', async () => {
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([])
  await useTrailsStore.getState().removeTrail(1)
  expect(useTrailsStore.getState().version).toBe(1)
})

test('removeTrail publishes the activity links it cleared', async () => {
  fakeActivitiesRepo.listOverviewRows.mockResolvedValue([activitySummary(5, null)])
  useActivitiesStore.setState({ activities: [activitySummary(5, 43)], version: 0 })
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([])
  await useTrailsStore.getState().removeTrail(43)
  expect(useActivitiesStore.getState()).toMatchObject({ version: 1, activities: [activitySummary(5, null)] })
})

test('removeTrail still reloads the trails when the activities reload fails', async () => {
  fakeActivitiesRepo.listOverviewRows.mockRejectedValue(new Error('db'))
  fakeRepo.deleteTrail.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([])
  await expect(useTrailsStore.getState().removeTrail(1)).rejects.toThrow('db')
  expect(useTrailsStore.getState().version).toBe(1)
})

test('of two overlapping loads, the later one is what the store keeps', async () => {
  let landEarlier: (rows: TrailOverviewRow[]) => void = () => {}
  fakeRepo.listOverviewRows
    .mockReturnValueOnce(new Promise((resolve) => { landEarlier = resolve }))
    .mockResolvedValueOnce([summary(2)])
  const earlier = useTrailsStore.getState().loadTrails()
  await useTrailsStore.getState().loadTrails()
  landEarlier([summary(1), summary(2)])
  await earlier
  expect(useTrailsStore.getState().trails.map((t) => t.id)).toEqual([2])
})
