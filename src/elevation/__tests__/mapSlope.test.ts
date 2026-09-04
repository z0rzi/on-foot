import { buildSlopeRuns } from '../mapSlope'
import { buildElevationProfile } from '../profile'
import type { SlopeBand } from '../slope'

describe('buildSlopeRuns', () => {
  const oneSeg = buildElevationProfile([[
    { lat: 0, lng: 0, ele: 0 },
    { lat: 0, lng: 0.001, ele: 40 },
    { lat: 0, lng: 0.002, ele: 45 },
  ]])!

  it('emits one coordinate run per band, tagged with the band', () => {
    const bands: SlopeBand[] = [
      { start: 0, end: oneSeg.totalDistance / 2, band: 'steep' },
      { start: oneSeg.totalDistance / 2, end: oneSeg.totalDistance, band: 'flat' },
    ]
    const runs = buildSlopeRuns(oneSeg, bands)
    expect(runs.map((r) => r.band)).toEqual(['steep', 'flat'])
    expect(runs[0].coordinates[0]).toEqual([oneSeg.samples[0].lng, oneSeg.samples[0].lat])
    for (const r of runs) {
      expect(r.coordinates.length).toBeGreaterThanOrEqual(2)
      for (const [lng, lat] of r.coordinates) {
        expect(typeof lng).toBe('number')
        expect(typeof lat).toBe('number')
      }
    }
  })

  it('adjacent runs share their boundary coordinate (no gap on the map)', () => {
    const mid = oneSeg.totalDistance / 2
    const runs = buildSlopeRuns(oneSeg, [
      { start: 0, end: mid, band: 'steep' },
      { start: mid, end: oneSeg.totalDistance, band: 'uphill' },
    ])
    const endOfFirst = runs[0].coordinates[runs[0].coordinates.length - 1]
    const startOfSecond = runs[1].coordinates[0]
    expect(startOfSecond[0]).toBeCloseTo(endOfFirst[0], 9)
    expect(startOfSecond[1]).toBeCloseTo(endOfFirst[1], 9)
  })

  it('never lets a run cross a segment break', () => {
    const twoSeg = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 44 }],
      [{ lat: 0, lng: 1, ele: 100 }, { lat: 0, lng: 1.001, ele: 60 }],
    ])!
    const dA = twoSeg.samples[1].distance
    const runs = buildSlopeRuns(twoSeg, [
      { start: 0, end: dA, band: 'steep' },
      { start: dA, end: twoSeg.totalDistance, band: 'downhill' },
    ])
    expect(Math.max(...runs[0].coordinates.map(([lng]) => lng))).toBeLessThan(0.5)
    expect(Math.min(...runs[1].coordinates.map(([lng]) => lng))).toBeGreaterThan(0.5)
  })

  it('returns [] for an empty band list', () => {
    expect(buildSlopeRuns(oneSeg, [])).toEqual([])
  })
})
