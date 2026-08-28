import { useCallback, useEffect, useState } from 'react'
import { BackHandler } from 'react-native'

// gorhom's BottomSheetModal (v5) renders through a JS portal, not a native Modal, so it does not
// intercept the Android hardware back button. Without this, back falls through to navigation and
// exits the app while a sheet is open. Registers a back handler that dismisses the open sheet and
// consumes the event; wire the returned handler to the modal's onChange prop.
export function useSheetBackDismiss(dismiss: () => void): (index: number) => void {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss()
      return true
    })
    return () => sub.remove()
  }, [open, dismiss])

  return useCallback((index: number) => setOpen(index >= 0), [])
}
