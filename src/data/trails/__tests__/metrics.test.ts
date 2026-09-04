import { haversineMeters, computeMetrics, metricsForSegments, formatDistance, formatElevation, formatMetricsSummary } from '../gpx/metrics'
import { GpxPoint } from '../types'

const p = (lat: number, lng: number, ele: number | null = null): GpxPoint => ({ lat, lng, ele })

describe('haversineMeters', () => {
  test('one degree of longitude at the equator is ~111.32 km', () => {
    expect(haversineMeters(0, 0, 0, 1)).toBeCloseTo(111194.93, 0)
  })
  test('identical points are zero distance', () => {
    expect(haversineMeters(45, 3, 45, 3)).toBe(0)
  })
})

describe('computeMetrics', () => {
  test('empty list has no elevation data', () => {
    expect(computeMetrics([])).toEqual({ distanceMeters: 0, elevationGainMeters: null, elevationLossMeters: null })
  })
  test('single point with elevation yields zero gain and loss', () => {
    expect(computeMetrics([p(1, 1, 10)])).toEqual({ distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 })
  })
  test('track without any elevation samples reports null gain and loss', () => {
    const m = computeMetrics([p(0, 0, null), p(0, 1, null), p(0, 2, null)])
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.elevationGainMeters).toBeNull()
    expect(m.elevationLossMeters).toBeNull()
  })
  test('sums distance and splits elevation into gain and loss', () => {
    const m = computeMetrics([p(0, 0, 100), p(0, 0.001, 130), p(0, 0.002, 110)])
    expect(m.distanceMeters).toBeGreaterThan(200)
    expect(m.elevationGainMeters).toBe(30)
    expect(m.elevationLossMeters).toBe(20)
  })
  test('altitude wander while barely moving is not climb', () => {
    // Standing still still yields fixes: the OS delivers one whenever it believes the walker
    // moved 10 m, so a stop reads as a slow crawl with a wandering altitude.
    const wander = Array.from({ length: 60 }, (_, i) => p(0, i * 0.0001, 200 + (i % 6 < 3 ? 4 : -4)))
    const m = computeMetrics(wander)
    const rawGain = 8 * 9 // every 6 fixes swing 4 m up and 4 m down
    expect(m.distanceMeters).toBeGreaterThan(600)
    expect(m.elevationGainMeters).toBeLessThan(rawGain / 8)
    expect(m.elevationLossMeters).toBeLessThan(rawGain / 8)
  })
  test('skips elevation deltas when either endpoint lacks elevation', () => {
    const m = computeMetrics([p(0, 0, 100), p(0, 0, null), p(0, 0, 200)])
    expect(m.elevationGainMeters).toBe(0)
    expect(m.elevationLossMeters).toBe(0)
  })
})

describe('formatters', () => {
  test('formatDistance switches to km at 1000 m', () => {
    expect(formatDistance(450)).toBe('450 m')
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(1000)).toBe('1.0 km')
  })
  test('formatElevation rounds to whole metres', () => {
    expect(formatElevation(250.4)).toBe('250 m')
  })
  test('formatElevation shows a dash when elevation is unknown', () => {
    expect(formatElevation(null)).toBe('—')
  })
  test('formatMetricsSummary includes gain when known', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: 340, elevationLossMeters: 300 }))
      .toBe('1.5 km • 340 m gain')
  })
  test('formatMetricsSummary states when elevation is missing', () => {
    expect(formatMetricsSummary({ distanceMeters: 1500, elevationGainMeters: null, elevationLossMeters: null }))
      .toBe('1.5 km • no elevation data')
  })
})

describe('metricsForSegments', () => {
  const seg = (lngs: number[], eles: (number | null)[]): GpxPoint[] =>
    lngs.map((lng, i) => ({ lat: 0, lng, ele: eles[i] }))

  it('sums per-segment distance and excludes the gap between segments', () => {
    const a = seg([0, 0.001], [null, null])
    const b = seg([1, 1.001], [null, null]) // far away; gap must NOT be counted
    const twoSeg = metricsForSegments([a, b])
    const oneEach = computeMetrics(a).distanceMeters + computeMetrics(b).distanceMeters
    expect(twoSeg.distanceMeters).toBeCloseTo(oneEach, 6)
    // A single flat segment spanning the gap would be far larger:
    expect(computeMetrics([...a, ...b]).distanceMeters).toBeGreaterThan(twoSeg.distanceMeters * 10)
  })

  it('sums elevation gain/loss per segment', () => {
    const a = seg([0, 0.001], [100, 110]) // +10
    const b = seg([1, 1.001], [200, 190]) // -10
    const m = metricsForSegments([a, b])
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(10)
  })

  it('elevation is null only when no segment has elevation', () => {
    const flat = seg([0, 0.001], [null, null])
    expect(metricsForSegments([flat]).elevationGainMeters).toBeNull()
  })

  it('a single segment equals computeMetrics of that segment', () => {
    const a = seg([0, 0.001, 0.002], [100, 110, 105])
    expect(metricsForSegments([a])).toEqual(computeMetrics(a))
  })
})
