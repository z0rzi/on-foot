import { projectX, projectY, areaPaths, buildBandTops, linePaths } from '../svg'
import { buildElevationProfile } from '../profile'
import type { SlopeBand } from '../slope'

const oneSeg = buildElevationProfile([[
  { lat: 0, lng: 0, ele: 0 },
  { lat: 0, lng: 0.001, ele: 100 },
]])!

describe('projection', () => {
  it('maps distance across the full width', () => {
    expect(projectX(0, oneSeg, 200)).toBe(0)
    expect(projectX(oneSeg.totalDistance, oneSeg, 200)).toBeCloseTo(200, 6)
  })
  it('inverts elevation: max near top (padded), min at bottom (y=height)', () => {
    const top = projectY(100, oneSeg, 50)
    expect(top).toBeGreaterThan(0) // top headroom padding, not flush against the edge
    expect(top).toBeLessThan(10)
    expect(projectY(0, oneSeg, 50)).toBeCloseTo(50, 6)
  })
  it('centres a flat-elevation profile', () => {
    const flat = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 42 }, { lat: 0, lng: 0.001, ele: 42 },
    ]])!
    expect(projectY(42, flat, 80)).toBe(40)
  })
})

describe('linePaths', () => {
  it('produces one OPEN polyline per band, tagged with the band', () => {
    const bands: SlopeBand[] = [
      { start: 0, end: oneSeg.totalDistance / 2, band: 'uphill' },
      { start: oneSeg.totalDistance / 2, end: oneSeg.totalDistance, band: 'steep' },
    ]
    const lines = linePaths(buildBandTops(oneSeg, bands, { width: 200, height: 50 }))
    expect(lines.map((l) => l.band)).toEqual(['uphill', 'steep'])
    for (const l of lines) {
      expect(l.d.startsWith('M ')).toBe(true)
      expect(l.d).toContain(' L ')
      expect(l.d.trim().endsWith('Z')).toBe(false) // open, not closed to a baseline
    }
  })
})

describe('linePaths multi-segment', () => {
  it("resolves the second segment's band boundary within its own segment (regression)", () => {
    // seg A ends at ele 160; seg B starts at ele 400. B's band must draw from 400, not 160.
    const twoSeg = buildElevationProfile([
      [{ lat: 0, lng: 0, ele: 100 }, { lat: 0, lng: 0.001, ele: 160 }],
      [{ lat: 0, lng: 1, ele: 400 }, { lat: 0, lng: 1.001, ele: 420 }],
    ])!
    const dA = twoSeg.samples[1].distance
    const scale = { width: 200, height: 50 }
    const bands: SlopeBand[] = [
      { start: 0, end: dA, band: 'uphill' },
      { start: dA, end: twoSeg.totalDistance, band: 'steep' },
    ]
    const lines = linePaths(buildBandTops(twoSeg, bands, scale))
    const secondLineFirstPoint = lines[1].d.match(/^M ([\d.-]+) ([\d.-]+)/)!
    const y = Number(secondLineFirstPoint[2])
    expect(y).toBeCloseTo(projectY(400, twoSeg, scale.height), 6)
    expect(y).not.toBeCloseTo(projectY(160, twoSeg, scale.height), 6)
  })
})

describe('areaPaths', () => {
  it('emits a closed filled polygon per non-flat band', () => {
    const bands: SlopeBand[] = [{ start: 0, end: oneSeg.totalDistance, band: 'steep' }]
    const areas = areaPaths(buildBandTops(oneSeg, bands, { width: 200, height: 50 }), 50)
    expect(areas).toHaveLength(1)
    expect(areas[0].band).toBe('steep')
    expect(areas[0].d.startsWith('M ')).toBe(true)
    expect(areas[0].d.trim().endsWith('Z')).toBe(true)
  })
  it('fills flat bands too (rendered white by the graph)', () => {
    const flat = buildElevationProfile([[
      { lat: 0, lng: 0, ele: 10 }, { lat: 0, lng: 0.001, ele: 10 },
    ]])!
    const bands: SlopeBand[] = [{ start: 0, end: flat.totalDistance, band: 'flat' }]
    const areas = areaPaths(buildBandTops(flat, bands, { width: 200, height: 50 }), 50)
    expect(areas).toHaveLength(1)
    expect(areas[0].band).toBe('flat')
    expect(areas[0].d.trim().endsWith('Z')).toBe(true)
  })
})

describe('buildBandTops', () => {
  it('drops bands too short to draw, so the path builders never see them', () => {
    const far = oneSeg.totalDistance * 10
    const tops = buildBandTops(
      oneSeg,
      [
        { start: 0, end: oneSeg.totalDistance, band: 'steep' },
        { start: far, end: far + 1, band: 'flat' },
      ],
      { width: 200, height: 50 },
    )
    expect(tops.map((t) => t.band)).toEqual(['steep'])
  })

  it('feeds both path sets from the same points', () => {
    const bands: SlopeBand[] = [{ start: 0, end: oneSeg.totalDistance, band: 'steep' }]
    const tops = buildBandTops(oneSeg, bands, { width: 200, height: 50 })
    const [area] = areaPaths(tops, 50)
    const [line] = linePaths(tops)
    const shared = tops[0].points.map(([x, y]) => `L ${x} ${y}`).join(' ')
    expect(area.d).toContain(shared)
    expect(line.d).toContain(shared.replace(/^L /, ''))
  })
})
