import type { MapMode } from './mapMode'
import type { RecordingHealth, RecordingWarning } from '../recording/streamHealth'
import { recordingWarning } from '../recording/streamHealth'
import { formatDistance, formatElevation } from '../format/units'
import { formatActivityDate } from '../activities/format'

// The Map's top pill: one sentence per state.
export type PillContent =
  | { kind: 'figures'; warning: RecordingWarning | null }
  | { kind: 'paused' }
  | { kind: 'trail'; name: string; detail: string; clearLabel: string }
  | { kind: 'activity'; name: string; detail: string; clearLabel: string }
  | { kind: 'none' }

export type PillKind = PillContent['kind']

export interface PillInput {
  mode: MapMode
  health: RecordingHealth
  trail: { name: string; metrics: { distanceMeters: number; elevationGainMeters: number | null } } | null
  activity: { name: string; startedAt: number } | null
}

export function pillContent({ mode, health, trail, activity }: PillInput): PillContent {
  switch (mode) {
    case 'recording':
      return health.kind === 'paused' ? { kind: 'paused' } : { kind: 'figures', warning: recordingWarning(health) }
    case 'trail': {
      if (!trail) return { kind: 'none' }
      const { distanceMeters, elevationGainMeters } = trail.metrics
      const distance = formatDistance(distanceMeters)
      return {
        kind: 'trail',
        name: trail.name,
        detail: elevationGainMeters == null ? distance : `${distance} · ${formatElevation(elevationGainMeters)} gain`,
        clearLabel: 'Stop showing trail',
      }
    }
    case 'activity':
      return activity
        ? {
            kind: 'activity',
            name: activity.name,
            detail: formatActivityDate(activity.startedAt),
            clearLabel: 'Stop showing activity',
          }
        : { kind: 'none' }
    case 'free':
      return { kind: 'none' }
  }
}
