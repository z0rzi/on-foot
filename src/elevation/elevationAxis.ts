import { formatElevation } from '../format/units'

export interface AxisTick { ele: number; label: string }

export interface ElevationAxis {
  // Round elevations inside the plotted range, low to high: one to three of them, a round step apart.
  ticks: AxisTick[]
  // The elevation range the plot spans: the profile's own, so its lowest point is the plot's floor.
  low: number
  high: number
}

// A flatter profile is drawn over this span around its middle, so a few metres of noise read as flat.
const MIN_SPAN = 10
const MAX_TICKS = 3
const MANTISSAS = [1, 2, 2.5, 5]
const MIN_STEP = 5

// The round steps from the smallest up: 5, 10, 20, 25, 50, 100, 200, 250, 500…
function* roundSteps(): Generator<number> {
  for (let decade = 1; ; decade *= 10) {
    for (const m of MANTISSAS) if (m * decade >= MIN_STEP) yield m * decade
  }
}

function multiplesWithin(step: number, low: number, high: number): number[] {
  const out: number[] = []
  for (let ele = Math.ceil(low / step) * step; ele <= high; ele += step) out.push(ele)
  return out
}

// The y-axis of a profile from `min` to `max` metres: the plot spans the profile, and the labels are
// the round numbers inside it at the finest round step that gives no more than three.
export function elevationAxis(min: number, max: number): ElevationAxis {
  const middle = (min + max) / 2
  const [low, high] = max - min < MIN_SPAN ? [middle - MIN_SPAN / 2, middle + MIN_SPAN / 2] : [min, max]
  let ticks: number[] = []
  for (const step of roundSteps()) {
    ticks = multiplesWithin(step, low, high)
    if (ticks.length <= MAX_TICKS) break
  }
  return { ticks: ticks.map((ele) => ({ ele, label: formatElevation(ele) })), low, high }
}
