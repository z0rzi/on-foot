import { XMLParser } from 'fast-xml-parser'
import { GpxPoint, GpxWaypoint } from '../types'

export interface GpxParseResult {
  points: GpxPoint[]
  waypoints: GpxWaypoint[]
  title: string | null
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

function num(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

function str(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const s = String(value).trim()
  return s.length === 0 ? null : s
}

function requireCoord(node: any, kind: string): { lat: number; lng: number } {
  const lat = num(node?.['@_lat'])
  const lng = num(node?.['@_lon'])
  if (lat === null || lng === null) throw new Error(`GPX ${kind} missing lat/lon`)
  return { lat, lng }
}

function toPoint(node: any): GpxPoint {
  const { lat, lng } = requireCoord(node, 'point')
  return { lat, lng, ele: num(node?.ele) }
}

function toWaypoint(node: any): GpxWaypoint {
  const { lat, lng } = requireCoord(node, 'waypoint')
  return { lat, lng, ele: num(node?.ele), name: str(node?.name), description: str(node?.desc) }
}

export function parseGpx(xml: string, fallbackName: string | null = null): GpxParseResult {
  const gpx = parser.parse(xml)?.gpx ?? {}

  const waypoints = asArray(gpx.wpt).map(toWaypoint)

  const routes = asArray(gpx.rte)
  const points =
    routes.length > 0
      ? routes.flatMap((rte: any) => asArray(rte.rtept).map(toPoint))
      : asArray(gpx.trk).flatMap((trk: any) =>
          asArray(trk.trkseg).flatMap((seg: any) => asArray(seg.trkpt).map(toPoint)),
        )

  const trackTitle = str(asArray(gpx.trk)[0]?.name)
  const metadataTitle = str(gpx.metadata?.name)
  const title = trackTitle ?? metadataTitle ?? str(fallbackName)

  return { points, waypoints, title }
}
