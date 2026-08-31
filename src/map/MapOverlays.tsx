import { useMemo } from 'react'
import { useMapProvider } from './provider'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'
import { segmentLines, connectorLines, overallEndpoints } from './geo'
import type { GpxPoint } from '../data/trails/types'
import type { TrackPoint } from '../data/activities/types'

const trailArrow = require('../assets/trail-arrow.png')

export type OverlayRoute = { segments: GpxPoint[][]; kind: 'trail' | 'activity' }

// The map's data overlays in a fixed painter's order: the route (trail or activity) beneath, the
// live recording track above it. The z-order lives here so the "recording line above the trail
// line" invariant is structural — callers choose what to show, not how the layers stack.
export function MapOverlays({
  route,
  liveSegments,
  showLiveTrack,
}: {
  route: OverlayRoute | null
  liveSegments: TrackPoint[][]
  showLiveTrack: boolean
}) {
  const { components } = useMapProvider()
  const c = useTheme()
  const { TrailOverlay, RouteLine } = components

  const routeSegments = route?.segments ?? null
  const routeKind = route?.kind ?? null
  const routeLines = useMemo(() => (routeSegments ? segmentLines(routeSegments) : null), [routeSegments])
  const routeConnectors = useMemo(() => (routeSegments ? connectorLines(routeSegments) : null), [routeSegments])
  const routeEndpoints = useMemo(() => (routeSegments ? overallEndpoints(routeSegments) : null), [routeSegments])
  const liveLines = useMemo(() => segmentLines(liveSegments), [liveSegments])
  const liveConnectors = useMemo(() => connectorLines(liveSegments), [liveSegments])

  return (
    <>
      {routeLines && routeConnectors && routeEndpoints && routeLines.length > 0 &&
        (routeKind === 'activity' ? (
          <TrailOverlay
            lines={routeLines}
            connectors={routeConnectors}
            connectorDashArray={[...MapTokens.connectorDashArray]}
            endpoints={routeEndpoints}
            color={c.activityLine}
            lineWidth={MapTokens.trailLineWidth}
            endpointRadius={MapTokens.endpointRadius}
            endpointStrokeColor={c.trailEndpointStroke}
            endpointStrokeWidth={MapTokens.endpointStrokeWidth}
          />
        ) : (
          <TrailOverlay
            lines={routeLines}
            connectors={routeConnectors}
            connectorDashArray={[...MapTokens.connectorDashArray]}
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
        <RouteLine
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
