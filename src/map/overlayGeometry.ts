import { MapTokens } from '../theme/tokens'

// The card's live top edge: the height of the card's frame, and where the Map's overlays (controls
// column, record button) sit against it. Worklets: they run on the UI thread, frame by frame.

// The card's live height above a bottom edge, from its top in the same frame: above the root's
// bottom, its margin included, for the overlays; above gorhom's container, the card's own visible
// height, for its frame. sheetTop is 0 before the sheet has laid out, and at or past the bottom
// edge while parked at its pre-layout position or before the container has a height; none is an
// edge to ride, so all read as no card rather than pushing the overlays off the screen.
export function sheetHeightAbove(rootHeight: number, sheetTop: number): number {
  'worklet'
  return rootHeight === 0 || sheetTop === 0 || sheetTop >= rootHeight ? 0 : rootHeight - sheetTop
}

export function overlayBottom(sheetHeight: number): number {
  'worklet'
  return sheetHeight === 0 ? 0 : sheetHeight + MapTokens.overlaySheetGap
}

// Past half the screen the overlays would end up under the top pill, so they hide.
export function overlaysHidden(sheetHeight: number, rootHeight: number): boolean {
  'worklet'
  return sheetHeight > rootHeight / 2
}
