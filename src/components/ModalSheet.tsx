import React, { useCallback } from 'react'
import { StyleSheet, Text } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTheme } from '../theme/useTheme'
import { useSheetBackDismiss } from './useSheetBackDismiss'

// A modal sheet over the screen, as tall as its content, which scrolls past the room the screen
// leaves below the status bar: its backdrop, a swipe down or back closes it. Its holder presents it
// through the ref.
export function ModalSheet({
  ref,
  title,
  subtitle,
  children,
}: {
  ref: React.RefObject<BottomSheetModal | null>
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const c = useTheme()
  const insets = useSafeAreaInsets()
  const onChange = useSheetBackDismiss(useCallback(() => ref.current?.dismiss(), [ref]))
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  )

  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      backdropComponent={renderBackdrop}
      onChange={onChange}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
      handleIndicatorStyle={{ backgroundColor: c.onSurfaceVariant }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.panelContent }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: c.onSurfaceVariant }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  subtitle: { fontSize: 11, textAlign: 'center', marginBottom: 6 },
})
