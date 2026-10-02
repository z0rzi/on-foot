import { fixBatchSummary } from '../fixBatchSummary'

const fix = (t: number, accuracy: number | null, lat = 45.1, lng = 6.1) => ({ lat, lng, ele: 1000, t, accuracy })

describe('fixBatchSummary', () => {
  it('reports what arrived, what was kept and what was dropped', () => {
    const arrived = [fix(1_700_000_000_000, 8), fix(1_700_000_030_000, 12)]
    const kept = [arrived[1]]

    expect(fixBatchSummary(arrived, kept, null)).toEqual(
      expect.objectContaining({ arrived: 2, kept: 1, dropped: 1 }),
    )
  })

  it('reports the first and last time to the second', () => {
    const arrived = [
      fix(new Date(2026, 9, 2, 9, 15, 0).getTime(), 5),
      fix(new Date(2026, 9, 2, 9, 17, 30).getTime(), 5),
    ]
    const summary = fixBatchSummary(arrived, arrived, null)

    expect(summary.firstAt).toBe('09:15:00')
    expect(summary.lastAt).toBe('09:17:30')
  })

  it('reports the best accuracy in the batch, and null when none is known', () => {
    expect(fixBatchSummary([fix(1, 20), fix(2, 7)], [], null).bestAccuracy).toBe(7)
    expect(fixBatchSummary([fix(1, null)], [], null).bestAccuracy).toBeNull()
  })

  it('reports whole metres from the previous stored point', () => {
    const kept = [fix(1, 5, 45.0, 6.0)]
    const summary = fixBatchSummary(kept, kept, { lat: 45.001, lng: 6.0 })

    expect(summary.metresFromPrevious).toBe(111)
  })

  it('has no distance to report with no previous point', () => {
    const kept = [fix(1, 5)]
    expect(fixBatchSummary(kept, kept, null).metresFromPrevious).toBeNull()
  })

  it('carries no coordinate, so the log can never place the user', () => {
    const kept = [fix(1, 5, 45.123456, 6.654321)]
    const serialised = JSON.stringify(fixBatchSummary(kept, kept, { lat: 45.2, lng: 6.7 }))

    expect(serialised).not.toContain('45.1')
    expect(serialised).not.toContain('6.65')
    expect(serialised).not.toMatch(/lat|lng/i)
  })

  it('is empty-safe for a delivery that arrived with nothing', () => {
    expect(fixBatchSummary([], [], null)).toEqual(
      expect.objectContaining({ arrived: 0, kept: 0, dropped: 0, firstAt: null, lastAt: null }),
    )
  })
})
