import { useEffect } from 'react'
import { AppState } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { logEvent } from '../log'
import type { MapMode } from '../store/mapStore'

// FIELD-2: the sheet is sometimes left at the window height after the app is reopened, which drives
// graphBottom negative. sheetTop is a shared value, so it is read here on the JS thread.
export function useSheetGeometryLog({
  mode,
  sheetTop,
  rootHeight,
  graphBottom,
}: {
  mode: MapMode
  sheetTop: SharedValue<number>
  rootHeight: SharedValue<number>
  graphBottom: SharedValue<number>
}) {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return
      logEvent('info', 'map', 'app active', {
        mode,
        sheetTop: Math.round(sheetTop.value),
        rootHeight: Math.round(rootHeight.value),
        graphBottom: Math.round(graphBottom.value),
      })
    })
    return () => subscription.remove()
  }, [mode, sheetTop, rootHeight, graphBottom])
}
