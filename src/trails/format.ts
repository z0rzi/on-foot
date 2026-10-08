import type { TrailMetrics } from '../data/trails/types'
import { formatDistance, formatElevation } from '../format/units'

export function formatMetricsSummary(metrics: TrailMetrics): string {
  const distance = formatDistance(metrics.distanceMeters)
  return metrics.elevationGainMeters === null
    ? `${distance} • no elevation data`
    : `${distance} • ${formatElevation(metrics.elevationGainMeters)} gain`
}
