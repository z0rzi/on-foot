// The elevation graph's fixed footprint: the plot. The scrub tooltip floats over its top.
export const GRAPH_HEIGHT = 62

// Whether a touch at y on the plot shows the scrub as it lands. A band at the plot's top may lie under
// the touch target of a control above it (the card's pip row): a touch there is a tap on that control
// unless it drags, so it shows the scrub only once the drag is claimed.
export function scrubShowsOnTouch(y: number, coveredTop: number): boolean {
  return y >= coveredTop
}
