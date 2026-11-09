import { useEffect } from 'react'
import { BackHandler } from 'react-native'
import { backDismissesSheet } from './sheetBack'

// gorhom's sheets (v5) render in JS, not in a native Modal, so they do not intercept the Android
// hardware back button. Without this, back falls through to navigation and exits the app while a
// sheet is open. While the sheet is open (and its screen `focused`, for a sheet on a screen that
// stays mounted under pushed screens), registers a back handler that dismisses it and consumes the
// event.
export function useBackDismiss(
  dismiss: () => void,
  { open, focused = true }: { open: boolean; focused?: boolean },
): void {
  const consumes = backDismissesSheet({ open, focused })

  useEffect(() => {
    if (!consumes) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [consumes, dismiss])
}
