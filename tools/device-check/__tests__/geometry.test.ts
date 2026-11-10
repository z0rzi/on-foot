import { haversineMeters } from '../../../src/data/geo/metrics'
import { bearingDegrees, buildRoute, destination, positionAt } from '../geometry'

const CAPITOLE = { lat: 43.60445, lng: 1.44345 }

describe('destination', () => {
  it('puts a point the given distance away, as the app measures it', () => {
    const p = destination(CAPITOLE, 45, 1000)
    expect(haversineMeters(CAPITOLE.lat, CAPITOLE.lng, p.lat, p.lng)).toBeCloseTo(1000, 0)
    expect(bearingDegrees(CAPITOLE, p)).toBeCloseTo(45, 1)
  })
})

describe('positionAt', () => {
  const north = destination(CAPITOLE, 0, 400)
  const east = destination(north, 90, 600)
  const route = buildRoute([
    { ...CAPITOLE, ele: 100 },
    { ...north, ele: 140 },
    { ...east, ele: null },
  ])

  it('measures the route as the app does', () => {
    expect(route.length).toBeCloseTo(1000, 0)
  })

  it('finds the point at a mark on the right leg, elevation interpolated', () => {
    const p = positionAt(route, 100, 0)
    expect(haversineMeters(CAPITOLE.lat, CAPITOLE.lng, p.lat, p.lng)).toBeCloseTo(100, 0)
    expect(p.ele).toBeCloseTo(110, 5)
  })

  it('has no elevation where the route has none', () => {
    expect(positionAt(route, 700, 0).ele).toBeNull()
  })

  it('offsets to the right of the direction of travel for a positive offset', () => {
    const on = positionAt(route, 200, 0)
    const off = positionAt(route, 200, 30)
    expect(haversineMeters(on.lat, on.lng, off.lat, off.lng)).toBeCloseTo(30, 0)
    expect(bearingDegrees(on, off)).toBeCloseTo(90, 0)
    const left = positionAt(route, 700, -20)
    expect(bearingDegrees(positionAt(route, 700, 0), left)).toBeCloseTo(0, 0)
  })

  it('clamps marks to the route', () => {
    const end = positionAt(route, 5000, 0)
    expect(haversineMeters(end.lat, end.lng, east.lat, east.lng)).toBeLessThan(0.01)
  })
})

describe('buildRoute', () => {
  it('refuses fewer than two points', () => {
    expect(() => buildRoute([{ ...CAPITOLE, ele: null }])).toThrow('at least 2 points')
  })
})
