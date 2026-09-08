import { planOfflineChanges, seedSelection, type PlanRow } from '../plan'

const row = (styleId: string, downloaded: boolean, estimateBytes: number | null = 100): PlanRow => ({
  styleId, downloaded, estimateBytes,
})

describe('planOfflineChanges', () => {
  test('a ticked, not-downloaded row is an add and counts its estimate', () => {
    const plan = planOfflineChanges([row('a', false, 250)], new Set(['a']))
    expect(plan).toEqual({ adds: ['a'], removes: [], toDownloadBytes: 250, hasChanges: true })
  })
  test('an unticked, downloaded row is a remove', () => {
    const plan = planOfflineChanges([row('a', true)], new Set())
    expect(plan).toEqual({ adds: [], removes: ['a'], toDownloadBytes: 0, hasChanges: true })
  })
  test('adds and removes together', () => {
    const plan = planOfflineChanges([row('a', false, 40), row('b', true), row('c', false, 60)], new Set(['a', 'c']))
    expect(plan).toEqual({ adds: ['a', 'c'], removes: ['b'], toDownloadBytes: 100, hasChanges: true })
  })
  test('no changes when ticks mirror the downloaded set', () => {
    const plan = planOfflineChanges([row('a', true), row('b', false)], new Set(['a']))
    expect(plan).toEqual({ adds: [], removes: [], toDownloadBytes: 0, hasChanges: false })
  })
  test('a ticked, already-downloaded row is not an add and adds no bytes', () => {
    const plan = planOfflineChanges([row('a', true, 500)], new Set(['a']))
    expect(plan.adds).toEqual([])
    expect(plan.toDownloadBytes).toBe(0)
  })
  test('an add with no estimate contributes 0 bytes but is still an add', () => {
    const plan = planOfflineChanges([row('a', false, null), row('b', false, 30)], new Set(['a', 'b']))
    expect(plan.adds).toEqual(['a', 'b'])
    expect(plan.toDownloadBytes).toBe(30)
  })
})

describe('seedSelection', () => {
  test('ticks the downloaded layers when there are any', () => {
    expect(seedSelection(['a', 'b'], 'c')).toEqual(new Set(['a', 'b']))
  })
  test('falls back to the current style when nothing is downloaded', () => {
    expect(seedSelection([], 'c')).toEqual(new Set(['c']))
  })
})
