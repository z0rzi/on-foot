const mockRemoveActivity = jest.fn()

jest.mock('../../store/activitiesStore', () => ({
  useActivitiesStore: { getState: () => ({ removeActivity: mockRemoveActivity }) },
}))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import { logEvent } from '../../log'
import { useMapStore } from '../../store/mapStore'
import { deleteActivity } from '../deleteActivity'

beforeEach(() => {
  jest.clearAllMocks()
  useMapStore.getState().select('activity', 5)
})

describe('deleteActivity', () => {
  it('removes the activity, then forgets it on the map', async () => {
    mockRemoveActivity.mockImplementation(async () => {
      expect(useMapStore.getState().selection).toMatchObject({ kind: 'activity', id: 5 })
    })
    await deleteActivity(5)
    expect(mockRemoveActivity).toHaveBeenCalledWith(5)
    expect(useMapStore.getState().selection).toBeNull()
  })

  it('keeps the activity shown and logs when the delete fails', async () => {
    mockRemoveActivity.mockRejectedValue(new TypeError('disk full'))
    await expect(deleteActivity(5)).rejects.toThrow('disk full')
    expect(useMapStore.getState().selection).toMatchObject({ kind: 'activity', id: 5 })
    expect(logEvent).toHaveBeenCalledWith('error', 'error', 'deleting the activity failed', { errorClass: 'TypeError' })
  })
})
