import { ReactNode } from 'react'
import { StyleSheet } from 'react-native'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import type { SharedValue } from 'react-native-reanimated'
import { useTheme } from '../theme/useTheme'

const SNAP_POINTS = ['16%', '55%']

export function MapInfoSheet({
  animatedPosition,
  children,
}: {
  animatedPosition?: SharedValue<number>
  children: ReactNode
}) {
  const c = useTheme()
  return (
    <BottomSheet
      index={0}
      snapPoints={SNAP_POINTS}
      enablePanDownToClose={false}
      animatedPosition={animatedPosition}
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
