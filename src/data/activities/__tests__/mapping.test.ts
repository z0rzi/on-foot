import {
  activityMetricsFromSegments, buildNewActivityInput, deserializeActivityGeometry,
  groupPointsBySegment, inputToActivityValues, lastTrackPoint, pointsToInsertValues,
  rowToActivity, rowToLivePoint, rowToSession, rowToSummary, serializeActivityGeometry,
} from '../mapping'
import { NewActivityInput, TrackPoint } from '../types'

const pts: TrackPoint[] = [
  { lat: 0, lng: 0, ele: 100, t: 1000 },
  { lat: 0, lng: 0.001, ele: 110, t: 4000 },
  { lat: 0, lng: 0.002, ele: 105, t: 7000 },
]

const segs: TrackPoint[][] = [
  [{ lat: 0, lng: 0, ele: 100, t: 1000 }, { lat: 0, lng: 0.001, ele: 110, t: 4000 }],
  [{ lat: 0, lng: 0.5, ele: 105, t: 60000 }],
]

describe('activity geometry (de)serialize', () => {
  it('round-trips segments', () => {
    expect(deserializeActivityGeometry(serializeActivityGeometry({ segments: segs }))).toEqual({ segments: segs })
  })
  it('upcasts legacy { points } to a single segment', () => {
    expect(deserializeActivityGeometry(JSON.stringify({ points: pts }))).toEqual({ segments: [pts] })
  })
  it('legacy empty points -> no segments', () => {
    expect(deserializeActivityGeometry(JSON.stringify({ points: [] }))).toEqual({ segments: [] })
  })
  it('defaults missing geometry to { segments: [] }', () => {
    expect(deserializeActivityGeometry('{}')).toEqual({ segments: [] })
  })
})

describe('groupPointsBySegment', () => {
  it('groups rows by segment ascending, preserving order within a segment', () => {
    const rows = [
      { id: 1, sessionId: 1, lat: 0, lng: 0, ele: null, t: 10, segment: 0 },
      { id: 2, sessionId: 1, lat: 0, lng: 1, ele: null, t: 20, segment: 0 },
      { id: 3, sessionId: 1, lat: 0, lng: 2, ele: null, t: 30, segment: 1 },
    ]
    expect(groupPointsBySegment(rows)).toEqual([
      [{ lat: 0, lng: 0, ele: null, t: 10 }, { lat: 0, lng: 1, ele: null, t: 20 }],
      [{ lat: 0, lng: 2, ele: null, t: 30 }],
    ])
  })
})

describe('lastTrackPoint', () => {
  it('returns the last point of the last non-empty segment', () => {
    expect(lastTrackPoint(segs)).toEqual({ lat: 0, lng: 0.5, ele: 105, t: 60000 })
  })
  it('is null for no points', () => {
    expect(lastTrackPoint([])).toBeNull()
  })
})

describe('rowToLivePoint', () => {
  it('maps a point row to a segment-tagged live point', () => {
    expect(rowToLivePoint({ id: 1, sessionId: 2, lat: 1, lng: 2, ele: null, t: 5, segment: 3 }))
      .toEqual({ lat: 1, lng: 2, ele: null, t: 5, segment: 3 })
  })
})

describe('rowToSession', () => {
  it('maps a recording session row including pause + segment fields', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 10 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: null, pausedAt: null, pausedMs: 0, currentSegment: 0, segmentStartedAt: 10 })
  })
  it('maps a paused session on a later segment', () => {
    expect(
      rowToSession({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2, segmentStartedAt: 300 }),
    ).toEqual({ id: 3, startedAt: 10, linkedTrailId: 2, pausedAt: 500, pausedMs: 120, currentSegment: 2, segmentStartedAt: 300 })
  })
})

describe('activityMetricsFromSegments', () => {
  it('computes distance, moving duration, elevation over segments', () => {
    const m = activityMetricsFromSegments([pts], 1000, 7000, 2000)
    expect(m.distanceMeters).toBeGreaterThan(0)
    expect(m.durationSeconds).toBe(4)
    expect(m.elevationGainMeters).toBe(10)
    expect(m.elevationLossMeters).toBe(5)
  })
  it('excludes the break leg between segments from distance', () => {
    const near = [{ lat: 0, lng: 0, ele: null, t: 0 }, { lat: 0, lng: 0.001, ele: null, t: 1000 }]
    const far = [{ lat: 0, lng: 1, ele: null, t: 2000 }, { lat: 0, lng: 1.001, ele: null, t: 3000 }]
    const twoSeg = activityMetricsFromSegments([near, far], 0, 3000, 0)
    const oneSeg = activityMetricsFromSegments([[...near, ...far]], 0, 3000, 0)
    expect(twoSeg.distanceMeters).toBeLessThan(oneSeg.distanceMeters)
  })
  it('never returns a negative duration', () => {
    expect(activityMetricsFromSegments([pts], 7000, 1000, 0).durationSeconds).toBe(0)
  })
})

describe('buildNewActivityInput', () => {
  const session = { id: 9, startedAt: 1000, linkedTrailId: 42, pausedAt: 7000, pausedMs: 2000, currentSegment: 0, segmentStartedAt: 1000 }
  const form = { name: 'Morning walk', effort: 'moderate' as const, comments: 'nice' }
  it('assembles the input; endedAt is the pause moment, geometry is segments', () => {
    const input = buildNewActivityInput(session, [pts], form)
    expect(input).toMatchObject({
      name: 'Morning walk', effort: 'moderate', comments: 'nice',
      linkedTrailId: 42, startedAt: 1000, endedAt: 7000,
      geometry: { segments: [pts] },
    })
    expect(input.metrics.durationSeconds).toBe(4)
  })
  it('falls back to the last point time when not paused', () => {
    const input = buildNewActivityInput({ ...session, pausedAt: null }, [pts], form)
    expect(input.endedAt).toBe(7000)
  })
})

describe('inputToActivityValues / pointsToInsertValues', () => {
  const input: NewActivityInput = {
    name: 'A', effort: 'hard', comments: null, linkedTrailId: null,
    geometry: { segments: [pts] },
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
    expect(JSON.parse(v.geometry)).toEqual({ segments: [pts] })
  })
  it('maps points to per-row insert values with segment', () => {
    expect(pointsToInsertValues(7, 2, [pts[0]])).toEqual([{ sessionId: 7, segment: 2, lat: 0, lng: 0, ele: 100, t: 1000 }])
  })
})

describe('rowToSummary / rowToActivity', () => {
  const row = {
    id: 1, name: 'A', effort: 'max', comments: 'c', linkedTrailId: 3,
    geometry: JSON.stringify({ segments: [pts] }),
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
    expect(a.geometry).toEqual({ segments: [pts] })
    expect(a.comments).toBe('c')
    expect(a.endedAt).toBe(7000)
  })
})
