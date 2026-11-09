import type { ElevationAxis } from './elevationAxis'
import { projectY, YScale } from './svg'

// Room over the highest point, so the peak is not flush against the plot's top edge.
const TOP_HEADROOM = 6
// Between a label's digits and its gridline.
const LABEL_GAP = 2
// A digit's height, as a share of the font size: what must fit between the gridline and the plot's edge.
const DIGIT_HEIGHT = 0.75

export interface AxisLabel {
  label: string
  // The gridline's pixel row in the plot.
  y: number
  // The label's text baseline, inside the plot at its left edge.
  baseline: number
}

export interface AxisLayout { y: YScale; labels: AxisLabel[] }

// Where the y-axis's gridlines and labels go in a plot `plotHeight` tall, high to low. The lowest point
// of the profile is the plot's bottom edge. Each label is drawn in the plot, just above its gridline,
// or just under it when the gridline is too near the top for the digits to fit above. A label whose
// digits would come within the gap of the label below is dropped, with its gridline.
export function axisLayout(axis: ElevationAxis, fontSize: number, plotHeight: number): AxisLayout {
  const y: YScale = { low: axis.low, high: axis.high, top: TOP_HEADROOM, bottom: plotHeight }
  const digits = DIGIT_HEIGHT * fontSize
  const labels: AxisLabel[] = []
  for (const t of axis.ticks) {
    const gridY = projectY(t.ele, y)
    const above = gridY - LABEL_GAP
    const baseline = above - digits >= 0 ? above : Math.min(gridY + LABEL_GAP + digits, plotHeight)
    const below = labels[0]
    if (below && baseline + LABEL_GAP > below.baseline - digits) continue
    labels.unshift({ label: t.label, y: gridY, baseline })
  }
  return { y, labels }
}
