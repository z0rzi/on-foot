import { computeMetrics } from '../trails/gpx/metrics'
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
  endedAt: number | null
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
}

export interface RecordingPointRow {
  id: number
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
}

export interface RecordingPointInsertValues {
  sessionId: number
  lat: number
  lng: number
  ele: number | null
  t: number
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
  const parsed = JSON.parse(json) as Partial<ActivityGeometry>
  return { points: parsed.points ?? [] }
}

export function rowToTrackPoint(row: RecordingPointRow): TrackPoint {
  return { lat: row.lat, lng: row.lng, ele: row.ele, t: row.t }
}

export function rowToSession(row: RecordingSessionRow): RecordingSession {
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    linkedTrailId: row.linkedTrailId,
    pausedAt: row.pausedAt,
    pausedMs: row.pausedMs,
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

export function activityMetricsFromPoints(
  points: TrackPoint[],
  startedAt: number,
  endedAt: number,
): ActivityMetrics {
  const m = computeMetrics(points)
  return {
    distanceMeters: m.distanceMeters,
    durationSeconds: Math.max(0, Math.round((endedAt - startedAt) / 1000)),
    elevationGainMeters: m.elevationGainMeters,
    elevationLossMeters: m.elevationLossMeters,
  }
}

export function buildNewActivityInput(
  session: RecordingSession,
  points: TrackPoint[],
  form: ActivityFormFields,
): NewActivityInput {
  const endedAt = session.endedAt ?? points[points.length - 1]?.t ?? session.startedAt
  return {
    name: form.name,
    effort: form.effort,
    comments: form.comments,
    linkedTrailId: session.linkedTrailId,
    geometry: { points },
    metrics: activityMetricsFromPoints(points, session.startedAt, endedAt),
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

export function pointsToInsertValues(sessionId: number, points: TrackPoint[]): RecordingPointInsertValues[] {
  return points.map((p) => ({ sessionId, lat: p.lat, lng: p.lng, ele: p.ele, t: p.t }))
}
