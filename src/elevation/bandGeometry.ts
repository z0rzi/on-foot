import { ElevationProfile, ElevationSample, GradeBand } from './profile'
import { SlopeBand } from './slope'

// Samples grouped by segment, each run still ordered by distance. Built once per call and shared by
// every band: rebuilding it per band made banding O(bands × samples).
function indexBySegment(profile: ElevationProfile): Map<number, ElevationSample[]> {
  const bySegment = new Map<number, ElevationSample[]>()
  for (const s of profile.samples) {
    const list = bySegment.get(s.segment)
    if (list) list.push(s)
    else bySegment.set(s.segment, [s])
  }
  return bySegment
}

// First index whose distance is >= `distance`, or samples.length when none is.
function lowerBound(samples: ElevationSample[], distance: number): number {
  let lo = 0
  let hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].distance < distance) lo = mid + 1
    else hi = mid
  }
  return lo
}

// First index whose distance is strictly greater than `distance`.
function upperBound(samples: ElevationSample[], distance: number): number {
  let lo = 0
  let hi = samples.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (samples[mid].distance <= distance) lo = mid + 1
    else hi = mid
  }
  return lo
}

// The sample at `distance`, interpolated between segSamples[hi - 1] and segSamples[hi] and clamped
// at both ends. `hi` is the bound the caller already computed, so this costs no further search.
function interpAt(segSamples: ElevationSample[], distance: number, hi: number): ElevationSample {
  if (hi <= 0) return segSamples[0]
  if (hi >= segSamples.length) return segSamples[segSamples.length - 1]
  const a = segSamples[hi - 1]
  const b = segSamples[hi]
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

// Each band's samples within its OWN segment: an interpolated sample at band.start, the strictly
// inner same-segment samples, and an interpolated sample at band.end. A band is placed by its
// midpoint, since per-segment distance ranges touch only at their endpoints.
export interface BandSamples {
  band: GradeBand
  samples: ElevationSample[]
}

export function samplesForBands(profile: ElevationProfile, bands: SlopeBand[]): BandSamples[] {
  const bySegment = indexBySegment(profile)
  const segmentFor = (distance: number): ElevationSample[] | null => {
    for (const list of bySegment.values()) {
      if (distance >= list[0].distance && distance <= list[list.length - 1].distance) return list
    }
    return null
  }
  return bands.map((band) => {
    const segSamples = segmentFor((band.start + band.end) / 2)
    if (!segSamples) return { band: band.band, samples: [] }
    const from = upperBound(segSamples, band.start)
    const to = lowerBound(segSamples, band.end)
    return {
      band: band.band,
      samples: [
        interpAt(segSamples, band.start, from),
        ...segSamples.slice(from, to),
        interpAt(segSamples, band.end, to),
      ],
    }
  })
}
