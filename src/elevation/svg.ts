import { ElevationProfile, GradeBand, sampleAt } from './profile'
import { SlopeBand } from './slope'
import { samplesForBands } from './bandGeometry'

// The vertical mapping: elevation `low` onto pixel row `bottom`, `high` onto `top`.
export interface YScale { low: number; high: number; top: number; bottom: number }

export interface PlotScale { width: number; y: YScale }

function projectX(distance: number, profile: ElevationProfile, width: number): number {
  if (profile.totalDistance <= 0) return 0
  return (distance / profile.totalDistance) * width
}

export function projectY(ele: number, { low, high, top, bottom }: YScale): number {
  const range = high - low
  if (range <= 0) return (top + bottom) / 2
  return bottom - ((ele - low) / range) * (bottom - top)
}

// The plot point of the profile at a distance: where the line passes there.
export function projectPoint(distance: number, profile: ElevationProfile, scale: PlotScale): { x: number; y: number } {
  return { x: projectX(distance, profile, scale.width), y: projectY(sampleAt(profile, distance).ele, scale.y) }
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
        projectY(s.ele, scale.y),
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
