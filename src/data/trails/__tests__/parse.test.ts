import { parseGpx } from '../gpx/parse'

const TRACK = `<?xml version="1.0"?>
<gpx><metadata><name>Meta Name</name></metadata>
<trk><name>Track Name</name><trkseg>
<trkpt lat="1.0" lon="2.0"><ele>100</ele></trkpt>
<trkpt lat="1.1" lon="2.1"><ele>110</ele></trkpt>
</trkseg></trk>
<wpt lat="1.0" lon="2.0"><name>WP</name><desc>hi</desc></wpt></gpx>`

const ROUTE_AND_TRACK = `<?xml version="1.0"?>
<gpx><rte><rtept lat="5.0" lon="6.0"/><rtept lat="5.1" lon="6.1"/></rte>
<trk><trkseg><trkpt lat="9.0" lon="9.0"/></trkseg></trk></gpx>`

const NAMESPACED = `<?xml version="1.0"?>
<gpx xmlns:gpx="http://x"><trk><gpx:name>NS Track</gpx:name><trkseg>
<trkpt lat="3.0" lon="4.0"><gpx:ele>50</gpx:ele></trkpt></trkseg></trk></gpx>`

const METADATA_ONLY = `<?xml version="1.0"?>
<gpx><metadata><name>Only Meta</name></metadata>
<trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`

const NO_NAMES = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`

const MISSING_LAT = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lon="1"/></trkseg></trk></gpx>`

const MULTI_SEG = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="1.0" lon="1.0"/><trkpt lat="2.0" lon="2.0"/>
</trkseg><trkseg>
<trkpt lat="3.0" lon="3.0"/>
</trkseg></trk></gpx>`

const MULTI_RTE = `<?xml version="1.0"?>
<gpx><rte><rtept lat="1.0" lon="1.0"/><rtept lat="2.0" lon="2.0"/></rte>
<rte><rtept lat="3.0" lon="3.0"/></rte>
<trk><trkseg><trkpt lat="9.0" lon="9.0"/></trkseg></trk></gpx>`

test('track: points, elevation, waypoints, and track-name title', () => {
  const r = parseGpx(TRACK)
  expect(r.points).toEqual([
    { lat: 1.0, lng: 2.0, ele: 100 },
    { lat: 1.1, lng: 2.1, ele: 110 },
  ])
  expect(r.waypoints).toEqual([{ lat: 1.0, lng: 2.0, ele: null, name: 'WP', description: 'hi' }])
  expect(r.title).toBe('Track Name')
})

test('route points win over track points when a route exists', () => {
  const r = parseGpx(ROUTE_AND_TRACK)
  expect(r.points).toEqual([
    { lat: 5.0, lng: 6.0, ele: null },
    { lat: 5.1, lng: 6.1, ele: null },
  ])
})

test('namespace prefixes are stripped from tags', () => {
  const r = parseGpx(NAMESPACED)
  expect(r.points).toEqual([{ lat: 3.0, lng: 4.0, ele: 50 }])
  expect(r.title).toBe('NS Track')
})

test('title falls back to metadata name, then to the provided fallback', () => {
  expect(parseGpx(METADATA_ONLY).title).toBe('Only Meta')
  expect(parseGpx(NO_NAMES, 'file-name').title).toBe('file-name')
  expect(parseGpx(NO_NAMES).title).toBeNull()
})

test('a point missing lat or lon throws', () => {
  expect(() => parseGpx(MISSING_LAT)).toThrow()
})

test('multiple track segments merge in document order', () => {
  const r = parseGpx(MULTI_SEG)
  expect(r.points).toEqual([
    { lat: 1.0, lng: 1.0, ele: null },
    { lat: 2.0, lng: 2.0, ele: null },
    { lat: 3.0, lng: 3.0, ele: null },
  ])
})

test('multiple routes merge in document order and win over tracks', () => {
  const r = parseGpx(MULTI_RTE)
  expect(r.points).toEqual([
    { lat: 1.0, lng: 1.0, ele: null },
    { lat: 2.0, lng: 2.0, ele: null },
    { lat: 3.0, lng: 3.0, ele: null },
  ])
})
