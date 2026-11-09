import { useCallback, useState } from 'react'
import { modalSheetOpen } from './sheetBack'
import { useBackDismiss } from './useBackDismiss'

// useBackDismiss for a modal sheet, open from its onChange index: wire the returned handler to the
// sheet's onChange prop.
export function useSheetBackDismiss(dismiss: () => void): (index: number) => void {
  const [index, setIndex] = useState(-1)
  useBackDismiss(dismiss, { open: modalSheetOpen(index) })
  return useCallback((next: number) => setIndex(next), [])
}
