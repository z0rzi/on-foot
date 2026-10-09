import { useMemo } from 'react'
import { useMapProvider } from './provider'
import type { ColouredLine } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { segmentLines, connectorLines, overallEndpoints } from './geo'
import type { GpxPoint } from '../data/trails/types'
import type { TrackPoint } from '../data/activities/types'
import type { RouteSource } from '../elevation/routeDisplay'

const trailArrow = require('../assets/trail-arrow.png')

export type OverlayRoute = { segments: GpxPoint[][]; kind: 'trail' | 'activity' }

// The map's data overlays in a fixed painter's order: the route (trail or activity) beneath, the
// live recording track above it. The z-order lives here so the "recording line above the trail
// line" invariant is structural — callers choose what to show, not how the layers stack. The
// colouring follows the route it was derived from: it lands on the route overlay or the live
// overlay depending on which one `colouring.kind` names, never both.
export function MapOverlays({
  route,
  liveSegments,
  showLiveTrack,
  colouring,
}: {
  route: OverlayRoute | null
  liveSegments: TrackPoint[][]
  showLiveTrack: boolean
  colouring?: { kind: RouteSource; lines: ColouredLine[] }
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
  const liveColouring = colouring?.kind === 'live' ? colouring.lines : undefined

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
          colouredLines={colouring?.kind === routeKind ? colouring.lines : undefined}
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
          colouredLines={liveColouring}
          // The slope palette has near-white bands that vanish on a light basemap without an
          // outline; the solid recording colour is already legible, so only the coloured case
          // needs one.
          casing={liveColouring != null}
        />
      )}
    </>
  )
}
