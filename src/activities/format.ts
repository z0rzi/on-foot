import { ActivityMetrics } from '../data/activities/types'
import { formatDistance } from '../data/trails/gpx/metrics'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  return `${seconds}s`
}

export function formatActivityDate(startedAt: number): string {
  const d = new Date(startedAt)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatActivitySummary(metrics: ActivityMetrics): string {
  return `${formatDistance(metrics.distanceMeters)} · ${formatDuration(metrics.durationSeconds)}`
}
