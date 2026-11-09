export interface SheetBackState {
  open: boolean
  // Whether the screen hosting the sheet is the focused one; a sheet under a pushed screen stays
  // mounted and must leave back to that screen.
  focused: boolean
}

export function backDismissesSheet({ open, focused }: SheetBackState): boolean {
  return focused && open
}

// A modal sheet's open state from its onChange index, -1 once dismissed. Unlike the map sheet
// (`sheetIsOpen`), it has no collapsed position to tell from open: shown at all is open.
export function modalSheetOpen(index: number): boolean {
  return index >= 0
}
