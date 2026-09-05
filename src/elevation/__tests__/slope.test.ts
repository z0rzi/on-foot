import { smoothProfile, slopeBands } from '../slope'
import { buildElevationProfile, ElePoint } from '../profile'

// ~111 m between consecutive points at lat 0 (0.001° lng).
const seg = (eles: number[]): ElePoint[] => eles.map((ele, i) => ({ lat: 0, lng: i * 0.001, ele }))

describe('smoothProfile', () => {
  it('windowMeters <= 0 returns the profile unchanged', () => {
    const p = buildElevationProfile([seg([100, 130, 110])])!
    expect(smoothProfile(p, 0)).toEqual(p)
  })

  it('averages out a single-sample spike toward its neighbours', () => {
    // Flat 100 m line with one +30 m spike in the middle; a wide window pulls the spike down.
    const p = buildElevationProfile([seg([100, 100, 130, 100, 100])])!
    const s = smoothProfile(p, 500) // window spans the whole track
    const mid = s.samples[2].ele
    expect(mid).toBeLessThan(130)
    expect(mid).toBeGreaterThan(100)
    expect(s.maxEle).toBeLessThan(130) // recomputed from smoothed eles
  })

  it('does not average across a segment break', () => {
    // Segment A flat at 100, segment B flat at 200; smoothing must not bleed B into A.
    const a = seg([100, 100])
    const b: ElePoint[] = [{ lat: 0, lng: 1, ele: 200 }, { lat: 0, lng: 1.001, ele: 200 }]
    const p = buildElevationProfile([a, b])!
    const s = smoothProfile(p, 100000) // huge window — would merge if segments weren't respected
    expect(s.samples[0].ele).toBe(100)
    expect(s.samples[1].ele).toBe(100)
    expect(s.samples[2].ele).toBe(200)
    expect(s.samples[3].ele).toBe(200)
  })

  it('keeps each segment its own first and last elevation', () => {
    // The window shrinks at a segment's ends rather than leaning inward, so the drawn profile
    // starts and finishes at the altitudes actually measured there.
    const p = buildElevationProfile([seg([100, 130, 110])])!
    const s = smoothProfile(p, 100000)
    expect(s.samples[0].ele).toBe(100)
    expect(s.samples[2].ele).toBe(110)
  })

  it('preserves distances, coordinates and segment tags', () => {
    const p = buildElevationProfile([seg([100, 120, 140])])!
    const s = smoothProfile(p, 50)
    expect(s.samples.map((x) => x.distance)).toEqual(p.samples.map((x) => x.distance))
    expect(s.samples.map((x) => x.segment)).toEqual(p.samples.map((x) => x.segment))
    expect(s.samples.map((x) => x.lng)).toEqual(p.samples.map((x) => x.lng))
  })
})

describe('slopeBands', () => {
  it('a uniform slope is a single band', () => {
    const p = buildElevationProfile([seg([0, 50, 100, 150])])! // ~45% throughout → steep
    const bands = slopeBands(p, 0)
    expect(bands).toHaveLength(1)
    expect(bands[0].band).toBe('steep')
    expect(bands[0].start).toBe(0)
    expect(bands[0].end).toBeCloseTo(p.totalDistance, 6)
  })

  it('a descent with a tiny up-bump reads as one downhill band (the device-feedback case)', () => {
    // Net descent 200→100 with one +2 m blip. Smoothed first, then banded → all downhill,
    // with no stray non-downhill run.
    const p = smoothProfile(buildElevationProfile([seg([200, 170, 172, 140, 110])])!, 400)
    const bands = slopeBands(p, 200)
    expect(bands.every((b) => b.band === 'downhill')).toBe(true)
  })

  it('dissolves a short run into its longer neighbour', () => {
    // Long steep climb, a very short flat notch, then more steep climb. With minRun larger than
    // the notch, the whole thing is one steep band.
    const p = buildElevationProfile([seg([0, 50, 100, 100.5, 150, 200])])!
    const withMerge = slopeBands(p, p.totalDistance) // minRun = whole track → forces a single run
    expect(withMerge).toHaveLength(1)
    expect(withMerge[0].band).toBe('steep')
  })

  it('does not merge across a segment break', () => {
    const aUp: ElePoint[] = [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.001, ele: 50 }]   // ~45% steep
    const bDown: ElePoint[] = [{ lat: 0, lng: 1, ele: 100 }, { lat: 0, lng: 1.001, ele: 50 }] // steep down
    const p = buildElevationProfile([aUp, bDown])!
    const bands = slopeBands(p, 0)
    expect(bands.map((b) => b.band)).toEqual(['steep', 'downhill'])
  })

  it('never dissolves a short run across a segment break', () => {
    // Segment A is a single short steep run; segment B is a long downhill run. Even with a large
    // minRun (bigger than A), A must NOT be swallowed into B — they belong to different segments.
    const aUp: ElePoint[] = [{ lat: 0, lng: 0, ele: 0 }, { lat: 0, lng: 0.0003, ele: 15 }] // short, steep
    const bDown: ElePoint[] = [
      { lat: 0, lng: 1, ele: 100 },
      { lat: 0, lng: 1.001, ele: 60 },
      { lat: 0, lng: 1.002, ele: 20 },
    ] // long, steep downhill
    const p = buildElevationProfile([aUp, bDown])!
    const breakDistance = p.samples[1].distance // end of segment A === start of segment B
    const bands = slopeBands(p, p.totalDistance) // minRun huge → would merge everything if allowed
    expect(bands).toHaveLength(2)
    expect(bands[0].band).toBe('steep')
    expect(bands[1].band).toBe('downhill')
    // The two bands meet at the break but neither spans it:
    expect(bands[0].end).toBeCloseTo(breakDistance, 6)
    expect(bands[1].start).toBeCloseTo(breakDistance, 6)
  })
})
