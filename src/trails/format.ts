import type { TrailMetrics } from '../data/trails/types'
import { formatDistance, formatDuration, formatElevation } from '../format/units'
import type { ClimbAhead, TrailAhead } from '../elevation/trailAhead'
import type { MetricTile } from '../components/MetricsGrid'

// How many activities a trail's family holds (D105).
export function formatCompleted(count: number): string {
  return `Completed ${count}×`
}

export function formatTrailSummary(metrics: TrailMetrics): string {
  const distance = formatDistance(metrics.distanceMeters)
  return metrics.elevationGainMeters === null
    ? `${distance} · no elevation data`
    : `${distance} · ${formatElevation(metrics.elevationGainMeters)} gain`
}

// A trail's metrics as the trail card and the trail form show them.
export function trailMetricTiles(metrics: TrailMetrics): MetricTile[] {
  return [
    { label: 'Distance', value: formatDistance(metrics.distanceMeters) },
    { label: 'Elevation gain', value: formatElevation(metrics.elevationGainMeters) },
    { label: 'Elevation loss', value: formatElevation(metrics.elevationLossMeters) },
  ]
}

export type AheadLineKind = 'end' | 'climb' | 'offTrail'

interface AheadLine {
  kind: AheadLineKind
  text: string
}

// null is no place on the trail: the recording is off it, or has matched no point yet.
export function formatTrailAhead(ahead: TrailAhead | null): AheadLine[] {
  if (!ahead) return [{ kind: 'offTrail', text: 'Not on the trail' }]
  return [
    { kind: 'end', text: formatEnd(ahead.leftMeters, ahead.walkingSeconds) },
    { kind: 'climb', text: formatClimb(ahead.climb) },
  ]
}

// With no distance to read, there is no time to give either.
function formatEnd(leftMeters: number, walkingSeconds: number): string {
  const distance = formatDistance(leftMeters)
  return distance === formatDistance(0)
    ? 'At the trail end'
    : `Trail end in ${formatWalkingTime(walkingSeconds)} (${distance})`
}

function formatClimb(climb: ClimbAhead): string {
  switch (climb.kind) {
    case 'next':
      return `Next climb in ${formatWalkingTime(climb.walkingSeconds)} (${formatDistance(climb.distanceMeters)}) · ${formatElevation(climb.heightMeters)} to climb`
    case 'climbing':
      return `Climbing · ${formatWalkingTime(climb.walkingSeconds)} to the top (${formatElevation(climb.heightMeters)} up)`
    case 'none':
      return 'No climb left'
  }
}

function formatWalkingTime(seconds: number): string {
  return formatDuration(Math.max(1, Math.round(seconds / 60)) * 60)
}
