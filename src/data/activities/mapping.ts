import { metricsForSegments } from '../trails/gpx/metrics'
import { movingDurationMs } from './duration'
import {
  Activity, ActivityGeometry, ActivityMetrics, ActivitySummary,
  Effort, NewActivityInput, RecordingSession, TrackPoint,
} from './types'

export interface ActivityRow {
  id: number
  name: string
  effort: string
  comments: string | null
  linkedTrailId: number | null
  geometry: string
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  startedAt: number
  endedAt: number
  createdAt: number
}

export interface ActivityInsertValues {
  name: string
  effort: string
  comments: string | null
  linkedTrailId: number | null
  geometry: string
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  startedAt: number
  endedAt: number
  createdAt: number
}

export interface RecordingSessionRow {
  id: number
  startedAt: number
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
  currentSegment: number
}

export interface RecordingPointRow {
  id: number
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
  segment: number
}

export interface RecordingPointInsertValues {
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
  segment: number
}

export interface ActivityFormFields {
  name: string
  effort: Effort
  comments: string | null
}

export function serializeActivityGeometry(geometry: ActivityGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeActivityGeometry(json: string): ActivityGeometry {
  const parsed = JSON.parse(json) as { segments?: TrackPoint[][]; points?: TrackPoint[] }
  if (parsed.segments) return { segments: parsed.segments }
  if (parsed.points) return { segments: parsed.points.length ? [parsed.points] : [] }
  return { segments: [] }
}

export function rowToTrackPoint(row: RecordingPointRow): TrackPoint {
  return { lat: row.lat, lng: row.lng, ele: row.ele, t: row.t }
}

export function groupPointsBySegment(rows: RecordingPointRow[]): TrackPoint[][] {
  const bySegment = new Map<number, TrackPoint[]>()
  for (const row of rows) {
    const list = bySegment.get(row.segment) ?? []
    list.push(rowToTrackPoint(row))
    bySegment.set(row.segment, list)
  }
  return [...bySegment.keys()].sort((a, b) => a - b).map((k) => bySegment.get(k)!)
}

export function lastTrackPoint(segments: TrackPoint[][]): TrackPoint | null {
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i]
    if (seg.length > 0) return seg[seg.length - 1]
  }
  return null
}

export function rowToSession(row: RecordingSessionRow): RecordingSession {
  return {
    id: row.id,
    startedAt: row.startedAt,
    linkedTrailId: row.linkedTrailId,
    pausedAt: row.pausedAt,
    pausedMs: row.pausedMs,
    currentSegment: row.currentSegment,
  }
}

export function rowToSummary(row: ActivityRow): ActivitySummary {
  return {
    id: row.id,
    name: row.name,
    effort: row.effort as Effort,
    metrics: {
      distanceMeters: row.distanceMeters,
      durationSeconds: row.durationSeconds,
      elevationGainMeters: row.elevationGainMeters,
      elevationLossMeters: row.elevationLossMeters,
    },
    linkedTrailId: row.linkedTrailId,
    startedAt: row.startedAt,
    createdAt: row.createdAt,
  }
}

export function rowToActivity(row: ActivityRow): Activity {
  return {
    ...rowToSummary(row),
    comments: row.comments,
    geometry: deserializeActivityGeometry(row.geometry),
    endedAt: row.endedAt,
  }
}

export function activityMetricsFromSegments(
  segments: TrackPoint[][],
  startedAt: number,
  endedAt: number,
  pausedMs: number,
): ActivityMetrics {
  const m = metricsForSegments(segments)
  return {
    distanceMeters: m.distanceMeters,
    durationSeconds: Math.round(movingDurationMs(startedAt, endedAt, pausedMs) / 1000),
    elevationGainMeters: m.elevationGainMeters,
    elevationLossMeters: m.elevationLossMeters,
  }
}

export function buildNewActivityInput(
  session: RecordingSession,
  segments: TrackPoint[][],
  form: ActivityFormFields,
): NewActivityInput {
  const endedAt = session.pausedAt ?? lastTrackPoint(segments)?.t ?? session.startedAt
  return {
    name: form.name,
    effort: form.effort,
    comments: form.comments,
    linkedTrailId: session.linkedTrailId,
    geometry: { segments },
    metrics: activityMetricsFromSegments(segments, session.startedAt, endedAt, session.pausedMs),
    startedAt: session.startedAt,
    endedAt,
  }
}

export function inputToActivityValues(input: NewActivityInput, now: number): ActivityInsertValues {
  return {
    name: input.name,
    effort: input.effort,
    comments: input.comments,
    linkedTrailId: input.linkedTrailId,
    geometry: serializeActivityGeometry(input.geometry),
    distanceMeters: input.metrics.distanceMeters,
    durationSeconds: input.metrics.durationSeconds,
    elevationGainMeters: input.metrics.elevationGainMeters,
    elevationLossMeters: input.metrics.elevationLossMeters,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    createdAt: now,
  }
}

export function pointsToInsertValues(
  sessionId: number,
  segment: number,
  points: TrackPoint[],
): RecordingPointInsertValues[] {
  return points.map((p) => ({ sessionId, segment, lat: p.lat, lng: p.lng, ele: p.ele, t: p.t }))
}
