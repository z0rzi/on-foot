import { routeDisplay } from '../routeDisplay'
import { buildElevationProfile, ElePoint } from '../profile'
import { displaySlopeBands, smoothProfile } from '../slope'

// ~111 m between consecutive points at lat 0 (0.001° lng).
const seg = (eles: number[]): ElePoint[] => eles.map((ele, i) => ({ lat: 0, lng: i * 0.001, ele }))

describe('routeDisplay', () => {
  it('returns null when there are no segments', () => {
    expect(routeDisplay('trail', null, 0)).toBeNull()
  })

  it('returns null when the route has too few elevation samples to plot', () => {
    expect(routeDisplay('trail', [seg([100])], 0)).toBeNull()
  })

  it('returns null when the route covers no distance', () => {
    // Two samples at the same coordinate: a profile with no x-axis plots nothing.
    const stationary: ElePoint[] = [
      { lat: 0, lng: 0, ele: 100 },
      { lat: 0, lng: 0, ele: 110 },
    ]
    expect(routeDisplay('trail', [stationary], 0)).toBeNull()
  })

  it('bundles exactly what the profile and banding helpers produce separately', () => {
    const segments = [seg([100, 140, 180, 150, 100])]
    const profile = buildElevationProfile(segments)!
    expect(routeDisplay('trail', segments, 0)).toEqual({
      kind: 'trail',
      profile,
      ...displaySlopeBands(profile, 0),
    })
  })

  it('applies the smoothing window, so it reaches the band boundaries', () => {
    // A single-sample spike over a ~444 m track: unsmoothed it carves its own bands, while a
    // window wider than the track dissolves every run into one.
    const segments = [seg([100, 100, 130, 100, 100])]
    const sharp = routeDisplay('trail', segments, 0)!
    const smooth = routeDisplay('trail', segments, 500)!
    expect(sharp.bands.length).toBeGreaterThan(smooth.bands.length)
  })

  it('keeps the raw profile raw and the smoothed one smoothed', () => {
    // 500 m, as above: wide enough against this fixture's ~111 m spacing to actually average
    // the spike away rather than leave every sample's own window containing only itself.
    const segments = [seg([100, 100, 130, 100, 100])]
    const d = routeDisplay('trail', segments, 500)!
    expect(d.profile).toEqual(buildElevationProfile(segments))
    expect(d.smoothed).toEqual(smoothProfile(d.profile, 500))
    expect(d.smoothed.samples.map((s) => s.ele)).not.toEqual(d.profile.samples.map((s) => s.ele))
  })

  it('carries the source kind through to the display', () => {
    expect(routeDisplay('live', [seg([100, 120, 140])], 0)?.kind).toBe('live')
  })
})
