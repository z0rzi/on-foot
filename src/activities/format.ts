import { ActivityMetrics } from '../data/activities/types'
import { formatDistance } from '../data/geo/metrics'

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

export function formatStopwatch(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60
  const mm = hours > 0 ? minutes.toString().padStart(2, '0') : minutes.toString()
  const ss = seconds.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

export function formatActivityDate(startedAt: number): string {
  const d = new Date(startedAt)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

export function formatActivitySummary(metrics: ActivityMetrics): string {
  return `${formatDistance(metrics.distanceMeters)} · ${formatDuration(metrics.durationSeconds)}`
}

export function formatPace(distanceMeters: number, durationSeconds: number): string {
  if (distanceMeters <= 0 || durationSeconds <= 0) return '—'
  const secPerKm = durationSeconds / (distanceMeters / 1000)
  let minutes = Math.floor(secPerKm / 60)
  let seconds = Math.round(secPerKm % 60)
  if (seconds === 60) {
    minutes += 1
    seconds = 0
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatSpeed(distanceMeters: number, durationSeconds: number): string {
  if (durationSeconds <= 0) return '—'
  const kmh = distanceMeters / 1000 / (durationSeconds / 3600)
  return kmh.toFixed(1)
}
