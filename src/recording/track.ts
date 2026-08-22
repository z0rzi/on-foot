import { TrackPoint } from '../data/activities'

export interface DeviceLocation {
  coords: { latitude: number; longitude: number; altitude: number | null }
  timestamp: number
}

export function toTrackPoint(loc: DeviceLocation): TrackPoint {
  return {
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    ele: loc.coords.altitude,
    t: Math.round(loc.timestamp),
  }
}
