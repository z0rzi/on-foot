import { useEffect, useMemo } from 'react'
import { routeDisplay, type RouteDisplay } from '../elevation/routeDisplay'
import { usePreferencesStore } from '../settings/preferencesStore'
import { logEvent } from '../log'
import { profileSourceFor } from './profileSource'
import { routeTiming } from './routeTiming'
import type { MapMode } from './mapMode'
import type { Trail } from '../data/trails/types'
import type { Activity, TrackPoint } from '../data/activities/types'

// The one place the elevation view of the on-screen route is derived, and the only place the
// smoothing preference is read for display. Everything that draws the route or its graph takes
// the result from here, so the map and the graph can never disagree about where a band begins.
// The source is memoised separately from the display: in recording mode with a trail followed,
// profileSourceFor returns the trail's own segment array on every call, so segments holds across
// GPS fix batches even though the source object wrapping it is new each time. The second memo is
// keyed on kind and segments rather than on source itself so that reference stability still
// reaches it, and the profile/banding pass below does not re-run per fix. The pass is timed where
// it runs, in render, and logged once committed (T-4); the live track's is not, it runs again on
// every fix batch.
export function useRouteDisplay(
  mode: MapMode,
  trail: Trail | null,
  activity: Activity | null,
  liveSegments: TrackPoint[][],
): RouteDisplay | null {
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)
  const source = useMemo(
    () => profileSourceFor(mode, trail, activity, liveSegments),
    [mode, trail, activity, liveSegments],
  )
  const kind = source?.kind ?? null
  const segments = source?.segments ?? null
  const derived = useMemo(() => {
    if (!kind) return null
    // eslint-disable-next-line react-hooks/purity -- a measurement for the log, not render input
    const start = performance.now()
    const display = routeDisplay(kind, segments, smoothing)
    // eslint-disable-next-line react-hooks/purity -- a measurement for the log, not render input
    const ms = performance.now() - start
    return { display, timing: kind === 'live' ? null : routeTiming(kind, segments ?? [], ms) }
  }, [kind, segments, smoothing])
  const timing = derived?.timing ?? null
  useEffect(() => {
    if (timing) logEvent('info', 'map', 'route derived', timing)
  }, [timing])
  return derived?.display ?? null
}
