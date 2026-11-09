import type { SheetRest } from './sheetRest'

// How high up the window the open card's top may reach; details beyond it scroll.
const OPEN_TOP_MAX_RATIO = 0.8

export interface SheetMeasure {
  // The state's resting position: the first snap point.
  rest: SheetRest
  // The state's details as they lay out, unclipped.
  detailsHeight: number
  windowHeight: number
}

// Open, the card is its resting header (pip row, and graph when shown), the details and the pinned nav
// row. The nav card's open point only keeps the snap points one shape across states: nothing reaches it.
export function sheetSnapPoints({ rest, detailsHeight, windowHeight }: SheetMeasure): {
  rest: number
  open: number
} {
  const cap = windowHeight * OPEN_TOP_MAX_RATIO - rest.bottomInset
  const fitted = Math.min(rest.height + detailsHeight + rest.navRowHeight, cap)
  return { rest: rest.height, open: Math.max(fitted, rest.height + 1) }
}

// The open height in force: an open card never moves on its own, so a new measurement only applies
// while the card is collapsed and is taken up on the next opening.
export function appliedOpenHeight(applied: number, measured: number, collapsed: boolean): number {
  return collapsed ? measured : applied
}
