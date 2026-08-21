export interface GpxPoint { lat: number; lng: number; ele: number | null }
export interface GpxWaypoint {
  lat: number; lng: number; ele: number | null
  name: string | null; description: string | null
}
export type Difficulty = 'easy' | 'medium' | 'hard'
export interface TrailMetrics {
  distanceMeters: number; elevationGainMeters: number | null; elevationLossMeters: number | null
}
export interface TrailGeometry { points: GpxPoint[]; waypoints: GpxWaypoint[] }
export interface NewTrailInput {
  name: string; difficulty: Difficulty; description: string | null
  metrics: TrailMetrics; geometry: TrailGeometry
}
export interface TrailUpdate {
  name: string; difficulty: Difficulty; description: string | null
}
export interface TrailSummary {
  id: number; name: string; difficulty: Difficulty
  metrics: TrailMetrics; createdAt: number
}
export interface Trail extends TrailSummary {
  description: string | null; geometry: TrailGeometry; updatedAt: number
}
