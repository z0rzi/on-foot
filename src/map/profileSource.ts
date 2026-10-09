import { groupPointsBySegment } from '../data/activities/mapping'
import type { RouteSource } from '../elevation/routeDisplay'
import type { MapMode } from '../store/mapStore'
import type { Trail } from '../data/trails/types'
import type { Activity, LiveTrackPoint } from '../data/activities/types'
import type { ElePoint } from '../elevation/profile'

export function profileSourceFor(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): { kind: RouteSource; segments: ElePoint[][] } | null {
  if (mode === 'trail') return trail ? { kind: 'trail', segments: trail.geometry.segments } : null
  if (mode === 'activity') {
    return activity ? { kind: 'activity', segments: activity.geometry.segments } : null
  }
  if (mode === 'recording') {
    return trail
      ? { kind: 'trail', segments: trail.geometry.segments }
      : { kind: 'live', segments: groupPointsBySegment(livePoints) }
  }
  return null
}
