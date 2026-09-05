import { buildElevationProfile, buildElevationProfile as build, ElePoint, gradeBand, sampleAt } from '../profile'
import { haversineMeters } from '../../data/geo/metrics'

const seg = (lngs: number[], eles: (number | null)[]): ElePoint[] =>
  lngs.map((lng, i) => ({ lat: 0, lng, ele: eles[i] }))

describe('buildElevationProfile', () => {
  it('returns null when no point has elevation', () => {
    expect(buildElevationProfile([seg([0, 0.001], [null, null])])).toBeNull()
  })

  it('accumulates cumulative distance and keeps elevation per sample', () => {
    const p = buildElevationProfile([seg([0, 0.001, 0.002], [100, 110, 105])])!
    expect(p.samples).toHaveLength(3)
    expect(p.samples[0].distance).toBe(0)
    expect(p.samples[1].distance).toBeGreaterThan(0)
    expect(p.samples[2].distance).toBeGreaterThan(p.samples[1].distance)
    expect(p.minEle).toBe(100)
    expect(p.maxEle).toBe(110)
    expect(p.totalDistance).toBe(p.samples[2].distance)
  })

  it('excludes the inter-segment gap: segment 2 starts at the same distance segment 1 ended', () => {
    const a = seg([0, 0.001], [100, 110])
    const b = seg([1, 1.001], [200, 190]) // far away
    const p = buildElevationProfile([a, b])!
    const endOfA = p.samples[1].distance
    const startOfB = p.samples[2].distance
    expect(startOfB).toBe(endOfA) // gap carries no distance
    expect(p.samples[2].segment).toBe(1)
  })

  it('skips null-elevation points but still advances distance through them', () => {
    const p = buildElevationProfile([seg([0, 0.001, 0.002], [100, null, 120])])!
    expect(p.samples.map((s) => s.ele)).toEqual([100, 120])
    const hop = haversineMeters(0, 0, 0, 0.001)
    expect(p.samples[1].distance).toBeCloseTo(2 * hop, 6) // distance crossed the skipped point, not just one hop
  })
})

describe('gradeBand', () => {
  it('maps grade percentages to bands at the documented boundaries', () => {
    expect(gradeBand(45)).toBe('steep')
    expect(gradeBand(40)).toBe('rough')   // 40 is NOT steep (> 40 only) — black means dangerous
    expect(gradeBand(30)).toBe('rough')
    expect(gradeBand(20)).toBe('rough')
    expect(gradeBand(12)).toBe('uphill')  // 12 is NOT rough
    expect(gradeBand(8)).toBe('uphill')
    expect(gradeBand(4)).toBe('flat')     // 4 is NOT uphill
    expect(gradeBand(0)).toBe('flat')
    expect(gradeBand(-4)).toBe('flat')    // -4 is still flat
    expect(gradeBand(-5)).toBe('downhill')
    expect(gradeBand(-30)).toBe('downhill')
  })
})

describe('sampleAt', () => {
  // Single segment, 0 → ~111.19 m across, ele 100 → 200 (so grade is a clean function of distance).
  const p = build([[
    { lat: 0, lng: 0, ele: 100 },
    { lat: 0, lng: 0.001, ele: 200 },
  ]])!

  it('clamps below zero to the first sample', () => {
    expect(sampleAt(p, -50)).toMatchObject({ ele: 100, lat: 0, lng: 0 })
  })
  it('clamps beyond the end to the last sample', () => {
    expect(sampleAt(p, p.totalDistance + 999).ele).toBe(200)
  })
  it('interpolates elevation and coordinates at the midpoint', () => {
    const mid = sampleAt(p, p.totalDistance / 2)
    expect(mid.ele).toBeCloseTo(150, 5)
    expect(mid.lng).toBeCloseTo(0.0005, 6)
    expect(mid.grade).toBeGreaterThan(0)
  })
  it("returns segment A's endpoint at the boundary between segments", () => {
    const g = build([
      [{ lat: 0, lng: 0, ele: 100 }, { lat: 0, lng: 0.001, ele: 160 }],
      [{ lat: 1, lng: 1, ele: 400 }, { lat: 1, lng: 1.001, ele: 420 }],
    ])!
    const endOfA = g.samples[1].distance
    const s = sampleAt(g, endOfA)
    expect(s.lat).toBeCloseTo(0, 6)
    expect(s.lng).toBeCloseTo(0.001, 6) // segment A's last point, not segment B's
    expect(s.ele).toBeCloseTo(160, 6)
  })
})
