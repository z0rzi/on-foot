import type { PaceWindow } from './currentPace'
import type { PaceSpeedMode } from '../settings/preferencesStore'
import { formatDistance, formatElevation } from '../format/units'
import { formatPace, formatSpeed, formatStopwatch } from '../activities/format'

export interface RecordingFigure {
  value: string
  label: string
}

// The recording's four figures, in display order: time, distance, pace (or speed), gain.
export function recordingFigures(input: {
  movingSeconds: number
  distanceMeters: number
  gainMeters: number | null
  pace: PaceWindow | null
  paceSpeedMode: PaceSpeedMode
}): [RecordingFigure, RecordingFigure, RecordingFigure, RecordingFigure] {
  const { pace } = input
  const paceFigure =
    input.paceSpeedMode === 'pace'
      ? { value: pace ? formatPace(pace.distanceMeters, pace.movingSeconds) : '—', label: '/km' }
      : { value: pace ? formatSpeed(pace.distanceMeters, pace.movingSeconds) : '—', label: 'km/h' }
  return [
    { value: formatStopwatch(input.movingSeconds), label: 'time' },
    { value: formatDistance(input.distanceMeters), label: 'distance' },
    paceFigure,
    { value: formatElevation(input.gainMeters), label: 'gain' },
  ]
}
