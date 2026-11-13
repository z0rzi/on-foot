import { OverviewColumns, overviewColumns, overviewFromColumns, simplifyToOverview } from '../geo/overview'
import { Difficulty, GpxPoint, GpxWaypoint, NewTrailInput, Trail, TrailGeometry, TrailOverviewRow, TrailSummary, TrailUpdate } from './types'

export interface TrailRow extends OverviewColumns {
  id: number
  name: string
  difficulty: string
  distanceMeters: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
  description: string | null
  geometry: string
  createdAt: number
  updatedAt: number
}

type TrailSummaryRow = Omit<TrailRow, 'description' | 'geometry' | 'updatedAt'>

export type TrailInsertValues = Omit<TrailRow, 'id'>

export function serializeGeometry(geometry: TrailGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeGeometry(json: string): TrailGeometry {
  const parsed = JSON.parse(json) as {
    segments?: GpxPoint[][]; points?: GpxPoint[]; waypoints?: GpxWaypoint[]
  }
  const segments = parsed.segments ?? (parsed.points?.length ? [parsed.points] : [])
  return { segments, waypoints: parsed.waypoints ?? [] }
}

export function rowToSummary(row: TrailSummaryRow): TrailSummary {
  return {
    id: row.id,
    name: row.name,
    difficulty: row.difficulty as Difficulty,
    metrics: {
      distanceMeters: row.distanceMeters,
      elevationGainMeters: row.elevationGainMeters,
      elevationLossMeters: row.elevationLossMeters,
    },
    createdAt: row.createdAt,
  }
}

export function rowToOverviewRow(row: TrailSummaryRow): TrailOverviewRow {
  return { ...rowToSummary(row), ...overviewFromColumns(row) }
}

export function rowToTrail(row: TrailRow): Trail {
  return {
    ...rowToSummary(row),
    description: row.description,
    geometry: deserializeGeometry(row.geometry),
    updatedAt: row.updatedAt,
  }
}

export function inputToInsertValues(input: NewTrailInput, now: number): TrailInsertValues {
  return {
    name: input.name,
    difficulty: input.difficulty,
    distanceMeters: input.metrics.distanceMeters,
    elevationGainMeters: input.metrics.elevationGainMeters,
    elevationLossMeters: input.metrics.elevationLossMeters,
    description: input.description,
    geometry: serializeGeometry(input.geometry),
    ...overviewColumns(simplifyToOverview(input.geometry.segments)),
    createdAt: now,
    updatedAt: now,
  }
}

export interface TrailUpdateValues {
  name: string
  difficulty: string
  description: string | null
  updatedAt: number
}

export function updateToValues(update: TrailUpdate, now: number): TrailUpdateValues {
  return {
    name: update.name,
    difficulty: update.difficulty,
    description: update.description,
    updatedAt: now,
  }
}
