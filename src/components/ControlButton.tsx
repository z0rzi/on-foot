import React, { forwardRef } from 'react'
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

// Exported so the record button's animated, gesture-driven surface can wear it too — it is a
// GestureDetector-wrapped Animated.View, not a Pressable, so it cannot be a ControlButton.
export const controlSurfaceStyle: ViewStyle = {
  width: MapTokens.controlSize,
  height: MapTokens.controlSize,
  borderRadius: MapTokens.controlSize / 2,
  alignItems: 'center',
  justifyContent: 'center',
  elevation: 4,
  shadowColor: '#000',
  shadowOpacity: 0.2,
  shadowRadius: 4,
  shadowOffset: { width: 0, height: 2 },
}

// forwardRef so callers (e.g. MapControls wrapping this in a GestureDetector for the 2D/3D
// button's vertical-drag gesture) can attach a ref to the underlying native view.
export const ControlButton = forwardRef<View, {
  children: React.ReactNode
  onPress: () => void
  accessibilityLabel: string
}>(function ControlButton({ children, onPress, accessibilityLabel }, ref) {
  const c = useTheme()
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[styles.btn, { backgroundColor: c.controlSurface }]}
    >
      <View>{children}</View>
    </Pressable>
  )
})

const styles = StyleSheet.create({
  btn: controlSurfaceStyle,
})
