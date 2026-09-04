import { ElevationProfile, GradeBand } from './profile'
import { SlopeBand } from './slope'
import { bandSamples } from './bandGeometry'

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

// Top edge (the curve) of a band as projected points, resolved within the band's own segment.
function bandTopPoints(profile: ElevationProfile, band: SlopeBand, scale: PlotScale): [number, number][] {
  return bandSamples(profile, band).map((s): [number, number] => [
    projectX(s.distance, profile, scale.width),
    projectY(s.ele, profile, scale.height),
  ])
}

export interface BandArea { band: GradeBand; d: string }

export function buildBandAreas(profile: ElevationProfile, bands: SlopeBand[], scale: PlotScale): BandArea[] {
  const baseline = scale.height
  return bands
    .map((band) => ({ band: band.band, top: bandTopPoints(profile, band, scale) }))
    .filter(({ top }) => top.length >= 2)
    .map(({ band, top }) => {
      const x0 = top[0][0]
      const x1 = top[top.length - 1][0]
      const d = `M ${x0} ${baseline} ` + top.map(([x, y]) => `L ${x} ${y}`).join(' ') + ` L ${x1} ${baseline} Z`
      return { band, d }
    })
}

export interface BandLine { band: GradeBand; d: string }

// Open polyline (the curve itself) per band, so each slope run can be stroked with its own
// width and contrast — a non-colour channel carrying the same slope information (accessibility).
export function buildBandLines(profile: ElevationProfile, bands: SlopeBand[], scale: PlotScale): BandLine[] {
  return bands
    .map((band) => ({ band: band.band, top: bandTopPoints(profile, band, scale) }))
    .filter(({ top }) => top.length >= 2)
    .map(({ band, top }) => {
      const d = `M ${top[0][0]} ${top[0][1]} ` + top.slice(1).map(([x, y]) => `L ${x} ${y}`).join(' ')
      return { band, d }
    })
}
