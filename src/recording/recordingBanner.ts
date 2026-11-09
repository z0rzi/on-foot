import { formatStopwatch } from '../activities/format'
import type { RecordingPhase } from './recordingPhase'

// The pushed screens' sign that a recording runs; null when there is none to show.
export function recordingBannerText(phase: RecordingPhase, elapsedSeconds: number): string | null {
  switch (phase) {
    case 'idle':
      return null
    case 'recording':
      return `● Recording · ${formatStopwatch(elapsedSeconds)}`
    case 'paused':
      return `⏸ Paused · ${formatStopwatch(elapsedSeconds)}`
  }
}
