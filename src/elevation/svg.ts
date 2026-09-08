import { ElevationProfile, GradeBand } from './profile'
import { SlopeBand } from './slope'
import { samplesForBands } from './bandGeometry'

export interface PlotScale { width: number; height: number }

export function projectX(distance: number, profile: ElevationProfile, width: number): number {
  if (profile.totalDistance <= 0) return 0
  return (distance / profile.totalDistance) * width
}

// Reserve a little headroom at the top so the highest peak isn't flush against the edge.
const Y_PAD_TOP = 6

export function projectY(ele: number, profile: ElevationProfile, height: number): number {
  const range = profile.maxEle - profile.minEle
  if (range <= 0) return height / 2
  return height - ((ele - profile.minEle) / range) * (height - Y_PAD_TOP)
}

export interface BandTop {
  band: GradeBand
  points: [number, number][]
}

// The projected top edge (the curve) of every band, each resolved within its own segment. Bands too
// short to draw are dropped here, so the path builders below never have to re-check.
export function buildBandTops(
  profile: ElevationProfile,
  bands: SlopeBand[],
  scale: PlotScale,
): BandTop[] {
  return samplesForBands(profile, bands)
    .map(({ band, samples }) => ({
      band,
      points: samples.map((s): [number, number] => [
        projectX(s.distance, profile, scale.width),
        projectY(s.ele, profile, scale.height),
      ]),
    }))
    .filter(({ points }) => points.length >= 2)
}

export interface BandArea { band: GradeBand; d: string }

// Closed to the baseline, so the band reads as filled ground beneath the curve.
export function areaPaths(tops: BandTop[], height: number): BandArea[] {
  return tops.map(({ band, points }) => {
    const x0 = points[0][0]
    const x1 = points[points.length - 1][0]
    const d = `M ${x0} ${height} ` + points.map(([x, y]) => `L ${x} ${y}`).join(' ') + ` L ${x1} ${height} Z`
    return { band, d }
  })
}

export interface BandLine { band: GradeBand; d: string }

// Open polyline (the curve itself) per band, so each slope run can be stroked with its own
// width and contrast — a non-colour channel carrying the same slope information (accessibility).
export function linePaths(tops: BandTop[]): BandLine[] {
  return tops.map(({ band, points }) => ({
    band,
    d: `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' '),
  }))
}
