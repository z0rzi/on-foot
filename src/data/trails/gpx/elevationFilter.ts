export interface ElevationPoint { distance: number; ele: number }
export interface ElevationChange { gainMeters: number; lossMeters: number }

// A GPS altitude fix wanders by several metres, and the wander is correlated over minutes, so
// summing raw per-point deltas turns a flat walk into hundreds of metres of climb. Two stages
// tame it: an average over a window of travelled distance — the unit that makes the cutoff
// independent of how densely the source sampled — then a deadband that counts a reversal only
// once it is larger than what the residual noise can fake.
export const ELEVATION_SMOOTHING_WINDOW_METERS = 150
export const ELEVATION_DEADBAND_METERS = 3

export function smoothElevationSeries(samples: ElevationPoint[], windowMeters: number): number[] {
  if (windowMeters <= 0 || samples.length === 0) return samples.map((s) => s.ele)
  const half = windowMeters / 2
  const first = samples[0].distance
  const last = samples[samples.length - 1].distance
  const smoothed: number[] = []
  let lo = 0
  let hi = 0
  let sum = 0
  for (const sample of samples) {
    const centre = sample.distance
    // The window stays centred and never reaches past either end of the run, so the run keeps
    // its measured start and end elevations instead of being averaged toward its middle.
    const reach = Math.min(half, centre - first, last - centre)
    while (centre - samples[lo].distance > reach) sum -= samples[lo++].ele
    while (hi < samples.length && samples[hi].distance - centre <= reach) sum += samples[hi++].ele
    smoothed.push(sum / (hi - lo))
  }
  return smoothed
}

export function accumulateGainLoss(eles: number[], deadbandMeters: number): ElevationChange {
  let gainMeters = 0
  let lossMeters = 0
  if (eles.length === 0) return { gainMeters, lossMeters }
  // `reference` is the last elevation committed to the totals; `low`/`high` are the extremes seen
  // since, so a reversal is measured from the peak or valley it turned — including the very first
  // swing, before any direction is held. Committing resets all three to the current elevation.
  let reference = eles[0]
  let low = reference
  let high = reference
  let direction = 0
  for (const ele of eles) {
    if (direction > 0 && ele > reference) {
      gainMeters += ele - reference
    } else if (direction < 0 && ele < reference) {
      lossMeters += reference - ele
    } else if (ele - low >= deadbandMeters) {
      gainMeters += ele - low
      lossMeters += Math.max(0, reference - low)
      direction = 1
    } else if (high - ele >= deadbandMeters) {
      lossMeters += high - ele
      gainMeters += Math.max(0, high - reference)
      direction = -1
    } else {
      low = Math.min(low, ele)
      high = Math.max(high, ele)
      continue
    }
    reference = ele
    low = ele
    high = ele
  }
  return { gainMeters, lossMeters }
}

export function elevationChange(samples: ElevationPoint[]): ElevationChange {
  return accumulateGainLoss(
    smoothElevationSeries(samples, ELEVATION_SMOOTHING_WINDOW_METERS),
    ELEVATION_DEADBAND_METERS,
  )
}
