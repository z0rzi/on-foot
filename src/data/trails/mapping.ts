import { Difficulty, NewTrailInput, Trail, TrailGeometry, TrailSummary } from './types'

export interface TrailRow {
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

export interface TrailInsertValues {
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

export function serializeGeometry(geometry: TrailGeometry): string {
  return JSON.stringify(geometry)
}

export function deserializeGeometry(json: string): TrailGeometry {
  const parsed = JSON.parse(json) as Partial<TrailGeometry>
  return { points: parsed.points ?? [], waypoints: parsed.waypoints ?? [] }
}

export function rowToSummary(row: TrailRow): TrailSummary {
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
    createdAt: now,
    updatedAt: now,
  }
}
