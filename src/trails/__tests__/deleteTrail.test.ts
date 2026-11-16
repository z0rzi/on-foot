const mockSteps: string[] = []
const mockRemoveTrail = jest.fn()
const mockAlongTrailId = jest.fn()

jest.mock('../../store/trailsStore', () => ({
  useTrailsStore: { getState: () => ({ removeTrail: mockRemoveTrail }) },
}))
jest.mock('../../recording/currentAlongTrail', () => ({ currentAlongTrailId: () => mockAlongTrailId() }))
jest.mock('../../log', () => ({ ...jest.requireActual('../../log/errorClass'), logEvent: jest.fn() }))

import { logEvent } from '../../log'
import { useMapStore } from '../../store/mapStore'
import { useOfflineStore } from '../../map/offline/offlineStore'
import { packId } from '../../map/offline/packId'
import type { OfflineController, OfflinePackInfo } from '../../map/provider/types'
import { deleteTrail } from '../deleteTrail'

const pack = (id: string): OfflinePackInfo => ({ id, state: 'complete', percentage: 100, sizeBytes: 1 })

const controller: OfflineController = {
  downloadPack: async () => {},
  resumePack: async () => {},
  deletePack: async (id) => { mockSteps.push(`pack ${id}`) },
  listPacks: async () => [],
  subscribe: () => () => {},
}

const selectionStep = () => {
  const selection = useMapStore.getState().selection
  return selection ? `${selection.kind} ${selection.id} shown` : 'nothing shown'
}

beforeEach(() => {
  jest.clearAllMocks()
  mockSteps.length = 0
  mockAlongTrailId.mockReturnValue(null)
  mockRemoveTrail.mockImplementation(async (id: number) => { mockSteps.push(`trail ${id}`, selectionStep()) })
  useOfflineStore.setState({ packs: [pack(packId(3, 'outdoors')), pack(packId(4, 'outdoors'))], progress: {} })
  useMapStore.getState().select('trail', 3)
})

describe('deleteTrail', () => {
  it('removes the offline map, then the trail, then forgets the trail on the map', async () => {
    await deleteTrail(controller, 3)
    mockSteps.push(selectionStep())
    expect(mockSteps).toEqual([`pack ${packId(3, 'outdoors')}`, 'trail 3', 'trail 3 shown', 'nothing shown'])
  })

  it('says whether the recording was following the trail', async () => {
    mockAlongTrailId.mockReturnValue(3)
    expect(await deleteTrail(controller, 3)).toEqual({ wasRecordedAlong: true })
    mockAlongTrailId.mockReturnValue(4)
    expect(await deleteTrail(controller, 3)).toEqual({ wasRecordedAlong: false })
  })

  it('keeps the trail shown and logs when the delete fails', async () => {
    mockRemoveTrail.mockRejectedValue(new TypeError('disk full'))
    await expect(deleteTrail(controller, 3)).rejects.toThrow('disk full')
    expect(selectionStep()).toBe('trail 3 shown')
    expect(logEvent).toHaveBeenCalledWith('error', 'error', 'deleting the trail failed', { errorClass: 'TypeError' })
  })
})
