import { fixBatchSummary } from '../fixBatchSummary'
import type { GateResult } from '../fixGate'
import type { LocationFix } from '../../location'

const fix = (t: number, accuracy: number | null, lat = 45.1, lng = 6.1): LocationFix => ({
  lat, lng, ele: 1000, t, accuracy,
})

const gate = (overrides: Partial<GateResult> = {}): GateResult => ({
  kept: [],
  candidate: null,
  droppedAccuracy: 0,
  droppedJump: 0,
  recovered: 0,
  worstRejectedAccuracy: null,
  worstJump: null,
  ...overrides,
})

describe('fixBatchSummary', () => {
  it('reports what arrived, what was kept and what was dropped before the segment', () => {
    const arrived = [fix(1_700_000_000_000, 8), fix(1_700_000_030_000, 12), fix(1_700_000_060_000, 12)]
    const inSegment = arrived.slice(1)

    expect(fixBatchSummary(arrived, inSegment, gate({ kept: [arrived[2]] }), null)).toEqual(
      expect.objectContaining({ arrived: 3, kept: 1, droppedBeforeSegment: 1 }),
    )
  })

  it('reports why the gate dropped fixes, its worst jump in whole metres, and how many it recovered', () => {
    const summary = fixBatchSummary(
      [],
      [],
      gate({
        droppedAccuracy: 2,
        droppedJump: 1,
        recovered: 1,
        worstRejectedAccuracy: 390,
        worstJump: { metres: 674.6, allowedMetres: 100.2, seconds: 5.02 },
      }),
      null,
    )

    expect(summary).toEqual(
      expect.objectContaining({
        droppedAccuracy: 2,
        droppedJump: 1,
        recovered: 1,
        worstRejectedAccuracy: 390,
        worstJump: { metres: 675, allowedMetres: 100, seconds: 5.02 },
      }),
    )
  })

  it('reports no worst figures when the gate rejected nothing', () => {
    const summary = fixBatchSummary([], [], gate(), null)

    expect(summary.worstRejectedAccuracy).toBeNull()
    expect(summary.worstJump).toBeNull()
  })

  it('reports the first and last time to the second', () => {
    const arrived = [
      fix(new Date(2026, 9, 2, 9, 15, 0).getTime(), 5),
      fix(new Date(2026, 9, 2, 9, 17, 30).getTime(), 5),
    ]
    const summary = fixBatchSummary(arrived, arrived, gate({ kept: arrived }), null)

    expect(summary.firstAt).toBe('09:15:00')
    expect(summary.lastAt).toBe('09:17:30')
  })

  it('reports the best accuracy in the batch, and null when none is known', () => {
    expect(fixBatchSummary([fix(1, 20), fix(2, 7)], [], gate(), null).bestAccuracy).toBe(7)
    expect(fixBatchSummary([fix(1, null)], [], gate(), null).bestAccuracy).toBeNull()
  })

  it('reports whole metres from the anchor to the first fix in the segment, even one the gate rejected', () => {
    const rejected = fix(2, 383, 45.001, 6.0)
    const summary = fixBatchSummary([rejected], [rejected], gate({ droppedAccuracy: 1 }), {
      lat: 45.0, lng: 6.0, t: 1,
    })

    expect(summary.metresFromAnchor).toBe(111)
  })

  it('has no distance to report with no anchor', () => {
    const inSegment = [fix(1, 5)]
    expect(fixBatchSummary(inSegment, inSegment, gate({ kept: inSegment }), null).metresFromAnchor).toBeNull()
  })

  it('has no distance to report with no fix in the segment', () => {
    expect(fixBatchSummary([fix(1, 5)], [], gate(), { lat: 45, lng: 6, t: 0 }).metresFromAnchor).toBeNull()
  })

  it('carries no coordinate, so the log can never place the user', () => {
    const inSegment = [fix(2, 5, 45.123456, 6.654321)]
    const candidate = fix(3, 8, 45.13, 6.66)
    const serialised = JSON.stringify(
      fixBatchSummary(inSegment, inSegment, gate({ kept: inSegment, candidate }), { lat: 45.2, lng: 6.7, t: 1 }),
    )

    expect(serialised).not.toContain('45.1')
    expect(serialised).not.toContain('45.2')
    expect(serialised).not.toContain('6.65')
    expect(serialised).not.toContain('6.7')
    expect(serialised).not.toMatch(/lat|lng/i)
  })

  it('is empty-safe for a delivery that arrived with nothing', () => {
    expect(fixBatchSummary([], [], gate(), null)).toEqual(
      expect.objectContaining({ arrived: 0, kept: 0, droppedBeforeSegment: 0, firstAt: null, lastAt: null }),
    )
  })
})
