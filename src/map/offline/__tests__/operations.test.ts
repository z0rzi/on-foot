import { packIdsForTrail } from '../operations'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const info = (id: string): OfflinePackInfo => ({ id, meta: null, state: 'complete', percentage: 100, sizeBytes: 1 })

describe('packIdsForTrail', () => {
  test('returns only the target trail\'s pack ids', () => {
    const packs = [info(packId(1, 'a')), info(packId(1, 'b')), info(packId(2, 'a')), info('foreign')]
    expect(packIdsForTrail(packs, 1)).toEqual([packId(1, 'a'), packId(1, 'b')])
  })
})
