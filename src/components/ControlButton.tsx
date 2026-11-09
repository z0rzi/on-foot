import React, { forwardRef } from 'react'
import { Pressable, View, type ViewStyle } from 'react-native'
import { useTheme } from '../theme/useTheme'
import { MapTokens } from '../theme/tokens'

// Exported so the record button's animated, gesture-driven surface can wear it too — it is a
// GestureDetector-wrapped Animated.View, not a Pressable, so it cannot be a ControlButton.
export function controlSurfaceStyle(size: number = MapTokens.controlSize): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...MapTokens.controlShadow,
  }
}

const defaultSurface = controlSurfaceStyle()

// forwardRef so callers (e.g. MapControls wrapping this in a GestureDetector for the 2D/3D
// button's vertical-drag gesture) can attach a ref to the underlying native view.
export const ControlButton = forwardRef<View, {
  children: React.ReactNode
  onPress: () => void
  accessibilityLabel: string
  size?: number
}>(function ControlButton({ children, onPress, accessibilityLabel, size }, ref) {
  const c = useTheme()
  return (
    <Pressable
      ref={ref}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[size == null ? defaultSurface : controlSurfaceStyle(size), { backgroundColor: c.controlSurface }]}
    >
      <View>{children}</View>
    </Pressable>
  )
})
