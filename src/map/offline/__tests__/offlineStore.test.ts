import { useOfflineStore } from '../offlineStore'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const info = (id: string): OfflinePackInfo => ({ id, meta: null, state: 'complete', percentage: 100, sizeBytes: 1 })

const fakeController = (packs: OfflinePackInfo[]): OfflineController => ({
  downloadPack: async () => {},
  deletePack: async () => {},
  resumePack: async () => {},
  listPacks: async () => packs,
  subscribe: () => () => {},
})

beforeEach(() => useOfflineStore.setState({ packs: [], progress: {} }))

describe('offlineStore', () => {
  test('refreshPacks loads from the controller', async () => {
    await useOfflineStore.getState().refreshPacks(fakeController([info(packId(1, 'a'))]))
    expect(useOfflineStore.getState().packs).toHaveLength(1)
  })
  test('setProgress then clearProgress', () => {
    const id = packId(1, 'a')
    useOfflineStore.getState().setProgress(id, 30, false)
    expect(useOfflineStore.getState().progress[id]).toEqual({ percentage: 30, failed: false })
    useOfflineStore.getState().clearProgress(id)
    expect(useOfflineStore.getState().progress[id]).toBeUndefined()
  })
})
