import React, { forwardRef, useCallback, useMemo } from 'react'
import { Image, Pressable, StyleSheet, Text } from 'react-native'
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet'
import { useTheme } from '../theme/useTheme'
import { useMapCapabilities } from './provider'
import { useMapStore } from '../store/mapStore'

export const LayersSheet = forwardRef<BottomSheetModal>((_props, ref) => {
  const c = useTheme()
  const caps = useMapCapabilities()
  const setMapStyle = useMapStore((s) => s.setMapStyle)
  const snapPoints = useMemo(() => ['50%'], [])

  // Dim + tap-outside-to-close: tapping the backdrop dismisses the sheet (swipe-down still works).
  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  )

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: c.panelBackground }}
    >
      <BottomSheetView style={styles.content}>
        <Text style={[styles.title, { color: c.panelContent }]}>Map Layers</Text>
        {caps.styles.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.row, { borderColor: c.panelDivider }]}
            onPress={() => {
              setMapStyle(s.id)
              ;(ref as any)?.current?.dismiss()
            }}
          >
            <Image source={s.preview} style={styles.preview} resizeMode="cover" />
            <Text style={[styles.label, { color: c.panelContent }]}>{s.label}</Text>
          </Pressable>
        ))}
      </BottomSheetView>
    </BottomSheetModal>
  )
})
LayersSheet.displayName = 'LayersSheet'

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  title: { textAlign: 'center', fontWeight: 'bold', fontSize: 16, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', height: 84, borderWidth: 1, borderRadius: 10, marginBottom: 8, overflow: 'hidden' },
  preview: { width: 84, height: 84 },
  label: { marginLeft: 8, fontWeight: 'bold', fontSize: 14 },
})
