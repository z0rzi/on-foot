import { ElevationProfile, GradeBand } from './profile'
import { SlopeBand } from './slope'
import { bandSamples } from './bandGeometry'

export interface SlopeRun { band: GradeBand; coordinates: [number, number][] } // [lng, lat]

// Split a route into one [lng, lat] polyline per slope band. Runs are scoped per segment — a run
// never crosses a break. Boundary coords are interpolated within the segment so adjacent runs
// share their join.
export function buildSlopeRuns(profile: ElevationProfile, bands: SlopeBand[]): SlopeRun[] {
  return bands
    .map((b) => ({ band: b.band, coordinates: bandSamples(profile, b).map((s): [number, number] => [s.lng, s.lat]) }))
    .filter((r) => r.coordinates.length >= 2)
}
