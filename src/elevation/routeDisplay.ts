import { buildElevationProfile, type ElePoint, type ElevationProfile } from './profile'
import { displaySlopeBands, type SlopeBand } from './slope'

// The elevation view of one route: what is plotted, and where its colour bands fall. The raw
// profile carries the coordinates and the plotted line; the smoothed one exists only so the band
// boundaries and the scrubbed grade read from the same series the smoothing preference produced.
export interface RouteDisplay {
  profile: ElevationProfile
  smoothed: ElevationProfile
  bands: SlopeBand[]
}

export function routeDisplay(
  segments: ElePoint[][] | null,
  smoothingMeters: number,
): RouteDisplay | null {
  if (!segments) return null
  const profile = buildElevationProfile(segments)
  if (!profile) return null
  return { profile, ...displaySlopeBands(profile, smoothingMeters) }
}
