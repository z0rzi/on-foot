import { useMemo } from 'react'
import type { ColouredLine } from '../map/provider/types'
import { useTheme } from '../theme/useTheme'
import { usePreferencesStore } from '../settings/preferencesStore'
import { buildElevationProfile } from './profile'
import { displaySlopeBands } from './slope'
import { buildSlopeRuns } from './mapSlope'
import { slopeBandColour } from './slopeColour'
import type { GpxPoint } from '../data/trails/types'

// Slope-colours a route today; reads the smoothing preference internally. This hook OWNS the
// metric choice — future speed-colouring for activities branches HERE, keeping the map seam
// metric-agnostic. Returns undefined when the route has no elevation (plain line).
export function useRouteColouring(segments: GpxPoint[][] | null): ColouredLine[] | undefined {
  const c = useTheme()
  const smoothing = usePreferencesStore((s) => s.elevationSmoothingMeters)

  return useMemo(() => {
    if (!segments) return undefined
    const profile = buildElevationProfile(segments)
    if (!profile) return undefined
    const { bands } = displaySlopeBands(profile, smoothing)
    return buildSlopeRuns(profile, bands).map((r) => ({
      coordinates: r.coordinates,
      color: slopeBandColour(r.band, c),
    }))
  }, [segments, smoothing, c])
}
