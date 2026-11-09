import { haversineMeters } from '../data/geo/metrics'
import type { TrackPoint } from '../data/activities/types'
import { isMovingStep } from './movingStep'

const PACE_WINDOW_METERS = 1000
const MIN_PACE_DISTANCE_METERS = 200

export interface PaceWindow {
  distanceMeters: number
  movingSeconds: number
}

// The pace over the most recent PACE_WINDOW_METERS of track, walking back from the last point.
// Steps never cross a segment boundary, and a stop is not track.
export function currentPace(segments: TrackPoint[][]): PaceWindow | null {
  let distanceMeters = 0
  let movingSeconds = 0
  for (let s = segments.length - 1; s >= 0; s--) {
    const segment = segments[s]
    for (let i = segment.length - 1; i > 0; i--) {
      const a = segment[i - 1]
      const b = segment[i]
      const stepMeters = haversineMeters(a.lat, a.lng, b.lat, b.lng)
      const stepSeconds = (b.t - a.t) / 1000
      if (!isMovingStep(stepMeters, stepSeconds)) continue
      const remaining = PACE_WINDOW_METERS - distanceMeters
      if (stepMeters >= remaining) {
        return { distanceMeters: PACE_WINDOW_METERS, movingSeconds: movingSeconds + (stepSeconds * remaining) / stepMeters }
      }
      distanceMeters += stepMeters
      movingSeconds += stepSeconds
    }
  }
  return distanceMeters < MIN_PACE_DISTANCE_METERS ? null : { distanceMeters, movingSeconds }
}
