import { LngLatBounds } from './types'

const KM_PER_LAT_DEGREE = 111

export function boundsForTrail(
  points: { lat: number; lng: number }[],
  marginKm: number,
): LngLatBounds | null {
  if (points.length === 0) return null
  let minLat = points[0].lat
  let maxLat = points[0].lat
  let minLng = points[0].lng
  let maxLng = points[0].lng
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  const latMargin = marginKm / KM_PER_LAT_DEGREE
  const midLat = (minLat + maxLat) / 2
  const lngMargin = marginKm / (KM_PER_LAT_DEGREE * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)))
  return {
    ne: [maxLng + lngMargin, maxLat + latMargin],
    sw: [minLng - lngMargin, minLat - latMargin],
  }
}
