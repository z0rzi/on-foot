jest.mock('../../data/activities', () => ({
  activitiesRepository: {
    listSummaries: jest.fn(),
    getActivity: jest.fn(),
    saveActivity: jest.fn(),
    deleteActivity: jest.fn(),
  },
}))

import { useActivitiesStore } from '../activitiesStore'
import { ActivitySummary } from '../../data/activities/types'
import { activitiesRepository } from '../../data/activities'

const fakeRepo = activitiesRepository as jest.Mocked<typeof activitiesRepository>

const summary = (id: number): ActivitySummary => ({
  id, name: `A${id}`, effort: 'easy',
  metrics: { distanceMeters: 0, durationSeconds: 0, elevationGainMeters: 0, elevationLossMeters: 0 },
  linkedTrailId: null, startedAt: id, createdAt: id,
})

beforeEach(() => {
  jest.clearAllMocks()
  useActivitiesStore.setState({ activities: [] })
})

test('loadActivities caches summaries from the repository', async () => {
  fakeRepo.listSummaries.mockResolvedValue([summary(2), summary(1)])
  await useActivitiesStore.getState().loadActivities()
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2, 1])
})

test('removeActivity deletes via the repository and reloads the cache', async () => {
  useActivitiesStore.setState({ activities: [summary(1), summary(2)] })
  fakeRepo.deleteActivity.mockResolvedValue(undefined)
  fakeRepo.listSummaries.mockResolvedValue([summary(2)])
  await useActivitiesStore.getState().removeActivity(1)
  expect(fakeRepo.deleteActivity).toHaveBeenCalledWith(1)
  expect(useActivitiesStore.getState().activities.map((a) => a.id)).toEqual([2])
})
