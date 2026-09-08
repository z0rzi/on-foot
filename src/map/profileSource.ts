import { groupPointsBySegment } from '../data/activities/mapping'
import type { MapMode } from '../store/mapStore'
import type { Trail } from '../data/trails/types'
import type { Activity, LiveTrackPoint } from '../data/activities/types'
import type { ElePoint } from '../elevation/profile'

export function profileSegmentsFor(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): ElePoint[][] | null {
  const segments =
    mode === 'trail' ? trail?.geometry.segments
    : mode === 'activity' ? activity?.geometry.segments
    : mode === 'recording' ? (trail ? trail.geometry.segments : groupPointsBySegment(livePoints))
    : undefined
  return segments ?? null
}
