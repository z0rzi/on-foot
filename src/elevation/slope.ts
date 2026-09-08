import { smoothElevationSeries } from '../data/geo/elevationFilter'
import { ElevationProfile, ElevationSample, GradeBand, gradeBand } from './profile'

export function smoothProfile(profile: ElevationProfile, windowMeters: number): ElevationProfile {
  if (windowMeters <= 0) return profile
  const src = profile.samples
  const samples: ElevationSample[] = []
  for (const [lo, hi] of segmentRanges(src)) {
    smoothElevationSeries(src.slice(lo, hi + 1), windowMeters).forEach((ele, k) => {
      samples.push({ ...src[lo + k], ele })
    })
  }
  let minEle = Infinity
  let maxEle = -Infinity
  for (const s of samples) {
    if (s.ele < minEle) minEle = s.ele
    if (s.ele > maxEle) maxEle = s.ele
  }
  return { samples, minEle, maxEle, totalDistance: profile.totalDistance }
}

// Index bounds [lo, hi] of each run of samples sharing a segment. Nothing — a smoothing window,
// a slope run — may span two segments: the gap between them is ground that was never walked.
function segmentRanges(samples: ElevationSample[]): [number, number][] {
  const ranges: [number, number][] = []
  let i = 0
  while (i < samples.length) {
    let j = i
    while (j + 1 < samples.length && samples[j + 1].segment === samples[i].segment) j++
    ranges.push([i, j])
    i = j + 1
  }
  return ranges
}

export interface SlopeBand { start: number; end: number; band: GradeBand }

export interface DisplayBanding {
  smoothed: ElevationProfile
  bands: SlopeBand[]
}

// Slope banding for display, and the only place the smoothing preference is applied. That
// preference is a legibility control: it decides where colour bands begin and end, never what is
// drawn or stored. Callers plot the raw profile and take only the boundaries from here, and stored
// gain/loss uses the fixed window in data/geo/elevationFilter (enforced by architecture/importRules).
// One value drives both the averaging window and the minimum run length because both exist for the
// same reason — to stop the bands fragmenting into confetti.
export function displaySlopeBands(profile: ElevationProfile, smoothingMeters: number): DisplayBanding {
  const smoothed = smoothProfile(profile, smoothingMeters)
  return { smoothed, bands: slopeBands(smoothed, smoothingMeters) }
}

export function slopeBands(smoothed: ElevationProfile, minRunMeters: number): SlopeBand[] {
  const s = smoothed.samples
  const bands: SlopeBand[] = []
  for (const [lo, hi] of segmentRanges(s)) {
    const runs = segmentRuns(s, lo, hi)
    bands.push(...(minRunMeters <= 0 ? runs : dissolveShortRuns(runs, minRunMeters)))
  }
  return bands
}

// Coalesced slope runs within a single segment's sample slice [lo, hi].
function segmentRuns(samples: ElevationSample[], lo: number, hi: number): SlopeBand[] {
  const runs: SlopeBand[] = []
  for (let i = lo + 1; i <= hi; i++) {
    const a = samples[i - 1]
    const b = samples[i]
    const span = b.distance - a.distance
    if (span <= 0) continue
    const band = gradeBand(((b.ele - a.ele) / span) * 100)
    const last = runs[runs.length - 1]
    if (last && last.band === band && last.end === a.distance) last.end = b.distance
    else runs.push({ start: a.distance, end: b.distance, band })
  }
  return runs
}

function dissolveShortRuns(runs: SlopeBand[], minRunMeters: number): SlopeBand[] {
  let current = runs
  while (current.length > 1) {
    let idx = -1
    let shortest = Infinity
    for (let i = 0; i < current.length; i++) {
      const len = current[i].end - current[i].start
      if (len < minRunMeters && len < shortest) {
        shortest = len
        idx = i
      }
    }
    if (idx === -1) break
    const prev = current[idx - 1]
    const next = current[idx + 1]
    const target = !next || (prev && prev.end - prev.start >= next.end - next.start) ? prev : next
    if (target === prev) prev.end = current[idx].end
    else next.start = current[idx].start
    current = coalesce(current.filter((_, i) => i !== idx))
  }
  return current
}

function coalesce(runs: SlopeBand[]): SlopeBand[] {
  const out: SlopeBand[] = []
  for (const run of runs) {
    const last = out[out.length - 1]
    if (last && last.band === run.band && last.end === run.start) last.end = run.end
    else out.push({ ...run })
  }
  return out
}
