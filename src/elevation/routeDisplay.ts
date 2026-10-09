import { buildElevationProfile, type ElePoint, type ElevationProfile } from './profile'
import { displaySlopeBands, type SlopeBand } from './slope'

export type RouteSource = 'trail' | 'activity' | 'live'

// The elevation view of one route: what is plotted, and where its colour bands fall. The raw
// profile carries the coordinates and the plotted line; the smoothed one exists only so the band
// boundaries and the scrubbed grade read from the same series the smoothing preference produced.
// kind names which route this view describes, so callers deciding what to colour on screen can
// match the view to the right overlay instead of re-deriving the choice themselves.
export interface RouteDisplay {
  kind: RouteSource
  profile: ElevationProfile
  smoothed: ElevationProfile
  bands: SlopeBand[]
}

export function routeDisplay(
  kind: RouteSource,
  segments: ElePoint[][] | null,
  smoothingMeters: number,
): RouteDisplay | null {
  if (!segments) return null
  const profile = buildElevationProfile(segments)
  if (!profile) return null
  return { kind, profile, ...displaySlopeBands(profile, smoothingMeters) }
}
