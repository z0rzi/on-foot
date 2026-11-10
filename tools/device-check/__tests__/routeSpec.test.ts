import { haversineMeters } from '../../../src/data/geo/metrics'
import { parseGpx } from '../../../src/data/trails/gpx/parse'
import { buildRoute, positionAt } from '../geometry'
import { gpxTitle, parseGpxPoints, writeGpx } from '../gpx'
import { DEFAULT_ROUTE_START, devcheckName, gpxFileName, parseStretches, routePoints } from '../routeSpec'

describe('parseStretches', () => {
  it('reads lengths, grades in percent and noele stretches', () => {
    expect(parseStretches(['500', '300:12%', '200:noele', '100:-5'])).toEqual([
      { length: 500, grade: 0 },
      { length: 300, grade: 12 },
      { length: 200, grade: null },
      { length: 100, grade: -5 },
    ])
  })

  it.each([
    [['500', '80x'], 'stretch 2 "80x"'],
    [['0'], 'stretch 1 "0"'],
    [['300:steep'], 'stretch 1 "300:steep"'],
    [['300:5:2'], 'stretch 1 "300:5:2"'],
  ])('refuses %j, naming the faulty part', (spec, message) => {
    expect(() => parseStretches(spec)).toThrow(message)
  })

  it('refuses an empty route', () => {
    expect(() => parseStretches([])).toThrow('at least one stretch')
  })
})

describe('routePoints', () => {
  const points = routePoints(parseStretches(['500', '300:12%', '200:noele', '100:-5%']), DEFAULT_ROUTE_START)
  const route = buildRoute(points)

  it('is as long as its stretches, measured as the app measures', () => {
    let length = 0
    for (let i = 1; i < points.length; i++) length += haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)
    expect(length).toBeCloseTo(1100, 0)
  })

  it('starts at a public place', () => {
    expect(points[0]).toMatchObject({ lat: 43.60445, lng: 1.44345, ele: 146 })
  })

  it('climbs and descends by the grades, with no elevation on noele', () => {
    expect(positionAt(route, 500, 0).ele).toBeCloseTo(146, 5)
    expect(positionAt(route, 800, 0).ele).toBeCloseTo(182, 5)
    expect(positionAt(route, 900, 0).ele).toBeNull()
    expect(points[points.length - 1].ele).toBeCloseTo(177, 5)
  })

  it('keeps points no more than 10 m apart', () => {
    for (let i = 1; i < points.length; i++) {
      expect(haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng)).toBeLessThanOrEqual(10.001)
    }
  })
})

describe('naming', () => {
  it('gives every route the DEVCHECK prefix, once', () => {
    expect(devcheckName('climb then flat')).toBe('DEVCHECK climb then flat')
    expect(devcheckName('DEVCHECK climb')).toBe('DEVCHECK climb')
    expect(gpxFileName('DEVCHECK climb, then flat!')).toBe('DEVCHECK-climb-then-flat.gpx')
  })
})

describe('GPX', () => {
  const points = routePoints(parseStretches(['100:10%', '50:noele']), DEFAULT_ROUTE_START)
  const xml = writeGpx('DEVCHECK climb', points)

  it('is read by the app with its name and elevations', () => {
    const parsed = parseGpx(xml, null)
    expect(parsed.title).toBe('DEVCHECK climb')
    const segment = parsed.segments[0]
    expect(segment).toHaveLength(points.length)
    expect(segment[0].ele).toBe(146)
    expect(segment[segment.length - 1].ele).toBeNull()
  })

  it('reads back to the same points', () => {
    const back = parseGpxPoints(xml)
    expect(back).toHaveLength(points.length)
    back.forEach((p, i) => {
      expect(p.lat).toBeCloseTo(points[i].lat, 7)
      expect(p.lng).toBeCloseTo(points[i].lng, 7)
      expect(p.ele === null ? null : p.ele).toEqual(points[i].ele === null ? null : expect.closeTo(points[i].ele as number, 1))
    })
  })

  it('reads track points in any attribute order, with or without elevation', () => {
    const other = `<gpx><trk><trkseg>
      <trkpt lon="1.5" lat="43.5"><ele>210.5</ele><time>2026-01-01T00:00:00Z</time></trkpt>
      <trkpt lat="43.501" lon="1.501"/>
    </trkseg></trk></gpx>`
    expect(parseGpxPoints(other)).toEqual([
      { lat: 43.5, lng: 1.5, ele: 210.5 },
      { lat: 43.501, lng: 1.501, ele: null },
    ])
  })

  const POINTS = '<trkseg><trkpt lat="1" lon="2"/><trkpt lat="1.001" lon="2"/></trkseg>'
  it.each([
    ['<metadata><name>Meta</name></metadata>', '<name>Track</name>'],
    ['<metadata><name>Meta</name></metadata>', ''],
    ['', ''],
    ['', '<name>  </name>'],
  ])('titles a file with metadata %j and track name %j as the app does', (metadata, trackName) => {
    const gpx = `<gpx>${metadata}<trk>${trackName}${POINTS}</trk></gpx>`
    expect(gpxTitle(gpx, 'DEVCHECK-file')).toBe(parseGpx(gpx, 'DEVCHECK-file').title)
  })

  it('falls back to route points when the file has no track', () => {
    expect(parseGpxPoints('<gpx><rte><rtept lat="1" lon="2"/><rtept lat="1.001" lon="2"/></rte></gpx>')).toHaveLength(2)
  })
})
