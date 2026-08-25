import { packIdsForTrail, retryTargetsForTrail } from '../operations'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const info = (id: string, state: OfflinePackInfo['state'] = 'complete'): OfflinePackInfo => ({
  id, state, percentage: 100, sizeBytes: 1,
})

describe('packIdsForTrail', () => {
  test('returns only the target trail\'s pack ids', () => {
    const packs = [info(packId(1, 'a')), info(packId(1, 'b')), info(packId(2, 'a')), info('foreign')]
    expect(packIdsForTrail(packs, 1)).toEqual([packId(1, 'a'), packId(1, 'b')])
  })
})

describe('retryTargetsForTrail', () => {
  test('an at-rest incomplete pack → retry, hasPack true (resume)', () => {
    const targets = retryTargetsForTrail([info(packId(1, 'a'), 'incomplete')], {}, 1)
    expect(targets).toEqual([{ id: packId(1, 'a'), styleId: 'a', hasPack: true }])
  })
  test('a failed live entry with no pack → retry, hasPack false (re-download)', () => {
    const targets = retryTargetsForTrail([], { [packId(1, 'a')]: { percentage: 0, failed: true } }, 1)
    expect(targets).toEqual([{ id: packId(1, 'a'), styleId: 'a', hasPack: false }])
  })
  test('does not retry a complete pack', () => {
    expect(retryTargetsForTrail([info(packId(1, 'a'), 'complete')], {}, 1)).toEqual([])
  })
  test('dedupes a layer that is both failed-in-progress and incomplete-in-registry', () => {
    const targets = retryTargetsForTrail(
      [info(packId(1, 'a'), 'incomplete')],
      { [packId(1, 'a')]: { percentage: 0, failed: true } },
      1,
    )
    expect(targets).toEqual([{ id: packId(1, 'a'), styleId: 'a', hasPack: true }])
  })
  test('ignores other trails and foreign ids', () => {
    const packs = [info(packId(2, 'a'), 'incomplete'), info('foreign', 'error')]
    expect(retryTargetsForTrail(packs, {}, 1)).toEqual([])
  })
})
