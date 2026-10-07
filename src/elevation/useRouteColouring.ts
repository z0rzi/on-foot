import { useMemo } from 'react'
import type { ColouredLine } from '../map/provider/types'
import { useTheme } from '../theme/useTheme'
import { buildSlopeRuns } from './mapSlope'
import { slopeBandColour } from './slopeColour'
import type { RouteDisplay } from './routeDisplay'

// Slope-colours a route today. This hook OWNS the metric choice — future speed-colouring for
// activities branches HERE, keeping the map seam metric-agnostic. The bands arrive already
// derived, so the colours and the graph can never disagree. Returns undefined when there is
// nothing to colour (no route, or a route with no elevation), which draws a plain line.
export function useRouteColouring(display: RouteDisplay | null): ColouredLine[] | undefined {
  const c = useTheme()

  return useMemo(() => {
    if (!display) return undefined
    return buildSlopeRuns(display.profile, display.bands).map((r) => ({
      coordinates: r.coordinates,
      color: slopeBandColour(r.band, c),
    }))
  }, [display, c])
}
