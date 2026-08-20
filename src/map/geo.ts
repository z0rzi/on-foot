import { GpxPoint } from '../data/trails/types'

export function toLineCoordinates(points: GpxPoint[]): [number, number][] {
  return points.map((point) => [point.lng, point.lat])
}

export function endpointCoordinates(points: GpxPoint[]): [number, number][] {
  if (points.length === 0) return []
  const first = points[0]
  const last = points[points.length - 1]
  return [
    [first.lng, first.lat],
    [last.lng, last.lat],
  ]
}

export function boundsForPoints(
  points: GpxPoint[],
): { ne: [number, number]; sw: [number, number] } | null {
  if (points.length === 0) return null
  let minLng = points[0].lng
  let maxLng = points[0].lng
  let minLat = points[0].lat
  let maxLat = points[0].lat
  for (const point of points) {
    if (point.lng < minLng) minLng = point.lng
    if (point.lng > maxLng) maxLng = point.lng
    if (point.lat < minLat) minLat = point.lat
    if (point.lat > maxLat) maxLat = point.lat
  }
  return { ne: [maxLng, maxLat], sw: [minLng, minLat] }
}
