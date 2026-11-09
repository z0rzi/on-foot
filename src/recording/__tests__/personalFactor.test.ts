import { historyActivityIds, historyFactor, personalFactor } from '../personalFactor'
import type { ActivitySummary, TrackPoint } from '../../data/activities/types'

const METERS_PER_DEGREE_AT_EQUATOR = (6371000 * Math.PI) / 180
const STEP_METERS = 50

// Tobler's published speed (Tobler, 1993), the yardstick a factor of 1 means walking at.
const toblerKmh = (grade: number) => 6 * Math.exp(-3.5 * Math.abs(grade + 0.05))

const point = (meters: number, ele: number | null, seconds: number): TrackPoint => ({
  lat: 0,
  lng: meters / METERS_PER_DEGREE_AT_EQUATOR,
  ele,
  t: seconds * 1000,
})

interface Walk { meters: number; grade?: number; factor?: number; fromMeters?: number; fromSeconds?: number; ele?: (m: number) => number | null }

// A segment walked at `factor` times Tobler's time on a constant grade, a point every 50 m.
function walk({ meters, grade = 0, factor = 1, fromMeters = 0, fromSeconds = 0, ele }: Walk): TrackPoint[] {
  const stepSeconds = (STEP_METERS / 1000 / toblerKmh(grade)) * 3600 * factor
  const points: TrackPoint[] = []
  for (let m = 0; m <= meters; m += STEP_METERS) {
    const elevation = ele ? ele(m) : 500 + grade * m
    points.push(point(fromMeters + m, elevation, fromSeconds + (m / STEP_METERS) * stepSeconds))
  }
  return points
}

describe('historyFactor', () => {
  test('a track walked exactly at Tobler speed gives 1', () => {
    expect(historyFactor([[walk({ meters: 3000 })]])).toBeCloseTo(1, 3)
    expect(historyFactor([[walk({ meters: 3000, grade: 0.12 })]])).toBeCloseTo(1, 3)
  })

  test('a stop is left out', () => {
    const before = walk({ meters: 1500 })
    const end = before[before.length - 1]
    const stopEnd = end.t / 1000 + 30 * 60
    const stop = [point(1502, 500, end.t / 1000 + 900), point(1503, 500, stopEnd)]
    const after = walk({ meters: 1500, fromMeters: 1503, fromSeconds: stopEnd })
    expect(historyFactor([[[...before, ...stop, ...after]]])).toBeCloseTo(1, 2)
  })

  test('steps without elevation are left out', () => {
    const climb = walk({ meters: 3000, grade: 0.1 })
    const blind = walk({ meters: 1000, factor: 3, fromMeters: 3050, fromSeconds: climb[climb.length - 1].t / 1000 + 60, ele: () => null })
    const tail = walk({ meters: 0, fromMeters: 4100, fromSeconds: blind[blind.length - 1].t / 1000 + 60 })
    expect(historyFactor([[[...climb, ...blind, ...tail]]])).toBeCloseTo(1, 2)
  })

  test('the gap between two segments is not walked', () => {
    const before = walk({ meters: 1500 })
    const after = walk({ meters: 1500, fromMeters: 4000, fromSeconds: before[before.length - 1].t / 1000 + 3600 })
    expect(historyFactor([[before, after]])).toBeCloseTo(1, 3)
  })

  test('altitude wander is smoothed out like the stored gain', () => {
    const wander = (m: number) => 500 + ((m / STEP_METERS) % 2) * 6
    expect(historyFactor([[walk({ meters: 3000, ele: wander })]])).toBeCloseTo(1, 1)
  })

  test('the factor of a history is the median of its tracks', () => {
    const tracks = [1.4, 0.8, 1.1, 0.9, 1.6].map((factor) => [walk({ meters: 2500, factor })])
    expect(historyFactor(tracks)).toBeCloseTo(1.1, 3)
    expect(historyFactor(tracks.slice(0, 4))).toBeCloseTo(1, 3)
  })

  test('a track with under 2 km of moving steps with elevation is left out', () => {
    const short = [walk({ meters: 1500, factor: 3 })]
    const mostlyBlind = [walk({ meters: 1500, factor: 3 }), walk({ meters: 1500, fromMeters: 2000, ele: () => null })]
    const long = [walk({ meters: 2500, factor: 1.2 })]
    expect(historyFactor([short, mostlyBlind, long])).toBeCloseTo(1.2, 3)
  })

  test('no qualifying track gives 1', () => {
    expect(historyFactor([])).toBe(1)
    expect(historyFactor([[walk({ meters: 1000, factor: 2 })], [], [[]]])).toBe(1)
  })
})

describe('personalFactor', () => {
  test('the history factor alone before the hike has a moving step', () => {
    expect(personalFactor(1.5, [])).toBeCloseTo(1.5, 3)
    expect(personalFactor(1.5, [[point(0, 500, 0)]])).toBeCloseTo(1.5, 3)
  })

  test('the history blends into the hike over its first 2 km', () => {
    expect(personalFactor(1.5, [walk({ meters: 1000 })])).toBeCloseTo(1.25, 3)
    expect(personalFactor(1.5, [walk({ meters: 2000 })])).toBeCloseTo(1, 3)
    expect(personalFactor(1.5, [walk({ meters: 5000, factor: 0.8 })])).toBeCloseTo(0.8, 3)
  })

  test('the factor is clamped to 0.5–2', () => {
    expect(personalFactor(3, [])).toBe(2)
    expect(personalFactor(1, [walk({ meters: 3000, factor: 0.3 })])).toBe(0.5)
  })
})

describe('historyActivityIds', () => {
  const summary = (id: number, startedAt: number, distanceMeters: number): ActivitySummary => ({
    id,
    name: `Hike ${id}`,
    effort: 'moderate',
    metrics: { distanceMeters, durationSeconds: 3600, elevationGainMeters: 100, elevationLossMeters: 100 },
    linkedTrailId: null,
    startedAt,
    createdAt: startedAt,
  })

  test('the five most recent activities of 2 km or more', () => {
    const summaries = [
      summary(1, 100, 5000),
      summary(2, 700, 1999),
      summary(3, 600, 2000),
      summary(4, 200, 8000),
      summary(5, 500, 3000),
      summary(6, 400, 4000),
      summary(7, 300, 9000),
    ]
    expect(historyActivityIds(summaries)).toEqual([3, 5, 6, 7, 4])
  })

  test('no activity, no history', () => {
    expect(historyActivityIds([])).toEqual([])
  })
})
