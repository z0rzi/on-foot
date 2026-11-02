import { GpxError, parseGpx } from '../gpx/parse'

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
<trkpt lat="3.0" lon="4.0"><gpx:ele>50</gpx:ele></trkpt>
<trkpt lat="3.1" lon="4.1"/></trkseg></trk></gpx>`

const METADATA_ONLY = `<?xml version="1.0"?>
<gpx><metadata><name>Only Meta</name></metadata>
<trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="3.1" lon="4.1"/></trkseg></trk></gpx>`

const NO_NAMES = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lat="1" lon="1"/><trkpt lat="3.1" lon="4.1"/></trkseg></trk></gpx>`

const MISSING_LAT = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lon="1"/></trkseg></trk></gpx>`

const MULTI_SEG = `<?xml version="1.0"?>
<gpx><trk><trkseg>
<trkpt lat="1.0" lon="1.0"/><trkpt lat="2.0" lon="2.0"/>
</trkseg><trkseg>
<trkpt lat="3.0" lon="3.0"/><trkpt lat="3.1" lon="4.1"/>
</trkseg></trk></gpx>`

const MULTI_RTE = `<?xml version="1.0"?>
<gpx><rte><rtept lat="1.0" lon="1.0"/><rtept lat="2.0" lon="2.0"/></rte>
<rte><rtept lat="3.0" lon="3.0"/><rtept lat="3.1" lon="4.1"/></rte>
<trk><trkseg><trkpt lat="9.0" lon="9.0"/></trkseg></trk></gpx>`

const EMPTY_RTE_WITH_TRACK = `<?xml version="1.0"?>
<gpx><rte><name>Route metadata only</name></rte>
<trk><trkseg><trkpt lat="1.0" lon="2.0"/><trkpt lat="1.1" lon="2.1"/></trkseg></trk></gpx>`

test('track: segments, elevation, waypoints, and track-name title', () => {
  const r = parseGpx(TRACK)
  expect(r.segments).toEqual([[
    { lat: 1.0, lng: 2.0, ele: 100 },
    { lat: 1.1, lng: 2.1, ele: 110 },
  ]])
  expect(r.waypoints).toEqual([{ lat: 1.0, lng: 2.0, ele: null, name: 'WP', description: 'hi' }])
  expect(r.title).toBe('Track Name')
})

test('route points win over track points; one segment per route', () => {
  expect(parseGpx(ROUTE_AND_TRACK).segments).toEqual([[
    { lat: 5.0, lng: 6.0, ele: null },
    { lat: 5.1, lng: 6.1, ele: null },
  ]])
})

test('namespace prefixes are stripped from tags', () => {
  const r = parseGpx(NAMESPACED)
  expect(r.segments).toEqual([[
    { lat: 3.0, lng: 4.0, ele: 50 },
    { lat: 3.1, lng: 4.1, ele: null },
  ]])
  expect(r.title).toBe('NS Track')
})

test('title falls back to metadata name, then to the provided fallback', () => {
  expect(parseGpx(METADATA_ONLY).title).toBe('Only Meta')
  expect(parseGpx(NO_NAMES, 'file-name').title).toBe('file-name')
  expect(parseGpx(NO_NAMES).title).toBeNull()
})

const EMPTY_ROOT = `<?xml version="1.0"?><gpx></gpx>`

const EMPTY_SEG = `<?xml version="1.0"?>
<gpx><trk><name>No Points</name><trkseg></trkseg></trk></gpx>`

const WAYPOINTS_ONLY = `<?xml version="1.0"?>
<gpx><wpt lat="1.0" lon="2.0"><name>WP</name></wpt></gpx>`

function reasonOf(xml: string): string {
  try {
    parseGpx(xml)
  } catch (err) {
    return err instanceof GpxError ? err.reason : `not a GpxError: ${String(err)}`
  }
  return 'did not throw'
}

test('a document with no gpx root is a format failure', () => {
  expect(reasonOf('hello world, not xml at all')).toBe('format')
  expect(reasonOf('{"json":true}')).toBe('format')
  expect(reasonOf('')).toBe('format')
})

test('a gpx root with no route or track points is an empty failure', () => {
  expect(reasonOf(EMPTY_ROOT)).toBe('empty')
  expect(reasonOf(EMPTY_SEG)).toBe('empty')
})

test('a waypoints-only file has no route to import', () => {
  expect(reasonOf(WAYPOINTS_ONLY)).toBe('empty')
})

test('a point missing lat or lon is a format failure', () => {
  expect(reasonOf(MISSING_LAT)).toBe('format')
})

test('each track segment is its own segment, in document order', () => {
  expect(parseGpx(MULTI_SEG).segments).toEqual([
    [{ lat: 1.0, lng: 1.0, ele: null }, { lat: 2.0, lng: 2.0, ele: null }],
    [{ lat: 3.0, lng: 3.0, ele: null }, { lat: 3.1, lng: 4.1, ele: null }],
  ])
})

test('each route is its own segment, in document order, winning over tracks', () => {
  expect(parseGpx(MULTI_RTE).segments).toEqual([
    [{ lat: 1.0, lng: 1.0, ele: null }, { lat: 2.0, lng: 2.0, ele: null }],
    [{ lat: 3.0, lng: 3.0, ele: null }, { lat: 3.1, lng: 4.1, ele: null }],
  ])
})

test('a route element with no points does not suppress the track', () => {
  expect(parseGpx(EMPTY_RTE_WITH_TRACK).segments).toEqual([
    [{ lat: 1.0, lng: 2.0, ele: null }, { lat: 1.1, lng: 2.1, ele: null }],
  ])
})

const ONE_POINT_RTE = `<?xml version="1.0"?>
<gpx><rte><rtept lat="1.0" lon="2.0"/></rte></gpx>`

const ONE_POINT_TRK = `<?xml version="1.0"?>
<gpx><trk><trkseg><trkpt lat="1.0" lon="2.0"/></trkseg></trk></gpx>`

const TEXT_ROOT = `<?xml version="1.0"?><gpx>just some text</gpx>`

test('a segment of one point cannot be drawn and is an empty failure', () => {
  expect(reasonOf(ONE_POINT_RTE)).toBe('empty')
  expect(reasonOf(ONE_POINT_TRK)).toBe('empty')
})

const ONE_POINT_RTE_WITH_TRACK = `<?xml version="1.0"?>
<gpx><rte><name>Stub</name><rtept lat="1.0" lon="2.0"/></rte>
<trk><trkseg><trkpt lat="3.0" lon="4.0"/><trkpt lat="3.1" lon="4.1"/></trkseg></trk></gpx>`

test('a route with too few points to draw does not suppress the track', () => {
  expect(parseGpx(ONE_POINT_RTE_WITH_TRACK).segments).toEqual([
    [{ lat: 3.0, lng: 4.0, ele: null }, { lat: 3.1, lng: 4.1, ele: null }],
  ])
})

test('a gpx root holding only text is a format failure, but an empty root is not', () => {
  expect(reasonOf(TEXT_ROOT)).toBe('format')
  expect(reasonOf(EMPTY_ROOT)).toBe('empty')
})

function trackNamed(name: string): string {
  return `<?xml version="1.0"?>
<gpx><trk><name>${name}</name><trkseg>
<trkpt lat="1.0" lon="2.0"/><trkpt lat="1.1" lon="2.1"/>
</trkseg></trk>
<wpt lat="1.0" lon="2.0"><name>${name}</name><desc>${name}</desc></wpt></gpx>`
}

test('decimal and hex numeric references decode in every text field', () => {
  const r = parseGpx(trackNamed('Lac d&#039;Or&#xE9;don &#x27;x&#x27;'))
  expect(r.title).toBe("Lac d'Orédon 'x'")
  expect(r.waypoints[0].name).toBe("Lac d'Orédon 'x'")
  expect(r.waypoints[0].description).toBe("Lac d'Orédon 'x'")
})

test('the five XML entities decode alongside numeric references, each only once', () => {
  expect(parseGpx(trackNamed('&lt;a&gt; &quot;b&quot; &apos;c&apos; d&#039;e &amp; f')).title)
    .toBe(`<a> "b" 'c' d'e & f`)
  expect(parseGpx(trackNamed('&amp;#039; &amp;amp;')).title).toBe('&#039; &amp;')
})

test('HTML named entities are not XML and stay literal', () => {
  expect(parseGpx(trackNamed('Or&eacute;don&nbsp;&copy;')).title).toBe('Or&eacute;don&nbsp;&copy;')
})

test('malformed and out-of-range numeric references stay literal without throwing', () => {
  expect(parseGpx(trackNamed('a&#xZZ;b&#;c&#1114112;d&#x110000;e')).title)
    .toBe('a&#xZZ;b&#;c&#1114112;d&#x110000;e')
})

test('the fallback name is a file name, not XML, and is not decoded', () => {
  expect(parseGpx(NO_NAMES, 'a&#039;b').title).toBe('a&#039;b')
})

test('CDATA content is literal text and is not decoded', () => {
  expect(parseGpx(trackNamed('<![CDATA[a &amp; b &#039;]]>')).title).toBe('a &amp; b &#039;')
})

test('an internal DOCTYPE entity expands in text fields', () => {
  const xml = trackNamed('&lake;').replace('<gpx>', '<!DOCTYPE gpx [<!ENTITY lake "Lac Bleu">]><gpx>')
  expect(parseGpx(xml).title).toBe('Lac Bleu')
})
