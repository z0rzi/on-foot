export type Effort = 'easy' | 'moderate' | 'hard' | 'max'

export interface TrackPoint { lat: number; lng: number; ele: number | null; t: number }
export interface ActivityGeometry { points: TrackPoint[] }

export interface ActivityMetrics {
  distanceMeters: number
  durationSeconds: number
  elevationGainMeters: number | null
  elevationLossMeters: number | null
}

export interface NewActivityInput {
  name: string
  effort: Effort
  comments: string | null
  linkedTrailId: number | null
  geometry: ActivityGeometry
  metrics: ActivityMetrics
  startedAt: number
  endedAt: number
}

export interface ActivitySummary {
  id: number
  name: string
  effort: Effort
  metrics: ActivityMetrics
  linkedTrailId: number | null
  startedAt: number
  createdAt: number
}

export interface Activity extends ActivitySummary {
  comments: string | null
  geometry: ActivityGeometry
  endedAt: number
}

export interface RecordingSession {
  id: number
  startedAt: number
  linkedTrailId: number | null
  pausedAt: number | null
  pausedMs: number
}
