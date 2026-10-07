import { useMemo } from 'react'
import { routeDisplay, type RouteDisplay } from '../elevation/routeDisplay'
import { usePreferencesStore } from '../settings/preferencesStore'
import { profileSegmentsFor } from './profileSource'
import type { MapMode } from '../store/mapStore'
import type { Trail } from '../data/trails/types'
import type { Activity, LiveTrackPoint } from '../data/activities/types'

// The one place the elevation view of the on-screen route is derived, and the only place the
// smoothing preference is read for display. Everything that draws the route or its graph takes
// the result from here, so the map and the graph can never disagree about where a band begins.
// Segments are memoised separately from the display: in recording mode with a trail followed,
// profileSegmentsFor returns the trail's own segment array on every call, so that memo holds
// across GPS fix batches and the profile/banding pass below does not re-run per fix.
export function useRouteDisplay(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): RouteDisplay | null {
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const segments = useMemo(
    () => profileSegmentsFor(mode, trail, activity, livePoints),
    [mode, trail, activity, livePoints],
  )
  return useMemo(() => routeDisplay(segments, smoothing), [segments, smoothing])
}
