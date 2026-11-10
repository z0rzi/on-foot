import { haversineMeters } from '../../../src/data/geo/metrics'
import { bearingDegrees, buildRoute, destination, positionAt } from '../geometry'
import { fixIntentExtras, parsePace, planJump, planMove } from '../walkPlan'

const START = { lat: 43.60445, lng: 1.44345 }
const straight = (metres: number) =>
  buildRoute([
    { ...START, ele: 100 },
    { ...destination(START, 45, metres), ele: 100 + metres / 10 },
  ])

const gaps = (fixes: { lat: number; lng: number }[]) =>
  fixes.slice(1).map((f, i) => haversineMeters(fixes[i].lat, fixes[i].lng, f.lat, f.lng))

describe('parsePace', () => {
  it('names the paces when none is given', () => {
    expect(() => parsePace(undefined)).toThrow(/walk \(1\.4 m\/s\).*fast \(8 m\/s\)/)
  })

  it('reads walk, fast and an explicit speed', () => {
    expect(parsePace('walk')).toBe(1.4)
    expect(parsePace('fast')).toBe(8)
    expect(parsePace('2.5')).toBe(2.5)
  })

  it('refuses a speed that is not a positive number', () => {
    expect(() => parsePace('0')).toThrow('pace')
    expect(() => parsePace('quick')).toThrow('pace')
  })
})

describe('planMove', () => {
  it('walks 2 km at fast pace in fixes 8 m apart, the last one standing', () => {
    const fixes = planMove(straight(2000), { mark: 0, offset: 0 }, { mark: 2000, offset: 0 }, 8, 4)
    expect(fixes).toHaveLength(250)
    for (const gap of gaps(fixes)) expect(gap).toBeCloseTo(8, 1)
    expect(fixes.slice(0, -1).every((f) => f.speed === 8 && f.bearing !== null && Math.abs(f.bearing - 45) < 0.5)).toBe(true)
    expect(fixes[fixes.length - 1]).toMatchObject({ speed: null, bearing: null, mark: 2000 })
  })

  it('spaces walking-pace fixes 1.4 m apart and ends exactly on the mark', () => {
    const route = straight(1000)
    const fixes = planMove(route, { mark: 100, offset: 0 }, { mark: 110, offset: 0 }, 1.4, 4)
    expect(fixes).toHaveLength(8)
    for (const gap of gaps(fixes).slice(0, -1)) expect(gap).toBeCloseTo(1.4, 2)
    const end = positionAt(route, 110, 0)
    const last = fixes[fixes.length - 1]
    expect(haversineMeters(last.lat, last.lng, end.lat, end.lng)).toBeLessThan(0.01)
  })

  it('carries the route elevation at each mark, and the accuracy asked for', () => {
    const fixes = planMove(straight(1000), { mark: 0, offset: 0 }, { mark: 80, offset: 0 }, 8, 30)
    expect(fixes.map((f) => f.ele)).toEqual([100.8, 101.6, 102.4, 103.2, 104, 104.8, 105.6, 106.4, 107.2, 108].map((e) => expect.closeTo(e, 5)))
    expect(fixes.every((f) => f.accuracy === 30)).toBe(true)
  })

  it('steps sideways off the route, perpendicular to it', () => {
    const route = straight(1000)
    const fixes = planMove(route, { mark: 200, offset: 0 }, { mark: 200, offset: 30 }, 1.4, 4)
    const on = positionAt(route, 200, 0)
    const last = fixes[fixes.length - 1]
    expect(haversineMeters(on.lat, on.lng, last.lat, last.lng)).toBeCloseTo(30, 1)
    expect(bearingDegrees(on, last)).toBeCloseTo(135, 0)
    expect(fixes[0].bearing).toBeCloseTo(135, 0)
    expect(last).toMatchObject({ mark: 200, offset: 30 })
  })

  it('walks back along the route to an earlier mark', () => {
    const fixes = planMove(straight(1000), { mark: 500, offset: 0 }, { mark: 400, offset: 0 }, 8, 4)
    expect(fixes[0].bearing).toBeCloseTo(225, 0)
    expect(fixes[fixes.length - 1].mark).toBe(400)
  })

  it('re-sends the position standing when the move has no length', () => {
    const fixes = planMove(straight(1000), { mark: 300, offset: 0 }, { mark: 300, offset: 0 }, 8, 4)
    expect(fixes).toHaveLength(1)
    expect(fixes[0]).toMatchObject({ mark: 300, speed: null, bearing: null })
  })
})

describe('planJump', () => {
  it('is one standing fix at the mark', () => {
    const route = straight(1000)
    const fix = planJump(route, { mark: 600, offset: 0 }, 4)
    const at = positionAt(route, 600, 0)
    expect(fix).toMatchObject({ lat: at.lat, lng: at.lng, speed: null, bearing: null, mark: 600 })
  })
})

describe('fixIntentExtras', () => {
  it('sends speed and bearing only for a moving fix, and altitude only when known', () => {
    const moving = { lat: 43.6, lng: 1.4, ele: 146.25, accuracy: 4, speed: 1.4, bearing: 45, mark: 10, offset: 0 }
    expect(fixIntentExtras(moving)).toEqual([
      '--es', 'latitude', '43.6000000', '--es', 'longitude', '1.4000000', '--es', 'accuracy', '4',
      '--es', 'altitude', '146.3', '--es', 'speed', '1.4', '--es', 'bearing', '45.0',
    ])
    expect(fixIntentExtras({ ...moving, ele: null, speed: null, bearing: null })).toEqual([
      '--es', 'latitude', '43.6000000', '--es', 'longitude', '1.4000000', '--es', 'accuracy', '4',
    ])
  })
})
