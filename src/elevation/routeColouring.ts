import type { ColouredLine } from '../map/provider/types'
import type { AppColors } from '../theme/colors'
import { buildSlopeRuns } from './mapSlope'
import { slopeBandColour } from './slopeColour'
import type { RouteDisplay } from './routeDisplay'

// Slope-colours a route today. This layer OWNS the metric choice — future speed-colouring for
// activities branches HERE, keeping the map seam metric-agnostic. The bands arrive already
// derived, so the colours and the graph can never disagree. Returns undefined when there is
// nothing to colour (no route, or a route with no elevation), which draws a plain line.
export function routeColouring(
  display: RouteDisplay | null,
  c: AppColors,
): ColouredLine[] | undefined {
  if (!display) return undefined
  const runs = buildSlopeRuns(display.profile, display.bands)
  if (!runs.length) return undefined
  return runs.map((r) => ({
    coordinates: r.coordinates,
    color: slopeBandColour(r.band, c),
  }))
}
