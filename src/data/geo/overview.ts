// The text of a GeoJSON MultiLineString geometry, produced only by `simplifyToOverview`.
export type OverviewGeometry = string & { readonly __brand: 'OverviewGeometry' }

export interface StartPoint { lat: number; lng: number }

export interface ItemOverview {
  geometry: OverviewGeometry
  start: StartPoint | null
}

interface Position { lat: number; lng: number }

export const OVERVIEW_TOLERANCE_METERS = 10

const METERS_PER_DEGREE_LAT = 110540
const METERS_PER_DEGREE_LNG_AT_EQUATOR = 111320

// Distance in metres from p to the segment a–b, on a plane projected at a's latitude: exact enough
// over the length of a hike.
export function metersToSegment(p: Position, a: Position, b: Position): number {
  const kx = Math.cos((a.lat * Math.PI) / 180) * METERS_PER_DEGREE_LNG_AT_EQUATOR
  const px = (p.lng - a.lng) * kx
  const py = (p.lat - a.lat) * METERS_PER_DEGREE_LAT
  const bx = (b.lng - a.lng) * kx
  const by = (b.lat - a.lat) * METERS_PER_DEGREE_LAT
  const lengthSquared = bx * bx + by * by
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / lengthSquared))
  return Math.hypot(px - along * bx, py - along * by)
}

// Douglas–Peucker: the first and last points are always kept.
function simplifySegment<P extends Position>(points: P[]): P[] {
  if (points.length < 3) return points
  const keep = new Array<boolean>(points.length).fill(false)
  keep[0] = true
  keep[points.length - 1] = true
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    let farthest = -1
    let farthestOffset = OVERVIEW_TOLERANCE_METERS
    for (let i = first + 1; i < last; i++) {
      const offset = metersToSegment(points[i], points[first], points[last])
      if (offset > farthestOffset) {
        farthest = i
        farthestOffset = offset
      }
    }
    if (farthest === -1) continue
    keep[farthest] = true
    stack.push([first, farthest], [farthest, last])
  }
  return points.filter((_, i) => keep[i])
}

const isFinitePosition = (p: Position): boolean => Number.isFinite(p.lat) && Number.isFinite(p.lng)

const round = (degrees: number): number => Math.round(degrees * 1e5) / 1e5

// [lng, lat] as GeoJSON orders them, rounded, without a position repeating the one before it.
function roundedLine(points: Position[]): number[][] {
  const line: number[][] = []
  for (const p of points) {
    const position = [round(p.lng), round(p.lat)]
    const previous = line[line.length - 1]
    if (!previous || previous[0] !== position[0] || previous[1] !== position[1]) line.push(position)
  }
  return line
}

export function simplifyToOverview(segments: Position[][]): ItemOverview {
  const lines = segments.map((segment) => roundedLine(simplifySegment(segment.filter(isFinitePosition))))
  const first = lines.find((line) => line.length > 0)
  return {
    geometry: JSON.stringify({
      type: 'MultiLineString',
      coordinates: lines.filter((line) => line.length >= 2),
    }) as OverviewGeometry,
    start: first ? { lat: first[0][1], lng: first[0][0] } : null,
  }
}

// How an overview is stored: a null geometry is a row the backfill has not reached yet.
export interface OverviewColumns {
  overviewGeometry: string | null
  startLat: number | null
  startLng: number | null
}

export function overviewColumns(overview: ItemOverview): OverviewColumns {
  return {
    overviewGeometry: overview.geometry,
    startLat: overview.start?.lat ?? null,
    startLng: overview.start?.lng ?? null,
  }
}

// What an overview row carries beside its summary.
export interface OverviewFields {
  overviewGeometry: OverviewGeometry | null
  start: StartPoint | null
}

export function overviewFromColumns(columns: OverviewColumns): OverviewFields {
  return {
    // Only `simplifyToOverview` writes the column.
    overviewGeometry: columns.overviewGeometry as OverviewGeometry | null,
    start:
      columns.startLat !== null && columns.startLng !== null
        ? { lat: columns.startLat, lng: columns.startLng }
        : null,
  }
}

// What filling one row's overview came to. A row deleted since it was listed is `missing`.
export type OverviewFill =
  | { kind: 'filled' }
  | { kind: 'unreadable'; error: unknown }
  | { kind: 'missing' }

// The columns to store for a row saved before overviews existed. A geometry that cannot be read is
// stored with an empty overview, so the backfill never retries it.
export function storedOverview(readSegments: () => Position[][]): {
  columns: OverviewColumns
  fill: OverviewFill
} {
  try {
    return { columns: overviewColumns(simplifyToOverview(readSegments())), fill: { kind: 'filled' } }
  } catch (error) {
    return { columns: overviewColumns(simplifyToOverview([])), fill: { kind: 'unreadable', error } }
  }
}
