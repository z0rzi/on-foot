import { XMLParser } from 'fast-xml-parser'
import { GpxPoint, GpxWaypoint } from '../types'

export interface GpxParseResult {
  segments: GpxPoint[][]
  waypoints: GpxWaypoint[]
  title: string | null
}

export type GpxFailure = 'format' | 'empty'

export class GpxError extends Error {
  constructor(readonly reason: GpxFailure, message: string) {
    super(message)
  }
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

/* eslint-disable @typescript-eslint/no-explicit-any -- fast-xml-parser emits untyped nodes; the
   nested shapes are dynamically typed and every leaf value is validated by num()/str(), so typing
   the tree rigorously would add casts without adding real safety. */
function requireCoord(node: any, kind: string): { lat: number; lng: number } {
  const lat = num(node?.['@_lat'])
  const lng = num(node?.['@_lon'])
  if (lat === null || lng === null) throw new GpxError('format', `GPX ${kind} missing lat/lon`)
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
  const gpx = parser.parse(xml)?.gpx
  if (gpx === undefined || gpx === null) throw new GpxError('format', 'No <gpx> root element')

  const waypoints = asArray(gpx.wpt).map(toWaypoint)

  const routes = asArray(gpx.rte)
  const segments: GpxPoint[][] =
    routes.length > 0
      ? routes.map((rte: any) => asArray(rte.rtept).map(toPoint))
      : asArray(gpx.trk).flatMap((trk: any) =>
          asArray(trk.trkseg).map((seg: any) => asArray(seg.trkpt).map(toPoint)),
        )
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const nonEmpty = segments.filter((s) => s.length > 0)
  if (nonEmpty.length === 0) throw new GpxError('empty', 'GPX has no route or track points')

  const trackTitle = str(asArray(gpx.trk)[0]?.name)
  const metadataTitle = str(gpx.metadata?.name)
  const title = trackTitle ?? metadataTitle ?? str(fallbackName)

  return { segments: nonEmpty, waypoints, title }
}
