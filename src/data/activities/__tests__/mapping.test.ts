import {
  activityMetricsFromPoints, buildNewActivityInput, deserializeActivityGeometry,
  inputToActivityValues, pointsToInsertValues, rowToActivity, rowToSession,
  rowToSummary, rowToTrackPoint, serializeActivityGeometry,
} from '../mapping'
import { NewActivityInput, TrackPoint } from '../types'

const pts: TrackPoint[] = [
  { lat: 0, lng: 0, ele: 100, t: 1000 },
  { lat: 0, lng: 0.001, ele: 110, t: 4000 },
  { lat: 0, lng: 0.002, ele: 105, t: 7000 },
]

describe('activity geometry (de)serialize', () => {
  it('round-trips points', () => {
    expect(deserializeActivityGeometry(serializeActivityGeometry({ points: pts }))).toEqual({ points: pts })
  })
  it('defaults missing points to []', () => {
    expect(deserializeActivityGeometry('{}')).toEqual({ points: [] })
  })
})

describe('rowToTrackPoint', () => {
  it('maps a point row incl. null ele', () => {
    expect(rowToTrackPoint({ id: 1, sessionId: 2, lat: 1, lng: 2, ele: null, t: 5 }))
      .toEqual({ lat: 1, lng: 2, ele: null, t: 5 })
  })
})

describe('rowToSession', () => {
  it('maps a session row (recording)', () => {
    expect(rowToSession({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null }))
      .toEqual({ id: 3, startedAt: 10, endedAt: null, linkedTrailId: null })
  })
})

describe('activityMetricsFromPoints', () => {
  it('computes distance, duration, elevation', () => {
    const m = activityMetricsFromPoints(pts, 1000, 7000)
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.durationSeconds).toBe(6)
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(5)
  })
  it('returns null elevation when no point has ele', () => {
    const flat: TrackPoint[] = [{ lat: 0, lng: 0, ele: null, t: 0 }, { lat: 0, lng: 0.001, ele: null, t: 2000 }]
    const m = activityMetricsFromPoints(flat, 0, 2000)
    expect(m.elevationGainMeters).toBeNull()
    expect(m.elevationLossMeters).toBeNull()
  })
  it('never returns a negative duration', () => {
    expect(activityMetricsFromPoints(pts, 7000, 1000).durationSeconds).toBe(0)
  })
})

describe('buildNewActivityInput', () => {
  const session = { id: 9, startedAt: 1000, endedAt: 7000, linkedTrailId: 42 }
  const form = { name: 'Morning walk', effort: 'moderate' as const, comments: 'nice' }
  it('assembles the input from session + points + form', () => {
    const input = buildNewActivityInput(session, pts, form)
    expect(input).toMatchObject({
      name: 'Morning walk', effort: 'moderate', comments: 'nice',
      linkedTrailId: 42, startedAt: 1000, endedAt: 7000,
      geometry: { points: pts },
    })
    expect(input.metrics.durationSeconds).toBe(6)
  })
  it('falls back to the last point time when endedAt is null', () => {
    const input = buildNewActivityInput({ ...session, endedAt: null }, pts, form)
    expect(input.endedAt).toBe(7000)
  })
})

describe('inputToActivityValues / pointsToInsertValues', () => {
  const input: NewActivityInput = {
    name: 'A', effort: 'hard', comments: null, linkedTrailId: null,
    geometry: { points: pts },
    metrics: { distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5 },
    startedAt: 1000, endedAt: 7000,
  }
  it('flattens input to insert values with createdAt', () => {
    const v = inputToActivityValues(input, 9999)
    expect(v).toMatchObject({
      name: 'A', effort: 'hard', comments: null, linkedTrailId: null,
      distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5,
      startedAt: 1000, endedAt: 7000, createdAt: 9999,
    })
    expect(JSON.parse(v.geometry)).toEqual({ points: pts })
  })
  it('maps points to per-row insert values', () => {
    expect(pointsToInsertValues(7, [pts[0]])).toEqual([{ sessionId: 7, lat: 0, lng: 0, ele: 100, t: 1000 }])
  })
})

describe('rowToSummary / rowToActivity', () => {
  const row = {
    id: 1, name: 'A', effort: 'max', comments: 'c', linkedTrailId: 3,
    geometry: JSON.stringify({ points: pts }),
    distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5,
    startedAt: 1000, endedAt: 7000, createdAt: 9999,
  }
  it('summary carries metrics + link, no geometry', () => {
    expect(rowToSummary(row)).toEqual({
      id: 1, name: 'A', effort: 'max',
      metrics: { distanceMeters: 12, durationSeconds: 6, elevationGainMeters: 10, elevationLossMeters: 5 },
      linkedTrailId: 3, startedAt: 1000, createdAt: 9999,
    })
  })
  it('activity adds comments, geometry, endedAt', () => {
    const a = rowToActivity(row)
    expect(a.geometry).toEqual({ points: pts })
    expect(a.comments).toBe('c')
    expect(a.endedAt).toBe(7000)
  })
})
