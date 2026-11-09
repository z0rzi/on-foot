import { useState } from 'react'
import { runOnJS, useAnimatedReaction, type SharedValue } from 'react-native-reanimated'
import { sheetIsOpen } from './sheetIndex'

// The map sheet's open state, read from its live index on the UI thread and handed to JS only when it
// flips. gorhom's onAnimate / onChange are not a source for it: neither fires when a drag over-pulls
// past the open snap point, which leaves the sheet open on screen.
export function useSheetOpen(animatedIndex: SharedValue<number>): boolean {
  const [open, setOpen] = useState(false)
  useAnimatedReaction(
    () => sheetIsOpen(animatedIndex.value),
    (next, previous) => {
      if (next !== previous) runOnJS(setOpen)(next)
    },
  )
  return open
}
