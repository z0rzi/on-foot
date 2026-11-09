import { useEffect } from 'react'
import { AppState, Dimensions } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { runOnUISync } from 'react-native-worklets'
import { logEvent } from '../log'
import type { MapMode } from '../store/mapStore'

// FIELD-2: the sheet is sometimes left at the window height after the app is reopened, which drives
// the sheet height to 0 and the overlays to the root's bottom. The three shared values are read in
// one UI-thread call so they form one consistent snapshot.
export function useSheetGeometryLog({
  mode,
  sheetTop,
  rootHeight,
  sheetHeight,
}: {
  mode: MapMode
  sheetTop: SharedValue<number>
  rootHeight: SharedValue<number>
  sheetHeight: SharedValue<number>
}) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      const geometry = runOnUISync(() => ({
        sheetTop: sheetTop.value,
        rootHeight: rootHeight.value,
        sheetHeight: sheetHeight.value,
      }))
      // sheetTop is 0 before the sheet has laid out; sheetTop === windowHeight says it is still
      // parked at its initial position, off the bottom of the window.
      logEvent('info', 'map', 'app active', {
        mode,
        windowHeight: Math.round(Dimensions.get('window').height),
        sheetTop: Math.round(geometry.sheetTop),
        rootHeight: Math.round(geometry.rootHeight),
        sheetHeight: Math.round(geometry.sheetHeight),
      })
    })
    return () => subscription.remove()
  }, [mode, sheetTop, rootHeight, sheetHeight])
}
