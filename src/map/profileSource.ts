import type { RouteSource } from '../elevation/routeDisplay'
import type { MapMode } from './mapMode'
import type { Trail } from '../data/trails/types'
import type { Activity, TrackPoint } from '../data/activities/types'
import type { ElePoint } from '../elevation/profile'

export function profileSourceFor(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  liveSegments: TrackPoint[][],
): { kind: RouteSource; segments: ElePoint[][] } | null {
  if (mode === 'trail') return trail ? { kind: 'trail', segments: trail.geometry.segments } : null
  if (mode === 'activity') {
    return activity ? { kind: 'activity', segments: activity.geometry.segments } : null
  }
  if (mode === 'recording') {
    return trail
      ? { kind: 'trail', segments: trail.geometry.segments }
      : { kind: 'live', segments: liveSegments }
  }
  return null
}
