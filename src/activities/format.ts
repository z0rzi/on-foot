import { ActivityMetrics } from '../data/activities/types'
import { formatDistance } from '../data/geo/metrics'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const twoDigits = (n: number): string => n.toString().padStart(2, '0')

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
  const mm = hours > 0 ? twoDigits(minutes) : minutes.toString()
  const ss = twoDigits(seconds)
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
  return `${minutes}:${twoDigits(seconds)}`
}

export function formatSpeed(distanceMeters: number, durationSeconds: number): string {
  if (durationSeconds <= 0) return '—'
  const kmh = distanceMeters / 1000 / (durationSeconds / 3600)
  return kmh.toFixed(1)
}

export function formatClockTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}`
}

export function formatClockSeconds(timestamp: number): string {
  const d = new Date(timestamp)
  return `${twoDigits(d.getHours())}:${twoDigits(d.getMinutes())}:${twoDigits(d.getSeconds())}`
}

export function formatCalendarClockSeconds(timestamp: number): string {
  const d = new Date(timestamp)
  return `${twoDigits(d.getMonth() + 1)}-${twoDigits(d.getDate())} ${formatClockSeconds(timestamp)}`
}
