import { GpxPoint, TrailMetrics } from '../types'

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

export function computeMetrics(points: GpxPoint[]): TrailMetrics {
  let distanceMeters = 0
  let elevationGainMeters = 0
  let elevationLossMeters = 0
  const hasElevation = points.some((point) => point.ele !== null)
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    distanceMeters += haversineMeters(prev.lat, prev.lng, cur.lat, cur.lng)
    if (prev.ele !== null && cur.ele !== null) {
      const delta = cur.ele - prev.ele
      if (delta > 0) elevationGainMeters += delta
      else elevationLossMeters += Math.abs(delta)
    }
  }
  return {
    distanceMeters,
    elevationGainMeters: hasElevation ? elevationGainMeters : null,
    elevationLossMeters: hasElevation ? elevationLossMeters : null,
  }
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

export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters.toFixed(0)} m`
}

export function formatElevation(meters: number | null): string {
  return meters === null ? '—' : `${meters.toFixed(0)} m`
}

export function formatMetricsSummary(metrics: TrailMetrics): string {
  const distance = formatDistance(metrics.distanceMeters)
  return metrics.elevationGainMeters === null
    ? `${distance} • no elevation data`
    : `${distance} • ${formatElevation(metrics.elevationGainMeters)} gain`
}
