import { packIdsForTrail, removeAllPacksForTrail } from '../operations'
import { packId } from '../packId'
import type { OfflineController, OfflinePackInfo } from '../../provider/types'

const info = (id: string): OfflinePackInfo => ({ id, meta: null, state: 'complete', percentage: 100, sizeBytes: 1 })

describe('packIdsForTrail', () => {
  test('returns only the target trail\'s pack ids', () => {
    const packs = [info(packId(1, 'a')), info(packId(1, 'b')), info(packId(2, 'a')), info('foreign')]
    expect(packIdsForTrail(packs, 1)).toEqual([packId(1, 'a'), packId(1, 'b')])
  })
})

describe('removeAllPacksForTrail', () => {
  test('deletes every pack belonging to the trail', async () => {
    const deleted: string[] = []
    const controller: OfflineController = {
      downloadPack: async () => {},
      deletePack: async (id) => { deleted.push(id) },
      resumePack: async () => {},
      listPacks: async () => [info(packId(5, 'a')), info(packId(5, 'b')), info(packId(6, 'a'))],
      subscribe: () => () => {},
    }
    await removeAllPacksForTrail(controller, 5)
    expect(deleted.sort()).toEqual([packId(5, 'a'), packId(5, 'b')])
  })
})
