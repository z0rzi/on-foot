import { GRAPH_HEIGHT } from '../elevation/graphGeometry'

// The pip, and the inset above and below it.
export const PIP_HEIGHT = 4
export const PIP_INSET = 8
const PIP_COMPACT_HEIGHT = PIP_INSET + PIP_HEIGHT + PIP_INSET
const PIP_TOUCH_HEIGHT = 44
// The card under the graph, so the plot never rests on the card's bottom edge and the open card's
// details start as far below it as they are from each other.
export const GRAPH_BOTTOM_GAP = 12

// The pip row's laid-out height, and how far its touch target reaches below it. Over a graph it is
// just room for the pip, its target reaching down over the graph's top; with nothing under it but the
// details, it is laid out as tall as its target.
export function pipRow(graphShown: boolean): { height: number; slop: number } {
  return graphShown
    ? { height: PIP_COMPACT_HEIGHT, slop: PIP_TOUCH_HEIGHT - PIP_COMPACT_HEIGHT }
    : { height: PIP_TOUCH_HEIGHT, slop: 0 }
}

// What the collapsed card shows: the pip row, and the graph and its gap under it when shown.
export function sheetHeaderHeight(graphShown: boolean): number {
  return pipRow(graphShown).height + (graphShown ? GRAPH_HEIGHT + GRAPH_BOTTOM_GAP : 0)
}
