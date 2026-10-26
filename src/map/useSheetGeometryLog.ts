import { useEffect } from 'react'
import { AppState, Dimensions } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'
import { runOnUISync } from 'react-native-worklets'
import { logEvent } from '../log'
import type { MapMode } from '../store/mapStore'

// FIELD-2: the sheet is sometimes left at the window height after the app is reopened, which drives
// graphBottom negative. The three shared values are read in one UI-thread call so they form one
// consistent snapshot.
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
      const geometry = runOnUISync(() => ({
        sheetTop: sheetTop.value,
        rootHeight: rootHeight.value,
        graphBottom: graphBottom.value,
      }))
      // The sheet's initial position is the window height, so sheetTop === windowHeight says the
      // sheet never left it rather than leaving the reader to infer it from the tab bar.
      logEvent('info', 'map', 'app active', {
        mode,
        windowHeight: Math.round(Dimensions.get('window').height),
        sheetTop: Math.round(geometry.sheetTop),
        rootHeight: Math.round(geometry.rootHeight),
        graphBottom: Math.round(geometry.graphBottom),
      })
    })
    return () => subscription.remove()
  }, [mode, sheetTop, rootHeight, graphBottom])
}
