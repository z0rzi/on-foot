import { useMemo } from 'react'
import { useMapProvider } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { toLineCoordinates, endpointCoordinates } from './geo'
import type { GpxPoint } from '../data/trails/types'
import type { TrackPoint } from '../data/activities/types'

const trailArrow = require('../assets/trail-arrow.png')

export type OverlayRoute = { points: GpxPoint[]; kind: 'trail' | 'activity' }

// The map's data overlays in a fixed painter's order: the route (trail or activity) beneath, the
// live recording track above it. The z-order lives here so the "recording line above the trail
// line" invariant is structural — callers choose what to show, not how the layers stack.
export function MapOverlays({
  route,
  livePoints,
  showLiveTrack,
}: {
  route: OverlayRoute | null
  livePoints: TrackPoint[]
  showLiveTrack: boolean
}) {
  const { components } = useMapProvider()
  const c = useTheme()
  const { TrailOverlay, RouteLine } = components

  const routePoints = route?.points ?? null
  const routeKind = route?.kind ?? null
  const routeLine = useMemo(() => (routePoints ? toLineCoordinates(routePoints) : null), [routePoints])
  const routeEndpoints = useMemo(
    () => (routePoints ? endpointCoordinates(routePoints) : null),
    [routePoints],
  )
  const liveLine = useMemo(() => toLineCoordinates(livePoints), [livePoints])

  return (
    <>
      {routeLine && routeEndpoints && (routePoints?.length ?? 0) >= 2 &&
        (routeKind === 'activity' ? (
          <TrailOverlay
            line={routeLine}
            endpoints={routeEndpoints}
            color={c.activityLine}
            lineWidth={MapTokens.trailLineWidth}
            endpointRadius={MapTokens.endpointRadius}
            endpointStrokeColor={c.trailEndpointStroke}
            endpointStrokeWidth={MapTokens.endpointStrokeWidth}
          />
        ) : (
          <TrailOverlay
            line={routeLine}
            endpoints={routeEndpoints}
            color={c.trailLine}
            lineWidth={MapTokens.trailLineWidth}
            arrowImage={trailArrow}
            arrowSpacing={MapTokens.arrowSpacing}
            arrowSize={MapTokens.arrowSize}
            endpointRadius={MapTokens.endpointRadius}
            endpointStrokeColor={c.trailEndpointStroke}
            endpointStrokeWidth={MapTokens.endpointStrokeWidth}
          />
        ))}
      {showLiveTrack && (
        <RouteLine line={liveLine} color={c.recordingLine} lineWidth={MapTokens.recordingLineWidth} />
      )}
    </>
  )
}
