jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    listOverviewRows: jest.fn(),
    getActivity: jest.fn(),
    saveActivity: jest.fn(),
    deleteActivity: jest.fn(),
  },
}))

import { useActivitiesStore } from '../activitiesStore'
import { activitiesRepository, ActivityOverviewRow, NewActivityInput } from '../../data/activities'

const fakeRepo = activitiesRepository as jest.Mocked<typeof activitiesRepository>

const summary = (id: number): ActivityOverviewRow => ({
  id, name: `A${id}`, effort: 'easy',
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  linkedTrailId: null, startedAt: id, createdAt: id, overviewGeometry: null, start: null,
})
const input: NewActivityInput = {
  name: 'New', effort: 'moderate', comments: null, linkedTrailId: null,
  geometry: { segments: [] },
  metrics: { distanceMeters: 1, durationSeconds: 1, elevationGainMeters: 0, elevationLossMeters: 0 },
  startedAt: 1, endedAt: 2,
}

beforeEach(() => {
  jest.clearAllMocks()
  useActivitiesStore.setState({ activities: [], version: 0 })
})

test('loadActivities caches summaries from the repository', async () => {
  fakeRepo.listOverviewRows.mockResolvedValue([summary(2), summary(1)])
  await useActivitiesStore.getState().loadActivities()
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2, 1])
})

test('removeActivity deletes via the repository and reloads the cache', async () => {
  useActivitiesStore.setState({ activities: [summary(1), summary(2)] })
  fakeRepo.deleteActivity.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(2)])
  await useActivitiesStore.getState().removeActivity(1)
  expect(fakeRepo.deleteActivity).toHaveBeenCalledWith(1)
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2])
})

test('loadActivities leaves the mutation version unchanged', async () => {
  fakeRepo.listOverviewRows.mockResolvedValue([summary(1)])
  await useActivitiesStore.getState().loadActivities()
  await useActivitiesStore.getState().loadActivities()
  expect(useActivitiesStore.getState().version).toBe(0)
})

test('saveActivity bumps the mutation version', async () => {
  fakeRepo.saveActivity.mockResolvedValue(7)
  fakeRepo.listOverviewRows.mockResolvedValue([summary(7)])
  await useActivitiesStore.getState().saveActivity(3, input)
  expect(useActivitiesStore.getState().version).toBe(1)
})

test('removeActivity bumps the mutation version', async () => {
  fakeRepo.deleteActivity.mockResolvedValue(undefined)
  fakeRepo.listOverviewRows.mockResolvedValue([])
  await useActivitiesStore.getState().removeActivity(1)
  expect(useActivitiesStore.getState().version).toBe(1)
})

test('of two overlapping loads, the later one is what the store keeps', async () => {
  let landEarlier: (rows: ActivityOverviewRow[]) => void = () => {}
  fakeRepo.listOverviewRows
    .mockReturnValueOnce(new Promise((resolve) => { landEarlier = resolve }))
    .mockResolvedValueOnce([summary(2)])
  const earlier = useActivitiesStore.getState().loadActivities()
  await useActivitiesStore.getState().loadActivities()
  landEarlier([summary(1), summary(2)])
  await earlier
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2])
})
