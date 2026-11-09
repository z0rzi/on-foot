import { currentPace } from '../currentPace'
import type { TrackPoint } from '../../data/activities/types'

const METERS_PER_DEGREE_AT_EQUATOR = (6371000 * Math.PI) / 180

const at = (meters: number, seconds: number): TrackPoint => ({
  lat: 0,
  lng: meters / METERS_PER_DEGREE_AT_EQUATOR,
  ele: null,
  t: seconds * 1000,
})

// 100 m every 75 s is 4.8 km/h, a 12:30 /km pace.
function walk(fromMeters: number, toMeters: number, fromSeconds: number): TrackPoint[] {
  const points: TrackPoint[] = []
  for (let m = fromMeters, s = fromSeconds; m <= toMeters; m += 100, s += 75) points.push(at(m, s))
  return points
}

describe('currentPace', () => {
  test('a window inside one segment covers the last 1 000 m only', () => {
    const slowStart = [at(0, 0), at(500, 1000)]
    const segment = [...slowStart, ...walk(600, 2500, 1075)]
    const window = currentPace([segment])
    expect(window?.distanceMeters).toBeCloseTo(1000, 3)
    expect(window?.movingSeconds).toBeCloseTo(750, 3)
  })

  test('a window across a pause skips the gap and carries on into the earlier segment', () => {
    const before = walk(0, 600, 0)
    const after = walk(5000, 5600, 3600)
    const window = currentPace([before, after])
    expect(window?.distanceMeters).toBeCloseTo(1000, 3)
    expect(window?.movingSeconds).toBeCloseTo(750, 3)
  })

  test('the step crossing the 1 000 m mark is interpolated', () => {
    const segment = [at(0, 0), at(400, 400), at(1200, 800)]
    const window = currentPace([segment])
    expect(window?.distanceMeters).toBeCloseTo(1000, 3)
    expect(window?.movingSeconds).toBeCloseTo(600, 3)
  })

  test('a 20-minute stop without pause adds neither time nor distance', () => {
    const before = walk(0, 1000, 0)
    const stopEnd = 750 + 20 * 60
    const stop = [at(1003, 750 + 600), at(1005, stopEnd)]
    const after = walk(1005, 1405, stopEnd)
    const window = currentPace([[...before, ...stop, ...after]])
    expect(window?.distanceMeters).toBeCloseTo(1000, 3)
    expect(window?.movingSeconds).toBeCloseTo(750, 3)
  })

  test('under 200 m walked there is no pace', () => {
    expect(currentPace([walk(0, 100, 0)])).toBeNull()
    expect(currentPace([])).toBeNull()
    expect(currentPace([[at(0, 0)]])).toBeNull()
  })

  test('between 200 m and 1 km the window is everything walked', () => {
    const window = currentPace([walk(0, 300, 0), walk(800, 1100, 3600)])
    expect(window?.distanceMeters).toBeCloseTo(600, 3)
    expect(window?.movingSeconds).toBeCloseTo(450, 3)
  })

  test('a relaunch gap within the same walk contributes nothing', () => {
    const beforeCrash = walk(0, 500, 0)
    const afterRelaunch = walk(520, 1020, 375 + 7200)
    const window = currentPace([beforeCrash, afterRelaunch])
    expect(window?.distanceMeters).toBeCloseTo(1000, 3)
    expect(window?.movingSeconds).toBeCloseTo(750, 3)
  })
})
