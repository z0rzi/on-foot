import type { MapMode } from '../store/mapStore'
import { MapTokens } from '../theme/tokens'
import { sheetHeaderHeight } from './sheetHeader'

// Where the map card rests in a state: the nav card when nothing is shown and idle, which neither
// collapses nor opens; otherwise the graph card collapsed on its pip row, with the graph under it when
// the state has one.
export type SheetRestKind = 'nav' | 'graph'

export interface SheetRest {
  kind: SheetRestKind
  // The card's own height: gorhom's first snap point, measured from the card's bottom edge.
  height: number
  // From the window's bottom to the card's bottom edge: the side margin, the system inset lying inside
  // it, or the system inset when taller.
  bottomInset: number
  // From the window's bottom to the resting card's top edge: the region the camera keeps clear.
  covered: number
  // The nav row: the nav card itself, and the open graph card's footer, pinned under the details.
  navRowHeight: number
}

export function sheetRest({
  mode,
  graphShown,
  navRowHeight,
  systemInset,
}: {
  mode: MapMode
  // Whether the state has a profile to draw; the nav card never shows one.
  graphShown: boolean
  // The nav card is that row.
  navRowHeight: number
  // The system's bottom inset (gesture or button bar).
  systemInset: number
}): SheetRest {
  const bottomInset = Math.max(MapTokens.overlayPadding, systemInset)
  const nav = mode === 'free'
  const height = nav ? navRowHeight : sheetHeaderHeight(graphShown)
  return {
    kind: nav ? 'nav' : 'graph',
    height,
    bottomInset,
    covered: height + bottomInset,
    navRowHeight,
  }
}
