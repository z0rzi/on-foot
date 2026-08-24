import { groupPacksByTrail, totalOfflineBytes } from '../grouping'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const pack = (trailId: number, styleId: string, sizeBytes: number): OfflinePackInfo => ({
  id: packId(trailId, styleId),
  state: 'complete',
  percentage: 100,
  sizeBytes,
})

describe('groupPacksByTrail', () => {
  test('groups a trail\'s layers with a per-group total', () => {
    const groups = groupPacksByTrail(
      [pack(1, 'outdoors', 45), pack(1, 'satellite', 375)],
      [{ id: 1, name: 'Lac Blanc' }],
    )
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ trailId: 1, trailName: 'Lac Blanc', totalBytes: 420 })
    expect(groups[0].layers).toEqual([
      { styleId: 'outdoors', sizeBytes: 45 },
      { styleId: 'satellite', sizeBytes: 375 },
    ])
  })
  test('a pack whose trail is gone groups under a null name', () => {
    const groups = groupPacksByTrail([pack(9, 'outdoors', 10)], [])
    expect(groups[0]).toMatchObject({ trailId: 9, trailName: null })
  })
  test('skips foreign (unparseable) pack names', () => {
    const foreign: OfflinePackInfo = { id: 'x', state: 'complete', percentage: 100, sizeBytes: 5 }
    expect(groupPacksByTrail([foreign], [])).toEqual([])
  })
  test('empty → []', () => expect(groupPacksByTrail([], [])).toEqual([]))
})

describe('totalOfflineBytes', () => {
  test('sums all pack sizes', () => {
    expect(totalOfflineBytes([pack(1, 'a', 10), pack(2, 'b', 32)])).toBe(42)
  })
})
