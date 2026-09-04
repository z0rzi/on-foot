import { bandSamples } from '../bandGeometry'
import { buildElevationProfile } from '../profile'
import type { SlopeBand } from '../slope'

describe('bandSamples', () => {
  it('interpolates band boundaries within a single segment', () => {
    const p = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 100 },
    ]])!
    const s = bandSamples(p, { start: 0, end: p.totalDistance, band: 'steep' })
    expect(s[0].ele).toBeCloseTo(0, 6)
    expect(s[s.length - 1].ele).toBeCloseTo(100, 6)
  })

  it("uses the band's OWN segment start elevation on a multi-segment track (regression)", () => {
    // seg A ends at ele 160; seg B starts at ele 400. B's band must start at 400, not 160.
    const p = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 100 }, { lat: 0, lng: 0.001, ele: 160 }],
      [{ lat: 0, lng: 1, ele: 400 }, { lat: 0, lng: 1.001, ele: 420 }],
    ])!
    const D = p.samples[1].distance
    const bandB: SlopeBand = { start: D, end: p.totalDistance, band: 'rough' }
    const s = bandSamples(p, bandB)
    expect(s[0].ele).toBeCloseTo(400, 6)              // seg B's start, NOT 160
    expect(s[0].lng).toBeCloseTo(1, 6)                // and B's coordinates, not A's
    expect(s[s.length - 1].ele).toBeCloseTo(420, 6)
  })

  it('shares the boundary sample between adjacent same-segment bands', () => {
    const p = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 50 }, { lat: 0, lng: 0.002, ele: 60 },
    ]])!
    const mid = p.totalDistance / 2
    const a = bandSamples(p, { start: 0, end: mid, band: 'steep' })
    const b = bandSamples(p, { start: mid, end: p.totalDistance, band: 'uphill' })
    expect(b[0].ele).toBeCloseTo(a[a.length - 1].ele, 6)
    expect(b[0].lng).toBeCloseTo(a[a.length - 1].lng, 6)
  })
})
