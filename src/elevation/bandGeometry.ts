import { ElevationProfile, ElevationSample } from './profile'
import { SlopeBand } from './slope'

// Interpolate a full ElevationSample at a distance within one segment's ordered samples
// (clamped at the ends).
function interpSample(segSamples: ElevationSample[], distance: number): ElevationSample {
  const first = segSamples[0]
  if (distance <= first.distance) return first
  const last = segSamples[segSamples.length - 1]
  if (distance >= last.distance) return last
  for (let i = 1; i < segSamples.length; i++) {
    const a = segSamples[i - 1]
    const b = segSamples[i]
    if (distance <= b.distance) {
      const span = b.distance - a.distance
      if (span === 0) return b
      const t = (distance - a.distance) / span
      return {
        distance,
        ele: a.ele + (b.ele - a.ele) * t,
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
        segment: b.segment,
      }
    }
  }
  return last
}

// The band's samples within its OWN segment: an interpolated ElevationSample at band.start, the
// strictly-inner same-segment samples, and an interpolated ElevationSample at band.end. The
// band's segment is identified by its midpoint, since per-segment distance ranges touch only at
// endpoints.
export function bandSamples(profile: ElevationProfile, band: SlopeBand): ElevationSample[] {
  const bySegment = new Map<number, ElevationSample[]>()
  for (const s of profile.samples) {
    const list = bySegment.get(s.segment) ?? []
    list.push(s)
    bySegment.set(s.segment, list)
  }

  const segmentAt = (distance: number): number | null => {
    for (const [seg, list] of bySegment) {
      if (distance >= list[0].distance && distance <= list[list.length - 1].distance) return seg
    }
    return null
  }

  const seg = segmentAt((band.start + band.end) / 2)
  if (seg === null) return []
  const segSamples = bySegment.get(seg)!
  const inner = segSamples.filter((s) => s.distance > band.start && s.distance < band.end)
  return [interpSample(segSamples, band.start), ...inner, interpSample(segSamples, band.end)]
}
