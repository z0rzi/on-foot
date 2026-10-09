import { useMemo } from 'react'
import { routeDisplay, type RouteDisplay } from '../elevation/routeDisplay'
import { usePreferencesStore } from '../settings/preferencesStore'
import { profileSourceFor } from './profileSource'
import type { MapMode } from '../store/mapStore'
import type { Trail } from '../data/trails/types'
import type { Activity, LiveTrackPoint } from '../data/activities/types'

// The one place the elevation view of the on-screen route is derived, and the only place the
// smoothing preference is read for display. Everything that draws the route or its graph takes
// the result from here, so the map and the graph can never disagree about where a band begins.
// The source is memoised separately from the display: in recording mode with a trail followed,
// profileSourceFor returns the trail's own segment array on every call, so segments holds across
// GPS fix batches even though the source object wrapping it is new each time. The second memo is
// keyed on kind and segments rather than on source itself so that reference stability still
// reaches it, and the profile/banding pass below does not re-run per fix.
export function useRouteDisplay(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  livePoints: LiveTrackPoint[],
): RouteDisplay | null {
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const source = useMemo(
    () => profileSourceFor(mode, trail, activity, livePoints),
    [mode, trail, activity, livePoints],
  )
  const kind = source?.kind ?? null
  const segments = source?.segments ?? null
  return useMemo(
    () => (kind ? routeDisplay(kind, segments, smoothing) : null),
    [kind, segments, smoothing],
  )
}
