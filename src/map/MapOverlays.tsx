import { useMemo } from 'react'
import { useMapProvider } from './provider'
import type { ColouredLine } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { segmentLines, connectorLines, overallEndpoints } from './geo'
import type { GpxPoint } from '../data/trails/types'
import type { TrackPoint } from '../data/activities/types'

const trailArrow = require('../assets/trail-arrow.png')

export type OverlayRoute = { segments: GpxPoint[][]; kind: 'trail' | 'activity' }

// The map's data overlays in a fixed painter's order: the route (trail or activity) beneath, the
// live recording track above it. The z-order lives here so the "recording line above the trail
// line" invariant is structural — callers choose what to show, not how the layers stack. The
// colouring only ever reaches the route overlay; the live track keeps its own colour.
export function MapOverlays({
  route,
  liveSegments,
  showLiveTrack,
  colouredLines,
}: {
  route: OverlayRoute | null
  liveSegments: TrackPoint[][]
  showLiveTrack: boolean
  colouredLines?: ColouredLine[]
}) {
  const { components } = useMapProvider()
  const c = useTheme()
  const { RouteOverlay } = components

  const routeSegments = route?.segments ?? null
  const routeKind = route?.kind ?? null
  const routeLines = useMemo(() => (routeSegments ? segmentLines(routeSegments) : null), [routeSegments])
  const routeConnectors = useMemo(() => (routeSegments ? connectorLines(routeSegments) : null), [routeSegments])
  const routeEndpoints = useMemo(() => (routeSegments ? overallEndpoints(routeSegments) : null), [routeSegments])
  const liveLines = useMemo(() => segmentLines(liveSegments), [liveSegments])
  const liveConnectors = useMemo(() => connectorLines(liveSegments), [liveSegments])

  const isActivity = routeKind === 'activity'
  const arrowProps = isActivity
    ? {}
    : { arrowImage: trailArrow, arrowSpacing: MapTokens.arrowSpacing, arrowSize: MapTokens.arrowSize }

  return (
    <>
      {routeLines && routeConnectors && routeEndpoints && routeLines.length > 0 && (
        <RouteOverlay
          idPrefix="trail"
          lines={routeLines}
          connectors={routeConnectors}
          connectorDashArray={[...MapTokens.connectorDashArray]}
          color={isActivity ? c.activityLine : c.trailLine}
          lineWidth={MapTokens.trailLineWidth}
          colouredLines={colouredLines}
          casing
          {...arrowProps}
          endpoints={{
            points: routeEndpoints,
            radius: MapTokens.endpointRadius,
            strokeColor: c.trailEndpointStroke,
            strokeWidth: MapTokens.endpointStrokeWidth,
          }}
        />
      )}
      {showLiveTrack && (
        <RouteOverlay
          idPrefix="route"
          lines={liveLines}
          connectors={liveConnectors}
          connectorDashArray={[...MapTokens.connectorDashArray]}
          color={c.recordingLine}
          lineWidth={MapTokens.recordingLineWidth}
        />
      )}
    </>
  )
}
