// The inverse of the app's track metrics: where a distance along a polyline lands. Same sphere as
// the app's haversine, so a mark here is the distance the app measures.
const EARTH_RADIUS_M = 6371000
const RAD = Math.PI / 180

export interface LatLng { lat: number; lng: number }
export interface RoutePoint extends LatLng { ele: number | null }

export interface Route {
  points: RoutePoint[]
  // Distance from the start to each point, in metres.
  cumulative: number[]
  length: number
}

export interface Position extends LatLng { ele: number | null }

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD
  const dLng = (b.lng - a.lng) * RAD
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bearingDegrees(a: LatLng, b: LatLng): number {
  const y = Math.sin((b.lng - a.lng) * RAD) * Math.cos(b.lat * RAD)
  const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD)
  return (Math.atan2(y, x) / RAD + 360) % 360
}

export function destination(from: LatLng, bearing: number, metres: number): LatLng {
  const d = metres / EARTH_RADIUS_M
  const b = bearing * RAD
  const lat1 = from.lat * RAD
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b))
  const lng2 = from.lng * RAD + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2))
  return { lat: lat2 / RAD, lng: lng2 / RAD }
}

export function buildRoute(points: RoutePoint[]): Route {
  if (points.length < 2) throw new Error(`a route needs at least 2 points, got ${points.length}`)
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + distanceMeters(points[i - 1], points[i]))
  const length = cumulative[cumulative.length - 1]
  if (length === 0) throw new Error('a route needs at least 2 distinct points')
  return { points, cumulative, length }
}

// The point at `mark` metres along the route, `offset` metres to the right of the route's direction
// (negative: to the left). Elevation is interpolated, and absent where either end of the leg has none.
export function positionAt(route: Route, mark: number, offset: number): Position {
  const s = Math.max(0, Math.min(route.length, mark))
  let i = 1
  while (i < route.points.length - 1 && route.cumulative[i] < s) i++
  const a = route.points[i - 1]
  const b = route.points[i]
  const legLength = route.cumulative[i] - route.cumulative[i - 1]
  const f = legLength > 0 ? (s - route.cumulative[i - 1]) / legLength : 0
  const legBearing = bearingDegrees(a, b)
  const onRoute = destination(a, legBearing, f * legLength)
  const at = offset === 0 ? onRoute : destination(onRoute, legBearing + 90, offset)
  const ele = a.ele !== null && b.ele !== null ? a.ele + f * (b.ele - a.ele) : null
  return { lat: at.lat, lng: at.lng, ele }
}
