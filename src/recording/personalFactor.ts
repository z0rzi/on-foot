import { storedElevationSeries } from '../data/geo/elevationFilter'
import { elevatedRuns } from '../data/geo/metrics'
import type { ActivitySummary, TrackPoint } from '../data/activities/types'
import { toblerSeconds } from '../elevation/tobler'
import { isMovingStep } from './movingStep'

const HISTORY_ACTIVITIES = 5
const MIN_MEASURED_METERS = 2000
const BLEND_METERS = 2000
const MIN_FACTOR = 0.5
const MAX_FACTOR = 2

interface TrackMeasure { movingSeconds: number; toblerTimeSeconds: number; movingMeters: number }

// The walker's factor on the hike in progress: the history's, moving to the hike's own over its
// first BLEND_METERS of measured steps.
export function personalFactor(history: number, live: TrackPoint[][]): number {
  const m = measure(live)
  const w = Math.min(1, m.movingMeters / BLEND_METERS)
  const blended = w > 0 ? (1 - w) * history + w * factorOf(m) : history
  return Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, blended))
}

// The activities the history is read from: the most recent HISTORY_ACTIVITIES long enough to qualify.
export function historyActivityIds(summaries: ActivitySummary[]): number[] {
  return summaries
    .filter((a) => a.metrics.distanceMeters >= MIN_MEASURED_METERS)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, HISTORY_ACTIVITIES)
    .map((a) => a.id)
}

// The median factor of the tracks with at least MIN_MEASURED_METERS of measured steps; 1 with none.
export function historyFactor(tracks: TrackPoint[][][]): number {
  const factors = tracks
    .map(measure)
    .filter((m) => m.movingMeters >= MIN_MEASURED_METERS)
    .map(factorOf)
    .sort((a, b) => a - b)
  if (factors.length === 0) return 1
  const mid = Math.floor(factors.length / 2)
  return factors.length % 2 ? factors[mid] : (factors[mid - 1] + factors[mid]) / 2
}

// A track's factor is its moving time over Tobler's time on the same steps (D87).
function factorOf(m: TrackMeasure): number {
  return m.movingSeconds / m.toblerTimeSeconds
}

// Elevation is smoothed as stored gain reads it, steps without elevation and stops are left out, and
// segments are never crossed.
function measure(segments: TrackPoint[][]): TrackMeasure {
  const total: TrackMeasure = { movingSeconds: 0, toblerTimeSeconds: 0, movingMeters: 0 }
  for (const run of segments.flatMap((segment) => elevatedRuns(segment).runs)) {
    const eles = storedElevationSeries(run)
    for (let i = 1; i < run.length; i++) {
      const meters = run[i].distance - run[i - 1].distance
      const seconds = (run[i].point.t - run[i - 1].point.t) / 1000
      if (!isMovingStep(meters, seconds)) continue
      total.movingSeconds += seconds
      total.movingMeters += meters
      total.toblerTimeSeconds += toblerSeconds(meters, (eles[i] - eles[i - 1]) / meters)
    }
  }
  return total
}
