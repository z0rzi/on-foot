import { projectY, projectPoint, areaPaths, buildBandTops, linePaths, type YScale } from '../svg'
import { buildElevationProfile, type ElevationProfile } from '../profile'
import type { SlopeBand } from '../slope'

const oneSeg = buildElevationProfile([[
  { lat: 0, lng: 0, ele: 0 },
  { lat: 0, lng: 0.001, ele: 100 },
]])!
// The profile's own range over a plot `height` tall.
const yScale = (p: ElevationProfile, height: number): YScale => ({ low: p.minEle, high: p.maxEle, top: 0, bottom: height })
const oneSegScale = { width: 200, y: yScale(oneSeg, 50) }

describe('projection', () => {
  it('maps a given elevation range onto the given pixel band, high at the top', () => {
    const scale = { low: 200, high: 300, top: 8, bottom: 54 }
    expect(projectY(300, scale)).toBe(8)
    expect(projectY(250, scale)).toBe(31)
    expect(projectY(200, scale)).toBe(54)
  })
  it('centres a flat elevation range in its band', () => {
    expect(projectY(42, { low: 42, high: 42, top: 6, bottom: 80 })).toBe(43)
  })
})

describe('projectPoint', () => {
  const valley = buildElevationProfile([[
    { lat: 0, lng: 0, ele: 100 },
    { lat: 0, lng: 0.001, ele: 0 },
    { lat: 0, lng: 0.002, ele: 100 },
  ]])!
  const scale = { width: 200, y: yScale(valley, 50) }

  it("places the profile's lowest point on the plot's bottom row, unclamped", () => {
    const at = projectPoint(valley.samples[1].distance, valley, scale)
    expect(at.x).toBeCloseTo(100, 6)
    expect(at.y).toBe(50)
  })
  it("places the first and last metre on the plot's edges, the highest point on its top row", () => {
    expect(projectPoint(0, valley, scale)).toEqual({ x: 0, y: 0 })
    const end = projectPoint(valley.totalDistance, valley, scale)
    expect(end.x).toBeCloseTo(200, 6)
    expect(end.y).toBeCloseTo(0, 6)
  })
})

describe('linePaths', () => {
  it('produces one OPEN polyline per band, tagged with the band', () => {
    const bands: SlopeBand[] = [
      { start: 0, end: oneSeg.totalDistance / 2, band: 'uphill' },
      { start: oneSeg.totalDistance / 2, end: oneSeg.totalDistance, band: 'steep' },
    ]
    const lines = linePaths(buildBandTops(oneSeg, bands, oneSegScale))
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
    const scale = { width: 200, y: yScale(twoSeg, 50) }
    const bands: SlopeBand[] = [
      { start: 0, end: dA, band: 'uphill' },
      { start: dA, end: twoSeg.totalDistance, band: 'steep' },
    ]
    const lines = linePaths(buildBandTops(twoSeg, bands, scale))
    const secondLineFirstPoint = lines[1].d.match(/^M ([\d.-]+) ([\d.-]+)/)!
    const y = Number(secondLineFirstPoint[2])
    expect(y).toBeCloseTo(projectY(400, scale.y), 6)
    expect(y).not.toBeCloseTo(projectY(160, scale.y), 6)
  })
})

describe('areaPaths', () => {
  it('emits a closed filled polygon per non-flat band', () => {
    const bands: SlopeBand[] = [{ start: 0, end: oneSeg.totalDistance, band: 'steep' }]
    const areas = areaPaths(buildBandTops(oneSeg, bands, oneSegScale), 50)
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
    const areas = areaPaths(buildBandTops(flat, bands, { width: 200, y: yScale(flat, 50) }), 50)
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
      oneSegScale,
    )
    expect(tops.map((t) => t.band)).toEqual(['steep'])
  })

  it('feeds both path sets from the same points', () => {
    const bands: SlopeBand[] = [{ start: 0, end: oneSeg.totalDistance, band: 'steep' }]
    const tops = buildBandTops(oneSeg, bands, oneSegScale)
    const [area] = areaPaths(tops, 50)
    const [line] = linePaths(tops)
    const shared = tops[0].points.map(([x, y]) => `L ${x} ${y}`).join(' ')
    expect(area.d).toContain(shared)
    expect(line.d).toContain(shared.replace(/^L /, ''))
  })
})
