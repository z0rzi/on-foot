import { XMLParser } from 'fast-xml-parser'
import type { RoutePoint } from './geometry'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
})

interface PointNode { '@_lat'?: string; '@_lon'?: string; ele?: string }
interface SegmentNode { trkpt?: PointNode | PointNode[] }
interface TrackNode { name?: string; trkseg?: SegmentNode | SegmentNode[] }
interface RouteNode { rtept?: PointNode | PointNode[] }
interface GpxNode { metadata?: { name?: string }; trk?: TrackNode | TrackNode[]; rte?: RouteNode | RouteNode[] }

const asArray = <T>(value: T | T[] | undefined): T[] => (value === undefined ? [] : Array.isArray(value) ? value : [value])

function toPoint(node: PointNode, index: number): RoutePoint {
  const lat = Number(node['@_lat'])
  const lng = Number(node['@_lon'])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error(`GPX point ${index + 1} has no lat/lon`)
  const ele = node.ele === undefined || node.ele.trim() === '' ? null : Number(node.ele)
  return { lat, lng, ele: ele !== null && Number.isFinite(ele) ? ele : null }
}

function parse(xml: string): GpxNode {
  const gpx = (parser.parse(xml) as { gpx?: GpxNode }).gpx
  if (!gpx) throw new Error('not a GPX file')
  return gpx
}

// Every track point in order, all segments joined; a file without a track falls back to its route.
export function parseGpxPoints(xml: string): RoutePoint[] {
  const gpx = parse(xml)
  const trackPoints = asArray(gpx.trk).flatMap((trk) => asArray(trk.trkseg).flatMap((seg) => asArray(seg.trkpt)))
  const nodes = trackPoints.length > 0 ? trackPoints : asArray(gpx.rte).flatMap((rte) => asArray(rte.rtept))
  return nodes.map(toPoint)
}

const nonEmpty = (s: string | undefined) => (s && s.trim().length > 0 ? s.trim() : null)

// The name the app gives a trail imported from this file: its first track's name, then the
// metadata name, then the file name. The app's own GPX parser cannot load in plain Node; a test
// holds the two to the same rule.
export function gpxTitle(xml: string, fileName: string): string {
  const gpx = parse(xml)
  return nonEmpty(asArray(gpx.trk)[0]?.name) ?? nonEmpty(gpx.metadata?.name) ?? fileName
}

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function writeGpx(name: string, points: RoutePoint[]): string {
  const trkpts = points.map((p) => {
    const ele = p.ele === null ? '' : `<ele>${p.ele.toFixed(1)}</ele>`
    return `<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}</trkpt>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="on-foot device-check" xmlns="http://www.topografix.com/GPX/1/1">',
    `<trk><name>${escapeXml(name)}</name><trkseg>`,
    ...trkpts,
    '</trkseg></trk>',
    '</gpx>',
    '',
  ].join('\n')
}
