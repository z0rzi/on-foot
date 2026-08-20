import { haversineMeters, computeMetrics, formatDistance, formatElevation } from '../gpx/metrics'
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
  test('empty and single-point lists yield zeros', () => {
    expect(computeMetrics([])).toEqual({ distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 })
    expect(computeMetrics([p(1, 1, 10)])).toEqual({ distanceMeters: 0, elevationGainMeters: 0, elevationLossMeters: 0 })
  })
  test('sums distance and splits elevation into gain and loss', () => {
    const m = computeMetrics([p(0, 0, 100), p(0, 0, 130), p(0, 0, 110)])
    expect(m.distanceMeters).toBe(0)
    expect(m.elevationGainMeters).toBe(30)
    expect(m.elevationLossMeters).toBe(20)
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
})
