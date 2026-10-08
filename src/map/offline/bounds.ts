import { boundsForPoints, LngLatBounds } from '../geo'

const KM_PER_LAT_DEGREE = 111

const expand = (bounds: LngLatBounds, marginKm: number): LngLatBounds => {
  const [maxLng, maxLat] = bounds.ne
  const [minLng, minLat] = bounds.sw
  const latMargin = marginKm / KM_PER_LAT_DEGREE
  const midLat = (minLat + maxLat) / 2
  const lngMargin = marginKm / (KM_PER_LAT_DEGREE * Math.max(0.01, Math.cos((midLat * Math.PI) / 180)))
  return {
    ne: [maxLng + lngMargin, maxLat + latMargin],
    sw: [minLng - lngMargin, minLat - latMargin],
  }
}

export function boundsForTrail(
  points: { lat: number; lng: number }[],
  marginKm: number,
): LngLatBounds | null {
  const bounds = boundsForPoints(points)
  return bounds && expand(bounds, marginKm)
}
