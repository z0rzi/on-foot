import { GpxPoint, TrailMetrics } from '../trails/types'
import { ElevationPoint, elevationChange } from './elevationFilter'

const EARTH_RADIUS_M = 6371000

const toRad = (deg: number): number => (deg * Math.PI) / 180

export function haversineMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const lat1 = toRad(aLat)
  const lat2 = toRad(bLat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

interface ElevatedPoint<P extends GpxPoint> extends ElevationPoint { point: P }

interface ElevatedRuns<P extends GpxPoint> {
  distanceMeters: number
  runs: ElevatedPoint<P>[][]
}

// Runs of consecutive points that carry elevation, each point at its distance along the track. A
// point without elevation breaks the run: bridging the gap would invent gain over ground whose
// profile is unknown.
export function elevatedRuns<P extends GpxPoint>(points: P[]): ElevatedRuns<P> {
  let distanceMeters = 0
  const runs: ElevatedPoint<P>[][] = []
  let run: ElevatedPoint<P>[] = []
  for (let i = 0; i < points.length; i++) {
    if (i > 0) {
      const prev = points[i - 1]
      distanceMeters += haversineMeters(prev.lat, prev.lng, points[i].lat, points[i].lng)
    }
    const point = points[i]
    if (point.ele === null) {
      if (run.length > 0) runs.push(run)
      run = []
      continue
    }
    run.push({ point, distance: distanceMeters, ele: point.ele })
  }
  if (run.length > 0) runs.push(run)
  return { distanceMeters, runs }
}

export function computeMetrics(points: GpxPoint[]): TrailMetrics {
  const { distanceMeters, runs } = elevatedRuns(points)
  if (runs.length === 0) {
    return { distanceMeters, elevationGainMeters: null, elevationLossMeters: null }
  }
  let elevationGainMeters = 0
  let elevationLossMeters = 0
  for (const elevated of runs) {
    const change = elevationChange(elevated)
    elevationGainMeters += change.gainMeters
    elevationLossMeters += change.lossMeters
  }
  return { distanceMeters, elevationGainMeters, elevationLossMeters }
}

export function metricsForSegments(segments: GpxPoint[][]): TrailMetrics {
  let distanceMeters = 0
  let gain = 0
  let loss = 0
  let hasElevation = false
  for (const segment of segments) {
    const m = computeMetrics(segment)
    distanceMeters += m.distanceMeters
    if (m.elevationGainMeters !== null) {
      hasElevation = true
      gain += m.elevationGainMeters
      loss += m.elevationLossMeters ?? 0
    }
  }
  return {
    distanceMeters,
    elevationGainMeters: hasElevation ? gain : null,
    elevationLossMeters: hasElevation ? loss : null,
  }
}

