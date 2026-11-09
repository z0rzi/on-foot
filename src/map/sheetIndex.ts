// The snap points' indices, which gorhom's live `animatedIndex` interpolates between: the resting
// position (the collapsed graph card, or the nav card, which never leaves it) and open.
export const SHEET_COLLAPSED = 0
export const SHEET_OPEN = 1

// How far off its collapsed position the sheet still counts as collapsed, in index units: room for
// the float error of the position-to-index interpolation, not a gesture threshold.
const COLLAPSED_TOLERANCE = 0.01

// Whether the sheet is open, from its live index. Any position off the collapsed one counts as open,
// mid-drag, mid-animation and over-pulled past the open snap point alike, so everything that depends
// on open holds for as long as the sheet shows any of its open content. Unlike a modal sheet
// (`modalSheetOpen`), the map sheet is never dismissed: its lowest index is collapsed, not -1.
export function sheetIsOpen(index: number): boolean {
  'worklet'
  return index > SHEET_COLLAPSED + COLLAPSED_TOLERANCE
}
