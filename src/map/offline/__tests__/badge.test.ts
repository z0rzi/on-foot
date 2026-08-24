import { offlineStateForTrail } from '../badge'
import { packId } from '../packId'
import type { OfflinePackInfo } from '../../provider/types'

const complete = (trailId: number, styleId: string): OfflinePackInfo => ({
  id: packId(trailId, styleId), state: 'complete', percentage: 100, sizeBytes: 1,
})

describe('offlineStateForTrail', () => {
  test('no packs, no progress → none', () => {
    expect(offlineStateForTrail(1, [], {})).toEqual({ kind: 'none' })
  })
  test('complete packs → available with their style ids', () => {
    const state = offlineStateForTrail(1, [complete(1, 'outdoors'), complete(1, 'satellite')], {})
    expect(state).toEqual({ kind: 'available', styleIds: ['outdoors', 'satellite'] })
  })
  test('live progress for the trail → downloading with rounded average pct + style ids', () => {
    const state = offlineStateForTrail(1, [], {
      [packId(1, 'outdoors')]: { percentage: 40, failed: false },
      [packId(1, 'satellite')]: { percentage: 60, failed: false },
    })
    expect(state).toEqual({ kind: 'downloading', pct: 50, styleIds: ['outdoors', 'satellite'] })
  })
  test('a failed live entry → failed (beats available)', () => {
    const state = offlineStateForTrail(1, [complete(1, 'outdoors')], {
      [packId(1, 'satellite')]: { percentage: 10, failed: true },
    })
    expect(state).toEqual({ kind: 'failed' })
  })
  test('a pack in error state → failed', () => {
    const errored: OfflinePackInfo = { id: packId(1, 'x'), state: 'error', percentage: 5, sizeBytes: 0 }
    expect(offlineStateForTrail(1, [errored], {})).toEqual({ kind: 'failed' })
  })
  test('an at-rest incomplete pack (interrupted) → failed, not none', () => {
    const partial: OfflinePackInfo = { id: packId(1, 'outdoors'), state: 'incomplete', percentage: 30, sizeBytes: 5 }
    expect(offlineStateForTrail(1, [partial], {})).toEqual({ kind: 'failed' })
  })
  test('an at-rest error beats a concurrent live download for the trail', () => {
    const errored: OfflinePackInfo = { id: packId(1, 'outdoors'), state: 'error', percentage: 5, sizeBytes: 0 }
    const state = offlineStateForTrail(1, [errored], { [packId(1, 'satellite')]: { percentage: 40, failed: false } })
    expect(state).toEqual({ kind: 'failed' })
  })
  test('a pack actively downloading (live-tracked) is not treated as stalled', () => {
    const partial: OfflinePackInfo = { id: packId(1, 'outdoors'), state: 'incomplete', percentage: 40, sizeBytes: 5 }
    const state = offlineStateForTrail(1, [partial], { [packId(1, 'outdoors')]: { percentage: 40, failed: false } })
    expect(state).toEqual({ kind: 'downloading', pct: 40, styleIds: ['outdoors'] })
  })
  test('ignores other trails', () => {
    expect(offlineStateForTrail(2, [complete(1, 'outdoors')], {})).toEqual({ kind: 'none' })
  })
})
