import { haversineMeters } from '../data/geo/metrics'

export interface ElePoint { lat: number; lng: number; ele: number | null }
export interface ElevationSample { distance: number; ele: number; lat: number; lng: number; segment: number }
export interface ElevationProfile { samples: ElevationSample[]; minEle: number; maxEle: number; totalDistance: number }

export function buildElevationProfile(segments: ElePoint[][]): ElevationProfile | null {
  const samples: ElevationSample[] = []
  let cumulative = 0
  let minEle = Infinity
  let maxEle = -Infinity
  segments.forEach((segment, segmentIndex) => {
    for (let i = 0; i < segment.length; i++) {
      const point = segment[i]
      if (i > 0) {
        const prev = segment[i - 1]
        cumulative += haversineMeters(prev.lat, prev.lng, point.lat, point.lng)
      }
      if (point.ele === null) continue
      samples.push({ distance: cumulative, ele: point.ele, lat: point.lat, lng: point.lng, segment: segmentIndex })
      if (point.ele < minEle) minEle = point.ele
      if (point.ele > maxEle) maxEle = point.ele
    }
  })
  const totalDistance = samples.length ? samples[samples.length - 1].distance : 0
  // A single sample — or several taken without moving — plots nothing: no run spans two points, so
  // every band, area and line comes out empty. Returning a profile anyway makes callers reserve
  // graph height for a blank graph (the recording controls jump up on the first fix).
  if (samples.length < 2 || totalDistance <= 0) return null
  return { samples, minEle, maxEle, totalDistance }
}

export type GradeBand = 'steep' | 'rough' | 'uphill' | 'flat' | 'downhill'

export function gradeBand(gradePercent: number): GradeBand {
  if (gradePercent > 40) return 'steep'
  if (gradePercent > 12) return 'rough'
  if (gradePercent > 4) return 'uphill'
  if (gradePercent >= -4) return 'flat'
  return 'downhill'
}

export interface ScrubSample { ele: number; grade: number; lat: number; lng: number }

export function sampleAt(profile: ElevationProfile, distance: number): ScrubSample {
  const { samples } = profile
  const d = Math.max(0, Math.min(distance, profile.totalDistance))
  if (d <= samples[0].distance) {
    const s = samples[0]
    return { ele: s.ele, grade: 0, lat: s.lat, lng: s.lng }
  }
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    if (d <= b.distance) {
      const span = b.distance - a.distance
      if (span === 0) {
        // coincident samples: no span to interpolate over
        return { ele: b.ele, grade: 0, lat: b.lat, lng: b.lng }
      }
      const t = (d - a.distance) / span
      return {
        ele: a.ele + (b.ele - a.ele) * t,
        grade: ((b.ele - a.ele) / span) * 100,
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      }
    }
  }
  const last = samples[samples.length - 1]
  return { ele: last.ele, grade: 0, lat: last.lat, lng: last.lng }
}
