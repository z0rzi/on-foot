import { haversineMeters } from '../data/geo/metrics'
import type { LiveTrackPoint } from '../data/activities/types'
import { toOneDecimal, type LogLevel } from '../log'

export const HEADING_CHECK_EVERY_MS = 10_000
const HEADING_SAMPLE_EVERY_MS = 5 * 60_000
const HEADING_STALL_AFTER_MS = 60_000
const HEADING_STALL_MIN_MOVED_M = 50

interface TimedHeading {
  t: number
  degrees: number
  accuracy: number
}

// What one heading watch has seen (T-89): the readings of the current sample window, and when
// the compass last said anything.
interface HeadingMonitor {
  startedAt: number
  windowStartedAt: number
  lastReadingAt: number | null
  readings: TimedHeading[]
  stalled: boolean
}

interface HeadingStep {
  monitor: HeadingMonitor
  entries: { level: Extract<LogLevel, 'info' | 'warn'>; message: string; detail?: Record<string, unknown> }[]
}

export function startHeadingMonitor(now: number): HeadingMonitor {
  return { startedAt: now, windowStartedAt: now, lastReadingAt: null, readings: [], stalled: false }
}

// A reading is the compass having turned, so the first one after a stall ends it.
export function headingReading(monitor: HeadingMonitor, reading: TimedHeading): HeadingStep {
  return {
    monitor: { ...monitor, lastReadingAt: reading.t, readings: [...monitor.readings, reading], stalled: false },
    entries: monitor.stalled ? [{ level: 'info', message: 'heading resumed' }] : [],
  }
}

// The smallest arc that holds every heading, so 350° and 5° are 15° apart, not 345°.
function headingSpreadDeg(degrees: readonly number[]): number {
  if (degrees.length < 2) return 0
  const sorted = degrees.map((d) => ((d % 360) + 360) % 360).sort((a, b) => a - b)
  let widestGap = 360 - sorted[sorted.length - 1] + sorted[0]
  for (let i = 1; i < sorted.length; i++) widestGap = Math.max(widestGap, sorted[i] - sorted[i - 1])
  return 360 - widestGap
}

// The length of the recorded track since an instant: a distance, the only thing the heading
// entries say of the position. Steps never cross a segment boundary.
export function metresMovedSince(points: readonly LiveTrackPoint[], since: number): number {
  let metres = 0
  for (let i = points.length - 1; i > 0 && points[i - 1].t >= since; i--) {
    const a = points[i - 1]
    const b = points[i]
    if (a.segment === b.segment) metres += haversineMeters(a.lat, a.lng, b.lat, b.lng)
  }
  return metres
}

// One periodic look at the watch. A sample closes each HEADING_SAMPLE_EVERY_MS window. A stall is
// silence: no reading since the last one (or since the watch began) for HEADING_STALL_AFTER_MS,
// over which the recording moved HEADING_STALL_MIN_MOVED_M. Both are measured from that last
// reading, so a slow walker trips it later and one standing still never does. It is said once.
export function headingTick(monitor: HeadingMonitor, now: number, movedSince: (t: number) => number): HeadingStep {
  const entries: HeadingStep['entries'] = []
  let { windowStartedAt, readings, stalled } = monitor

  if (now - windowStartedAt >= HEADING_SAMPLE_EVERY_MS) {
    entries.push({
      level: 'info',
      message: 'heading sample',
      detail: {
        updates: readings.length,
        spreadDeg: toOneDecimal(headingSpreadDeg(readings.map((r) => r.degrees))),
        accuracy: readings.length ? readings[readings.length - 1].accuracy : null,
        movedM: Math.round(movedSince(windowStartedAt)),
      },
    })
    windowStartedAt = now
    readings = []
  }

  const silentSince = monitor.lastReadingAt ?? monitor.startedAt
  if (!stalled && now - silentSince >= HEADING_STALL_AFTER_MS) {
    const movedM = movedSince(silentSince)
    if (movedM >= HEADING_STALL_MIN_MOVED_M) {
      entries.push({
        level: 'warn',
        message: 'heading stalled',
        detail: { silentS: Math.floor((now - silentSince) / 1000), movedM: Math.round(movedM) },
      })
      stalled = true
    }
  }

  return { monitor: { ...monitor, windowStartedAt, readings, stalled }, entries }
}
