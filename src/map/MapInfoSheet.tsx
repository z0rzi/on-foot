import { ReactNode, useEffect } from 'react'
import { StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { SharedValue } from 'react-native-reanimated'
import { useTheme } from '../theme/useTheme'

const SNAP_POINTS = ['16%', '55%']

export function MapInfoSheet({
  animatedPosition,
  onIndexChange,
  children,
}: {
  animatedPosition?: SharedValue<number>
  onIndexChange?: (index: number) => void
  children: ReactNode
}) {
  const c = useTheme()
  // Outside gorhom's own reaction, this component is the app's only writer of animatedPosition, so
  // it leaves the "no sheet" value (0) behind when it goes rather than the last edge it reported.
  useEffect(() => () => {
    if (animatedPosition) animatedPosition.value = 0
  }, [animatedPosition])
  return (
    <BottomSheet
      index={0}
      snapPoints={SNAP_POINTS}
      // The snap points above are the whole contract; dynamic sizing (on by default in v5) would add
      // a content-derived one and let a content height change move the sheet on its own.
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      animatedPosition={animatedPosition}
      onChange={onIndexChange}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
      handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
    >
      <BottomSheetView style={styles.content}>{children}</BottomSheetView>
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
})
